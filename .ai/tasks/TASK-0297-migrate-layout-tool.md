# TASK-0297 — A migrate-layout tool that moves a project-migration repo onto the one convention, dry run by default

## Status

- Status: todo
- Owner: agent
- Branch: agent/TASK-0297
- Created: 2026-11-13
- Updated: 2026-11-13
- Applies to: see Scope
- Source: ADR-0066 (the human's choice of one planning convention, 2026-11-13) and the read-only design in TASK-0294's log

## Objective

`skills/project-workflow/scripts/migrate-layout.py`: read TODO.md headings or GOALS.md for sprints, compute the old-to-new map (ADR-0066 clauses 2 and 3), print it by default, and with `--write` perform the moves with `git mv`, write `.ai/id-map.tsv`, convert the live files and rewrite path references only.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `.ai/decisions/0066-one-planning-convention.md` | accepted |
| TASK-0294's execution log | the design: layout map, id scheme, impact inventory |

## Scope

- In: The tool, its hermetic fixture tests (a throwaway repository on the old layout), and the gate wiring.
- Out: Running `--write` on this repository (TASK-0299).

## Likely files

The tool, its hermetic fixture tests (a throwaway repository on the old layout), and the gate wiring.

## Execution plan

1. Re-read ADR-0066 and the design; confirm the earlier tasks have landed.
2. Write the check that fails today, then the change.
3. Run the checks named below and `tests/validate.sh`.

## Acceptance criteria

- [ ] On a fixture repository, the dry run prints the map and changes nothing; `--write` leaves a tree whose every brief resolves through the map
- [ ] `git log --follow` finds a moved brief's history
- [ ] Ids inside historical files are untouched; path references are rewritten

## Mandatory validations

- [ ] tests/validate.sh

## Risks and rollback

- Risk: medium.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next: TASK-0298 follows

## Execution log

- 2026-11-13 · Claude Code (Opus 5.5, coordinator) · brief written from ADR-0066 and the design; no work done yet
  - Evidence: none yet
  - Deviation: none
