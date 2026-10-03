# TASK-0132 — Give ai-toolbox an AppRole identity; read several secret maps

## Objective

Teach `skills/vault-secrets/scripts/vault_secrets.py` the AppRole
authentication the human chose on 2026-10-04 for this codebase's own Vault
identity. With it, a command in this repo can read, create and edit secrets
under `kv/ai-toolbox/*` with no human password prompt. The loader also learns
to combine several map files, so the untracked private map can sit beside the
tracked `secrets.map`.

Human request, 2026-10-04: *"create a vault application token for this
codebase and allow it to create, edit and read passwords in the ai-toolbox KV
secrets. Then move all secrets from the .env file to the vault ai-toolbox."*

The human chose:
- **AppRole**, over a periodic token or a fixed one-year token.
- **A local, untracked map** for the moved names.
- **Removing the moved lines** from `.env`.
- **Removing the root `VAULT_TOKEN`** from `.env`.

Discharges no backlog item. Partly advances `B-052`.

## Minimal context

### Already done, before this brief, at the human's direct instruction

The Vault-side setup and the `.env` migration were **one-time actions on the
human's infrastructure and files, outside this repository**. They ran before
this brief was written, as the human asked, through an untracked script that
stays out of the repo. Its group names describe internal systems, and the
mirror is public. Recorded here, not reconstructed to look planned:

- **Policy `ai-toolbox-app`:**
  - `create`, `read`, `update` on `kv/data/ai-toolbox/*`;
  - `read`, `list` on `kv/metadata/ai-toolbox/*`;
  - **no `delete` or `destroy`**, so every overwrite stays recoverable as an
    earlier KV v2 version.
- **AppRole auth enabled.** Role `ai-toolbox`: tokens carry only that policy,
  `token_ttl` 10 min, `token_max_ttl` 30 min, `secret_id_ttl` 8760 h.
- **The credential** (`role_id`, `secret_id`, accessor) is in a private file
  under `~/.config/vault/`, mode 600, outside any repository. It was written,
  never printed.
- **AppRole login worked:** policies `['ai-toolbox-app', 'default']`, TTL
  600 s.
- **Migration.** The AppRole token wrote 32 values into 10 secrets under
  `kv/ai-toolbox/`. Each was read back and matched by sha256. Then:
  - the moved lines were removed from `.env`, which now holds only the two
    non-secret URLs;
  - the root `VAULT_TOKEN` line was already gone;
  - a private map with 31 entries was written beside the credential.
- **Side effect:** `GITLAB_PUSH_TOKEN` reached Vault, which closed `TASK-0131`
  (`d93442b`).

### What is missing in the repository, and why it has this shape

- **The loader has no AppRole method.** Today it can use the human's LDAP
  login, a pasted token, or `VAULT_TOKEN`.
  - AppRole logs in **once per command** and never stores a token. The
    `secret_id` file is the long-lived credential, and the token derived
    from it lives minutes.
  - `exec` **revokes that token before starting the child**, because the
    child never needs Vault. No live token outlives the fetch.
- **The credential file is checked.** It must not be readable by group or
  others. On `/mnt/c` every file reads as 0777, so a credential copied there
  is refused rather than silently used.
- **One `--map` at a time is not enough.** The private names cannot go in the
  tracked `secrets.map` (public mirror), yet a command may need a git token
  and a private one together.
  - `--map` becomes repeatable.
  - `VAULT_SECRETS_MAPS` (colon-separated) can name the maps once for a shell.
  - A variable mapped twice is an error, not a silent override.
- **ADR-0030 clause 3 said the credential kept on a host can only read.**
  This identity can also write, so that clause is amended by `ADR-0031`,
  which records the trade-off.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/vault-secrets/scripts/vault_secrets.py` | TASK-0131 | 444 lines; methods `ldap`, `token`; one `--map` |
| `tests/test-vault-secrets.sh` | TASK-0131 | 34/34 |
| Vault | human + one-time script, 2026-10-04 | `ai-toolbox-app` policy, `approle/` with role `ai-toolbox`, 10 secrets under `kv/ai-toolbox/` |
| `~/.config/vault/ai-toolbox.approle`, `~/.config/vault/ai-toolbox.map` | same | mode 600, outside the repo |
| `master` | `d93442b` | equal on local, `origin`, `github` |
| `.ai/tasks/TODO.md` | TASK-0131 | counter `TASK-0132` |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. **Loader:**
   - `VAULT_AUTH_METHOD=approle` with `VAULT_APPROLE_FILE`;
   - the file mode check;
   - per-command login;
   - revoke-before-exec;
   - `login` with approle verifies and stores nothing;
   - `put` with approle needs no prompt;
   - `--map` repeatable, plus `VAULT_SECRETS_MAPS`, with duplicate
     detection.
2. **Tests:** offline cases for every behaviour above, the leak scan
   extended to the AppRole secrets, and revert proofs.
3. **`ADR-0031`.** `SKILL.md` (minor version), `references/vault-layout.md`
   (AppRole role, `ai-toolbox-app` policy, the private map), the runbook
   (*An application identity for this codebase*), `.env.example`
   (`VAULT_APPROLE_FILE`, `VAULT_SECRETS_MAPS`), `CURRENT_STATE.md`,
   `TODO.md`, `BACKLOG.md` (`B-052` narrowed), the registry.

### Not included

- **The one-time setup and migration script.** It names internal systems,
  so it is not committed. `vault-layout.md` records the contract instead.
- **Wiring the estate's `vault_pass.sh`** to the value now at
  `kv/ai-toolbox/ansible#vault_password`. That is still `B-052`, in its own
  repository.
