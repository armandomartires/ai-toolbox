# TASK-0302 — Check the dashboard and Compass against the id map after the switch

## Status

- Status: todo
- Owner: agent
- Branch: agent/TASK-0302
- Created: 2026-11-13
- Updated: 2026-11-13
- Applies to: see Scope
- Source: ADR-0066 (the human's choice of one planning convention, 2026-11-13) and the read-only design in TASK-0294's log

## Objective

Rebuild the dashboard and open Compass on the converted repository; confirm sprints, tasks, decisions and history line up with what they showed before, through the id map.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `.ai/decisions/0066-one-planning-convention.md` | accepted |
| TASK-0294's execution log | the design: layout map, id scheme, impact inventory |

## Scope

- In: A comparison of before and after counts (tasks per sprint, decisions, closed dates), and any fix those show.
- Out: New features.

## Likely files

A comparison of before and after counts (tasks per sprint, decisions, closed dates), and any fix those show.

## Execution plan

1. Re-read ADR-0066 and the design; confirm the earlier tasks have landed.
2. Write the check that fails today, then the change.
3. Run the checks named below and `tests/validate.sh`.

## Acceptance criteria

- [ ] Tasks per sprint, decisions and closed dates match before and after, or each difference is explained

## Mandatory validations

- [ ] tests/validate.sh

## Risks and rollback

- Risk: low.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next: the sprint's checkpoint

## Execution log

- 2026-11-13 · Claude Code (Opus 5.5, coordinator) · brief written from ADR-0066 and the design; no work done yet
  - Evidence: none yet
  - Deviation: none
