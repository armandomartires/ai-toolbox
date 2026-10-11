# TASK-0155 — Declare a project's secrets backend: secrets.conf, init, the local backend

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-11
- Updated: 2026-10-11
- Applies to: `skills/vault-secrets/`, `skills/project-workflow/` (scaffolding step), WSL gate host
- Source: human request 2026-10-11 (choose secrets handling at scaffolding; a Vault KV store per project); `ADR-0034`

## Objective

Let a project declare where its secret values live (`local`, `vault`, `gitlab`, `github`) and have project-workflow ask at scaffolding. This task delivers the declaration, `init` and the complete local backend. Vault provisioning is `TASK-0156`; GitLab/GitHub `put` and `check` are `TASK-0157`.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `skills/vault-secrets/scripts/vault_secrets.py` | 1.1.1: map-driven Vault only; no conf, no `init` |
| `tests/test-vault-secrets.sh` | T1–T27, 50 cases, green on WSL |
| `skills/project-workflow/SKILL.md` | 6.0.0, five scaffolding steps, no secrets question |
| `ADR-0030` clauses 1 and 6 | one prefix per project in `kv/`; CI holds only CI-consumed secrets |

## Scope

- In: `ADR-0034`; `secrets.conf` parsing and validation; `init`; the local `.env` backend's `exec`, `put` and `check`; `exec` refusing `gitlab`/`github`; project-workflow step 6 and its reference table; the vault-secrets scope (2.0.0).
- Out: `provision` and per-project Vault policies (`TASK-0156`); GitLab/GitHub API writes (`TASK-0157`); the project-migration scaffold (`ai-project-scaffold.sh`); a `secrets.conf` for ai-toolbox itself, which stays on the shared `kv/` mount.

## Likely files

- `skills/vault-secrets/{scripts/vault_secrets.py,SKILL.md}`, `tests/test-vault-secrets.sh`
- `skills/project-workflow/{SKILL.md,templates/reference/environments-and-secrets.md}`
- `.ai/decisions/0034-per-project-secrets-backend.md`, `AGENTS.md`, `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`

## Execution plan

1. Write `ADR-0034` on the v2 template.
2. Add `load_conf`/`validate_conf` (strict keys, a name pattern, reserved mount names, backend-specific keys).
3. Add `init`: write the conf, then `.gitignore`, `.env.example` and, for vault, `secrets.map`. Never overwrite.
4. Add the local backend (`exec_local`, `put_local`, `check_local`) and dispatch on the declared backend. No conf keeps today's path.
5. Add T28–T35 and run them red against `HEAD`'s script, then green.
6. Add project-workflow step 6 and the backend table; bump the versions.

## Acceptance criteria

- [x] No `secrets.conf`: T1–T27 unchanged and green.
- [x] `init` is idempotent, refuses a different backend, a reserved or malformed name, and a key for another backend, and writes nothing when refused.
- [x] `.env.example` stays addable even when `.gitignore` already held a lone `!.env.example`.
- [x] A local `put` writes mode 600, replaces the line rather than duplicating it, and refuses while `.env` is not git-ignored.
- [x] `exec` refuses `gitlab`/`github` with exit 2 and runs nothing.
- [x] No local value appears in any output (T15 widened).

## Mandatory validations

- [x] tests/validate.sh (WSL)
- [x] tests/test-vault-secrets.sh against `HEAD`'s script (red proof)

## Risks and rollback

- **Git Bash on Windows cannot run this suite:** `getpass` there reads the console, not stdin, so T1 times out. That was already true before this task. WSL is the gate host.
- **`init` appends to `.gitignore`.** It only adds lines and never removes one.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `vault_secrets.py` | `init`; `secrets.conf` dispatch; local `.env` backend; CI backends refuse `exec`, and `put`/`check` say "not implemented yet" |
| `tests/test-vault-secrets.sh` | T28–T35 added: 77 cases |
| `vault-secrets` | 2.0.0: scope includes declaring a backend |
| `project-workflow` | 6.1.0: scaffolding step 6 asks about secrets |
| `ADR-0034` | accepted; amends `ADR-0030` clauses 1 and 6 for new projects |

Next: `TASK-0156`, Vault `provision`: own KV v2 mount, three policies and an AppRole.

## Execution log

- 2026-10-11 · Claude Code (Opus 5.5) · done
  - Evidence: `bash tests/test-vault-secrets.sh` (WSL) → `test-vault-secrets: 77/77 passed`
  - Evidence: the same suite against `git show HEAD:…/vault_secrets.py` → `50/77 passed`; all 27 new cases fail
  - Evidence: `bash tests/validate.sh` (WSL) → `validate.sh: OK`
  - Deviation: the `exec` refusal for CI backends moved here from `TASK-0157`. It is three lines, and leaving it out would let `exec` misread a CI project as a Vault one.