- **Changing the human's shell profile** to make `approle` the default
  method. That is the human's choice; the runbook shows the two exports.
- **Rotating or revoking the root token**, and moving the unseal-key file
  offline. Both are human steps, already recommended.

## Likely files

- New: `.ai/decisions/0031-codebase-approle-identity.md`.
- Changed:
  - `skills/vault-secrets/scripts/vault_secrets.py`
  - `skills/vault-secrets/SKILL.md`
  - `skills/vault-secrets/references/vault-layout.md`
  - `tests/test-vault-secrets.sh`
  - `docs/operations/runbook.md`
  - `.env.example`
  - `.ai/context/CURRENT_STATE.md`
  - `.ai/tasks/TODO.md`
  - `.ai/planning/BACKLOG.md`
  - `docs/registry.md`

## Execution plan

1. This brief and the ADR skeleton, before any code (same worktree,
   `agent/secrets-vault`, rebased at `d93442b`).
2. Loader:
   - `approle_login()`, with the file mode check and JSON validation;
   - `token_for()` resolving `VAULT_TOKEN` › approle › stored token;
   - revoke-before-exec for AppRole tokens, plus best-effort revoke after
     `check` and `put`;
   - repeatable `--map` and `VAULT_SECRETS_MAPS`.
3. Tests:
   - the stub gains `auth/approle/login`;
   - new cases:
     - approle `exec` with no stored token, with revoke-before-exec;
     - approle `put` with no prompt;
     - a loose file mode is refused before any request;
     - a wrong `secret_id` exits 3;
     - approle `login` stores nothing;
     - two maps merge;
     - a duplicate across maps fails;
     - `VAULT_SECRETS_MAPS`;
   - the leak scan gains the `secret_id` and the AppRole token.
4. Revert proofs: remove the mode check, skip revoke-before-exec, let a
   duplicate override. Each named case must fail.
5. Docs and ADR-0031; regenerate the registry; run the gate.
6. **Live check:** `check` with `VAULT_AUTH_METHOD=approle` and both maps
   lists every variable as readable, using no LDAP token and no prompt.
7. Commit, push both remotes through `vgit`, compare hashes, then the record
   commit.

## Acceptance criteria

- [x] `tests/validate.sh` passes, with the new cases in
      `tests/test-vault-secrets.sh`.
- [x] Each revert proof makes its named case fail; output recorded here.
- [x] Live: `VAULT_AUTH_METHOD=approle check --map secrets.map --map
      ~/.config/vault/ai-toolbox.map` exits 0, with every variable readable,
      and leaves no file behind.
- [x] No added line in a tracked file names an internal host, address or the
      private systems' names.
- [x] `ADR-0031` states the trade-off: an unattended credential that can
      write.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed)
- [x] the leak and infrastructure scan over added lines

## Risks and rollback

- **The `secret_id` file leaks.** Then anyone with it can read and overwrite
  `kv/ai-toolbox/*`, though not delete, so versions remain. Mitigations: mode
  600 enforced by the loader, the file outside every repository, and
  `secret_id_ttl` of one year. **Revoke** by destroying the accessor, a human
  step in the runbook.
- **An agent overwrites a secret by mistake.** KV v2 keeps the previous
  version, and `put` uses check-and-set. Rollback: `vault kv rollback`, or a
  `put` of the old value read by version.
- **Rollback of this change:** `git revert` the task commit. The
  `ldap`/`token` methods and the single-map behaviour are unchanged.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `vault_secrets.py` | 537 lines. Method `approle` (`VAULT_APPROLE_FILE`, mode check before reading, per-command login). `session_token()` resolves `VAULT_TOKEN`, then approle, then the stored token. Minted tokens are revoked before `exec` starts the child and after `check`/`put`; `put`'s LDAP token is now revoked after the write too. `--map` is repeatable, `VAULT_SECRETS_MAPS` is supported, and a duplicate is an error |
