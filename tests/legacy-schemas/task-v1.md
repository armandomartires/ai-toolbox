---
kind: task
framework: project-migration
id_placeholder: TASK-XXXX
title_placeholder: Title
filename_pattern: tasks/{id}-{name}.md
title_pattern: {id} — {title}
superseded: Preconditions, Dependencies, Expected result
allow_extra: true
---

# FROZEN (ADR-0033, TASK-0151): the task shape before v2. tests/validate.sh
# checks TASK-0024 to TASK-0152 against this copy; never edit it.

# Transcribed from .ai/templates/TASK.md and from a census of the 105 task
# files in .ai/tasks/ taken 2026-09-26. Nothing here is invented.
#
# superseded: names the three headings the Inputs/Outputs contract replaced
# (ADR-0012). They persist in 23, 23 and 19 existing briefs respectively --
# which is how the drift was found, and why the gate carries a boundary
# rather than rewriting those files.
#
# allow_extra: true deliberately. Real briefs add a task-specific section
# where the work warrants it -- `## Findings` on a spike, `## The re-count`
# on TASK-0108 -- and banning that would trade a real capability for tidiness.
# Order among the declared headings is still enforced.

## Objective
!phase before
!required true
!terse
what this task is for, and why now
!standard
What this task is for, and why it matters now. Name the plan item, backlog
entry or review finding it discharges.
!explicit
State what this task will change and why it is being done now. Name the
specific plan item, backlog entry (`B-###`) or review finding it discharges.
Do not restate the whole background here — that is Minimal context.
!literal
Replace this comment with 2-4 sentences answering, in order:
(1) What will this task change?
(2) Why does it need to happen now?
(3) Which plan item, `B-###` backlog entry, or review finding does it
    discharge? Write "none" if there is no such item.
Keep the background out of this section; it goes under Minimal context.
Delete this comment when done.

## Minimal context
!phase before
!required true
!terse
narrative and provenance — not an artifact list
!standard
Narrative: provenance, why this task's shape is what it is, what a prior
claim got wrong. Prose, sub-headings and tables all fine. NOT an artifact
list — that is Inputs, below.
!literal
Replace this comment with the background a reader needs to understand why
this task looks the way it does: what came before, what a previous attempt
or claim got wrong, and any measurement you took.
Do NOT list files here. Files go in the Inputs table below.
Prose, sub-headings and tables are all fine. Delete this comment when done.

## Inputs
!phase before
!required true
!terse
every artifact consumed, one row each
!standard
Every artifact this task consumes, so it can be started cold in a fresh
session. Merges the old Preconditions + Dependencies.
!explicit
One table row per artifact this task reads or depends on. Fill all three
columns of every row. This section merged the old Preconditions and
Dependencies sections; do not reintroduce either.
!literal
Add one row to the table below for each file, document or tool this task
reads or depends on. For each row fill all three columns:
  Artifact       — the path, in backticks.
  Produced by    — the task ID that made it, or the words: pre-existing
  Expected state — the specific state assumed: a version, a count, a
                   passing suite. Not the word "current".
Do not add a Preconditions or Dependencies section; this replaced both.
Delete this comment when done.
!body
| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
|          | TASK-XXXX, or "pre-existing" | version / size / passing suite |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope
!phase before
!required true
!terse
the boundary, stated both ways
!standard
What this task covers, and what it deliberately does not. Both halves below
must be filled — an empty "Not included" is how scope creeps.
!literal
Fill both sub-sections below. Both are required.
Under "Included", list what this task will do.
Under "Not included", list what it deliberately will NOT do, and why.
An empty "Not included" section is how a task grows past its plan.
Delete this comment when done.

### Included
!phase before
!required true
!standard
What this task will do.

### Not included
!phase before
!required true
!standard
What it deliberately will not do, and why. Never leave this empty.

