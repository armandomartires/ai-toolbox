#!/usr/bin/env python3
"""
pm_collect.py — read the `project-workflow` corpus into one structured record
(S027.T001_BuildAgileDashboard).

## What this module IS

The collection half of the agile dashboard. It reads every artifact the
plan/develop/test/validate convention already mandates — task briefs, the
roadmap sprint table, the ad-hoc list, ADRs, review checkpoints, the audit log
and git history — and returns a single dict matching `.ai/dashboard/SCHEMA.md`
sections 1 and 3. It computes no metric; that is `pm_metrics.py`.

It reads **two corpus layouts** through two readers that return the same record
shape — `pm_corpus_sprint.py` (`S###.T###` briefs) and `pm_corpus_migration.py`
(`TASK-####` briefs) — so every metric and every chart downstream is written
once. Which layout a project uses is detected, never assumed (`detect_shape`).

Neither reader re-implements the pending/done classification: both call
`pm_briefs.classify_status`, which `task_queue.py` also calls, so there is one
implementation and the gate and the dashboard cannot drift on what "done" means.
`task_queue.py` itself is an **optional** import — see the note above it.

## The problem this module actually solves: there are no dates

A brief records no created or closed date. Nothing in the convention asks it to.
So every date here is *derived*, from four independent sources of differing
trustworthiness, and **the source is recorded alongside the date** — because the
alternative is a burn-down chart that looks authoritative and is partly fiction.

The precedence order differs between arrival and closure, and the difference is
not arbitrary:

- **Arrival** (`created_at`) prefers the git add date of the brief file. The
  convention says a brief is written *before* the work starts, so the commit
  that adds it is the moment that scope entered the project. Where git cannot
  say (see the floor below), the sprint's own hand-recorded date range in
  `30.ROADMAP.md` is better evidence than an audit-log entry, which records
  activity rather than arrival.
- **Closure** (`closed_at`) prefers the explicit `(YYYY-MM-DD)` many briefs
  carry in their `**Status**` line, then the latest audit-log entry naming the
  task, then the last commit to touch the brief.

## The git floor, and why a date can be a lower bound

A repository's history can begin after its work did. This one's begins at a
post-migration baseline commit, so 30-odd briefs that already existed at that
commit all report the same git add date — which is not evidence they arrived
that day. Any git date equal to the baseline is therefore marked
`*_floored: True` and ranked *below* the hand-recorded sources, and the
dashboard renders it as approximate rather than as an observation. This is the
same fail-honest discipline `task_queue.py` applies to a status it cannot read:
report the uncertainty, never resolve it by guessing.

Read-only against the entire repository. Stdlib only, Python-only per ADR-0003.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPTS_DIR.parents[1]

if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import pm_briefs  # noqa: E402  (path must be set first)
import pm_corpus_migration  # noqa: E402
import pm_corpus_sprint  # noqa: E402

# `task_queue.py` is this vault's readiness gate, and it is deliberately NOT a
# hard dependency: this module is vendored into other projects, which have no
# such file and no reason to carry a table of this vault's task ids. Where it is
# present its lane classification is used; where it is not, lanes are simply not
# reported. See ADR-0029 decision 6.
try:
    import task_queue  # noqa: E402
except ImportError:  # pragma: no cover - exercised by the vendored copy
    task_queue = None

SCHEMA_VERSION = 2
GENERATOR_VERSION = "2.0.0"

# The two corpus layouts this reader serves. Both are correct for the project
# that has them; see ADR-0029.
SHAPE_SPRINT_BRIEF = "sprint_brief"     # S###_Sprint.T###_Name.md
SHAPE_NUMBERED_TASK = "numbered_task"   # TASK-####-slug.md

TASK_ID_RE = re.compile(r"\bS(\d{3})\.T(\d{3})\b")
DATE_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")
PARTIAL_DATE_RE = re.compile(r"(?:→|->|–|—)\s*(\d{2})-(\d{2})\b")
HEX_IN_TICKS_RE = re.compile(r"`([0-9a-f]{7,40})`")
HEX_BARE_RE = re.compile(r"\b([0-9a-f]{7,40})\b")
SPRINT_LABEL_RE = re.compile(r"S(\d{3})_([A-Za-z0-9]+)")
LOG_ENTRY_RE = re.compile(r"^##\s*\[(\d{4}-\d{2}-\d{2})\]\s*(\S+)\s*\|\s*(.*)$")
ADR_FILE_RE = re.compile(r"^(\d{4})-(.+)\.md$")
ADHOC_ITEM_RE = re.compile(r"^###\s+(\d+)\.\s+(.*)$")
ADHOC_SECTION_RE = re.compile(r"^##\s+(Open|Resolved)\s*$", re.IGNORECASE)
FILENAME_DATE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})-")

# `**Found during**: restoring ad-hoc item 10's provider blocks (2026-09-28),`
FOUND_DURING_RE = re.compile(r"\*\*Found during\*\*:(.*?)(?:\n\n|\Z)", re.DOTALL)

# Where an audit log might live. Ordered by specificity; the first that exists
# wins, and which one it was is recorded in `project.log_path` so a reader is
# never left guessing which file the activity series came from.
LOG_CANDIDATES = (
    "6.LLMWIKI/log.md",
    "docs/log.md",
    "CHANGELOG.md",
)

# Commit path -> area bucket, first match wins. The buckets are a closed set so
# the front end can colour-code them (SCHEMA.md section 1.10).
AREA_RULES = (
    (".ai/scripts/", "scripts"),
    (".ai/tests/", "tests"),
    (".ai/workflow/", "workflow"),
    (".ai/dashboard/", "scripts"),
    (".ai/orchestrator/", "agent-config"),
    (".ai/config/", "agent-config"),
    (".ai/docs/", "docs"),
    (".ai/prompts/", "docs"),
    ("docs/", "docs"),
    (".claude/", "agent-config"),
    (".agents/", "agent-config"),
    (".opencode/", "agent-config"),
    (".obsidian/", "agent-config"),
    ("6.LLMWIKI/", "wiki"),
)

PENDING_STATE_RULES = (
    # Checked in order against the lowercased status text. "blocked" is tested
    # before "not started" because five briefs are written
    # `not started | **blocked on \`S017.T006\`**` — the blocker is the
    # informative half, and reporting those as merely not-started would hide
    # every real dependency stall on the board.
    ("blocked", "blocked"),
    ("in progress", "in_progress"),
    ("not started", "not_started"),
)


# ---------------------------------------------------------------------------
# small helpers
# ---------------------------------------------------------------------------


# The root every emitted path is reported relative to. Module-level because a
# dozen collectors call `_rel` and threading a base argument through all of them
# would be noise; `collect()` sets it once. It matters because the tool now runs
# against a project that is not this repository, and AGENTS.md's no-absolute-
# paths rule is not satisfied by a path that is merely relative to the wrong
# thing — it would break on every other machine exactly as an absolute one does.
_REL_BASE = REPO_ROOT


def _rel(path):
    """Root-relative POSIX path, falling back to absolute for a path outside."""
    try:
        return str(Path(path).resolve().relative_to(_REL_BASE)).replace("\\", "/")
    except ValueError:
        return str(path).replace("\\", "/")


def _read(path):
    """Read a text file, never raising. Returns "" on any failure.

    A corpus file that cannot be read is a defect to report, not a reason to
    abandon the whole run - the other 117 briefs are still worth reading.
    """
    try:
        return Path(path).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def _header_field(text, label, window=20):
    """Return the text after `**<label>**:` from the file's header, or None."""
    prefix = "**%s**:" % label
    for line in text.splitlines()[:window]:
        if line.startswith(prefix):
            return line[len(prefix):].strip()
    return None


def _first_heading(text):
    for line in text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return None


def _section(text, heading):
    """The body of a `## <heading>` section, up to the next `## `."""
    lines = text.splitlines()
    out, inside = [], False
    for line in lines:
        if line.startswith("## "):
            if inside:
                break
            inside = line[3:].strip().lower() == heading.lower()
            continue
        if inside:
            out.append(line)
    return "\n".join(out).strip()


