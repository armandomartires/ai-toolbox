# TASK-0296 — project-workflow 8.0.0: ADR-NNNN file names, the hybrid brief, and current-state and session schemas

## Status

- Status: in_progress
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

- [ ] `new-artifact.sh --kind adr` renders `ADR-NNNN-…` (part 2, after TASK-0295)
- [x] `check-artifact.sh` accepts the hybrid brief and refuses one without Acceptance criteria
- [x] Legacy briefs still check against their legacy schema (`tests/legacy-schemas/workflow-task-v1.md`)
- [x] Version 8.0.0; `sync-templates.sh --check` and `sync-artifact-engine.sh --check` pass

## Mandatory validations

- [x] tests/validate.sh: in the pre-commit hook (part 1)

## Risks and rollback

- Risk: medium.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `skills/project-workflow/schemas/` | hybrid `task.md` (required Acceptance criteria, six statuses); new `current-state.md`, `risk-register.md` (gated `Last reviewed`), `session.md` |
| `tests/legacy-schemas/workflow-task-v1.md` | the previous workflow brief shape, for briefs written before it |
| SKILL.md 8.0.0, conventions, size budgets | name 10.CURRENT_STATE, 40.RISK_REGISTER and sessions/ |

Left for part 2: the `ADR-NNNN-title.md` name, the ADR template and dashboard fixture renames (after TASK-0295); generated templates for the three new kinds (`scripts/sync-templates.sh` targets, after TASK-0298, which owns that file); the gate boundary between legacy and hybrid briefs (at TASK-0299, when briefs are renamed).

Next: TASK-0297 follows

## Execution log

- 2026-11-13 · Claude Code (Opus 5.5, coordinator) · brief written from ADR-0066 and the design; no work done yet
  - Evidence: none yet
  - Deviation: none
- 2026-11-13 · Claude Code (Opus 5.5, coordinator; builder worker S296, Sonnet 5.5) · part 1 in an isolated worktree, brought here; two conflicts with TASK-0293/0294 resolved (version, and the forge rule kept in size-budgets)
  - Evidence: red: a brief without Acceptance criteria checked OK; green: `FAIL … missing required section: ## Acceptance criteria`; `check-dashboard.sh` OK (36), `check-tracker.sh` OK (49), `sync-templates.sh --check` and `sync-artifact-engine.sh --check` exit 0, `build-plugin.py --check` matches
  - Deviation: split in two parts; the ADR name waits for TASK-0295; the conventions template was already over its 3 KB budget and grew
