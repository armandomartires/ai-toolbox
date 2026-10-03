# ADR-0030 — Secrets are owned by Vault; the environment stays the interface

## Status

Accepted (2026-10-03), on the human's decisions of 2026-10-01..03. Task:
`TASK-0131`, which records the live verification.

Amends `ADR-0009` (configuration comes from the environment): the interface
stands, and the *source* of secret values changes. Amends `ADR-0028` on where
the push token lives: its 2026-09-30 amendment put it in the shell profile;
it now lives in Vault.

## Context

- **This repo's secrets are three git tokens.**
  - `GITLAB_PUSH_TOKEN`.
  - `GITLAB_TOKEN`, an admin token with `sudo`.
  - `GITHUB_TOKEN`.
- **They were exported from `~/.bashrc` on one WSL host.**
  - `TASK-0126` found that file world-readable (mode 644).
  - `TASK-0128`, and `TASK-0131` again, found `GITLAB_PUSH_TOKEN` unset in a
    session shell although the profile exports it.
- **A second host has none of them, and nothing fails loudly.** The human put
  it as: *"Env vars are not reliable because if we use another host we may
  not have the same var available."*
- **The human proposed GitHub and GitLab CI variables.** The intranet also
  has a HashiCorp Vault (1.21, open source).
- **Vault was first observed answering on plain `http://` only.** That would
  have repeated `ADR-0028`'s cleartext problem with every secret at once.
- **The human then fixed the Vault side.** Between 2026-10-01 and 2026-10-03
  they added TLS from the domain's internal CA, plus LDAP login against
  Active Directory over `ldaps://`. A login test passed end to end.

## Decision

Secret values are owned by the intranet Vault. Programs keep reading
environment variables. A loader puts the values a command needs into that
command's environment, and nowhere else.

1. **The single owner is Vault**, KV v2 at `kv/`, under one prefix per
   consuming project. A tracked `secrets.map` names which variable comes from
   which secret. It holds names and paths only, and every variable in it is
   documented in `.env.example` (gated).
2. **The loader is a skill**, `skills/vault-secrets/`, so other projects
   reuse it and `scripts/install.sh` deploys it to every host. It exports
   **only the variables named on its command line**, into **one child
   process**; exporting all of them needs an explicit `--all`. It never
   prints a value or a token.
3. **The token kept on a host is narrow.** `login` stores only a child token
   limited to `workstation-read`, for 8 hours. The user's LDAP token, which
   may carry admin, is never written down. A write uses a fresh login held in
   memory.
4. **HTTPS only.** A non-loopback `http://` Vault address is refused, with no
   override. A Vault without TLS would be a single place to capture every
   secret at once.
5. **An exported variable wins over Vault.** That keeps the gate hermetic
   and CI unchanged, and gives a migration path. `check` names every
   variable an export is shadowing.
6. **CI variables hold only secrets a CI job itself consumes.** They are not
   a store for anything a human or a workstation needs.
7. **Vault's address, like `$GITLAB_URL`, never enters a tracked file.**
   Neither does the CA certificate, which names internal hosts. What the
   Vault side must provide is recorded without them, in
   `skills/vault-secrets/references/vault-layout.md`.

The normative procedures are in `docs/operations/runbook.md`: *Secrets on a
new host* and *Authenticating a push*. Agent rules are in `AGENTS.md`
(*Security and secrets*) and the skill's `SKILL.md`.

## Alternatives considered

- **GitHub Actions secrets and GitLab CI variables as the store.**
  Rejected for five reasons:
  1. GitHub secrets are write-only through the API, so a host cannot fetch
     them.
  2. Reading GitLab variables needs a GitLab token already on the host,
     which is the problem itself, sent over `http://` (`ADR-0028`).
  3. GitLab has no runner, so its CI variables serve no CI either.
  4. Two stores means two owners of every secret, drifting on each
     rotation.
  5. Every job sees CI secrets, and the mirror is public. `TASK-0124`
     avoided repository secrets for that reason.
- **Keep shell-profile exports, plus a setup script per host.** Rejected.
  It multiplies copies of every token, one per host, all in plain-text
  profiles. The audit already found such a profile world-readable, and
  rotation means editing every host.
- **SOPS or age-encrypted secrets committed to the repo.** Rejected. The
  mirror is public, so the ciphertext and the secret *names* would be
  world-readable forever. A key compromised later decrypts every past
  commit. And the decryption key has to reach each host anyway, which is
  the original problem.
- **A SaaS manager (1Password, Bitwarden, Doppler, …).** Not pursued. The
  organisation already runs Vault on the intranet, administered by the
  human, with AD login, so a second store would split ownership.
- **Vault over plain HTTP, accepted as a risk in this ADR.** Offered to the
  human, who chose to enable TLS first. The loader therefore has no override
  for it.
- **Store the LDAP login token as-is.** Rejected. It carried a pre-existing
  `admin` policy, and a file on every workstation does not need admin.
- **Export every mapped secret into every wrapped command.** Rejected.
  Every `git push` would receive the admin `GITLAB_TOKEN`. Least privilege
  is the default, and `--all` has to be written out.
- **The vault CLI plus `envconsul`.** Not adopted. That is two more binaries
  to install and keep current on every host. The loader is about 450 lines
  of standard-library Python on the interpreter this repo already requires,
  and keeps every token out of argv.

## Consequences

- **A new host needs three things:** the CA certificate, two exported
  non-secret variables, and one login. It needs no token. Rotating a secret
  is one `put`, with no host to touch.
- **The token on disk expires in 8 hours and can only read.** Losing the
  file costs a login, not a credential.
- **New failure mode: Vault down or unreachable.** Every secret-needing
  command then fails, loudly, naming the variable. An exported value still
  works as the fallback, deliberately (clause 5).
- **The `workstation-read` policy must grant `update` on
  `auth/token/create`,** or `login` cannot narrow the token. That is a
  Vault-side requirement which this repo documents but cannot enforce.
- **The gate grows by `tests/test-vault-secrets.sh`:** about 1.6 s native,
  about 3.7 s on `/mnt/c`.
- **Every secret now depends on Vault staying unsealed.** Its unseal keys
  and root token become the most sensitive material in the estate. Keeping
  them off workstations and out of any folder an agent or a repository can
  see is a human obligation, recorded in `vault-layout.md`.
- **The estate's `ANSIBLE_VAULT_PASSWORD`** can move to Vault with the same
  loader (`--map`). That is left to its own task, in its own repository.
