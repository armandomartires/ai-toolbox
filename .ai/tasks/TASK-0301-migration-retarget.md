# TASK-0301 — project-migration 6.0.0 retrofits repositories into the one convention

## Status

- Status: todo
- Owner: agent
- Branch: agent/TASK-0301
- Created: 2026-11-13
- Updated: 2026-11-13
- Applies to: see Scope
- Source: ADR-0066 (the human's choice of one planning convention, 2026-11-13) and the read-only design in TASK-0294's log

## Objective

project-migration becomes the retrofit path into project-workflow's convention: its scaffold emits the numbered files, its own schemas and templates are deleted in favour of project-workflow's, Phase 3 calls `migrate-layout.py`, and its SKILL.md and governance spec say so.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `.ai/decisions/0066-one-planning-convention.md` | accepted |
| TASK-0294's execution log | the design: layout map, id scheme, impact inventory |

## Scope

- In: `skills/project-migration/` (scaffold, schemas, templates, references, SKILL.md), its engine copy, the plugin copy.
- Out: project-workflow's own files.

## Likely files

`skills/project-migration/` (scaffold, schemas, templates, references, SKILL.md), its engine copy, the plugin copy.

## Execution plan

1. Re-read ADR-0066 and the design; confirm the earlier tasks have landed.
2. Write the check that fails today, then the change.
3. Run the checks named below and `tests/validate.sh`.

## Acceptance criteria

- [ ] `ai-project-scaffold.sh` on an empty directory produces the one convention
- [ ] Version 6.0.0; the gate passes

## Mandatory validations

- [ ] tests/validate.sh

## Risks and rollback

- Risk: medium.
- **Needs the human's authorization in this file before work starts:** deleting project-migration's schemas and templates. Authorized: not yet.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next: TASK-0302 follows

## Execution log

- 2026-11-13 · Claude Code (Opus 5.5, coordinator) · brief written from ADR-0066 and the design; no work done yet
  - Evidence: none yet
  - Deviation: none
