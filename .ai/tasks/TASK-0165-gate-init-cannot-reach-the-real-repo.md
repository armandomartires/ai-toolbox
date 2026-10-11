# TASK-0165 — Keep the gate's throwaway `git init` out of the real repository

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-11
- Updated: 2026-10-11
- Applies to: `tests/test-vault-secrets.sh`, `tests/validate.sh`, `.ai/context/CURRENT_STATE.md`
- Source: found while committing `TASK-0163` from a linked worktree; human chose a separate task, 2026-10-11

## Objective

Committing from a linked worktree set `core.bare = true` in the main repository's shared config twice, and every checkout and worktree then failed with `this operation must be run in a work tree`. The pre-commit hook exports `GIT_DIR` (the worktree's admin directory), and `test-vault-secrets.sh`'s T28-T35 run `git init` with the inherited environment, so they re-initialise the real repository. Clear the variables, and make the gate catch the next suite that forgets.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `tests/test-vault-secrets.sh` | `subprocess.run(["git", "init", …])` with `os.environ`; no unset |
| `check-publish.sh`, `check-vendor.sh`, `test-worktree.sh`, `test-private-names.sh` | already clear the locator variables (`TASK-0127` onward) |
| main `.git/config` | `core.bare` restored to `false` by hand, on the human's yes |

## Scope

- In: the same `unset` block as `check-publish.sh` at the top of `test-vault-secrets.sh`; a static check in `validate.sh` over `tests/*.sh` and `skills/*/scripts/check-*.sh`.
- Out: scripts that write to git without an init; `vault_secrets.py` itself, which runs git only where its caller points it; the main checkout's uncommitted `emit-agents.py`/`install.sh` edits, which are not this session's.

## Likely files

- `tests/test-vault-secrets.sh`, `tests/validate.sh`, `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`, this brief

## Execution plan

1. Red-prove: a decoy repository with a linked worktree; run the suite with `GIT_DIR` and `GIT_INDEX_FILE` set to that worktree's admin directory; read the decoy's `core.bare`.
2. Add the `unset` block; run the same proof.
3. Add the static check; prove it fires on the pre-fix suite.
4. `tests/validate.sh`; commit through the hook from the worktree, then check `core.bare`.

## Acceptance criteria

- [x] Before the fix the decoy's `core.bare` goes `false` → `true`; after it stays `false` and the suite passes with the decoy set.
- [x] The static check names `tests/test-vault-secrets.sh` when its `unset` is removed, and is silent on today's tree.
- [x] This task's commit goes through the pre-commit hook from a linked worktree, and the main config still reads `core.bare = false` afterwards.

## Mandatory validations

- [x] tests/validate.sh (WSL, AlmaLinux-10)
- [x] decoy red/green proof of `tests/test-vault-secrets.sh`

## Risks and rollback

- **The static check is textual.** An init spelled another way, or an unset placed after it, passes; the decoy proof is what shows the behaviour.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `test-vault-secrets.sh` | clears the git locator variables before any git call |
| `validate.sh` | `GIT-LOCATORS:` check over suites that run an init |

Next: land `TASK-0163` through the hook.

## Execution log

- 2026-10-11 · Claude Code (Opus 5.5) · done
  - Evidence: pre-fix suite with a decoy worktree `GIT_DIR` → `109/113 passed`, decoy `core.bare` `false` → `true`
  - Evidence: after the fix, same proof → `113/113 passed`, decoy `core.bare` stays `false`
  - Evidence: the static check on the pre-fix suite → `GIT-LOCATORS: tests/test-vault-secrets.sh…`; on today's tree → silent
  - Evidence: `tests/validate.sh` (AlmaLinux-10) → `validate.sh: OK`; commit through the hook from the worktree, then `git config core.bare` → `false`
  - Deviation: a plain decoy `.git` was not enough (re-init keeps `bare = false`); the proof needs a linked worktree's admin directory, as the hook has.
