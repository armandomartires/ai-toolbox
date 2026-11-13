# TASK-0225 — task-orchestrator 0.5.4: a misclassification hint, and the session gate's effort from settings

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-04
- Updated: 2026-11-04
- Applies to: `mods/task-orchestrator/` (`hooks/register.tsx`, tests, README, ARCHITECTURE)
- Source: the human, 2026-11-04, on the Field Manual's open items: "Both code fixes"

## Objective

A wrong but valid class is caught where it is cheapest to see, and the session gate checks effort from the first turn.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `register.tsx` | a lookup task that ends partial says nothing about its class; `coordinatorEffort` is unset until the coordinator's first `turn.step` |

## Scope

- In: a `misclassified?` note on a `lookup` or `extraction` task that ends short of completed, printed by `collect`; `coordinatorEffort` seeded at session start from settings; tests; docs; version 0.5.4.
- Out: judging the objective's text; a fallback down the ladder; live runs; republishing.

## Likely files

- `mods/task-orchestrator/hooks/{register.tsx,register.test.tsx}`, `README.md`, `ARCHITECTURE.md`, `.claude-plugin/plugin.json`

## Execution plan

1. `reclassifyHint` in `turn.complete`; `collect` prints the note.
2. `settingsEffort` at `session.start`: env, then the coordinator model's `modelSettings`, then `effortLevel`.
3. Tests, docs, version.

## Acceptance criteria

- [x] A lookup task ending partial carries a note naming class `exploration` and its settings; a completed one carries none
- [x] Re-dispatching it as suggested is a retry and the task's escalation
- [x] Before any coordinator request, a session above the settings' effort is refused
- [x] `tests/test-mods.sh --mod task-orchestrator` passes

## Mandatory validations

- [x] tests/test-mods.sh --mod task-orchestrator
- [x] tests/validate.sh

## Risks and rollback

- A settings effort that differs from what the app actually runs is corrected by the first `turn.step`.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mods/task-orchestrator` | 0.5.4; 2 new cases, 67 pass |

Next: republish 0.5.4, then the live run of the end note and session workers in a new session.

## Execution log

- 2026-11-04 · Claude Code (Opus 5.5) · both fixes
  - Evidence: `tests/test-mods.sh --mod task-orchestrator` → `PASS task-orchestrator: 67 pass`
