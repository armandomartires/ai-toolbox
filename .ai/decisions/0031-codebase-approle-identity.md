# ADR-0031 — The codebase has an AppRole identity that may write its own secrets

## Status

Accepted (2026-10-04), on the human's decisions of that day. Task: `TASK-0132`.

**Amends `ADR-0030` clause 3.** That clause made every credential kept on a
host read-only. A host may now also hold this codebase's AppRole credential,
which can write, but only under the codebase's own prefix.

## Context

- **The human asked for an "application token for this codebase".** It should
  create, edit and read passwords in the `ai-toolbox` KV secrets. Then every
  secret in the local `.env` should move there.
- **What that `.env` held.** It sat inside this repository's folder on
  `/mnt/c`, where every file reads as mode 0777 and any agent session can
  open it. Its 34 variables included:
  - the git push tokens;
  - credentials for other internal systems;
  - for a time, the Vault root token.
- **`ADR-0030` left no unattended path to write.** It gave humans an LDAP
  login and a stored token that could only read. So every write needed the
  human's AD password, which is exactly what the request wanted to avoid.
- **Three shapes were offered** with their trade-offs: a periodic token, a
  fixed one-year token, and AppRole. The human chose AppRole, plus three
  further choices:
  - an untracked map for the moved names;
  - removing the moved lines from `.env`;
  - removing the root token from `.env`.

## Decision

The codebase authenticates to Vault as the AppRole `ai-toolbox`. Its tokens
can create, read and update secrets under `kv/ai-toolbox/` and nothing else.
They are minted per command and revoked as soon as that command is done with
them.

1. **The policy `ai-toolbox-app` is the whole grant:**
   - `create`, `read`, `update` on `kv/data/ai-toolbox/*`;
   - `read`, `list` on `kv/metadata/ai-toolbox/*`.

   It has **no `delete` or `destroy`**, so every overwrite remains
   recoverable as an earlier KV v2 version. It has no other prefix and no
   Vault configuration.
2. **The credential is one file.** It holds `role_id` and `secret_id`, at
   mode 600, outside every repository. The loader refuses it before reading
   if group or others can read it; on `/mnt/c` that is always the case.
   `secret_id_ttl` is one year. The intended shape is one `secret_id` per
   host, so any host can be cut off alone by destroying its accessor.
3. **No token is stored.**
   - Each `exec`, `check` or `put` logs in for itself.
   - `exec` revokes the token **before** the child starts, because the child
     never needs Vault.
   - `check` and `put` revoke it when they finish.
   - The LDAP path for humans is unchanged, and so is its read-only child
     token.
4. **Names describing internal systems go in an untracked map,** beside the
   credential. The tracked `secrets.map` keeps only what this repository's
   own procedures need. Maps combine (`--map` repeated, or
   `VAULT_SECRETS_MAPS`), and a variable mapped twice is an error, never an
   override.
5. **An agent writes with this identity only on the human's instruction.**
   The rule is in the skill's `SKILL.md`. Reading through `exec` and `check`
   stays the norm.

Procedures: `docs/operations/runbook.md`, *An application identity for this
codebase*. Vault-side contract:
`skills/vault-secrets/references/vault-layout.md`.

## Alternatives considered

- **A periodic token** (renewed by use, 32-day period). It is simpler: a
  token in a file. Rejected by the human in favour of AppRole. It would also
  have been a long-lived token on disk, and a stolen one works until revoked.
  An AppRole `secret_id` still has to be exchanged at Vault, and the token
  that comes back dies within minutes.
- **A fixed one-year token.** It is the simplest of all. But it needs the
  token backend's maximum TTL raised, expires on a date nobody watches, and
  is a bearer credential for its whole life. Rejected.
- **Keep writes behind the human's LDAP login only** (`ADR-0030` as it was).
  Rejected by the request itself: the human wanted the codebase able to
  create and edit its secrets unattended.
- **Put the moved names in the tracked `secrets.map`** and `.env.example`.
  Rejected: the mirror is public, and those names inventory internal
  systems. Values were never at risk; the names were.
- **Keep `.env` as a fallback copy after the move.** Rejected: the copy was
  the problem, a plain-text file in a folder every agent can read.
- **Grant `delete`/`destroy` for symmetry with "edit".** Rejected. An
  unattended credential that can erase history turns a mistake into a loss.

## Consequences

- **Any process on a host with the credential file can read and overwrite
  every `kv/ai-toolbox/*` secret.** That includes an agent session, with no
  human prompt. This is the requested capability and its main risk. It is
  bounded by:
  - the prefix;
  - the missing delete;
  - KV versions;
  - the SKILL rule;
  - revocation by accessor.
- **The `secret_id` file is now the most sensitive file on a workstation,
  after the unseal keys.** Copying it to `/mnt/c`, into a repository or into
  a backup that syncs undoes the design. The loader's mode check catches the
  first case only.
- **`kv/ai-toolbox/` now holds credentials for systems this codebase does not
  own**, by the human's choice. The estate's Ansible Vault password is one of
  them, so `B-052`'s remaining work is only the estate-side wiring.
- **The `secret_id` expires after a year.** The failure is loud: `exec` exits
  3 with `AppRole login failed`. Issuing a new one is a human step with the
  root or admin credential, in the runbook.
- **The one-time setup and migration script is not in the repository,**
  because it names internal systems. `vault-layout.md` states the contract
  it fulfilled, so the layout can be rebuilt without it.
