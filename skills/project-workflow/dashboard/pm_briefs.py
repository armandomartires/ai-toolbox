#!/usr/bin/env python3
"""
pm_briefs.py — one status classifier, two vocabularies
(S028.T001_SecondCorpusShape).

## Why this module exists

Two project layouts are in the wild, and both are correct for the project that
has them:

- **sprint-brief** (`project-workflow`): `S###_Sprint.T###_Name.md`, with a
  bolded `**Status**:` line in the preamble. This vault.
- **numbered-task** (`project-migration`): `TASK-####-slug.md`, with a
  `- Status:` line inside a `## Status` section. `ai-toolbox`.

They spell status differently — `completed` vs `done`, and the second adds
`planned`, `ready`, `review` and `cancelled`, which the first has never used.
A dashboard that serves both needs to read both.

## The one thing this module refuses to do

It does not merge the two vocabularies into one permissive set. `task_queue.py`
gates unattended runs on its own vocabulary, and the reason is argued at length
in its docstring: a status it cannot read must be reported, never guessed at,
because guessing in either direction either redoes finished work or skips real
work. Teaching it to also accept `planned` would silently reclassify any brief
that happens to use that word — a behaviour change to a gate, smuggled in as a
refactor for something else's benefit.

So the **algorithm** lives here once, and each caller supplies the vocabulary it
is entitled to. `task_queue.py` passes exactly the constants it always had, and
its behaviour is bit-for-bit what it was. [[.ai/workflow/decisions/0029-one-dashboard-shipped-by-the-skill|ADR-0029]]
decision 6 records why the dependency points this way: the dashboard is vendored
into projects that have no `task_queue.py`, so the shipped half cannot depend on
the un-shipped one.

Stdlib only, Python-only per ADR-0003. Reads nothing; pure functions.
"""

from __future__ import annotations

# Header fields live in the first handful of lines, one per line. A brief that
# grows a field should still be parsed, so this scans a window rather than
# hardcoding a line index.
HEADER_WINDOW = 14

# --- the sprint-brief vocabulary (project-workflow) -------------------------
# Exactly what task_queue.py has always used. Do not extend these to suit
# another layout; add a vocabulary instead.
SPRINT_PENDING_PREFIXES = ("not started", "in progress", "blocked")
SPRINT_DONE_PREFIXES = ("completed", "complete", "closed", "done")

# --- the numbered-task vocabulary (project-migration) -----------------------
# The template states seven values: planned|ready|in_progress|blocked|review|
# done|cancelled. The extras below are what the corpus actually contains
# alongside them.
TASK_PENDING_PREFIXES = (
    "planned", "ready", "not started", "not_started", "todo", "open", "backlog",
    "in_progress", "in progress", "wip", "doing", "review", "in review",
    "blocked", "waiting", "parked",
)
TASK_DONE_PREFIXES = ("done", "completed", "complete", "closed", "shipped")

# Cancelled is neither pending nor done: the work will not happen and did not
# happen. Counting it as done inflates completion; counting it as pending leaves
# a burn-down that never reaches zero. It is its own state, and it is excluded
# from scope entirely.
TASK_CANCELLED_PREFIXES = ("cancelled", "canceled", "superseded", "withdrawn")

# "No dependency at all", as actually written: `none`, `nothing.`,
# `nothing in \`S017\`. Deliberately independent of ...`. These must NOT become
# unresolved prose gates, or genuinely ready tasks never are.
NO_DEPENDENCY_PREFIXES = ("none", "nothing", "n/a", "-")


