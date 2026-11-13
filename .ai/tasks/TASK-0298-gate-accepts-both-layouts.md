# TASK-0298 — The gate and scripts accept both layouts during the switch

## Status

- Status: todo
- Owner: agent
- Branch: agent/TASK-0298
- Created: 2026-11-13
- Updated: 2026-11-13
- Applies to: see Scope
- Source: ADR-0066 (the human's choice of one planning convention, 2026-11-13) and the read-only design in TASK-0294's log

## Objective

Before the rename can land green, every check that assumes the old layout must also accept the new one: `tests/validate.sh` (handover, line budgets, scaffold checks, schema groups keyed to TASK numbers, risk-register path), `scripts/check-backlog-closures.py`, `scripts/worktree.sh` (`S###.T###` and `TASK-nnnn`), `scripts/sync-templates.sh`, the emit tests and the tier and turn file paths, the unattended-run binding fixtures and stubs.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `.ai/decisions/0066-one-planning-convention.md` | accepted |
| TASK-0294's execution log | the design: layout map, id scheme, impact inventory |

## Scope

- In: Those files and their tests; the schema-group boundaries re-keyed through the id map.
- Out: Removing old-layout support (TASK-0300).

## Likely files

Those files and their tests; the schema-group boundaries re-keyed through the id map.

## Execution plan

1. Re-read ADR-0066 and the design; confirm the earlier tasks have landed.
2. Write the check that fails today, then the change.
3. Run the checks named below and `tests/validate.sh`.

## Acceptance criteria

- [ ] The gate passes on this repository as it is, and on a fixture copy migrated by TASK-0297's tool
- [ ] `worktree.sh add S012.T001` and `add TASK-0299` both work

## Mandatory validations

- [ ] tests/validate.sh

## Risks and rollback

- Risk: medium-high.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next: TASK-0299 follows

## Execution log

- 2026-11-13 · Claude Code (Opus 5.5, coordinator) · brief written from ADR-0066 and the design; no work done yet
  - Evidence: none yet
  - Deviation: none
