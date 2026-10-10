# TASK-0152 — project-migration v2: concise task and ADR schemas

## Objective

Rewrite project-migration's task and ADR schemas to the v2 shape of `ADR-0033`, trim the other schemas' guidance, and bring the skill's docs in line. This is `PLAN-0007` phase 3, for `B-054`.

## Minimal context

The v1 task schema produced briefs with a median of 240 lines, and the dashboard reads every v1 ADR as `unknown`. `TASK-0151` froze v1 for history, so the change applies from `TASK-0153` and `ADR-0034`.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/project-migration/schemas/task.md` | `TASK-0110` | v1, 275 lines |
| `skills/project-migration/references/governance-spec.md` | pre-existing | outline with retired sections |
| `tests/legacy-schemas/` | `TASK-0151` | v1 frozen |

## Scope

### Included

- **Task schema:** `## Status` first, with `Applies to` and `Source`; Scope as In/Out bullets; a one-line log per attempt; `max_lines: 90`.
- **ADR schema:** a `**Status**`/`**Date**`/`**Task**` preamble, `max_lines: 80`.
- **Review, session, plan and backlog schemas:** census comments and "Delete this comment" removed; shapes unchanged.
- Templates re-rendered.
- **`governance-spec.md`:** rewritten, with the live-file budgets and the task report.
- **`SKILL.md`:** `4.0.0`.
- **The scaffold's `AGENTS.md` rules:** git is the record, plus the task report.

### Not included

- project-workflow's schemas. That is `TASK-0154`.
- Compacting the live files. That is `TASK-0153`.

## Likely files

`skills/project-migration/{schemas,templates,references,scripts/ai-project-scaffold.sh,SKILL.md}`, `.ai/templates/*`.

## Execution plan

1. Rewrite the task and ADR schemas, and trim the other four.
2. Run `scripts/sync-templates.sh`.
3. Update `governance-spec.md`, `SKILL.md` and the scaffold.
4. Red-prove the v2 schema, then run `tests/validate.sh`.

## Acceptance criteria

- [x] A filled v2 brief with an extra `## Minimal context` passes `check-artifact` at 59 lines.
- [x] The same brief padded to 91 lines fails with `over budget`.
- [x] A rendered ADR opens with `**Status**: proposed` / `**Date**:`, which the dashboard reads.
- [x] `tests/validate.sh` passes. The HANDOVER and SCAFFOLD checks are unchanged and green.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-templates.sh --check (inside the gate)
- [x] scripts/sync-registry.sh (if components changed): registry has no versions, unchanged

## Risks and rollback

- **A repository migrated earlier keeps v1 templates.** Its templates are point-in-time copies by design (B-051).
- **Rollback:** `git revert` the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `schemas/task.md` | v2, 165 lines (was 275) |
| `schemas/adr.md` | v2, 67 lines (was 109) |
| `.ai/templates/TASK.md` | 82 lines (was 117) |
| `governance-spec.md` | outline replaced by a pointer to the schema; live-file budgets |
| `SKILL.md` | `4.0.0`, 72 lines |

**Next task starts here**: `TASK-0153`, the first v2 brief, compacting the live files.

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-10
- Updated: 2026-10-10

## Execution log

### Attempt 1

- Date: 2026-10-10
- Agent: Claude Code (Opus 5.5)
- Actions: as planned.
- Observations:
  - The red proof printed `OK` at 59 lines.
  - At 91 lines it printed `over budget: 91 lines > max_lines 90 (ADR-0033)`.
  - The raw skeleton failed on `unfilled generator marker`.
  - The first draft of `governance-spec.md` changed the target layout's ADR names to `NNNN-*`. ADR-0013 keeps `ADR-NNNN-*` for this framework, so the names were reverted.
- Validation: `tests/validate.sh` (WSL): `validate.sh: OK`.
- Result: done.
- Commit: in git — the subject carries `TASK-0152`.
- Push: reported in the task report.