def _collapse(text, limit=None):
    out = re.sub(r"\s+", " ", (text or "")).strip()
    if limit and len(out) > limit:
        out = out[: limit - 1].rstrip() + "…"
    return out


def _de_camel(name):
    out = re.sub(r"[_-]+", " ", name or "")
    out = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", out)
    out = re.sub(r"([A-Za-z])(\d)", r"\1 \2", out)
    return re.sub(r"\s+", " ", out).strip()


def _quintiles(values):
    """Cut points for 5 buckets over `values`. Used only for the size proxy."""
    ordered = sorted(v for v in values if v is not None)
    if not ordered:
        return []
    return [ordered[min(len(ordered) - 1, int(len(ordered) * q / 5))] for q in (1, 2, 3, 4)]


def _bucket(value, cuts):
    if value is None or not cuts:
        return None
    for i, cut in enumerate(cuts):
        if value <= cut:
            return i + 1
    return len(cuts) + 1


def date_ref(prefix, value, source, floored=False):
    """Build the three sibling keys of a DateRef (SCHEMA.md section 1.2)."""
    return {
        prefix: value,
        prefix + "_source": source if value else "unknown",
        prefix + "_floored": bool(floored) if value else False,
    }


# ---------------------------------------------------------------------------
# git
# ---------------------------------------------------------------------------


class Git:
    """Everything this collector needs from git, in three subprocess calls.

    Deliberately not one call per file: resolving 118 brief dates with
    `git log -- <file>` is 118 process spawns and several seconds on Windows.
    One whole-history pass builds the same two maps.

    Rename caveat, recorded rather than hidden: `--name-only` reports the path
    as it was at that commit and rename detection is off, so a brief that was
    renamed has its `git_added` date at the rename, not at its original
    creation. For this corpus that never happens (the task-id filename is
    chosen once), but a project where it does will see a later arrival date,
    and the recorded source lets a reader see it came from git.
    """

    def __init__(self, root, enabled=True):
        self.root = Path(root)
        self.available = False
        self.baseline = None          # {date, hash, subject}
        self.commits = []             # newest first, SCHEMA.md section 1.10
        self.added = {}               # path -> earliest add date
        self.touched = {}             # path -> latest touch date
        # `enabled=False` is the `--no-git` path: it makes the generator behave
        # as it does in a directory that was copied rather than cloned, which is
        # the only way to exercise that degradation on a machine where git
        # works. The degradation must be announced, never silent — see the
        # provenance note built in `build_provenance`.
        self.enabled = enabled
        if enabled:
            self._load()

    def _run(self, args):
        try:
            proc = subprocess.run(
                ["git", "-C", str(self.root)] + args,
                capture_output=True, text=True, encoding="utf-8",
                errors="replace", timeout=120,
            )
        except (OSError, subprocess.SubprocessError):
            return None
        if proc.returncode != 0:
            return None
        return proc.stdout

    def _load(self):
        if self._run(["rev-parse", "--git-dir"]) is None:
            return
        self.available = True
        self._load_baseline()
        self._load_commits()
        self._load_adds()

    def _load_baseline(self):
        out = self._run([
            "log", "--reverse", "--date=short", "--format=%H\x1f%ad\x1f%s",
        ])
        if not out:
            return
        first = out.splitlines()[0] if out.splitlines() else ""
        parts = first.split("\x1f")
        if len(parts) >= 3:
            self.baseline = {
                "available": True,
                "hash": parts[0][:7],
                "date": parts[1],
                "subject": _collapse(parts[2], 120),
                "note": (
                    "Git history in this repository begins here. Work done "
                    "before this commit has no git date, so a git-derived date "
                    "equal to it is a lower bound, not an observation."
                ),
            }

    def _load_commits(self):
        out = self._run([
            "log", "--numstat", "--date=short", "--no-merges",
            "--format=\x01%H\x1f%ad\x1f%an\x1f%s",
        ])
        if out is None:
            return
        current = None
        for line in out.splitlines():
            if line.startswith("\x01"):
                if current:
                    self._finish_commit(current)
                parts = line[1:].split("\x1f")
                if len(parts) < 4:
                    current = None
                    continue
                current = {
                    "hash": parts[0][:7],
                    "full_hash": parts[0],
                    "date": parts[1],
                    "author": parts[2],
                    "subject": _collapse(parts[3], 200),
                    "files": 0,
                    "insertions": 0,
                    "deletions": 0,
                    "_areas": set(),
                    # Both id styles, because a commit subject is the one place
                    # either layout's ids appear and the collector does not know
                    # which corpus it is reading until later.
                    "task_ids": sorted(
                        {
                            "S%s.T%s" % (m.group(1), m.group(2))
                            for m in TASK_ID_RE.finditer(parts[3])
                        }
                        | {
                            "TASK-%s" % m.group(1)
                            for m in pm_corpus_migration.TASK_ID_RE.finditer(parts[3])
                        }
                    ),
                }
                continue
            if current is None or not line.strip():
                continue
            cols = line.split("\t")
            if len(cols) != 3:
                continue
            ins, dele, path = cols
            current["files"] += 1
            # A binary file's numstat columns are "-", not a count.
            if ins.isdigit():
                current["insertions"] += int(ins)
            if dele.isdigit():
                current["deletions"] += int(dele)
            current["_areas"].add(area_for(path))
            # Newest-first order means the FIRST time a path appears is its
            # most recent touch.
            self.touched.setdefault(path, current["date"])
        if current:
            self._finish_commit(current)

    def _finish_commit(self, commit):
        commit["areas"] = sorted(commit.pop("_areas"))
        commit.pop("full_hash", None)
        self.commits.append(commit)

    def _load_adds(self):
        # `--root` so a file first added in the initial commit is recorded.
        # Without it, a repo whose history starts with a bulk import reports no
        # add date at all for most of its corpus.
        out = self._run([
            "log", "--root", "--diff-filter=A", "--name-only", "--date=short",
            "--format=\x01%ad",
        ])
        if out is None:
            return
        date = None
        for line in out.splitlines():
            if line.startswith("\x01"):
                date = line[1:].strip()
                continue
            path = line.strip()
            if not path or date is None:
                continue
            # Newest-first, so keep overwriting: the LAST add recorded for a
            # path is its earliest one.
            self.added[path] = date

    def added_date(self, path):
        return self.added.get(_rel(path))

    def touched_date(self, path):
        return self.touched.get(_rel(path))

    def is_floored(self, date):
        return bool(self.baseline and date and date == self.baseline["date"])


def area_for(path):
    normalised = path.replace("\\", "/")
    for prefix, area in AREA_RULES:
        if normalised.startswith(prefix):
            return area
    if normalised.endswith(".md") and "/" not in normalised:
        return "docs"
    return "other"


# ---------------------------------------------------------------------------
# corpus location
# ---------------------------------------------------------------------------


def locate_corpus(root=None):
    """Find the workflow directory, whichever layout this project uses.

    Three layouts exist in the wild and all three are correct for the project
    that has them: `.ai/workflow/` (this repo, which nests one level deeper
    because `.ai/` already holds five siblings), `.ai/` (what the
    `project-workflow` skill scaffolds as of its 2.0.0), and `docs/ai/` (what
    it scaffolded before that). Detect by looking for the tasks directory
    rather than by assuming, so the tool works unchanged in all three.
    """
    base = Path(root or REPO_ROOT)
    for candidate in (base / ".ai" / "workflow", base / ".ai", base / "docs" / "ai"):
        if (candidate / "tasks").is_dir():
            return candidate
    # The root may *be* the corpus. That is how a caller points the tool at a
    # bare fixture, and how a project that keeps its corpus somewhere this list
    # does not guess can still be read with `--root <that directory>`. Checked
    # last so a real project layout always wins over a stray `tasks/` at the
    # repository root.
    if (base / "tasks").is_dir():
        return base
    return base / ".ai" / "workflow"


