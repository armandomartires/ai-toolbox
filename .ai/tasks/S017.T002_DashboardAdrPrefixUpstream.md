# TASK-0295 — The dashboard is owned here and reads ADR-NNNN file names and the id map

## Status

- Status: review
- Owner: agent
- Branch: agent/TASK-0295
- Created: 2026-11-13
- Updated: 2026-11-13
- Applies to: see Scope
- Source: ADR-0066 (the human's choice of one planning convention, 2026-11-13) and the read-only design in TASK-0294's log

## Objective

The dashboard matched decisions by `^(\d{4})-(.+)\.md$` only, so `ADR-0013-x.md` would show no decisions, and old `(TASK-NNNN)` commits could not date a renamed brief. sigma-llmwiki, which it was vendored from, is retired (the human, 2026-11-13), so make ai-toolbox its owner and change it here: both decision names, and `.ai/id-map.tsv` linking old ids to renamed briefs.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `skills/project-workflow/dashboard/` | a vendored copy with `VENDORED.md` |
| ADR-0066 clause 7 | an upstream change |

## Scope

- In: ownership (`VENDORED.md` replaced by `OWNERSHIP.md`, the "vendored" wording in the skill), `pm_collect.py` (both names, the id map, the close date from a subject-named commit), `check-dashboard.sh` and a converted fixture, AGENTS.md's line, ADR-0066 clause 7 amended.
- Out: `vendor-skill.sh`, which vendors the whole skill into other repositories, unchanged.

## Likely files

`skills/project-workflow/dashboard/`, `scripts/check-dashboard.sh`, `scripts/build-dashboard.sh`, `SKILL.md`, `references/dashboard.md`, `fixtures/dashboard-converted/`, the plugin copy, AGENTS.md, `.gitignore`, ADR-0066.

## Execution plan

1. Re-read ADR-0066 and the design; confirm the earlier tasks have landed.
2. Write the check that fails today, then the change.
3. Run the checks named below and `tests/validate.sh`.

## Acceptance criteria

- [x] A decisions folder with both `NNNN-` and `ADR-NNNN-` names counts every ADR; an id map links an old commit id to its new brief
- [x] `check-dashboard.sh` passes, and `build-dashboard.sh` on this repository shows its 64 decisions

## Mandatory validations

- [x] tests/validate.sh: in the pre-commit hook

## Risks and rollback

- Risk: medium.
- Authorized by the human 2026-11-13 ("Authorize 0295"); re-scoped the same day when the human said sigma-llmwiki is retired, so nothing changes outside this repository.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `skills/project-workflow/dashboard/` | owned here (`OWNERSHIP.md`); `ADR_FILE_RE` takes both names; `load_id_map()` and `Git.apply_id_map()` link old ids; a subject-named commit dates a sprint-brief task |
| `check-dashboard.sh` | a second block on `fixtures/dashboard-converted/` (14 assertions) |

Next: TASK-0296 follows

## Execution log

- 2026-11-13 · Claude Code (Opus 5.5, coordinator) · brief written from ADR-0066 and the design; no work done yet
  - Evidence: none yet
  - Deviation: none
- 2026-11-13 · Claude Code (Opus 5.5, coordinator; builder worker S295, Sonnet 5.5) · re-scoped after the human said sigma-llmwiki is retired; written in an isolated worktree and merged here
  - Evidence: red: the converted fixture gave decisions `[2]` not `[1, 2, 3]` and wrong close dates (7 mismatches); green: `OK (36 assertions, sprint-brief fixture)` and `OK (14 assertions, converted repository)`; a build on this repository showed 64 decisions and 286 tasks
  - Deviation: no upstream change; the id map is proven on the fixture only until TASK-0299
