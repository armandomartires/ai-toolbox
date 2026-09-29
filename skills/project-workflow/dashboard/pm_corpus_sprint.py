#!/usr/bin/env python3
"""
pm_corpus_sprint.py — read the sprint-brief project layout
(S028.T001_SecondCorpusShape).

## What this module IS

The first of two corpus readers behind the dashboard: `S###_Sprint.T###_Name.md`
briefs with a bolded `**Status**:` line. It is the parsing half of what
`task_queue.py` used to do alone, extracted so that two callers can share it:

- **`task_queue.py`**, this vault's readiness gate, which adds the things only
  it owns — the execution-lane table, the ready frontier, dangling-dependency
  validation — and whose behaviour is unchanged by the extraction;
- **`pm_collect.py`**, the dashboard's collector, which is **vendored into other
  projects** and therefore cannot import `task_queue.py` at all. That module
  carries a `LANES` table of *this vault's* task ids; shipping it to every
  project scaffolded from the skill would ship a hundred lines of another
  project's data as though it meant something.

That is the whole reason this file exists, and it is ADR-0029 decision 6 in
practice: one implementation of the parse, with the dependency pointing away
from the un-shippable module rather than into it.

## What it deliberately does NOT do

It assigns no lane and computes no readiness. Both are questions about *running*
work, which belong to the gate; a reader that answered them would be a second
opinion on the one thing `task_queue.py` exists to be the single owner of.

Stdlib only, Python-only per ADR-0003. Read-only.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import pm_briefs

# A task id as cited everywhere in prose: `S015.T009`. The filename form carries
# the sprint name as well, which lives in `30.ROADMAP.md`'s table and is
# deliberately not re-derived from it.
TASK_ID_RE = re.compile(r"\bS(\d{3})\.T(\d{3})\b")

# Two filename spellings exist, and both are this layout:
#
#   S015_Gemma12BReliability.T009_CoverThreeModes.md   — sprint name in the file
#   S001.T001_Scaffold.md                              — sprint name only in the roadmap
#
# The sprint segment is therefore optional. It was not, until the
# `project-workflow` skill's own dashboard fixture — which uses the second
# spelling — parsed to **zero tasks**. A reader that only accepts the spelling
# its author's repository happens to use is a reader that works in exactly one
# project, which is the opposite of the point.
FILENAME_RE = re.compile(
    r"^S(\d{3})(?:_(?P<sprint>[^.]+))?\.T(\d{3})_(?P<name>.+)\.md$"
)


@dataclass
class TaskRecord:
    """One brief, parsed. Every field is read from disk; none is inferred."""

    task_id: str
    sprint: str
    name: str
    path: str
    status_raw: str
    state: str  # "pending" | "done" | "unparseable"
    lane: str
    depends_on: list = field(default_factory=list)  # resolved S###.T### ids
    prose_gates: list = field(default_factory=list)  # unresolved free-text gates
    defects: list = field(default_factory=list)


def header_field(lines, label):
    """Return the text after `**<label>**:` from the header window, or None.

    Deliberately not a YAML parse: these briefs have no frontmatter — all of
    them use bolded key-value lines under an H1 — so there is nothing to parse
    structurally and a prefix scan is the honest tool rather than a fallback.

    Note this is the **bolded form only**, unlike `pm_briefs.header_field`. This
    layout writes `**Status**:` and nothing else, and accepting a bare
    `Status:` here would let a line quoted in a brief's body outrank the real
    header field.
    """
    prefix = "**%s**:" % label
    for line in lines[:pm_briefs.HEADER_WINDOW]:
        if line.startswith(prefix):
            return line[len(prefix):].strip()
    return None


def classify_status(status_raw):
    """`pending` | `done` | `unparseable`, on this layout's vocabulary."""
    return pm_briefs.classify_status(
        status_raw,
        pm_briefs.SPRINT_PENDING_PREFIXES,
        pm_briefs.SPRINT_DONE_PREFIXES,
    )