def _is_own_corpus(tasks_dir):
    """Whether this is the repository `task_queue.py` was written about.

    Compared by resolved path rather than by "is task_queue importable": the
    module is importable whenever the tool runs from this checkout, including
    when it has been pointed at somebody else's project with `--root`.
    """
    if task_queue is None:
        return False
    try:
        return Path(tasks_dir).resolve() == Path(task_queue.TASKS_DIR).resolve()
    except OSError:
        return False


def detect_shape(workflow_dir):
    """Which of the two task layouts this corpus uses.

    Decided by what the briefs are actually named, not by which directories
    exist. A `planning/` directory is the numbered-task layout's strongest
    structural signal, but it is not sufficient on its own: a project may add
    one to either layout, and the filenames are what the readers actually parse.
    So the filename census wins wherever it is decisive, and `planning/` only
    breaks a tie — which is the honest ordering, since a reader that guesses
    wrong produces zero tasks rather than an error.
    """
    tasks_dir = Path(workflow_dir) / "tasks"
    sprint_briefs = numbered = 0
    if tasks_dir.is_dir():
        for path in tasks_dir.glob("*.md"):
            if pm_corpus_sprint.FILENAME_RE.match(path.name):
                sprint_briefs += 1
            elif pm_corpus_migration.TASK_ID_RE.search(path.name):
                numbered += 1
    if sprint_briefs or numbered:
        return SHAPE_SPRINT_BRIEF if sprint_briefs >= numbered else SHAPE_NUMBERED_TASK
    if (Path(workflow_dir) / "planning").is_dir():
        return SHAPE_NUMBERED_TASK
    return SHAPE_SPRINT_BRIEF


def locate_log(root=None):
    base = Path(root or REPO_ROOT)
    for rel in LOG_CANDIDATES:
        path = base / rel
        if path.is_file():
            return path
    return None


# ---------------------------------------------------------------------------
# audit log
# ---------------------------------------------------------------------------


def parse_log(path):
    """Parse `## [YYYY-MM-DD] type | description` entries, in file order."""
    if not path or not Path(path).is_file():
        return []
    entries = []
    current = None
    for line in _read(path).splitlines():
        match = LOG_ENTRY_RE.match(line)
        if match:
            if current:
                entries.append(current)
            current = {
                "date": match.group(1),
                "type": match.group(2).strip().lower(),
                "_body": [match.group(3)],
            }
            continue
        if current is not None:
            if line.startswith("## "):
                entries.append(current)
                current = None
            elif line.strip():
                # The format asks for one line per entry, but a wrapped
                # continuation is common enough that dropping it would lose
                # most of several entries' text.
                current["_body"].append(line.strip())
    if current:
        entries.append(current)

    out = []
    for entry in entries:
        body = " ".join(entry.pop("_body"))
        entry["chars"] = len(body)
        entry["description"] = _collapse(body, 300)
        entry["task_ids"] = sorted({
            "S%s.T%s" % (m.group(1), m.group(2)) for m in TASK_ID_RE.finditer(body)
        })
        entry["_full"] = body
        out.append(entry)
    return out


def commit_dates_by_task(commits):
    """task_id -> sorted dates of every commit whose subject names it.

    The weaker half of closure dating for the numbered-task layout: a brief that
    records its own commit hashes gives an exact date, and this is the fallback
    for one that does not.
    """
    index = {}
    for commit in commits:
        for tid in commit.get("task_ids") or []:
            index.setdefault(tid, []).append(commit["date"])
    for tid in index:
        index[tid] = sorted(index[tid])
    return index


def log_dates_by_task(log_entries):
    """task_id -> sorted list of dates of every entry naming it."""
    index = {}
    for entry in log_entries:
        for tid in entry["task_ids"]:
            index.setdefault(tid, []).append(entry["date"])
    for tid in index:
        index[tid] = sorted(index[tid])
    return index


#     `ad-hoc item 31`, `items 2 and 3`, `items 17/23/28`, `items 17, 23`
# All four forms appear in the live log, so a single-number pattern silently
# misses every resolution recorded as a list - which showed up as five resolved
# items apparently having no audit-trail entry at all.
ADHOC_MENTION_RE = re.compile(
    r"\bitems?\s+(\d{1,3}(?:\s*(?:,|/|&|and)\s*\d{1,3})*)", re.IGNORECASE
)


def log_dates_by_adhoc(log_entries):
    """ad-hoc item number -> sorted dates of entries naming it.

    The word boundary on each number matters: without it, a mention of item 3
    would also credit item 31.
    """
    index = {}
    for entry in log_entries:
        for match in ADHOC_MENTION_RE.finditer(entry["_full"]):
            for number in re.findall(r"\d{1,3}", match.group(1)):
                index.setdefault(int(number), []).append(entry["date"])
    for number in index:
        index[number] = sorted(index[number])
    return index


# ---------------------------------------------------------------------------
# roadmap sprint table
# ---------------------------------------------------------------------------


def parse_sprint_table(workflow_dir):
    """Parse `30.ROADMAP.md`'s sprint-history table into {sprint_id: row}.

    The table is hand-maintained prose with a free-text dates cell, so the
    parse is deliberately forgiving: it takes the first full date it finds as
    the start, a second full date or a `-> MM-DD` partial as the end, and the
    word "ongoing" as an open end. A row it cannot read at all is skipped and
    reported, never guessed at.
    """
    path = Path(workflow_dir) / "30.ROADMAP.md"
    rows, defects = {}, []
    if not path.is_file():
        return rows, defects

    for line in _read(path).splitlines():
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 2:
            continue
        label_match = SPRINT_LABEL_RE.search(cells[0])
        if not label_match:
            continue
        sprint_id = "S" + label_match.group(1)
        dates_cell = cells[1] if len(cells) > 1 else ""
        theme = cells[3] if len(cells) > 3 else (cells[-1] if len(cells) > 2 else "")

        found = DATE_RE.findall(dates_cell)
        start = found[0] if found else None
        end = None
        ongoing = "ongoing" in dates_cell.lower()
        if len(found) > 1:
            end = found[1]
        elif start:
            partial = PARTIAL_DATE_RE.search(dates_cell)
            if partial:
                end = "%s-%s-%s" % (start[:4], partial.group(1), partial.group(2))
            elif not ongoing:
                end = start
        if not start:
            defects.append(
                "%s: roadmap sprint row has no resolvable date (%r)"
                % (sprint_id, _collapse(dates_cell, 60))
            )

        rows[sprint_id] = {
            "id": sprint_id,
            "name": label_match.group(2),
            "label": "%s_%s" % (sprint_id, label_match.group(2)),
            "roadmap_dates": _collapse(dates_cell, 80),
            "theme": _collapse(theme, 600),
            "start": start,
            "end": None if ongoing else end,
            "ongoing": ongoing,
        }
    return rows, defects


# ---------------------------------------------------------------------------
# task briefs
# ---------------------------------------------------------------------------


def _workflow_state(state, status_raw):
    if state in ("done", "unparseable"):
        return state
    text = (status_raw or "").lower()
    for needle, value in PENDING_STATE_RULES:
        if needle in text:
            return value
    return "not_started"


def _parse_commits_field(raw):
    if not raw:
        return []
    ticked = HEX_IN_TICKS_RE.findall(raw)
    if ticked:
        return sorted(set(ticked))
    # No backticks: fall back to bare hex runs, but only ones long enough to be
    # a real abbreviated hash. `N/A - no git history exists` yields nothing,
    # which is the correct answer for the 9 retroactive briefs that say it.
    return sorted(set(HEX_BARE_RE.findall(raw)))


