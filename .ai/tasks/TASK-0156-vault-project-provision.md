# TASK-0156 — Provision a Vault project's own KV mount, policies and AppRole

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-11
- Updated: 2026-10-11
- Applies to: `skills/vault-secrets/`, `docs/operations/runbook.md`, WSL gate host
- Source: human request 2026-10-11 ("a new vault kv store for each new project"); `ADR-0034` clauses 3–4

## Objective

Give a project that declares `backend = vault` a repeatable way to get its own KV v2 mount, policies `<p>-read`, `<p>-write` and `<p>-app`, and AppRole `<p>`. Until now every Vault path was created by hand or by a one-time script kept out of the repo.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `vault_secrets.py` | `TASK-0155`: `secrets.conf` and `init`; no Vault administration |
| `references/vault-layout.md` | shared `kv/` prefixes only; no per-project mount, no provisioner policy |
| `ADR-0031` | AppRole limits: 10m / 30m / 8760h, no delete |

## Scope

- In: `provision [--dry-run]`; the three policy HCL assets; `login` handing `<p>-read` down; `check` naming map entries outside the project's mount; the *A project's own mount* section of `vault-layout.md`; the runbook's *New project secrets*.
- Out: issuing `secret_id`s (per host, a human step); LDAP mappings (the estate's); a live run against the intranet Vault, which needs the human's admin login (see Next); GitLab/GitHub (`TASK-0157`).

## Likely files

- `skills/vault-secrets/{scripts/vault_secrets.py,assets/policies/*.hcl,SKILL.md,references/vault-layout.md}`
- `tests/test-vault-secrets.sh`, `docs/operations/runbook.md`, `.ai/` live files

## Execution plan

1. Render policies from `assets/policies/*.hcl` through literal `asset()` calls, so the gate's UNTRACKED ASSET check sees them.
2. Read phase: mount, three policies, `sys/auth`, role. Refuse anything that exists in another shape before any write.
3. Write phase: only the missing objects, with an admin token held in memory. Refuse root and AppRole tokens.
4. Extend the stub with `sys/mounts`, `sys/policies/acl`, `sys/auth`, role endpoints and PUT/DELETE; add T36–T43; prove red against `TASK-0155`'s script.
5. Document the provisioner policy and the procedure.

## Acceptance criteria

- [x] The first run creates the mount, three policies and the role: five writes, all with the admin token.
- [x] A second run writes nothing and prints five `unchanged:` lines.
- [x] A non-KV-v2 mount, a policy with a different body, and a missing `approle/` are each refused with zero writes.
- [x] A root token, an AppRole identity, and a token without the provisioner policy are each refused.
- [x] `--dry-run` sends no request at all; no DELETE is ever sent (T42).
- [x] `login` in a vault project requests `<p>-read` only if the LDAP login holds it, and warns otherwise.

## Mandatory validations

- [x] tests/validate.sh (WSL)
- [x] tests/test-vault-secrets.sh against `TASK-0155`'s script (red proof)

## Risks and rollback

- **The stub is not Vault.** Two answers are taken from Vault's documentation, not observed: the 400 for an unknown mount, and `sys/auth` needing `sudo`. The first live run must confirm them.
- **`secrets-provisioner` can write any policy.** The tool's refusals guard against accidents only, so the policy belongs on a person's fresh login.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `vault_secrets.py` | `provision [--dry-run]`; `login` adds `<p>-read`; `check` notes entries on other mounts |
| `assets/policies/` | `read.hcl`, `write.hcl`, `app.hcl`; none can delete |
| `tests/test-vault-secrets.sh` | T36–T43: 94 cases |
| `vault-layout.md`, runbook | *A project's own mount*; *New project secrets* |
| `vault-secrets` | 2.1.0 |

Next: a human runs `provision --dry-run`, then `provision` twice, on a throwaway project name against the intranet Vault, and records the output here.

## Execution log

- 2026-10-11 · Claude Code (Opus 5.5) · done (stub-verified; live run pending the human)
  - Evidence: `bash tests/test-vault-secrets.sh` (WSL) → `test-vault-secrets: 94/94 passed`
  - Evidence: the same suite against `git show HEAD:…/vault_secrets.py` → `79/94 passed`; the T36–T40 and T43 cases fail
  - Evidence: `bash tests/validate.sh` (WSL) → `validate.sh: OK`
  - Deviation: `check` warns about map entries on another mount, instead of checking that the mount exists. A read token cannot see `sys/mounts`.
