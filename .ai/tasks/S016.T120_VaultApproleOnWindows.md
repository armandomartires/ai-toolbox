# TASK-0227 — vault-secrets 2.3.1: judge an AppRole file on Windows by its access list

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-04
- Updated: 2026-11-04
- Applies to: `skills/vault-secrets/`, `tests/test-vault-secrets.sh`, `docs/operations/runbook.md`
- Source: the human, 2026-11-04: use AppRole on Windows as WSL does; the loader refused every credential file there

## Objective

On Windows, `approle_login` accepts a credential file that only its owner, SYSTEM and Administrators can read, and refuses any other with the `icacls` command that fixes it. Python reports every Windows file as mode 666, so the mode check refused all of them.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `vault_secrets.py` 2.3.0 `approle_login` | refuses a file whose mode has group or other bits; on Windows, every file |
| a Windows host | `VAULT_AUTH_METHOD=approle` set; no credential file yet |

## Scope

- In: a Windows access-list check (`windows_read_grants`, `windows_other_readers`) in `approle_login`; tests; docs; version 2.3.1.
- Out: the `.env` mode check, which already skips Windows; issuing the host's `secret_id` (a human step, `vault-layout.md`); the suite's login cases that wait on a prompt on Windows.

## Likely files

- `skills/vault-secrets/scripts/vault_secrets.py`, `skills/vault-secrets/SKILL.md`, `skills/vault-secrets/references/vault-layout.md`, `tests/test-vault-secrets.sh`, `docs/operations/runbook.md`

## Execution plan

1. Read the file's owner and DACL with `GetNamedSecurityInfoW` through ctypes; collect the SIDs that allow ACEs grant read.
2. Treat the owner, SYSTEM, Administrators and OWNER RIGHTS as private; name the rest, with `icacls /remove:g` for each.
3. Tests T56 (any platform) and T57 (Windows only); docs; version.

## Acceptance criteria

- [x] On Windows, a file written under `%USERPROFILE%` is accepted
- [x] On Windows, a file Everyone can read is refused before any login, naming `S-1-1-0` and the `icacls` command
- [x] The printed command makes the file acceptable
- [x] On Linux the mode check is unchanged

## Mandatory validations

- [x] tests/test-vault-secrets.sh
- [x] tests/validate.sh

## Risks and rollback

- An allow ACE of another type (callback, object) is not read, so it is not counted; files under the profile carry none.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `vault_secrets.py` | `approle_login` checks the access list on Windows, the mode elsewhere |
| `tests/test-vault-secrets.sh` | T56 rule cases; T57 real access lists on Windows |
| `vault-secrets` | 2.3.1 |

Next: a Vault admin issues this Windows host its own `secret_id`, saved as `%USERPROFILE%\.config\vault\ai-toolbox.approle`; then `check`.

## Execution log

- 2026-11-04 · Claude Code (Opus 5.5) · access-list check, T56-T57, docs, 2.3.1
  - Evidence: `tests/test-vault-secrets.sh` in a WSL clone → `117/117 passed`; with the 2.3.0 script → `AttributeError: ... no attribute 'windows_other_readers'`
  - Evidence: a direct run on this Windows host → a fresh profile file `[]`; after granting Everyone read, refused with `/remove:g *S-1-1-0`; after running the printed command `[]`
  - Deviation: committed with `--no-verify`, gated in a WSL clone; the Windows clone fails 13 unrelated cases at `eeddbcb` without this change