def _resolve_created(path, git, log_dates, sprint_row, created_raw=None):
    """Arrival date, in the precedence order argued in the module docstring.

    `**Created**:` outranks git where a brief carries one. Most briefs in this
    layout do not — the template asks for no such field — but the skill's own
    fixture does, and a hand-recorded date is better evidence than the commit
    that happened to add the file. Found by running against that fixture, where
    every date was otherwise falling through to the filesystem mtime.
    """
    if created_raw:
        match = DATE_RE.search(created_raw)
        if match:
            return match.group(1), "created_field", False

    added = git.added_date(path) if git.available else None
    if added and not git.is_floored(added):
        return added, "git_added", False
    if sprint_row and sprint_row.get("start"):
        return sprint_row["start"], "roadmap_sprint", False
    if log_dates:
        return log_dates[0], "log_md", False
    if added:
        return added, "git_added", True
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return None, "unknown", False
    import datetime

    return (
        datetime.date.fromtimestamp(mtime).isoformat(),
        "file_mtime",
        False,
    )


def _resolve_closed(path, git, log_dates, sprint_row, status_raw, state,
                    updated_raw=None):
    """Closure date. Only ever set for a task classified done."""
    if state != "done":
        return None, "unknown", False
    explicit = DATE_RE.search(status_raw or "")
    if explicit:
        return explicit.group(1), "status_line", False
    if log_dates:
        return log_dates[-1], "log_md", False
    touched = git.touched_date(path) if git.available else None
    if touched and not git.is_floored(touched):
        return touched, "git_last", False
    # Below both git sources deliberately: `**Updated**` means "last touched",
    # not "closed", and it moves whenever anyone edits the file. Above the
    # sprint window, because it is at least about this brief.
    if updated_raw:
        match = DATE_RE.search(updated_raw)
        if match:
            return match.group(1), "updated_field", False
    if sprint_row and sprint_row.get("end"):
        return sprint_row["end"], "roadmap_sprint", False
    if touched:
        return touched, "git_last", True
    return None, "unknown", False


def _resolve_created_numbered(rec, path, git, log_dates):
    """Arrival date for a numbered-task brief.

    The `- Created:` field outranks git here, the reverse of the sprint-brief
    layout's precedence, and the reason is that the field exists. That layout
    has no created field at all, so the commit that added the brief is the best
    available evidence; this one asks the author to record the date, and a
    hand-recorded date beats an inferred one. Where it is absent, the same git
    chain applies underneath.
    """
    if rec.created_raw:
        match = DATE_RE.search(rec.created_raw)
        if match:
            return match.group(1), "created_field", False

    added = git.added_date(path) if git.available else None
    if added and not git.is_floored(added):
        return added, "git_added", False
    if log_dates:
        return log_dates[0], "log_md", False
    if added:
        return added, "git_added", True
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return None, "unknown", False
    import datetime

    return datetime.date.fromtimestamp(mtime).isoformat(), "file_mtime", False


def _resolve_closed_numbered(rec, path, git, commit_dates, subject_dates, log_dates):
    """Closure date for a numbered-task brief, best evidence first.

    A recorded commit hash is the strongest: it is a fact about history rather
    than a field someone remembered to update. A commit whose *subject* names
    the task is next. Only then the `- Updated:` field, which is editable, is
    edited for reasons unrelated to closure, and is what the retired tool fell
    back to for everything.
    """
    if rec.state != "done":
        return None, "unknown", False

    dated = [commit_dates[h] for h in rec.commits if h in commit_dates]
    if dated:
        return max(dated), "commit_hash", False
    if subject_dates:
        return subject_dates[-1], "git_last", False
    if rec.updated_raw:
        match = DATE_RE.search(rec.updated_raw)
        if match:
            return match.group(1), "updated_field", False
    if log_dates:
        return log_dates[-1], "log_md", False

    touched = git.touched_date(path) if git.available else None
    if touched and not git.is_floored(touched):
        return touched, "git_last", False
    if touched:
        return touched, "git_last", True
    return None, "unknown", False


def effective_dependencies(rec, text):
    """The edges that are really dependencies, plus the ones deliberately dropped.

    `task_queue.py` unions the `**Depends on**` field with any task id appearing
    in the `**Status**` line, and its docstring gives the reason: five briefs
    record their real blocker only in the status line, so parsing the field
    alone would report a blocked task as ready. For a *readiness* question that
    over-read is free — an extra edge to an already-closed task cannot block
    anything.

    For a *graph* it is not free. A closed brief's status line is written after
    the fact and routinely names what comes next ("Ready for `S015.T010`"),
    which becomes a backwards edge and, against the real forward edge, a
    two-node cycle. Three such false cycles exist in this corpus right now, and
    reporting them as "this work can never start" would be the kind of false
    alarm that teaches a reader to skip the risk register.

    So the rule is: the `**Depends on**` field is always authoritative, and
    status-line ids count only for a task that is still pending — a finished
    task has no blockers by definition. Dropped ids are returned rather than
    discarded, so the count can be reported instead of vanishing.
    """
    hard = []
    depends_raw = _header_field(text, "Depends on")
    if depends_raw:
        # The field is prose, and a field that opens by declaring no dependency
        # is taken at its word even when it goes on to name other tasks - which
        # it often does, as a *successor* or a peer:
        #   "nothing mechanically; pairs with `S019.T002`."
        #   "nothing. **Must precede `S022.T003`**"
        # Harvesting ids past that declaration inverted both of those into
        # dependencies and produced two more false cycles. The "declares none"
        # vocabulary is shared rather than restated here, so the reader and the
        # gate cannot drift on what "no dependency" looks like.
        lowered = depends_raw.strip().lower()
        declares_none = any(
            lowered.startswith(p) for p in pm_briefs.NO_DEPENDENCY_PREFIXES
        )
        if not declares_none:
            for match in TASK_ID_RE.finditer(depends_raw):
                tid = "S%s.T%s" % (match.group(1), match.group(2))
                if tid not in hard and tid != rec.task_id:
                    hard.append(tid)

    if rec.state == "pending":
        effective = list(hard)
        for tid in rec.depends_on:
            if tid not in effective and tid != rec.task_id:
                effective.append(tid)
        return effective, []

    dropped = [t for t in rec.depends_on if t not in hard and t != rec.task_id]
    return hard, dropped


