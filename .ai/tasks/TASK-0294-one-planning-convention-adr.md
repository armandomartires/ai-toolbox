# TASK-0294 — Record one planning convention in ADR-0066, superseding ADR-0013

## Status

- Status: review
- Owner: agent (Claude Code)
- Branch: agent/compass-3556f4
- Created: 2026-11-13
- Updated: 2026-11-13
- Applies to: `.ai/decisions/`, `skills/project-workflow/SKILL.md`, `skills/project-migration/SKILL.md`, the S12 briefs
- Source: the human's review of the planning-skills explainer, 2026-11-13 ("apply all fixes", gap 3 of 3), the convention the human chose and the four answers given that day

## Objective

Record the human's decision: both planning skills use project-workflow's numbered layout and sprint-prefixed task ids, with `ADR-NNNN-title.md` ADR files and the additions the design keeps. Supersede ADR-0013, say so where both skills describe two frameworks, and open the tasks that carry it out.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| ADR-0013 | accepted: two frameworks, deliberately |
| The read-only design (architecture worker A1, Opus 5.5) | layout map, id scheme, impact inventory, task order, seven questions |

## Scope

- In: ADR-0066; ADR-0013's status; both SKILL.md pointers; briefs TASK-0295 to TASK-0302; sprint S12 on the board and in TODO.md.
- Out: implementing the convention (TASK-0295 to TASK-0302).

## Likely files

`.ai/decisions/0066-one-planning-convention.md`, `.ai/decisions/0013-*.md`, both `SKILL.md` files and their plugin copies, `.ai/tasks/TASK-0295..0302-*.md`, `.ai/tasks/TODO.md`, `.ai/GOALS.md`.

## Execution plan

1. Design read-only; put the open questions to the human.
2. Write the ADR from the answers; mark ADR-0013 superseded; point both skills at it.
3. Write the eight briefs with their risk and authorization flags.

## Acceptance criteria

- [x] ADR-0066 states layout, ids, sprint mapping, brief shape, history rule, GOALS.md and the dashboard change, with the human's four answers
- [x] ADR-0013 marked superseded by ADR-0066; both SKILL.md files point at it
- [x] TASK-0295 to TASK-0302 exist as briefs; TASK-0295, 0299, 0300 and 0301 name the authorization they need

## Mandatory validations

- [x] tests/validate.sh: in the pre-commit hook

## Risks and rollback

- The design's counts are from a grep on 2026-11-13; TASK-0297's dry run is the real inventory.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| ADR-0066 | accepted 2026-11-13 by the human |
| TASK-0295 to TASK-0302 | todo, sprint S12 |

Next: TASK-0295 needs the human's go-ahead for a change in sigma-llmwiki.

## Execution log

- 2026-11-13 · Claude Code (Opus 5.5, coordinator; architecture worker A1) · design read-only, then the human's answers: hybrid brief; S1–S11 as S001–S011 and the Post buckets as S012–S016; the sigma-llmwiki change allowed; 10.CURRENT_STATE, 40.RISK_REGISTER and sessions kept, paths rewritten but not ids, GOALS.md kept
  - Evidence: the design's counts: 276 briefs, 63 ADRs, 13 reviews, 31 sessions, 74 backlog rows, 290 board items, about 4,762 `TASK-NNNN` mentions in 408 `.ai/` files and 1,000 in 191 others; blockers found: `pm_collect.py:102` rejects `ADR-` names, `pm_collect.py:485-507` keeps only the majority layout, Compass names `[A-Za-z0-9_]+` (`plan.ts:71`)
  - Deviation: none
