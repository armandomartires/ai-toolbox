# TASK-0134 — The estate's ansible-vault password comes from Vault (B-052)

## Objective

Close `B-052`: the estate repository read its Ansible Vault password from a
plain `.env`, so every control node needed the file copied to it by hand. That
is the failure `ADR-0030` fixed for this repository's git tokens. Routed by
the human on 2026-10-04 (*"Proceed to complete B-052 and 53"*). The value
already sat in Vault, at `kv/ai-toolbox/ansible#vault_password`, after
`TASK-0132`'s migration.

## Minimal context

- **The fix lives in the other repository, under its own conventions.**
  SIGMA-infrastructure tracks the same goal as its ad-hoc `#39`. Its
  security document said *"Vault is not this workspace's secrets backend"*.
  So the change there is its own task, `S042_VaultPassword.T001_ReadFromVault`,
  with its own brief written before its code, its ADR 0014, its five gates
  plus `mypy`, and its revert proof. It is committed there locally as
  `2a09fa0` plus the record `b9f4ab6`. **Not pushed**: that `master` also
  carries 15 earlier unpushed commits, and its `gitlab` remote takes the
  admin token over `http://`. Both are the human's call.
- **What this repository still owes `B-052`.**
  - The `ansible-ops` skill's *Vault and log hygiene* section said where a
    vault password must never be, but not where it should come from.
  - **A correction found on the way.** `vault-layout.md` described LDAP
    settings (`userattr`, `groupfilter`, bind-as-user) that the estate's
    Ansible owns and declares differently. Those settings came from the
    one-time bootstrap of `TASK-0131`. It rewrote `auth/ldap/config` outside
    the estate's codified role and so drifted it. That was this repository's
    mistake: the bootstrap did not check who owned that configuration. The
    estate filed it as its `#96`. The fix here is to stop claiming the
    settings: one owner per fact.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| SIGMA-infrastructure `S042.T001` | that repository, 2026-10-04 | committed `2a09fa0`, `b9f4ab6`; gates green; end-to-end decrypt through Vault proven |
| `skills/ansible-ops/SKILL.md` | TASK-0029 | `1.0.0`; *Vault and log hygiene* has five bullets |
| `skills/vault-secrets/references/vault-layout.md` | TASK-0131/0132 | *Authentication* states LDAP settings this repo does not own |
| `.ai/planning/BACKLOG.md` | TASK-0133 | `B-052` `ready`; thirteen open |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. `skills/ansible-ops/SKILL.md` (`1.1.0`): one bullet on where a vault password
   should come from. It stays generic, because estate facts never enter a
   skill (`ADR-0015`).
2. `skills/vault-secrets/references/vault-layout.md`: *Authentication* defers
   the LDAP configuration to the estate's own configuration management, and
   keeps only what the loader requires (TLS to the directory, short tokens).
3. `BACKLOG.md` (`B-052` done, recount), `TODO.md`, `CURRENT_STATE.md`, the
   registry.

### Not included

- **Fixing the LDAP drift.** It needs the human's admin login, and the
  config belongs to the estate (`#96` there).
- **Pushing the estate repository.** That is the human's decision; see
  *Minimal context*.
- **The estate's other `.env` credentials.** They stay with the estate's
  `#39`.

## Likely files

`skills/ansible-ops/SKILL.md`, `skills/vault-secrets/references/vault-layout.md`,
`.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`, `.ai/context/CURRENT_STATE.md`,
`docs/registry.md`, this brief.

## Execution plan

1. This brief, before the edits here (worktree `agent/backlog`).
2. The skill bullet and the `vault-layout.md` correction.
3. Backlog, index, state; `scripts/sync-registry.sh`; `tests/validate.sh`.
4. Commit, push both remotes through `vgit`, record commit.

## Acceptance criteria

- [x] SIGMA-infrastructure's `tools/vault_pass.sh` reads Vault, with no `.env`
      fallback, proven there end to end and by a test that fails when
      reverted (`S042.T001` *Verification*).
- [x] `ansible-ops`'s hygiene section names the source and the no-fallback
      rule without any estate fact.
- [x] `vault-layout.md` no longer states LDAP settings this repository does
      not own.
- [x] `tests/validate.sh` passes.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed)

## Risks and rollback

- **The skill text leaks an estate fact.** Mitigated: it names no host,
  path or repository.
- **Rollback:** `git revert` the task commit here. The estate change has its
  own revert in its own repository.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| SIGMA-infrastructure | `2a09fa0` + `b9f4ab6` local, **not pushed**: `tools/vault_pass.sh`, `secrets.map`, `tests/test_vault_pass.py`, ADR 0014, `#96`, `#39` narrowed, docs; `.env` entry removed |
| `skills/ansible-ops/SKILL.md` | `1.1.0`, one bullet on the password's source and the no-fallback rule |
| `skills/vault-secrets/references/vault-layout.md` | *Authentication* defers LDAP to the estate, and keeps the TLS and token requirements |
| `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md` | `B-052` done, twelve open; counter `TASK-0135` |

**Next task starts here**: the human decides on the estate push, and
measures `#96` with their admin login. No deviation from the plan.

## Status

- Status: done
- Owner: agent (Claude Code); human for the estate push and `#96`
- Created: 2026-10-04
- Updated: 2026-10-04

## Execution log

### Attempt 1

- Date: 2026-10-04
- Agent: Claude Code (Opus 5.5), worktree `agent/backlog`, plus the estate
  checkout
- Actions:
  - In the estate, under its conventions: the brief, `vault_pass.sh`,
    `secrets.map`, the test, ADR 0014, the docs and `#96`. Then the gates,
    the `.env` line removed, and two local commits. Its `S042.T001`
    *Verification* holds every figure.
  - Here: the brief, then the two skill edits and the bookkeeping.
- Observations:
  - **The Vault copy was verified before use.** All 19 vaulted values (6
    files) decrypted with it, and 0 of 19 with a wrong password. A first
    check that walked parsed YAML passed the wrong password for every
    inline value under ansible-core 2.21, and was thrown away as vacuous.
  - **Revert proof in the estate:** the old script printed the decoy
    `.env` password (`stdout='from-dotenv'`), which
    `test_never_falls_back_to_dotenv` catches.
  - **Found:** the estate's `ansible-lint` now needs Vault access, because
    `--syntax-check` loads the vaulted inventory. Recorded in its ADR 0014.
    Also found the LDAP drift this repo caused, filed there as `#96`.
- Validation: `bash tests/validate.sh` printed `validate.sh: OK`. The scan
  of added lines, the new brief included, was clean.
- Result: done here. The estate push is pending the human.
- Commit: recorded in the follow-up record commit
- Push: recorded in the follow-up record commit