def collect_tasks(workflow_dir, git, log_entries, sprint_rows, shape=SHAPE_SPRINT_BRIEF,
                  repo_root=None):
    """Every brief, with dates resolved and provenance recorded.

    Both layouts land in the same record shape here, so everything downstream —
    every metric, every chart — is written once. What differs is only which
    reader produced the record and which evidence dates it.
    """
    repo_root = Path(repo_root) if repo_root else REPO_ROOT
    tasks_dir = Path(workflow_dir) / "tasks"
    numbered = shape == SHAPE_NUMBERED_TASK

    if not tasks_dir.is_dir():
        records, status = {}, {"defects": [], "ready": []}
    elif numbered:
        records = pm_corpus_migration.load_corpus(tasks_dir, workflow_dir)
        status = pm_corpus_migration.build_status(records)
    elif task_queue is not None and _is_own_corpus(tasks_dir):
        # Only for THIS repository's own corpus. `task_queue` owns the execution
        # lane, and `LANES` is a table of this vault's task ids — applied to
        # another project it reports every pending task as "no lane assigned",
        # which is a defect about a policy that project does not have. Found by
        # running against the skill's own fixture, which produced two such
        # defects and would have failed `--check` for every consumer.
        records = task_queue.load_corpus(tasks_dir)
        status = task_queue.build_status(records)
    else:
        records = pm_corpus_sprint.load_corpus(
            tasks_dir, rel_to=repo_root, default_lane=pm_corpus_migration.DEFAULT_LANE
        )
        status = pm_corpus_sprint.build_status(records)

    by_task = log_dates_by_task(log_entries)
    by_subject = commit_dates_by_task(git.commits)
    commit_dates = {}
    for commit in git.commits:
        commit_dates[commit["hash"]] = commit["date"]

    out = []
    for tid in sorted(records):
        rec = records[tid]
        path = repo_root / rec.path if not Path(rec.path).is_absolute() else Path(rec.path)
        if not path.is_file():
            path = tasks_dir / Path(rec.path).name
        text = _read(path)

        sprint_id = rec.sprint_id if numbered else "S" + tid[1:4]
        sprint_row = sprint_rows.get(sprint_id)
        log_dates = by_task.get(tid, [])

        if numbered:
            created, created_src, created_floored = _resolve_created_numbered(
                rec, path, git, log_dates
            )
            closed, closed_src, closed_floored = _resolve_closed_numbered(
                rec, path, git, commit_dates, by_subject.get(tid, []), log_dates
            )
            commits = list(rec.commits)
            points = rec.points
        else:
            created, created_src, created_floored = _resolve_created(
                path, git, log_dates, sprint_row, _header_field(text, "Created")
            )
            closed, closed_src, closed_floored = _resolve_closed(
                path, git, log_dates, sprint_row, rec.status_raw, rec.state,
                _header_field(text, "Updated")
            )
            commits = _parse_commits_field(_header_field(text, "Commits"))
            points_raw = _header_field(text, "Points")
            points = None
            if points_raw:
                number = re.search(r"\d+(?:\.\d+)?", points_raw)
                if number:
                    points = float(number.group(0))
                    if points.is_integer():
                        points = int(points)

        # Lead time starts at the earliest evidence of the work existing at
        # all, which for the nine retroactively written briefs is genuinely
        # BEFORE the brief itself - S000's work is logged 2026-07-27 and its
        # brief was written 2026-08-12. Taking the minimum keeps lead time >=
        # cycle time, which is what the term means, instead of inverting it.
        evidence = [d for d in (created,) if d]
        evidence.extend(log_dates)
        evidence.extend(
            commit_dates[h] for h in commits if h in commit_dates
        )
        first_evidence = min(evidence) if evidence else None

        if numbered:
            files_touched = rec.files_touched
            goal = rec.goal
            title = rec.name
            owner = rec.owner
            criteria = dict(rec.criteria)
            validations = dict(rec.validations)
            sprint_source = rec.sprint_source
            depends_on, dropped = [], []
        else:
            files_section = _section(text, "Files touched")
            files_touched = len([
                line for line in files_section.splitlines()
                if line.strip().startswith("- ")
            ])
            goal = _collapse(_section(text, "Goal"), 400)
            title = _de_camel(rec.name)
            # This layout records no owner and no checkbox criteria. Reported as
            # absent rather than filled with a plausible default, so a chart
            # over them renders "not recorded here" instead of a flat bar that
            # looks like data.
            owner = None
            criteria = {"total": 0, "checked": 0}
            validations = {"total": 0, "checked": 0}
            sprint_source = "filename"
            depends_on, dropped = effective_dependencies(rec, text)

        record = {
            "id": tid,
            "sprint_id": sprint_id,
            "sprint": rec.sprint,
            "name": rec.name,
            "title": title,
            # The migration reader records an absolute path (it globs a
            # directory it was handed); `task_queue` already reports a relative
            # one. Both are normalised here so no absolute path reaches a
            # payload that may be read on another machine.
            "path": _rel(path) if numbered else rec.path,
            "state": rec.state,
            "workflow_state": pm_briefs.workflow_state(rec.state, rec.status_raw),
            "status_raw": _collapse(rec.status_raw, 400),
            "lane": rec.lane,
            # Whether the lane was actually classified or fell back to the
            # default. Without this the lane chart reads as "97 tasks need a
            # human", when the truth is "97 tasks were never lane-classified
            # and default to the safe answer".
            "lane_explicit": (
                (not numbered) and task_queue is not None and tid in task_queue.LANES
            ),
            "owner": owner,
            "criteria": criteria,
            "validations": validations,
            "sprint_source": sprint_source,
            "depends_on": depends_on,
            "depends_on_dropped": dropped,
            "blocks": [],
            "prose_gates": list(rec.prose_gates),
            "blocked_by_unmet": [
                dep for dep in depends_on
                if records.get(dep) is None or records[dep].state != "done"
            ],
            "points": points,
            "size_bytes": len(text.encode("utf-8")),
            "size_bucket": None,
            "commits": commits,
            "commit_count": len(commits),
            "goal": goal,
            "files_touched": files_touched,
            "first_evidence": first_evidence,
            "defects": list(rec.defects),
        }
        record.update(date_ref("created_at", created, created_src, created_floored))
        record.update(date_ref("closed_at", closed, closed_src, closed_floored))
        out.append(record)

    # Reverse edges, computed once here so no consumer has to walk the corpus.
    index = {t["id"]: t for t in out}
    for task in out:
        for dep in task["depends_on"]:
            if dep in index:
                index[dep]["blocks"].append(task["id"])
    for task in out:
        task["blocks"] = sorted(set(task["blocks"]))

    cuts = _quintiles([t["size_bytes"] for t in out])
    for task in out:
        task["size_bucket"] = _bucket(task["size_bytes"], cuts)

    return out, status


# ---------------------------------------------------------------------------
# sprints
# ---------------------------------------------------------------------------


def collect_sprints(tasks, sprint_rows, today):
    """Union of sprints that have briefs and sprints the roadmap table names.

    A roadmap row with no briefs is real information - a sprint that was
    planned and never started - so it is reported rather than dropped, and a
    sprint with briefs and no row is reported for the opposite reason: the
    hand-maintained history has a gap.
    """
    by_sprint = {}
    for task in tasks:
        by_sprint.setdefault(task["sprint_id"], []).append(task)

    out = []
    for sprint_id in sorted(set(by_sprint) | set(sprint_rows)):
        members = sorted(by_sprint.get(sprint_id, []), key=lambda t: t["id"])
        row = sprint_rows.get(sprint_id, {})

        done = [t for t in members if t["state"] == "done"]
        pending = [t for t in members if t["state"] == "pending"]
        unparseable = [t for t in members if t["state"] == "unparseable"]
        # Cancelled work is neither delivered nor outstanding. It is excluded
        # from the denominator entirely: counting it as done inflates
        # completion, and counting it as pending leaves a burn-down that can
        # never reach zero.
        cancelled = [t for t in members if t["state"] == "cancelled"]
        in_scope = [t for t in members if t["state"] != "cancelled"]

        start, start_src, start_floored = row.get("start"), "roadmap_sprint", False
        if not start and members:
            dated = [t["created_at"] for t in members if t["created_at"]]
            if dated:
                start = min(dated)
                start_src = "git_added"
                start_floored = any(
                    t["created_at_floored"] for t in members if t["created_at"] == start
                )
        if not start:
            start_src = "unknown"

        ongoing = bool(row.get("ongoing")) or (bool(pending) and bool(done))
        end, end_src, end_floored = row.get("end"), "roadmap_sprint", False
        if not end and not pending and done:
            dated = [t["closed_at"] for t in done if t["closed_at"]]
            if dated:
                end = max(dated)
                end_src = "status_line"
                end_floored = any(
                    t["closed_at_floored"] for t in done if t["closed_at"] == end
                )
        if not end:
            end_src = "unknown"
            end_floored = False

        if not members:
            state = "planned"
        elif pending and not done:
            state = "planned"
        elif pending:
            state = "active"
        else:
            state = "closed"

        points = [t["points"] for t in members if t["points"] is not None]
        record = {
            "id": sprint_id,
            "name": row.get("name") or (members[0]["sprint"] if members else sprint_id),
            # `S015_Gemma12BReliability` where the briefs carry a sprint name,
            # and plain `S015` where they do not — never `S015_` with a dangling
            # separator for a name that was never recorded.
            "label": row.get("label") or (
                "%s_%s" % (sprint_id, members[0]["sprint"])
                if members and members[0]["sprint"] else sprint_id
            ),
            "theme": row.get("theme", ""),
            "roadmap_dates": row.get("roadmap_dates", ""),
            "ongoing": ongoing and state != "closed",
            "state": state,
            "task_ids": [t["id"] for t in members],
            "task_count": len(members),
            "done_count": len(done),
            "pending_count": len(pending),
            "unparseable_count": len(unparseable),
            "cancelled_count": len(cancelled),
            "points_total": sum(points) if points else None,
            "completion_pct": (
                round(100.0 * len(done) / len(in_scope), 1) if in_scope else 0.0
            ),
            "in_roadmap": sprint_id in sprint_rows,
            "has_briefs": bool(members),
        }
        record.update(date_ref("start", start, start_src, start_floored))
        record.update(date_ref("end", end, end_src, end_floored))
        out.append(record)
    return out


