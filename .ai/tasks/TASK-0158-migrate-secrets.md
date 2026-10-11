# TASK-0158 — Let project-migration migrate secrets, and import an old env file

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-11
- Updated: 2026-10-11
- Applies to: `skills/project-migration/`, `skills/vault-secrets/`, WSL gate host
- Source: human request 2026-10-11 ("project-migration ... choose if he wants to migrate secrets also"); `ADR-0034`

## Objective

When `project-migration` retrofits an existing repository, the user chooses whether its secrets move too, and to which backend. `vault_secrets.py import` moves an existing env file's values into that backend without anyone retyping them, and without an agent ever seeing a value.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `skills/project-migration/SKILL.md` | 4.0.0; Phase 1 notes "secrets exposure", with no choice and no procedure |
| `vault_secrets.py` | `TASK-0157`: four backends; values are written one at a time with `put` |
| `ADR-0034` | backends declared per project in `secrets.conf` |

## Scope

- In: project-migration Phase 1 (inventory by name; ask whether and where) and a new Phase 3b; `import --from FILE [--dry-run] [VAR…]` on every backend; SKILL.md and runbook.
- Out: the scaffold script's generated `AGENTS.md` (its secrets policy still holds); importing from a shell profile or a CI page (that stays `put`); deleting the old file (the human's).

## Likely files

- `skills/project-migration/SKILL.md`, `skills/vault-secrets/{scripts/vault_secrets.py,SKILL.md}`
- `tests/test-vault-secrets.sh`, `docs/operations/runbook.md`, `.ai/` live files

## Execution plan

1. Give the four writers an optional value parameter, and factor `writer_token` out of `cmd_put`.
2. Add `cmd_import`. It plans first: a name is skipped if it is undeclared, empty, or unmapped for `vault`. If an explicitly named variable is skipped, it refuses and writes nothing. Then it writes, with one login per batch.
3. Let the stub serve the project's own mount; add T50–T55; prove them red against `HEAD`'s script.
4. project-migration: add the Phase 1 inventory and question, Phase 3b, and a hard rule.

## Acceptance criteria

- [x] `--dry-run` contacts nothing and lists each name with its destination, or the reason it is skipped (T50).
- [x] The vault import writes into the project's own mount and leaves the source file in place (T51).
- [x] Naming a variable that cannot be imported exits 2 and writes nothing (T52).
- [x] Local, GitHub (value on stdin) and GitLab (token asked once) imports work (T53–T55).
- [x] No imported value reaches any output (T15).
- [x] project-migration never assumes either answer, and records a decline so the question is not asked again.

## Mandatory validations

- [x] tests/validate.sh (WSL)
- [x] tests/test-vault-secrets.sh against `HEAD`'s script (red proof)

## Risks and rollback

- **A batch can stop part-way** if one write fails. The earlier writes stand. A re-run is safe: vault re-reads with check-and-set, GitLab updates in place, and `gh` and `.env` overwrite.
- **Moving a once-committed secret does not un-leak it.** Phase 3b says to rotate it.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `project-migration` | 4.1.0: Phase 1 asks; Phase 3b moves secrets; a hard rule |
| `vault_secrets.py` | `import`; writers take a value; `writer_token` |
| `tests/test-vault-secrets.sh` | T50–T55: 113 cases |
| `vault-secrets` | 2.3.0 |

Next: the first real migration that chooses to move secrets exercises `import` live. Record it in that repository's task.

## Execution log

- 2026-10-11 · Claude Code (Opus 5.5) · done (stub-verified)
  - Evidence: `bash tests/test-vault-secrets.sh` (WSL) → `test-vault-secrets: 113/113 passed`
  - Evidence: the same suite against `git show HEAD:…/vault_secrets.py` → `107/113 passed`; T50, T51, T53, T54 and T55 fail
  - Evidence: `bash tests/validate.sh` (WSL) → `validate.sh: OK`
  - Deviation: none
