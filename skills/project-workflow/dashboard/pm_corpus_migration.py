#!/usr/bin/env python3
"""
pm_corpus_migration.py — read the numbered-task project layout
(S028.T001_SecondCorpusShape).

## What this module IS

The second of two corpus readers behind the dashboard. It reads the
`project-migration` layout — flat `TASK-####-slug.md` briefs under `tasks/`,
sprint membership recorded in `tasks/TODO.md`, a backlog table and roadmap
phases under `planning/` — and returns records in the same shape
`pm_collect.py` already consumes from the sprint-brief reader, so everything
downstream (date resolution, metrics, every chart) is untouched.

Written against the real corpus rather than against the template, because the
two differ in ways that matter. Each is noted at the code that handles it.

## What it deliberately does NOT do

**It does not default an estimate to 1.** The tool being replaced defaulted
`Points:` to `1.0` per task, which makes "points" a task count wearing a
different name — and a chart labelled "points" that is really a count is the
kind of thing a reader believes. [[.ai/workflow/decisions/0028-generated-static-pm-dashboard|ADR-0028]] §2
says an estimate nobody recorded cannot be recovered, so an absent `Points:`
stays `None` and the dashboard counts tasks and says so.

**It does not invent dependency edges.** This layout records no per-task
`Depends on` field. Rather than scrape prose for something that looks like one,
`depends_on` is empty and the Dependencies tab renders its own empty state. An
empty graph is honest; a guessed one is a claim that work is blocked.

Stdlib only, Python-only per ADR-0003. Read-only.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field, asdict
from pathlib import Path

import pm_briefs

# `TASK-0122-project-workflow-dashboard.md`, and the 3-digit variant.
TASK_ID_RE = re.compile(r"\bTASK-(\d{3,4})\b")
DATE_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")

# A sprint heading in TODO.md: `## Sprint S2 — Multi-client hardening`,
# `## Sprint S5 — Session handover contract (open)`, and the bucket for work
# that ran between sprints, `## Post-S4 (no sprint open)`.
SPRINT_IN_HEADING_RE = re.compile(r"\bS(\d{1,3})\b")
POST_SPRINT_RE = re.compile(r"^\s*post[-\s]", re.IGNORECASE)

CHECKBOX_RE = re.compile(r"^\s*[-*]\s+\[([ xX])\]")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*\S)\s*$")

# `- Commit: \`c30a568\` (workflow, AGENTS.md, .gitignore)`, and the plural.
COMMIT_LINE_RE = re.compile(
    r"^\s*(?:[-*>]\s*)?(?:\*\*)?Commits?(?:\(s\))?(?:\*\*)?\s*:", re.IGNORECASE
)
# At least 7 hex characters AND at least one digit. Without the digit test,
# ordinary English words parse as abbreviated SHAs — `deferred`, `feedback` and
# `added` are all valid hex.
SHA_RE = re.compile(r"\b(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b")

NUMBER_RE = re.compile(r"[\d.]+")

# Where the goal of the work is written. This layout says `## Objective`; the
# other says `## Goal`. Both are accepted so neither reader has to care which
# template a project started from.
GOAL_HEADINGS = ("objective", "goal")
CRITERIA_HEADINGS = ("acceptance criteria",)
VALIDATION_HEADINGS = ("mandatory validations", "validation", "validations")
FILES_HEADINGS = ("likely files", "files touched")

# The status block sits under `## Status`, but a brief that never grew one still
# carries the fields in its preamble. 40 lines covers both without reaching into
# the body and picking up a quoted example.
PREAMBLE_WINDOW = 40


@dataclass
class TaskRecord:
    """One brief, parsed. Mirrors `task_queue.TaskRecord`'s attribute names.

    `pm_collect` reads these attributes positionally by name, so the overlap is
    the contract. The extra fields carry what this layout records and the other
    does not (`owner`, `criteria`, `validations`) — all optional downstream.
    """

    task_id: str
    sprint: str
    sprint_id: str
    name: str
    path: str
    status_raw: str
    state: str  # "pending" | "done" | "cancelled" | "unparseable"
    lane: str
    depends_on: list = field(default_factory=list)
    prose_gates: list = field(default_factory=list)
    defects: list = field(default_factory=list)
    # Layout-specific fields, pre-parsed so the collector never re-reads the file.
    owner: str = "unassigned"
    points: float = None
    goal: str = ""
    commits: list = field(default_factory=list)
    files_touched: int = 0
    criteria: dict = field(default_factory=lambda: {"total": 0, "checked": 0})
    validations: dict = field(default_factory=lambda: {"total": 0, "checked": 0})
    created_raw: str = None
    updated_raw: str = None
    # "todo" (the index listed it), "sprint_file" (only a sprint file mentioned
    # it) or "none". Kept because the second is an inference and the first is a
    # record, and a velocity chart built on the two should be able to say so.
    sprint_source: str = "none"


# `operator` is the sprint-brief layout's safe default, chosen there because an
# unclassified brief should ask for a human rather than be swept into an
# unattended run. That reasoning does not transfer: this layout has no lane
# concept at all, so every task would report `operator` and the lane breakdown
# would be a flat bar measuring nothing. `task` says plainly that the project
# does not classify lanes.
DEFAULT_LANE = "task"


def _read(path):
    try:
        return Path(path).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def sections(text):
    """`lowercased heading -> body lines`, ignoring headings inside fences.

    A fenced block in a brief routinely contains `# comment` lines and whole
    example documents; treating those as headings would split a section in half
    and lose most of it.
    """
    out, current, fenced = {}, None, False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            fenced = not fenced
            if current is not None:
                out[current].append(line)
            continue
        if not fenced:
            match = HEADING_RE.match(line)
            if match:
                current = match.group(2).strip().lower()
                out.setdefault(current, [])
                continue
        if current is not None:
            out[current].append(line)
    return out


def _section_lines(sects, names):
    for name in names:
        if name in sects:
            return sects[name]
    return []


def count_boxes(lines):
    """`- [ ]` / `- [x]` totals for a section."""
    total = checked = 0
    for line in lines:
        match = CHECKBOX_RE.match(line)
        if match:
            total += 1
            if match.group(1).lower() == "x":
                checked += 1
    return {"total": total, "checked": checked}


def _collapse(text, limit=None):
    out = re.sub(r"\s+", " ", (text or "")).strip()
    if limit and len(out) > limit:
        out = out[: limit - 1].rstrip() + "…"
    return out


def _plain(text):
    """Strip the markdown a value carries in a table cell or a field."""
    out = re.sub(r"~~(.*?)~~", r"\1", text or "")
    out = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", out)
    return out.replace("**", "").replace("`", "").replace("*", "").strip()


def parse_brief(path, membership=None):
    """Parse one `TASK-####` brief. Never raises on bad content."""
    text = _read(path)
    lines = text.splitlines()

    match = TASK_ID_RE.search(Path(path).name)
    if not match:
        # A brief whose filename does not carry the id may still declare it in
        # the H1. Checked before giving up, because `INDEX.md`-style files and
        # real briefs are distinguished by whether an id exists at all.
        for line in lines[:5]:
            if line.startswith("# "):
                match = TASK_ID_RE.search(line)
                break
    if not match:
        return None

    task_id = "TASK-%s" % match.group(1)
    sects = sections(text)
    status_lines = sects.get("status", []) or lines[:PREAMBLE_WINDOW]

    status_raw = pm_briefs.header_field(status_lines, "Status", window=len(status_lines) or 1)
    owner = pm_briefs.header_field(status_lines, "Owner", window=len(status_lines) or 1)
    created = pm_briefs.header_field(status_lines, "Created", window=len(status_lines) or 1)
    updated = pm_briefs.header_field(status_lines, "Updated", window=len(status_lines) or 1)

    state = pm_briefs.classify_status(
        status_raw,
        pm_briefs.TASK_PENDING_PREFIXES,
        pm_briefs.TASK_DONE_PREFIXES,
        pm_briefs.TASK_CANCELLED_PREFIXES,
        # The template ships its own value list as a trailing `#` comment on the
        # same line: `- Status: done   # planned|ready|in_progress|...`, and the
        # corpus writes the value bolded: `- Status: **done**`.
        strip_comment=True,
        strip_markup=True,
    )

    points = None
    for label in ("Points", "Estimate", "Story points", "Size"):
        raw = pm_briefs.header_field(lines, label, window=PREAMBLE_WINDOW)
        if raw:
            number = NUMBER_RE.search(raw)
            if number:
                try:
                    points = float(number.group(0))
                except ValueError:
                    points = None
                else:
                    if points.is_integer():
                        points = int(points)
                break

    commits = []
    for line in lines:
        if COMMIT_LINE_RE.match(line):
            for sha in SHA_RE.findall(line.lower()):
                if sha not in commits:
                    commits.append(sha)

    title_line = next((l for l in lines[:5] if l.startswith("# ")), "")
    name = re.sub(r"^#\s*", "", title_line)
    name = TASK_ID_RE.sub("", name)
    name = re.sub(r"^\s*[—–:-]\s*", "", name).strip() or task_id

    sprint_id, sprint_source = (membership or {}).get(task_id, ("unassigned", "none"))

    defects = []
    if status_raw is None:
        defects.append("%s: no status line in its `## Status` section or preamble" % task_id)
    elif state == "unparseable":
        defects.append(
            "%s: status %r matches neither the pending vocabulary nor the done "
            "or cancelled ones" % (task_id, _collapse(status_raw, 60))
        )

    return TaskRecord(
        task_id=task_id,
        sprint=sprint_id,
        sprint_id=sprint_id,
        name=name,
        path=str(path).replace("\\", "/"),
        status_raw=_collapse(status_raw, 400) if status_raw else "",
        state=state,
        lane=DEFAULT_LANE,
        depends_on=[],
        prose_gates=[],
        defects=defects,
        owner=_plain(owner) or "unassigned" if owner else "unassigned",
        points=points,
        goal=_collapse(" ".join(_section_lines(sects, GOAL_HEADINGS)), 400),
        commits=commits,
        files_touched=len([
            l for l in _section_lines(sects, FILES_HEADINGS)
            if l.strip().startswith("- ")
        ]),
        criteria=count_boxes(_section_lines(sects, CRITERIA_HEADINGS)),
        validations=count_boxes(_section_lines(sects, VALIDATION_HEADINGS)),
        created_raw=created,
        updated_raw=updated,
        sprint_source=sprint_source,
    )


def _read_sprint_mentions(workflow_dir):
    """`task_id -> sprint id` for every task a sprint file merely mentions.

    A weaker signal than the index, and knowingly so: a sprint review names the
    tasks it closed, but it also names tasks it deferred, tasks it depended on
    and tasks it merely discussed. It is used **only** where the index is
    silent, and what it produced is labelled `sprint_file` in the record so a
    reader can tell an inference from a listing. Without it, 17 of this corpus's
    tasks report no sprint at all while their sprint file names them.
    """
    out = {}
    directory = Path(workflow_dir) / "planning" / "sprints"
    if not directory.is_dir():
        return out
    for path in sorted(directory.glob("*.md")):
        found = SPRINT_IN_HEADING_RE.search(path.name)
        if not found:
            continue
        sprint_id = "S%s" % found.group(1)
        for match in TASK_ID_RE.finditer(_read(path)):
            out.setdefault("TASK-%s" % match.group(1), sprint_id)
    return out


def read_membership(workflow_dir):
    """`task_id -> (sprint id, source)`, the index first and mentions second.

    `tasks/TODO.md` is the only place this layout deliberately records which
    sprint a task belonged to, so it wins wherever it speaks. The rules match
    the corpus as written:

    - **any** heading resets the current sprint, so tasks listed before the
      first `## Sprint ...` heading are genuinely unassigned rather than being
      swept into whichever sprint is named next;
    - a heading beginning `Post-` is its own bucket (`Post-S4`), because work
      run between sprints is a real category and merging it into the preceding
      sprint would inflate that sprint's velocity with work it never did;
    - only checkbox lines contribute, so prose under a heading that happens to
      mention a task id does not assign it.
    """
    membership = {
        tid: (sprint, "sprint_file")
        for tid, sprint in _read_sprint_mentions(workflow_dir).items()
    }

    todo = Path(workflow_dir) / "tasks" / "TODO.md"
    if not todo.is_file():
        todo = Path(workflow_dir) / "TODO.md"
    if not todo.is_file():
        return membership

    current = None
    listed = set()
    for line in _read(todo).splitlines():
        heading = HEADING_RE.match(line)
        if heading:
            text = heading.group(2)
            found = SPRINT_IN_HEADING_RE.search(text)
            if found and POST_SPRINT_RE.match(text):
                current = "Post-S%s" % found.group(1)
            elif found:
                current = "S%s" % found.group(1)
            else:
                current = None
            continue
        if current and CHECKBOX_RE.match(line):
            for match in TASK_ID_RE.finditer(line):
                tid = "TASK-%s" % match.group(1)
                if tid not in listed:
                    listed.add(tid)
                    membership[tid] = (current, "todo")
    return membership


def load_corpus(tasks_dir, workflow_dir=None):
    """Parse every brief. Returns `{task_id: TaskRecord}`, sorted by id."""
    tasks_dir = Path(tasks_dir)
    workflow_dir = Path(workflow_dir) if workflow_dir else tasks_dir.parent
    membership = read_membership(workflow_dir)

    records = {}
    for path in sorted(tasks_dir.glob("*.md")):
        if path.stem.upper() in ("TODO", "INDEX", "README"):
            continue
        rec = parse_brief(path, membership)
        if rec is not None:
            records[rec.task_id] = rec
    return records


def build_status(records):
    """The same contract `task_queue.build_status` returns.

    `ready` is empty and that is deliberate, not unimplemented: this layout
    records no dependencies, so every pending task is trivially unblocked and a
    "ready frontier" listing all of them would be a list, not a finding. The
    readiness question belongs to the gate that owns it, and this layout has no
    such gate.
    """
    counts = {"pending": 0, "done": 0, "cancelled": 0, "unparseable": 0}
    defects = []
    for tid in sorted(records):
        rec = records[tid]
        counts[rec.state] = counts.get(rec.state, 0) + 1
        defects.extend(rec.defects)
    return {
        "task_count": len(records),
        "counts": counts,
        "ready": [],
        "tasks": {tid: asdict(rec) for tid, rec in sorted(records.items())},
        "defects": defects,
        "conformant": not defects,
    }
