# TASK-XXXX — Title

## Objective
## Minimal context
<!-- Narrative: provenance, why this task's shape is what it is, what a
     prior claim got wrong. Prose, sub-headings and tables all fine.
     NOT an artifact list — that is Inputs, below. -->
## Inputs
<!-- Every artifact this task consumes, so it can be started cold in a
     fresh session. Merges the old Preconditions + Dependencies. -->
| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
|          | TASK-XXXX, or "pre-existing" | version / size / passing suite |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.
## Scope
### Included
### Not included
## Likely files
<!-- A forecast, written BEFORE the work — what you expect to touch.
     What you actually changed belongs in Outputs / handover, not here.
     If the two disagree at the end, that is a finding worth recording. -->
## Execution plan
1.
## Acceptance criteria
- [ ]
## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed)
## Risks and rollback
## Outputs / handover
<!-- What the next session inherits. Written AFTER the work — until it is
     verified you are describing an intention, not a state. -->
| Artifact | End state |
|----------|-----------|
|          | what it now contains, plus anything deliberately *not* changed |

**Next task starts here**: one line naming the state the next task picks
up from — not a prediction of what that task will be. Record any
deviation from the Plan here too: the next task may have been scoped
against the original.
## Status
- Status: planned   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent/human
- Created:
- Updated:
## Execution log
### Attempt 1
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