## Likely files
!phase before
!required true
!terse
a forecast, written before the work
!standard
A forecast, written BEFORE the work — what you expect to touch. What you
actually changed belongs in Outputs / handover, not here. If the two
disagree at the end, that is a finding worth recording.
!literal
Replace this comment with a list of the files you expect to create, change
or delete. Write this BEFORE starting.
Do not come back and correct it afterwards. What you actually changed goes
in Outputs / handover. If the forecast and the outcome disagree, say so
there — the disagreement is itself worth recording.
Delete this comment when done.

## Execution plan
!phase before
!required true
!terse
ordered steps, written before starting
!standard
The ordered steps you intend to take, written before starting.
!literal
Replace the numbered list below with the ordered steps you intend to take.
Write them BEFORE starting the work. If the plan later changes, do not edit
it here — record the deviation in the Execution log. Delete this comment.
!body
1.

## Acceptance criteria
!phase before
!required true
!terse
checkable conditions, each one falsifiable
!standard
The conditions that make this task done. Each must be checkable by someone
who was not present — a criterion nobody can falsify is not a criterion.
!literal
Replace the checkbox below with one checkbox per condition that must be
true for this task to be done.
Each condition must be checkable by someone who was not here. Write
"tests/validate.sh exits 0", not "validation works". Delete this comment.
!body
- [ ]

## Mandatory validations
!phase before
!required true
!terse
the commands that must pass
!standard
The commands that must pass before this task is done. Add any beyond the
two standing ones below.
!literal
Tick each box below once you have run that command and seen it pass.
Add a line for any other command this task requires. Do not tick a box for
a command you have not actually run. Delete this comment when done.
!body
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed)

## Risks and rollback
!phase before
!required true
!terse
what could go wrong, and how to undo it
!standard
What could go wrong, and how the change is undone if it does. Name the
rollback explicitly — "revert the commit" is a real answer, a missing
section is not.
!literal
Replace this comment with two parts:
(1) What could go wrong. One bullet per risk, each naming what would be
    damaged and how you would notice.
(2) How to undo this change if it does. "git revert, no migration needed"
    is a valid answer; leaving it blank is not.
Delete this comment when done.

## Outputs / handover
!phase after
!required true
!terse
every artifact changed, and what the next session inherits
!standard
What the next session inherits. Written AFTER the work — until it is
verified you are describing an intention, not a state.
!literal
Add one row to the table below for every file this task created or changed.
Then replace the text after "Next task starts here" with one sentence
naming the state the next session picks up from.
Write this AFTER the work is done and verified, never before.
Delete this comment when done.
!body
| Artifact | End state |
|----------|-----------|
|          | what it now contains, plus anything deliberately *not* changed |

**Next task starts here**: one line naming the state the next task picks
up from — not a prediction of what that task will be. Record any
deviation from the Plan here too: the next task may have been scoped
against the original.

## Status
!phase before
!required true
!terse
status, owner, dates
!standard
Keep `Updated` current. The vocabulary below is closed.
!literal
Fill each field below.
Status must be one of: planned, ready, in_progress, blocked, review, done,
cancelled. Use no other word.
Owner is either "agent" or "human". Created and Updated are dates in
YYYY-MM-DD form. Update "Updated" every time you change this file.
Delete this comment when done.
!body
- Status: planned   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent/human
- Created:
- Updated:

## Execution log
!phase after
!required true
!terse
what actually happened, per attempt
!standard
What actually happened, one block per attempt. Append a new `### Attempt N`
rather than editing an earlier one — a rewritten log is not a log.
!literal
Fill the fields under "Attempt 1" below as you work.
If the task is retried, ADD a new "### Attempt 2" heading with the same
fields. Never edit an earlier attempt to make it look correct: a rewritten
log is not a log. Delete this comment when done.

### Attempt 1
!phase after
!required true
!standard
One block per attempt. Record the commands you ran and what they printed,
not a summary of how it went.
!literal
Fill in each field below with what actually happened.
Under "Validation", paste what the command printed, not the word "passed".
Under "Push", record whether the push succeeded — a failed push means the
task is not done. Delete this comment when done.
!body
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
