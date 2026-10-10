# TASK-0154 — project-workflow 6.0.0: concise schemas, docs and fixtures

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-10
- Updated: 2026-10-10
- Applies to: `skills/project-workflow/` (not `dashboard/`, which is vendored)
- Source: `PLAN-0007` phase 5, `B-054` (closes it)

## Objective

Apply `ADR-0033` to the sprint-brief framework: concise schemas with line budgets, a shorter `SKILL.md` and references, and fixtures that pass their own checker. Also correct the dashboard reference where it misstated what the vendored code reads.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `skills/project-workflow/SKILL.md` | `5.2.1`, 140 lines |
| `references/dashboard.md` | 401 lines; cycle time said to start at the Execution log's `Date:` |
| `fixtures/dashboard/tasks/*.md` | completed briefs with leftover `FILL` markers; `check-dashboard.sh` OK (36) |
| `dashboard/pm_metrics.py` | cycle time = Created → closed (read, not edited) |

## Scope

- In: schemas (task, adr, review, adhoc, README), `SKILL.md`, `references/dashboard.md`, `templates/00.CONVENTIONS.md`, `templates/reference/*`, fixtures, re-rendered templates.
- Out: `dashboard/` (vendored from `sigma-llmwiki`); `20.PLAN.md`, `30.ROADMAP.md` and `35.AD_HOC_TASKS.md` templates, which are already short.

## Likely files

- `skills/project-workflow/{SKILL.md,schemas/*,references/dashboard.md,templates/**,fixtures/**}`
- `.ai/` live files

## Execution plan

1. Task schema: preamble `Status/Sprint/Created/Updated/Points/Commits/Applies to/Depends on`; no rationale in `!body`; `max_lines: 80`.
2. ADR schema: drop `Provenance` (git is the record) and mark it `superseded`. Trim review and adhoc.
3. Rewrite `SKILL.md`, `schemas/README.md`, `references/dashboard.md` and the reference templates.
4. Regenerate the fixtures with their asserted values unchanged, then run both checkers.
5. Close `B-054`.

## Acceptance criteria

- [x] `check-dashboard.sh` → `OK (36 assertions)` before and after.
- [x] Every fixture brief passes `check-artifact.sh`; `incomplete-task.md` still fails on all five defects.
- [x] `00.CONVENTIONS.md` is within its own 3,072-byte budget (3,056).
- [x] `references/dashboard.md` matches `pm_metrics.py`: cycle time Created → closed, lead time first evidence → closed; the sprint comes from the filename.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-templates.sh --check
- [x] skills/project-workflow/scripts/check-dashboard.sh

## Risks and rollback

- **Projects already scaffolded keep the 5.x templates.** That is by design: a copy is never updated retroactively.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `SKILL.md` | `6.0.0`, 81 lines (was 140) |
| `references/dashboard.md` | 150 lines (was 401); a *Fields that must keep their shape* table |
| `templates/reference/*` | 141 lines in total (was 359) |
| `schemas/task.md`, `adr.md` | `max_lines: 80`; ADR `Provenance` superseded |
| fixtures | five dashboard briefs pass `check-artifact.sh` |

Next: `PLAN-0007` is complete. The follow-ups (outside this plan) are in `CURRENT_STATE.md`.

## Execution log

- 2026-10-10 · Claude Code (Opus 5.5) · done; B-054 closed
  - Evidence: `check-dashboard.sh` → `OK (36 assertions, sprint-brief fixture)`; `check-artifact.sh` on the five fixture briefs → `OK` ×5; `incomplete-task.md` → 5 findings, rc 1
  - Evidence: `tests/validate.sh` → `validate.sh: OK`
  - Deviation: `00.CONVENTIONS.md` went to 3,151 bytes after the Definition of Done edit, and was trimmed back to 3,056.