| `tests/test-vault-secrets.sh` | 46 cases (T17–T25 new); the probe records its start time; `run()` clears a leftover probe |
| `SKILL.md` | 1.1.0: rules 6 (write only on instruction) and 7 (never move the credential); several maps; the AppRole section |
| `vault-layout.md`, runbook, `.env.example`, `ADR-0031`, `ADR-0030` pointer, `CURRENT_STATE.md`, `TODO.md`, `B-052` | as listed in *Scope* |
| Not changed | the tracked `secrets.map`; the LDAP and token methods; CI; the human's shell profile |

**Deviations from the Plan.**
1. `put` now also revokes the LDAP token it mints for a write. That token
   carries `admin`, and nothing needs it after the write. It was found while
   wiring the AppRole revoke and is covered by the same `finally`.
2. Measured cost: 2.2 s native and 5.3 s on `/mnt/c`, more than TASK-0131's
   figures, recorded in the gate's comment.

**Next task starts here**: the identity works live. To use it by default,
the human adds the three runbook exports to `~/.bashrc`. `B-052`'s estate
wiring can now read `kv/ai-toolbox/ansible#vault_password`.

## Status

- Status: done
- Owner: agent (Claude Code); human for Vault-side and credential steps
- Created: 2026-10-04
- Updated: 2026-10-04

## Execution log

### Attempt 1

- Date: 2026-10-04
- Agent: Claude Code (Opus 5.5), worktree `agent/secrets-vault`
- Actions:
  - Wrote the brief (above), stating that the Vault side and the `.env`
    migration came first, at the human's instruction.
  - Loader and test changes as in *Outputs*.
  - Documentation; `scripts/sync-registry.sh` (no row change, since the
    description is unchanged).
- Observations:
  - **First run after the change:** 34/34 of the old cases still passed.
    With the new cases, 45/46: T17 compared against the original GitHub
    value, but T12 rewrites it earlier. That was a test fault, fixed by
    comparing against the stub's current value. Then 46/46.
  - **Revert proofs** on mutated copies:
    | Mutation | Failed case | Result |
    |----------|-------------|--------|
    | M6, mode check → `if False:` | `FAIL T19 a credential file readable by others is refused before any login` | 45/46 (see below) |
    | M7, revoke before exec skipped | `FAIL T17 the AppRole token is revoked BEFORE the child starts` | 45/46 |
    | M8, duplicate check skipped | `FAIL T23 a variable mapped in two files is an error, not an override` | 45/46 |
    | M9, approle `login` stores its token | `FAIL T21 approle login verifies, prints policies, stores nothing` | 45/46 |

    M6 first failed T20 as well: T19's short-circuit left a probe file
    behind. `run()` now clears any leftover probe, and M6 then failed T19
    alone.
  - **Live, from this worktree,** with `VAULT_AUTH_METHOD=approle`, the
    credential file, and `--map secrets.map --map ~/.config/vault/ai-toolbox.map`:
    - `check` printed `token: policies ['ai-toolbox-app', 'default'], 0h09m
      left (AppRole, revoked after this check)`;
    - all 34 variables `readable from kv/ai-toolbox/…`;
    - exit 0;
    - `~/.vault-token` untouched.
  - **The Vault-side script's own output** (Minimal context):
    - AppRole login policies `['ai-toolbox-app', 'default']`, TTL 600 s;
    - 10 secrets written at version 1;
    - `all 32 match` by sha256;
    - `removed 32 lines` from `.env`, with 20 kept.
- Validation:
  - `bash tests/validate.sh` printed `validate.sh: OK`.
  - Test cost: 2.2 s native, 5.3 s `/mnt/c`.
  - Scan of 613 added lines for hostnames, the address prefix, the private
    systems' names, token shapes and the `secret_id` accessor: clean.
- Result: done. Every acceptance criterion is met, live included.
- Commit: `993a422` — *Give ai-toolbox an AppRole identity in Vault
  (TASK-0132)*, plus the record-keeping commit after it
- Push: **confirmed to both remotes** — `d93442b..993a422 HEAD -> master` to
  `origin` and to `github`; `HEAD`, `origin/master` and `github/master` all
  read `993a422`, and `git remote -v` is token-free. Both pushes
  authenticated with tokens fetched by this task's own AppRole identity
  (`VAULT_AUTH_METHOD=approle`, the runbook's `vgit`)