# ---------------------------------------------------------------------------
# ad-hoc items
# ---------------------------------------------------------------------------


def collect_adhoc(workflow_dir, git, adhoc_log_dates, today):
    path = Path(workflow_dir) / "35.AD_HOC_TASKS.md"
    if not path.is_file():
        return [], []

    text = _read(path)
    lines = text.splitlines()

    section = None
    items, current = [], None
    for line in lines:
        section_match = ADHOC_SECTION_RE.match(line)
        if section_match:
            if current:
                items.append(current)
                current = None
            section = section_match.group(1).lower()
            continue
        item_match = ADHOC_ITEM_RE.match(line)
        if item_match and section:
            if current:
                items.append(current)
            current = {
                "number": int(item_match.group(1)),
                "title": item_match.group(2).strip(),
                "state": "open" if section == "open" else "resolved",
                "_body": [],
            }
            continue
        if current is not None:
            current["_body"].append(line)
    if current:
        items.append(current)

    # `advisories`, not `defects`: an ad-hoc item whose resolution the audit log
    # never named is a real gap worth surfacing, but it is not a reason for
    # `--check` to fail. A gate that goes red over something the reader cannot
    # act on from here is a gate that teaches people to ignore it - which is
    # what ad-hoc item 32 is itself about.
    out, advisories = [], []
    for item in items:
        body = "\n".join(item.pop("_body"))
        title = re.sub(r"\s*[-—]+\s*RESOLVED\s*$", "", item["title"], flags=re.IGNORECASE)

        found, found_src, found_floored = None, "unknown", False
        found_block = FOUND_DURING_RE.search(body)
        if found_block:
            match = DATE_RE.search(found_block.group(1))
            if match:
                found, found_src = match.group(1), "body_found_during"
        if not found:
            match = DATE_RE.search(body)
            if match:
                found, found_src = match.group(1), "body_found_during"

        log_dates = adhoc_log_dates.get(item["number"], [])
        resolved, resolved_src, resolved_floored = None, "unknown", False
        if item["state"] == "resolved":
            if log_dates:
                resolved, resolved_src = log_dates[-1], "log_md"
            else:
                touched = git.touched_date(path) if git.available else None
                if touched:
                    # The whole file's last touch is a weak upper bound for one
                    # item inside it, so it is reported as floored rather than
                    # as this item's own resolution date.
                    resolved, resolved_src, resolved_floored = touched, "git_last", True
                    advisories.append(
                        "ad-hoc item %d is in the Resolved section but no audit-log "
                        "entry names it, so the audit trail does not record its "
                        "resolution; its date here is the ad-hoc file's own last "
                        "commit and is approximate" % item["number"]
                    )

        anchor = resolved if item["state"] == "resolved" else today
        age = None
        if found and anchor:
            age = _days_between(found, anchor)

        promoted = None
        promoted_match = re.search(
            r"[Pp]romoted\s+(?:to|into)\b[^\n]{0,80}?S(\d{3})\.T(\d{3})", body
        )
        if promoted_match:
            promoted = "S%s.T%s" % (promoted_match.group(1), promoted_match.group(2))

        record = {
            "number": item["number"],
            "title": _collapse(title, 240),
            "state": item["state"],
            "age_days": age,
            "size_bytes": len(body.encode("utf-8")),
            "promoted_to": promoted,
            "task_ids": sorted({
                "S%s.T%s" % (m.group(1), m.group(2)) for m in TASK_ID_RE.finditer(body)
            }),
        }
        record.update(date_ref("found_at", found, found_src, found_floored))
        record.update(date_ref("resolved_at", resolved, resolved_src, resolved_floored))
        out.append(record)

    out.sort(key=lambda i: i["number"])
    return out, advisories


def _days_between(start, end):
    import datetime

    try:
        a = datetime.date.fromisoformat(start)
        b = datetime.date.fromisoformat(end)
    except (TypeError, ValueError):
        return None
    return (b - a).days


# ---------------------------------------------------------------------------
# the numbered-task layout's sprints, phases and backlog
# ---------------------------------------------------------------------------

CLOSED_WORD_RE = re.compile(r"\b(closed|completed|complete)\b", re.IGNORECASE)
PHASE_HEADING_RE = re.compile(
    r"^Phase\s+(\d+)\s*[—–:-]*\s*(.*)$", re.IGNORECASE
)
BACKLOG_ID_RE = re.compile(r"^B-\d+$")


def parse_migration_sprints(workflow_dir):
    """Sprint records from `planning/sprints/*.md` plus `SPRINT-CURRENT.md`.

    Returns the same row shape `parse_sprint_table` does, so `collect_sprints`
    does not care which layout produced them.

    The closed date is the first date *after* the word "closed" rather than the
    first date on the line, because these files open with sentences like
    "**CLOSED 2026-09-26 on `REVIEW-0012`**. Promoted 2026-09-23 by `TASK-0085`"
    — taking the first date in the file would record the promotion date as the
    closure date, which is backwards and would make every sprint look instant.
    """
    rows, defects = {}, []
    directory = Path(workflow_dir) / "planning" / "sprints"
    if directory.is_dir():
        for path in sorted(directory.glob("*.md")):
            found = pm_corpus_migration.SPRINT_IN_HEADING_RE.search(path.name)
            if not found:
                continue
            sprint_id = "S%s" % found.group(1)
            lines = _read(path).splitlines()
            heading = next((l for l in lines[:5] if l.startswith("# ")), "")
            title = _collapse(re.sub(r"^#\s*", "", heading), 200)

            end = None
            for line in lines[:40]:
                marker = CLOSED_WORD_RE.search(line)
                if not marker:
                    continue
                after = DATE_RE.search(line, marker.end())
                if after:
                    end = after.group(1)
                    break
                on_line = DATE_RE.search(line)
                if on_line:
                    end = on_line.group(1)
                    break
            if not end:
                defects.append(
                    "%s: %s records no closure date in its first 40 lines"
                    % (sprint_id, _rel(path))
                )

            rows[sprint_id] = {
                "id": sprint_id,
                "name": title or sprint_id,
                "label": sprint_id,
                "roadmap_dates": end or "",
                "theme": title,
                "start": None,
                "end": end,
                "ongoing": False,
            }

    current = Path(workflow_dir) / "planning" / "SPRINT-CURRENT.md"
    if current.is_file():
        text = _read(current)
        head = text[:400].lower()
        # The sentinel is a real state, not a missing file: this project records
        # "no sprint is open" explicitly, and reading that as an open sprint
        # named by whatever id appears further down would invent one.
        if "no sprint is open" not in head:
            found = pm_corpus_migration.SPRINT_IN_HEADING_RE.search(text[:400])
            if found:
                sprint_id = "S%s" % found.group(1)
                start = DATE_RE.search(text[:2000])
                row = rows.get(sprint_id, {})
                rows[sprint_id] = {
                    "id": sprint_id,
                    "name": row.get("name") or sprint_id,
                    "label": sprint_id,
                    "roadmap_dates": row.get("roadmap_dates", ""),
                    "theme": row.get("theme", ""),
                    "start": start.group(1) if start else row.get("start"),
                    "end": None,
                    "ongoing": True,
                }
    return rows, defects


