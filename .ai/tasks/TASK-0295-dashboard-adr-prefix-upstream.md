# TASK-0295 — sigma-llmwiki's dashboard reads ADR-NNNN file names and the id map, then is re-vendored

## Status

- Status: todo
- Owner: agent
- Branch: agent/TASK-0295
- Created: 2026-11-13
- Updated: 2026-11-13
- Applies to: see Scope
- Source: ADR-0066 (the human's choice of one planning convention, 2026-11-13) and the read-only design in TASK-0294's log

## Objective

The dashboard copied here from sigma-llmwiki (`skills/project-workflow/dashboard/`, `VENDORED.md`) matches decisions by `^(\d{4})-(.+)\.md$` (`pm_collect.py:102`), so `ADR-0013-x.md` would show no decisions. Change it upstream to accept the `ADR-` prefix, and to read `.ai/id-map.tsv` so old `(TASK-NNNN)` commits still link to their renamed briefs; then re-vendor the copy here.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `.ai/decisions/0066-one-planning-convention.md` | accepted |
| TASK-0294's execution log | the design: layout map, id scheme, impact inventory |

## Scope

- In: The change in sigma-llmwiki and its own tests there; re-vendoring here (`vendor-skill.sh`), `VENDORED.md` hashes, the dashboard fixtures and checks here.
- Out: Editing the vendored copy here by hand (never: VENDORED.md).

## Likely files

The change in sigma-llmwiki and its own tests there; re-vendoring here (`vendor-skill.sh`), `VENDORED.md` hashes, the dashboard fixtures and checks here.

## Execution plan

1. Re-read ADR-0066 and the design; confirm the earlier tasks have landed.
2. Write the check that fails today, then the change.
3. Run the checks named below and `tests/validate.sh`.

## Acceptance criteria

- [ ] Upstream: a decisions folder with both `NNNN-` and `ADR-NNNN-` names counts every ADR; an id map links an old commit id to its new brief
- [ ] Here: the re-vendored copy passes `check-dashboard.sh`, and `build-dashboard.sh` on this repository still shows its 63 decisions

## Mandatory validations

- [ ] tests/validate.sh

## Risks and rollback

- Risk: medium.
- **Needs the human's authorization in this file before work starts:** the change in another repository (sigma-llmwiki): the human names its owner and approves the push. Authorized: not yet.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next: TASK-0296 follows

## Execution log

- 2026-11-13 · Claude Code (Opus 5.5, coordinator) · brief written from ADR-0066 and the design; no work done yet
  - Evidence: none yet
  - Deviation: none
