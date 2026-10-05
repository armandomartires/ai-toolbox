<!-- Rendered by ai-toolbox's scripts/sync-templates.sh. Shape is owned by
     ai-toolbox's skills/project-migration/schemas/task.md (its ADR-0027).
     In ai-toolbox, edit the schema and re-render; tests/validate.sh fails on
     drift. A copy in another repository is not regenerated or checked there. -->

# TASK-XXXX — Title

## Objective

<!-- FILL: What this task is for, and why it matters now. Name the plan item, backlog
     entry or review finding it discharges. -->

## Minimal context

<!-- FILL: Narrative: provenance, why this task's shape is what it is, what a prior
     claim got wrong. Prose, sub-headings and tables all fine. NOT an artifact
     list — that is Inputs, below. -->

## Inputs

<!-- FILL: Every artifact this task consumes, so it can be started cold in a fresh
     session. Merges the old Preconditions + Dependencies. -->

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
|          | TASK-XXXX, or "pre-existing" | version / size / passing suite |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

<!-- FILL: What this task covers, and what it deliberately does not. Both halves below
     must be filled — an empty "Not included" is how scope creeps. -->

### Included

<!-- FILL: What this task will do. -->

### Not included

<!-- FILL: What it deliberately will not do, and why. Never leave this empty. -->

## Likely files

<!-- FILL: A forecast, written BEFORE the work — what you expect to touch. What you
     actually changed belongs in Outputs / handover, not here. If the two
     disagree at the end, that is a finding worth recording. -->

## Execution plan

<!-- FILL: The ordered steps you intend to take, written before starting. -->

1.

## Acceptance criteria

<!-- FILL: The conditions that make this task done. Each must be checkable by someone
     who was not present — a criterion nobody can falsify is not a criterion. -->

- [ ]

## Mandatory validations

<!-- FILL: The commands that must pass before this task is done. Add any beyond the
     two standing ones below. -->

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed)

## Risks and rollback

<!-- FILL: What could go wrong, and how the change is undone if it does. Name the
     rollback explicitly — "revert the commit" is a real answer, a missing
     section is not. -->

## Outputs / handover

<!-- FILL: What the next session inherits. Written AFTER the work — until it is
     verified you are describing an intention, not a state. -->

| Artifact | End state |
|----------|-----------|
|          | what it now contains, plus anything deliberately *not* changed |

**Next task starts here**: one line naming the state the next task picks
up from — not a prediction of what that task will be. Record any
deviation from the Plan here too: the next task may have been scoped
against the original.

## Status

<!-- FILL: Keep `Updated` current. The vocabulary below is closed. -->

- Status: planned   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent/human
- Created:
- Updated:

## Execution log

<!-- FILL: What actually happened, one block per attempt. Append a new `### Attempt N`
     rather than editing an earlier one — a rewritten log is not a log. -->

### Attempt 1

<!-- FILL: One block per attempt. Record the commands you ran and what they printed,
     not a summary of how it went. -->

- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