def collect_phases(workflow_dir, git):
    """Roadmap phases: `## Phase N — Name (complete, YYYY-MM-DD)`.

    Only the numbered-task layout has these; the sprint-brief layout carries the
    same information in its sprint table and this returns `[]` there.

    A phase whose heading records no date keeps `date: null` and is rendered in
    the table but never plotted. Placing it at a guessed position on a timeline
    would be an invented fact in the one chart people read as a schedule.
    """
    path = None
    for candidate in ("planning/ROADMAP.md", "30.ROADMAP.md", "ROADMAP.md"):
        if (Path(workflow_dir) / candidate).is_file():
            path = Path(workflow_dir) / candidate
            break
    if path is None:
        return []

    out = []
    for line in _read(path).splitlines():
        if not line.startswith("## "):
            continue
        heading = line[3:].strip()
        match = PHASE_HEADING_RE.match(heading)
        if not match:
            continue
        # "complete" anywhere in the heading, so both `(complete, 2026-09-13)`
        # and `(COMPLETE 2026-09-26)` count.
        done = bool(re.search(r"\bcomplete", heading, re.IGNORECASE))
        date_match = DATE_RE.search(heading)
        title = re.sub(r"\(.*", "", match.group(2)).strip()
        record = {
            "number": int(match.group(1)),
            "title": _collapse(title, 200) or ("Phase %s" % match.group(1)),
            "state": "done" if done else "open",
            "path": _rel(path),
        }
        record.update(date_ref(
            "date",
            date_match.group(1) if date_match else None,
            "header_date" if date_match else "unknown",
        ))
        out.append(record)
    out.sort(key=lambda p: p["number"])
    return out


def collect_backlog(workflow_dir, adhoc):
    """The backlog: `planning/BACKLOG.md`'s table, else the ad-hoc list.

    One key serves both layouts. Where a real backlog table exists it is read
    with its priority/value/risk grading; where it does not, this vault's ad-hoc
    items are projected into the same shape with those three fields reported as
    `unrated` — which is true, since that list grades nothing. The alternative,
    a Backlog tab that is empty in half the projects using the tool, would make
    the feature look broken rather than inapplicable.
    """
    path = Path(workflow_dir) / "planning" / "BACKLOG.md"
    if not path.is_file():
        return [
            {
                "id": "A-%d" % item["number"],
                "title": item["title"],
                "priority": "unrated",
                "value": "unrated",
                "risk": "unrated",
                "state": "done" if item["state"] == "resolved" else "open",
                "status_raw": item["state"],
                "dependencies": "none",
                "note": "",
                "source": "adhoc",
            }
            for item in adhoc
        ]

    rows, header = [], None
    for line in _read(path).splitlines():
        if not line.strip().startswith("|"):
            # A non-table line after rows have started ends the table. A blank
            # line does not: these tables are written with blank lines between
            # groups of rows.
            if header is not None and line.strip():
                break
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if header is None:
            header = [c.lower().strip() for c in cells]
            continue
        if all(set(c) <= set("-: ") for c in cells):
            continue
        if len(cells) < 2:
            continue
        row = dict(zip(header, cells))
        ident = pm_corpus_migration._plain(row.get("id", ""))
        if not BACKLOG_ID_RE.match(ident):
            continue

        def cell(name, default=""):
            return pm_corpus_migration._plain(row.get(name, "")) or default

        status_raw = cell("status", "open")
        state = pm_briefs.classify_status(
            status_raw,
            pm_briefs.TASK_PENDING_PREFIXES,
            pm_briefs.TASK_DONE_PREFIXES,
            pm_briefs.TASK_CANCELLED_PREFIXES,
            strip_comment=True,
            strip_markup=True,
        )
        rows.append({
            "id": ident,
            "title": _collapse(cell("title"), 240),
            "priority": cell("priority", "unrated").lower(),
            "value": cell("value", "unrated").lower(),
            "risk": cell("risk", "unrated").lower(),
            "state": "done" if state == "done" else (
                "cancelled" if state == "cancelled" else "open"
            ),
            "status_raw": _collapse(status_raw, 80),
            "dependencies": _collapse(cell("dependencies", "none"), 120),
            "note": _collapse(cell("ready when"), 400),
            "source": "backlog_table",
        })
    return rows


# ---------------------------------------------------------------------------
# decisions and reviews
# ---------------------------------------------------------------------------


def collect_decisions(workflow_dir, git):
    directory = Path(workflow_dir) / "decisions"
    if not directory.is_dir():
        return []

    out = []
    for path in sorted(directory.glob("*.md")):
        match = ADR_FILE_RE.match(path.name)
        if not match or match.group(1) == "0000":
            continue
        text = _read(path)
        heading = _first_heading(text) or _de_camel(match.group(2))
        title = re.sub(r"^\d{4}\s*[-—]\s*", "", heading).strip()

        status_raw = _header_field(text, "Status") or ""
        status = "unknown"
        if status_raw:
            lowered = status_raw.lower()
            for candidate in ("accepted", "proposed", "superseded", "deprecated", "rejected"):
                if lowered.startswith(candidate):
                    status = candidate
                    break

        superseded_by = None
        supersede_match = re.search(r"superseded\s+by\s+(?:ADR[- ]?)?(\d{1,4})", text, re.IGNORECASE)
        if supersede_match and "NNNN" not in supersede_match.group(0):
            superseded_by = int(supersede_match.group(1))

        date, source, floored = None, "unknown", False
        header_date = _header_field(text, "Date")
        if header_date:
            found = DATE_RE.search(header_date)
            if found:
                date, source = found.group(1), "header_date"
        if not date and git.available:
            added = git.added_date(path)
            if added:
                date, source, floored = added, "git_added", git.is_floored(added)

        record = {
            "number": int(match.group(1)),
            "slug": match.group(2),
            "title": _collapse(title, 240),
            "path": _rel(path),
            "status": status,
            "size_bytes": len(text.encode("utf-8")),
            "superseded_by": superseded_by,
        }
        record.update(date_ref("date", date, source, floored))
        out.append(record)

    out.sort(key=lambda d: d["number"])
    return out


def collect_reviews(workflow_dir, git):
    directory = Path(workflow_dir) / "reviews"
    if not directory.is_dir():
        return []

    out = []
    for path in sorted(directory.glob("*.md")):
        if path.stem.startswith("0000"):
            continue
        text = _read(path)

        date, source, floored = None, "unknown", False
        header_date = _header_field(text, "Date")
        if header_date:
            found = DATE_RE.search(header_date)
            if found:
                date, source = found.group(1), "header_date"
        if not date:
            name_match = FILENAME_DATE_RE.match(path.name)
            if name_match:
                date, source = name_match.group(1), "filename"
        if not date and git.available:
            added = git.added_date(path)
            if added:
                date, source, floored = added, "git_added", git.is_floored(added)

        record = {
            "id": path.stem,
            "title": _collapse(_first_heading(text) or _de_camel(path.stem), 200),
            "path": _rel(path),
            "size_bytes": len(text.encode("utf-8")),
        }
        record.update(date_ref("date", date, source, floored))
        out.append(record)
    return out


# ---------------------------------------------------------------------------
# provenance
# ---------------------------------------------------------------------------


APPROXIMATE_SOURCES = ("roadmap_sprint", "file_mtime")


