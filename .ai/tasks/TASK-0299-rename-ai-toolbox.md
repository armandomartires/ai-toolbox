# TASK-0299 — Move ai-toolbox onto the one convention in one commit

## Status

- Status: todo
- Owner: agent
- Branch: agent/TASK-0299
- Created: 2026-11-13
- Updated: 2026-11-13
- Applies to: see Scope
- Source: ADR-0066 (the human's choice of one planning convention, 2026-11-13) and the read-only design in TASK-0294's log

## Objective

Run TASK-0297's tool with `--write` on this repository: about 400 files moved with `git mv`, `.ai/id-map.tsv` written, the live files (`00.CONVENTIONS`, `10.CURRENT_STATE`, `20.PLAN`, `30.ROADMAP`, `35.AD_HOC_TASKS`, `GOALS.md`, `AGENTS.md`) converted, path references rewritten. One commit.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `.ai/decisions/0066-one-planning-convention.md` | accepted |
| TASK-0294's execution log | the design: layout map, id scheme, impact inventory |

## Scope

- In: `.ai/`, `AGENTS.md`, `CLAUDE.md`, path references across the repository.
- Out: Rewriting ids in history (ADR-0066 clause 5); other repositories.

## Likely files

`.ai/`, `AGENTS.md`, `CLAUDE.md`, path references across the repository.

## Execution plan

1. Re-read ADR-0066 and the design; confirm the earlier tasks have landed.
2. Write the check that fails today, then the change.
3. Run the checks named below and `tests/validate.sh`.

## Acceptance criteria

- [ ] The gate passes; every brief, ADR and review resolves through the map; Compass shows the same board
- [ ] No other branch touches `.ai/` during the window

## Mandatory validations

- [ ] tests/validate.sh

## Risks and rollback

- Risk: HIGH.
- **Needs the human's authorization in this file before work starts:** about 400 renames and rewrites of live files (AGENTS.md, Destructive changes): the human authorizes it here and names a window with no other session on `.ai/`. Authorized: not yet.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next: TASK-0300 follows

## Execution log

- 2026-11-13 · Claude Code (Opus 5.5, coordinator) · brief written from ADR-0066 and the design; no work done yet
  - Evidence: none yet
  - Deviation: none
