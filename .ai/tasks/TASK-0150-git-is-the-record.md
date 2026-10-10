# TASK-0150 — Git is the record: ADR-0033 and one commit per task

## Objective

Record `ADR-0033` (concise artifacts) and `PLAN-0007`, and replace the two-commit "record commit" rule with *git is the record*. Raised as `B-054`, on the human's request of 2026-10-10.

## Minimal context

`AGENTS.md` required a second commit per task only to write the task commit's hash and push range into the brief. `ADR-0033` gives the reason for dropping it.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `AGENTS.md` | `ccc1855` | *Recording the hash takes two commits* block |
| `docs/operations/runbook.md` | `TASK-0099` | landing step edits the placeholders in a follow-up commit |
| `skills/unattended-ops/templates/bindings/opencode/driver.py` | `TASK-0099` | `log_lines` returns `Commit: pending — recorded at landing` |

## Scope

### Included

- `ADR-0033`, `PLAN-0007` and `B-054`.
- `AGENTS.md`: the git rules, a task-report shape, the definition of done, and the `CURRENT_STATE` rule.
- The runbook's landing step, plus the driver's `Commit:` line, its test, and `agents/closer`. `unattended-ops` goes to `1.3.2`.

### Not included

- Schema and engine changes. Those are `TASK-0151` and `TASK-0152`.
- Closed briefs, which keep their recorded hashes.

## Likely files

`.ai/decisions/0033-*`, `.ai/planning/plans/PLAN-0007-*`, `.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`, `AGENTS.md`, `docs/operations/runbook.md`, `agents/closer/agent.md`, `skills/unattended-ops/**`.

## Execution plan

1. Write the ADR, the plan and the backlog row.
2. Edit `AGENTS.md` and the runbook.
3. Change the driver line, its test and the closer.
4. Run `test_driver.py` and `tests/validate.sh`, then commit and push.

## Acceptance criteria

- [x] `AGENTS.md` no longer asks for a record commit, and states the task-report shape.
- [x] The driver's tests pass with the new `Commit:` line.
- [x] `check-backlog-closures.py` reports 1 open row, matching the sentence.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed): the registry shows no versions and is unchanged
- [x] `skills/unattended-ops/templates/bindings/opencode/tests/test_driver.py`

## Risks and rollback

- An unattended run from an older binding copy writes the old placeholder. The driver it ships with checks its own lines, so this is harmless.
- Rollback: `git revert` the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `ADR-0033`, `PLAN-0007` | accepted; five tasks planned |
| `AGENTS.md` | git is the record; task report shape |
| `driver.py` | `Commit: in git — the subject carries the task id (run <id>)` |

**Next task starts here**: `TASK-0151`, engine `max_lines` and legacy schemas.

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
- Observations: baseline dashboard payload (146 tasks, 145 done, `--check` clean) saved outside the repo for the `PLAN-0007` diff.
- Validation: `test_driver.py`: `Ran 34 tests … OK`; `tests/validate.sh` (WSL): `validate.sh: OK`.
- Result: done.
- Commit: in git — the subject carries `TASK-0150`.
- Push: reported in the task report.