def build_provenance(tasks, git, workflow_dir, log_path, log_entries,
                     sprints, adhoc, decisions, reviews, units):
    counts = {}
    approximate, excluded = [], []

    for task in tasks:
        for prefix in ("created_at", "closed_at"):
            if task[prefix] is None and prefix == "closed_at" and task["state"] != "done":
                continue
            source = task[prefix + "_source"]
            counts[source] = counts.get(source, 0) + 1
            if task[prefix + "_floored"] or source in APPROXIMATE_SOURCES:
                if task["id"] not in approximate:
                    approximate.append(task["id"])
        if not task["created_at"]:
            excluded.append(task["id"])

    floored = sum(
        1 for t in tasks for p in ("created_at", "closed_at") if t[p + "_floored"]
    )

    # How often a git date existed but was rejected for sitting exactly on the
    # baseline commit. This, not `floored`, is the informative number here: the
    # fallback chain usually rescues such a task with a hand-recorded sprint
    # date, so `floored` ends up at zero while a large share of the corpus was
    # in fact undatable from git.
    rejected = 0
    if git.available:
        for task in tasks:
            added = git.added_date(REPO_ROOT / task["path"])
            if added and git.is_floored(added) and task["created_at_source"] != "git_added":
                rejected += 1

    notes = []
    if not units["points_available"]:
        notes.append(
            "No task brief in this corpus carries an estimate, so every figure "
            "on this dashboard counts tasks of equal weight. That is the "
            "assumption count-based forecasting makes, and it is stated rather "
            "than hidden."
        )
    if git.baseline:
        notes.append(
            "Git history begins at %s (%s), so no commit can date work done "
            "before it. %d of %d briefs already existed at that commit; each "
            "fell back to its sprint's own hand-recorded date rather than being "
            "reported as having arrived on the import day."
            % (git.baseline["date"], git.baseline["hash"], rejected, len(tasks))
        )
        if floored:
            notes.append(
                "%d date%s could not be rescued by any hand-recorded source and "
                "%s shown as a lower bound." % (
                    floored, "" if floored == 1 else "s",
                    "is" if floored == 1 else "are",
                )
            )
    elif not git.enabled:
        notes.append(
            "Git was switched off for this run (--no-git), so no date came from "
            "a commit and the activity series are empty. Every figure here rests "
            "on hand-recorded sources alone. This is a deliberate degradation, "
            "stated so a reader does not mistake an empty Activity tab for a "
            "project that did nothing."
        )
    else:
        notes.append(
            "No git history was readable, so no date could be derived from "
            "commits. Dates come from hand-recorded sources only."
        )
    if approximate:
        notes.append(
            "%d of %d tasks carry at least one approximate date (a git floor or "
            "sprint-granularity fallback). They are plotted, and marked."
            % (len(approximate), len(tasks))
        )
    if excluded:
        notes.append(
            "%d task%s could not be dated at all and %s excluded from every "
            "time series."
            % (
                len(excluded), "" if len(excluded) == 1 else "s",
                "is" if len(excluded) == 1 else "are",
            )
        )
    dropped = sum(len(t.get("depends_on_dropped") or []) for t in tasks)
    if dropped:
        notes.append(
            "%d dependency edge%s scraped from a closed brief's status line "
            "%s ignored. A finished task has no blockers, and those lines name "
            "what came next, which would otherwise register as a backwards edge "
            "and a false dependency cycle."
            % (
                dropped, "" if dropped == 1 else "s",
                "was" if dropped == 1 else "were",
            )
        )
    defaulted = sum(1 for t in tasks if not t.get("lane_explicit"))
    if defaulted:
        notes.append(
            "%d of %d briefs carry no explicit execution lane and fall back to "
            "`operator`, the deliberately safe default. The lane breakdown "
            "therefore measures classification coverage at least as much as it "
            "measures real operator dependency."
            % (defaulted, len(tasks))
        )
    notes.append(
        "The cumulative flow diagram is reconstructed from two observable "
        "transitions - a brief arriving and a brief closing. Its 'done' band is "
        "exact at every point; the open bands show current sub-state for items "
        "still open and count already-closed items as in-flight at earlier "
        "dates, because what they were doing then is recorded nowhere."
    )
    notes.append(
        "Commit line counts exclude the initial import commit, which git "
        "reports no diff for. A bulk import is not development volume, and "
        "including it would dwarf every real week."
    )
    notes.append(
        "This dashboard is generated and strictly read-only. It never writes to "
        "the corpus it reads, so nothing here can be the cause of a discrepancy "
        "it reports."
    )

    return {
        "date_sources": counts,
        "git_baseline": git.baseline or {"available": False},
        "floored_dates": floored,
        "approximate_tasks": approximate,
        "excluded_from_timeseries": excluded,
        "estimates_present": units["points_available"],
        "sources_read": [
            {"path": _rel(Path(workflow_dir) / "tasks"), "kind": "task_briefs",
             "count": len(tasks)},
            {"path": _rel(Path(workflow_dir) / "30.ROADMAP.md"),
             "kind": "sprint_table",
             "count": sum(1 for s in sprints if s["in_roadmap"])},
            {"path": _rel(Path(workflow_dir) / "35.AD_HOC_TASKS.md"),
             "kind": "adhoc_items", "count": len(adhoc)},
            {"path": _rel(Path(workflow_dir) / "decisions"), "kind": "decisions",
             "count": len(decisions)},
            {"path": _rel(Path(workflow_dir) / "reviews"), "kind": "reviews",
             "count": len(reviews)},
            {"path": _rel(log_path) if log_path else "(none found)",
             "kind": "audit_log", "count": len(log_entries)},
            {"path": ".git", "kind": "commits", "count": len(git.commits)},
        ],
        "notes": notes,
    }


# ---------------------------------------------------------------------------
# entry point
# ---------------------------------------------------------------------------


def collect(root=None, today=None, use_git=True):
    """Read the whole corpus. Returns the SCHEMA.md sections 1 and 3 payload."""
    import datetime

    global _REL_BASE

    base = Path(root or REPO_ROOT)
    today = today or datetime.date.today().isoformat()
    _REL_BASE = base.resolve()

    workflow_dir = locate_corpus(base)
    shape = detect_shape(workflow_dir)
    log_path = locate_log(base)
    git = Git(base, use_git)

    log_entries = parse_log(log_path)
    if shape == SHAPE_NUMBERED_TASK:
        sprint_rows, sprint_defects = parse_migration_sprints(workflow_dir)
    else:
        sprint_rows, sprint_defects = parse_sprint_table(workflow_dir)
    tasks, queue_status = collect_tasks(
        workflow_dir, git, log_entries, sprint_rows, shape, base
    )
    sprints = collect_sprints(tasks, sprint_rows, today)
    adhoc, adhoc_advisories = collect_adhoc(
        workflow_dir, git, log_dates_by_adhoc(log_entries), today
    )
    backlog = collect_backlog(workflow_dir, adhoc)
    phases = collect_phases(workflow_dir, git)
    decisions = collect_decisions(workflow_dir, git)
    reviews = collect_reviews(workflow_dir, git)

    pointed = [t for t in tasks if t["points"] is not None]
    coverage = (len(pointed) / len(tasks)) if tasks else 0.0
    units = {
        "primary": "points" if tasks and coverage >= 1.0 else "tasks",
        "points_available": bool(pointed),
        "points_coverage": round(coverage, 4),
        "points_total": sum(t["points"] for t in pointed) if pointed else None,
        "size_proxy_note": (
            "Size buckets are a proxy derived from brief length, not an estimate."
        ),
    }

    # `defects` gates; `advisories` informs. See collect_adhoc for why.
    defects = list(queue_status.get("defects", []))
    defects.extend(sprint_defects)
    advisories = list(adhoc_advisories)

    for entry in log_entries:
        entry.pop("_full", None)

    return {
        "schema_version": SCHEMA_VERSION,
        "generator": {"name": "pm_dashboard.py", "version": GENERATOR_VERSION},
        "project": {
            "name": base.resolve().name,
            "workflow_dir": _rel(workflow_dir),
            "corpus_shape": shape,
            "log_path": _rel(log_path) if log_path else None,
            "today": today,
            "git_available": git.available,
        },
        "units": units,
        "tasks": tasks,
        "sprints": sprints,
        "adhoc": adhoc,
        "backlog": backlog,
        "phases": phases,
        "decisions": decisions,
        "reviews": reviews,
        "log": log_entries,
        "commits": git.commits,
        "provenance": build_provenance(
            tasks, git, workflow_dir, log_path, log_entries,
            sprints, adhoc, decisions, reviews, units,
        ),
        "defects": defects,
        "advisories": advisories,
        "_queue_ready": queue_status.get("ready", []),
    }


def main(argv=None):
    import argparse

    ap = argparse.ArgumentParser(
        description=(
            "Read the project-workflow corpus and print the collected record "
            "as JSON. Read-only; computes no metric (see pm_metrics.py)."
        )
    )
    ap.add_argument("--root", default=None, help="repository root (default: this repo)")
    ap.add_argument("--today", default=None, help="override today's date (YYYY-MM-DD)")
    args = ap.parse_args(argv)

    print(json.dumps(collect(args.root, args.today), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
