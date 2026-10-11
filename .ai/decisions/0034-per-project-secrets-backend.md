# ADR-0034 — Each project declares its secrets backend; a Vault project gets its own mount

**Status**: accepted
**Date**: 2026-10-11
**Task**: TASK-0155 (with TASK-0156, TASK-0157)

## Context

ADR-0030 put every secret value in Vault, under one prefix per project in the shared `kv/` mount. On 2026-10-11 the human asked for two things:
- a way to create a new Vault KV store for each new project;
- `project-workflow`'s scaffolding to let the user choose where secrets live: locally, in HashiCorp Vault, or in GitLab or GitHub project variables.

Every Vault path that exists today was created by hand:
- `workstation-read` and `secrets-writer` list each prefix by name;
- the AppRole came from a one-time script kept outside the repo (ADR-0031).

Nothing declared a project's choice, and `vault-secrets` excluded both provisioning and CI stores.

## Decision

1. **A project declares where its values live** in a tracked `secrets.conf`:
   - `backend = local | vault | gitlab | github` and `project = <name>`;
   - `gitlab_project` or `github_repo` when that backend is chosen;
   - names only. `.env.example` stays the list of variable names under every backend (ADR-0009).
2. **With no `secrets.conf`, nothing changes.** ai-toolbox and the estate keep ADR-0030's shared `kv/` prefixes and their maps.
3. **A new Vault project gets its own KV v2 mount**, named after the project. It also gets policies `<name>-read`, `<name>-write` and `<name>-app`, and an AppRole `<name>` with ADR-0031's limits.
   - **This amends ADR-0030 clause 1** for new projects only.
   - Provisioning is idempotent and additive. It never deletes, never edits a policy it did not create, and never enables an auth method.
4. **Provisioning and every write are human steps.** The admin token comes from the environment or a hidden prompt, is never stored, and is refused if it is root.
   - An agent may run `init`, `check` and `provision --dry-run`.
   - Who may read a mount through LDAP stays the estate's call.
5. **A project that chooses `gitlab` or `github` makes CI the store of record. This amends ADR-0030 clause 6 for that project.**
   - Its values are not readable on a host: GitHub secrets are write-only, and reading GitLab's would put a GitLab token on the wire for every command. So `exec` refuses and a local run exports the variable itself.
   - `put` sends a value on stdin, never in argv. `put` to an `http://` GitLab needs an explicit `--allow-http`, because that token crosses the network in cleartext (ADR-0028).
6. **`local` keeps values in a git-ignored `.env` at mode 600.** `put` refuses while `.env` is not ignored.
7. **The tooling is `skills/vault-secrets/`**, broadened rather than renamed: its script path is cited in AGENTS.md, the runbook, `vgit` and private maps on hosts. `project-workflow` asks the question at scaffolding and calls `init`.

## Alternatives considered

- **A prefix per project in the shared `kv/` mount (ADR-0030 as written):** rejected for new projects. Every project would mean editing two shared policies, and one wrong edit widens access for every project.
- **Vault for every project, no choice:** rejected because the human asked for a choice. A small or public project may have no Vault and no intranet access.
- **Record the choice only, and set CI values by hand:** rejected. `put` through the API keeps values out of browser history and copy-paste buffers, and `check` can confirm by name.
- **A separate `project-secrets` skill:** rejected. Two skills would both parse `secrets.conf` and `.env.example`, and the loader already owns the rules about values.

## Consequences

- A new project's secrets are isolated by mount, so one policy edit can no longer reach another project.
- A Vault admin creates a `secrets-provisioner` policy once, as documented in `skills/vault-secrets/references/vault-layout.md`. Until then `provision` fails with Vault's own 403, and `--dry-run` shows what it would do.
- Projects on `gitlab` or `github` cannot run a secret-needing command locally through `exec`. That is the price of a CI-owned store, and it is stated, not hidden.
- `vault-secrets` is now 2.x. Its scope includes provisioning a project's own mount and setting CI variables, and still excludes reading any value.