def classify_status(status_raw, pending_prefixes, done_prefixes,
                    cancelled_prefixes=(), strip_comment=False,
                    strip_markup=False):
    """Map a raw status to `pending` | `done` | `cancelled` | `unparseable`.

    Both sides are matched explicitly and neither is the default. Enumerating
    only the done-values would make an eighth spelling silently pending, and an
    already-closed task gets redone; enumerating only the pending-values would
    make a new pending word silently done, and real work is skipped. Neither
    default is safe, so this takes neither.

    Comparison is on the lowercased text, because corpora mix `complete` and
    `CLOSED` freely, and many statuses carry a trailing clause on the same line
    (`CLOSED (2026-09-19), closing S009_CitationsAndSchema`) — hence prefix
    matching rather than equality.

    `strip_comment` drops a trailing `#` comment before matching, and is
    **off by default on purpose**. The numbered-task template ships its status
    line as `- Status: done   # planned|ready|in_progress|blocked|review|done|
    cancelled`, so the real value is followed by every other value as
    documentation.

    Stated precisely, because it was measured rather than assumed: **this
    changes no answer today.** With the 16-prefix vocabulary below, the
    unfilled-template guard's `all()` never holds against that line, so the
    comment is harmless — by accident. Trim the pending vocabulary to the three
    values the template itself lists and the guard fires on every brief in the
    corpus, turning 116 done tasks into 116 unparseable ones. So this is a guard
    against a future vocabulary edit, not a fix for a live defect, and it is
    documented as such rather than credited with work it is not doing.

    The sprint-brief layout has never used `#` in a status, and turning this on
    for it would be a behaviour change to `task_queue.py`'s gate for another
    layout's benefit.

    `strip_markup` is off for the same reason and needed for the same corpus:
    that layout writes its value bolded, `- Status: **done**`, and 4 of its 121
    briefs were reported unparseable until this existed — including one reading
    `**cancelled — superseded by ADR-0017's rejection**`, which is about as
    clearly stated as a status gets. Prefix matching against raw markdown is the
    bug; stripping it in the sprint layout, where statuses are written plain and
    a `**blocked on ...**` clause follows the real value, would change which
    prefix wins.
    """
    if status_raw is None:
        return "unparseable"
    text = status_raw.strip().lower()
    if strip_comment:
        text = text.split("#", 1)[0].strip()
    if strip_markup:
        text = text.replace("**", "").replace("`", "").replace("*", "")
        text = text.replace("~~", "").strip()
    if not text:
        return "unparseable"

    # An unfilled template lists every value on one line as documentation
    # (`not started | in progress | blocked | completed`). Guard so a copied but
    # unfilled brief is reported rather than counted as whatever comes first.
    # Requires *every* pending value to be present, which is what makes it a
    # template test rather than a test for "a status with pipes in it".
    if text.count("|") >= 3 and all(p in text for p in pending_prefixes):
        return "unparseable"

    # Cancelled first: `cancelled` must not be reached by a `complete` test, and
    # `superseded` must not be read as pending.
    for prefix in cancelled_prefixes:
        if text.startswith(prefix):
            return "cancelled"
    for prefix in pending_prefixes:
        if text.startswith(prefix):
            return "pending"
    for prefix in done_prefixes:
        if text.startswith(prefix):
            return "done"
    return "unparseable"


# Which pending statuses mean what, for the board's own sub-state. Checked in
# order against the lowercased text: "blocked" is tested before "not started"
# because briefs are written `not started | **blocked on \`S017.T006\`**`, where
# the blocker is the informative half — reporting those as merely not-started
# would hide every real dependency stall on the board.
WORKFLOW_STATE_RULES = (
    ("blocked", "blocked"),
    ("waiting", "blocked"),
    ("parked", "blocked"),
    ("in progress", "in_progress"),
    ("in_progress", "in_progress"),
    ("wip", "in_progress"),
    ("doing", "in_progress"),
    # `review` is work that is done being written and not yet accepted. It is
    # in flight, not finished: counting it as done would close a task nobody has
    # accepted, which is the one direction that cannot be walked back.
    ("review", "in_progress"),
    ("not started", "not_started"),
    ("not_started", "not_started"),
    ("planned", "not_started"),
    ("ready", "not_started"),
    ("todo", "not_started"),
    ("backlog", "not_started"),
    ("open", "not_started"),
)


def workflow_state(state, status_raw):
    """The board sub-state for a task, given its coarse state and raw text."""
    if state in ("done", "cancelled", "unparseable"):
        return state
    text = (status_raw or "").lower()
    for needle, value in WORKFLOW_STATE_RULES:
        if needle in text:
            return value
    return "not_started"


def header_field(lines, label, window=HEADER_WINDOW):
    """Text after `**<label>**:` or `- <label>:` within the header window.

    Deliberately not a YAML parse: neither layout has frontmatter (checked
    live), so there is nothing to parse structurally and a prefix scan is the
    honest tool rather than a fallback. Both spellings are accepted because the
    two layouts differ only in that punctuation.
    """
    bold = "**%s**:" % label
    plain = "- %s:" % label
    bare = "%s:" % label
    for line in lines[:window]:
        stripped = line.strip()
        if line.startswith(bold):
            return line[len(bold):].strip()
        if stripped.lower().startswith(plain.lower()):
            return stripped[len(plain):].strip()
        if stripped.lower().startswith(bare.lower()):
            return stripped[len(bare):].strip()
    return None
