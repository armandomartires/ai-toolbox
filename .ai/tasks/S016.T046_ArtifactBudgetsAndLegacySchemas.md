# TASK-0151 — Artifact line budgets and frozen v1 schemas

## Objective

Give the artifact engine a `max_lines` schema key, and let the gate check old briefs and ADRs against frozen v1 shapes. This lets `TASK-0152` change the schemas without failing 157 historical artifacts. `PLAN-0007` phase 2, `B-054`.

## Minimal context

Schema conformance checked every brief from `TASK-0024` on, and every ADR, against the *current* schema. So any change to a section or to section order would have failed history, and `ADR-0033` forbids rewriting history.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/project-workflow/scripts/artifact_lib.py` | `TASK-0109` | no budget support |
| `tests/validate.sh` conformance block | `TASK-0110`, `TASK-0146` | one schema per kind |

## Scope

### Included

- `max_lines` in `check()`, plus a gate red proof that runs every time.
- `tests/legacy-schemas/{task,adr}-v1.md`, which are frozen copies.
- The `FIRST_V2_TASK=153` and `FIRST_V2_ADR=34` boundaries.
- Shorter headers in `artifact_lib.py`, `check-artifact.sh` and `new-artifact.sh`, with the copies re-synced.

### Not included

- Any schema change. That is `TASK-0152`.
- A `SKILL.md` length cap. `ADR-0008` still governs that.

## Likely files

`skills/project-workflow/scripts/{artifact_lib.py,check-artifact.sh,new-artifact.sh}`, their project-migration copies, `tests/validate.sh`, `tests/legacy-schemas/`.

## Execution plan

1. Add `max_lines`, then trim the headers.
2. Freeze the v1 schemas and route artifacts by number.
3. Add the gate red proof.
4. Run the mutant proofs, then `tests/validate.sh`.

## Acceptance criteria

- [x] An artifact over `max_lines` fails `check()`; one exactly at the budget passes.
- [x] A required heading added to `task-v1.md` fails 124 briefs, and added to `adr-v1.md` fails 33 ADRs. So routing is real.
- [x] `tests/validate.sh` passes.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-artifact-engine.sh --check
- [x] scripts/sync-registry.sh (if components changed): no component metadata changed

## Risks and rollback

- **The legacy copies drift from the briefs they check.** They are frozen; only a lowered boundary could expose a brief to a newer shape.
- **Rollback:** `git revert` the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `artifact_lib.py` (both copies) | `max_lines` reported as `over budget: N lines > max_lines M` |
| `tests/validate.sh` | `BUDGET` red proof; v1/v2 routing for briefs and ADRs |
| `tests/legacy-schemas/` | `task-v1.md`, `adr-v1.md` |

**Next task starts here**: `TASK-0152`. Rewrite the project-migration task and ADR schemas to v2.

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-10
- Updated: 2026-10-10

## Execution log

### Attempt 1

- Date: 2026-10-10
- Agent: Claude Code (Opus 5.5)
- Actions: as planned. Mutants were run in WSL and restored from copies.
- Observations:
  - Budget check disabled (`if False:`): `BUDGET: max_lines is not enforced`.
  - `## Bogus required` added to `task-v1.md`: `ARTIFACTS: 124 artifact(s) do not match`.
  - The same heading added to `adr-v1.md`: `33 artifact(s)`.
  - Python's string escaping turned a `sed` backreference in `num_of` into `\x01`; caught by `cat -A` and fixed.
- Validation: `tests/validate.sh` (WSL): `validate.sh: OK`.
- Result: done.
- Commit: in git; the subject carries `TASK-0151`.
- Push: reported in the task report.