def parse_dependencies(depends_raw, status_raw):
    """Split a dependency declaration into resolved ids and prose gates.

    Reads BOTH fields: some briefs carry the real blocker only in their status
    line (`not started | **blocked on \\`S017.T006\\`**`), so parsing
    `**Depends on**` alone would miss a live edge and report a blocked task as
    ready. The union is taken; duplicates collapse.
    """
    ids, gates = [], []

    for raw in (depends_raw, status_raw):
        if not raw:
            continue
        for m in TASK_ID_RE.finditer(raw):
            tid = "S%s.T%s" % (m.group(1), m.group(2))
            if tid not in ids:
                ids.append(tid)

    if depends_raw:
        stripped = depends_raw.strip()
        lowered = stripped.lower()
        declares_none = any(
            lowered.startswith(p) for p in pm_briefs.NO_DEPENDENCY_PREFIXES
        )
        # Prose that is neither an explicit "none" nor a resolvable task id is a
        # real gate someone wrote down on purpose. Recording it as an unresolved
        # gate keeps the task out of the ready frontier, which is the
        # conservative reading; dropping it would silently promote a gated task.
        if not declares_none and not TASK_ID_RE.search(stripped):
            gates.append(stripped)

    return ids, gates


def parse_brief(path, rel_to=None, default_lane="operator"):
    """Parse one brief into a TaskRecord. Never raises on bad content.

    Returns `None` for a file that is not a task brief (the template, inventory
    notes), which is how the caller's glob is filtered.
    """
    m = FILENAME_RE.match(Path(path).name)
    if not m:
        return None

    task_id = "S%s.T%s" % (m.group(1), m.group(3))
    lines = Path(path).read_text(encoding="utf-8", errors="replace").splitlines()

    status_raw = header_field(lines, "Status")
    depends_raw = header_field(lines, "Depends on")
    state = classify_status(status_raw)
    ids, gates = parse_dependencies(depends_raw, status_raw)

    defects = []
    if status_raw is None:
        defects.append(
            "%s: no `**Status**:` line in the first %d lines"
            % (task_id, pm_briefs.HEADER_WINDOW)
        )
    elif state == "unparseable":
        defects.append(
            "%s: status %r matches neither the pending vocabulary %s nor the "
            "done vocabulary %s"
            % (task_id, status_raw[:60], pm_briefs.SPRINT_PENDING_PREFIXES,
               pm_briefs.SPRINT_DONE_PREFIXES)
        )

    rel = Path(path)
    if rel_to:
        try:
            rel = Path(path).relative_to(rel_to)
        except ValueError:
            rel = Path(path)

    return TaskRecord(
        task_id=task_id,
        # Empty where the filename carries no sprint name; the roadmap table is
        # then the only place that sprint is named, which is what the second
        # spelling means rather than a parse failure.
        sprint=m.group("sprint") or "",
        name=m.group("name"),
        path=str(rel).replace("\\", "/"),
        status_raw=status_raw or "",
        state=state,
        lane=default_lane,
        depends_on=ids,
        prose_gates=gates,
        defects=defects,
    )


def load_corpus(tasks_dir, rel_to=None, default_lane="operator"):
    """Parse every brief. Returns `{task_id: TaskRecord}`, sorted by id."""
    records = {}
    for path in sorted(Path(tasks_dir).glob("*.md")):
        rec = parse_brief(path, rel_to, default_lane)
        if rec is not None:
            records[rec.task_id] = rec
    return records


def build_status(records):
    """Counts and parse defects. No lanes, no ready frontier — see the docstring."""
    counts = {"pending": 0, "done": 0, "unparseable": 0}
    defects = []
    for tid in sorted(records):
        rec = records[tid]
        counts[rec.state] = counts.get(rec.state, 0) + 1
        defects.extend(rec.defects)
    return {
        "task_count": len(records),
        "counts": counts,
        "ready": [],
        "tasks": {},
        "defects": defects,
        "conformant": not defects,
    }
