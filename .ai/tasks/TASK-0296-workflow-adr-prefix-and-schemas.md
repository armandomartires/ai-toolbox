# TASK-0296 — project-workflow 8.0.0: ADR-NNNN file names, the hybrid brief, and current-state and session schemas

## Status

- Status: todo
- Owner: agent
- Branch: agent/TASK-0296
- Created: 2026-11-13
- Updated: 2026-11-13
- Applies to: see Scope
- Source: ADR-0066 (the human's choice of one planning convention, 2026-11-13) and the read-only design in TASK-0294's log

## Objective

Make project-workflow the one convention: ADR files `ADR-NNNN-title.md`; the hybrid brief (bold header, Goal, Inputs, Plan, Acceptance criteria, Verification, Outputs; statuses add review and cancelled); new schemas for `10.CURRENT_STATE.md`, `40.RISK_REGISTER.md` and session records; templates regenerated from the schemas.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `.ai/decisions/0066-one-planning-convention.md` | accepted |
| TASK-0294's execution log | the design: layout map, id scheme, impact inventory |

## Scope

- In: `schemas/` (adr, task, new current-state, risk, session), `templates/` (`decisions/ADR-0000-TEMPLATE.md`, conventions, size budgets), `fixtures/dashboard/decisions/`, `SKILL.md`, the engine copy in project-migration via `scripts/sync-artifact-engine.sh`, the plugin copy.
- Out: Renaming this repository's files (TASK-0299).

## Likely files

`schemas/` (adr, task, new current-state, risk, session), `templates/` (`decisions/ADR-0000-TEMPLATE.md`, conventions, size budgets), `fixtures/dashboard/decisions/`, `SKILL.md`, the engine copy in project-migration via `scripts/sync-artifact-engine.sh`, the plugin copy.

## Execution plan

1. Re-read ADR-0066 and the design; confirm the earlier tasks have landed.
2. Write the check that fails today, then the change.
3. Run the checks named below and `tests/validate.sh`.

## Acceptance criteria

- [ ] `new-artifact.sh --kind adr` renders `ADR-NNNN-…`; `check-artifact.sh` accepts the hybrid brief and refuses one without Acceptance criteria
- [ ] Legacy briefs still check against their legacy schema
- [ ] Version 8.0.0; `sync-templates.sh --check` and `sync-artifact-engine.sh --check` pass

## Mandatory validations

- [ ] tests/validate.sh

## Risks and rollback

- Risk: medium.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next: TASK-0297 follows

## Execution log

- 2026-11-13 · Claude Code (Opus 5.5, coordinator) · brief written from ADR-0066 and the design; no work done yet
  - Evidence: none yet
  - Deviation: none
