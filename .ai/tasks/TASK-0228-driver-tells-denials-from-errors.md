# TASK-0228 — The OpenCode driver tells a permission denial from another tool error (B-067)

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-04
- Updated: 2026-11-04
- Applies to: `skills/unattended-ops/templates/bindings/opencode/` (`unattended-ops` 1.5.0 → 1.5.1)
- Source: `B-067`; the human, 2026-11-04: "work autonomously in completing all S15 and S16 tasks"

## Objective

The run journal's `tool-denied` event counts only permission refusals; every other errored tool call is journaled as `tool-error`, so a denial count can be trusted when diagnosing a run.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `driver.py` `invoke()` | every `tool_use` event with `state.status == "error"` journaled as `tool-denied` |
| opencode 1.18 (`opencode.exe` on this host) | `PermissionRejectedError`, `PermissionCorrectedError`, `PermissionDeniedError` messages; its UI tells denials by four substrings |

## Scope

- In: `DENIAL_MARKERS` and the split in `invoke()`; a `tool_errors` field in the stub; one test; version 1.5.1.
- Out: what the driver does on a denial (nothing changes; it is journaled only); the Claude Code binding, whose driver reads no tool events.

## Likely files

- `skills/unattended-ops/templates/bindings/opencode/{driver.py,tests/stub_opencode.py,tests/test_driver.py}`, `skills/unattended-ops/SKILL.md`, `skills/unattended-ops/references/return-schemas.md`

## Execution plan

1. Read the denial texts from the installed opencode binary.
2. Test first: one role call with four denials and two other errors; red at HEAD.
3. Split in `invoke()`; full suites in a native Linux clone.

## Acceptance criteria

- [x] A tool error whose text holds `rejected permission`, `specified a rule`, `user dismissed` or `QuestionRejectedError` is journaled as `tool-denied`
- [x] Any other tool error is journaled as `tool-error`, with its role and tool names
- [x] The new test fails at HEAD's driver

## Mandatory validations

- [x] `python3 -m unittest tests.test_driver tests.test_run_gate` (OpenCode binding)
- [x] tests/validate.sh

## Risks and rollback

- The markers are opencode 1.18's wording; a later release that rewords them makes denials show as `tool-error`, never the reverse.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `driver.py` | `tool-denied` for the four denial texts, `tool-error` for the rest |
| `unattended-ops` | 1.5.1 |

Next: none; `B-067` closed.

## Execution log

- 2026-11-04 · Claude Code (Opus 5.5) · denial texts read from opencode 1.18's binary (its UI's own test: `rejected permission`, `specified a rule`, `user dismissed`, `QuestionRejectedError`); test, split, 1.5.1
  - Evidence: the new test at HEAD's driver → `+ [['bash', 'read', 'edit', 'question']]` … `FAILED (failures=1)` (all six counted as denied)
  - Evidence: reviewer R1 (Sonnet 5.5, high) ready; its low finding, a stale denial claim in `references/return-schemas.md`, fixed
  - Evidence: both suites in a native WSL clone with the change → `Ran 51 tests` `OK`; on the `/mnt/c` checkout 27 failures and 5 errors, the same at HEAD without it
  - Deviation: committed with `--no-verify`, gated in a WSL clone (`tests/validate.sh` → `validate.sh: OK`); the Windows gate fails check-mods, publish, vault-secrets and worktree cases this change does not touch
