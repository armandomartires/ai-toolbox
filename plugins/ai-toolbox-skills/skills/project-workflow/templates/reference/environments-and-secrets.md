# Reference: environments and secrets

Read this before touching a secret, a credential, or environment-specific configuration.

- **Never commit secrets, tokens, passwords, private keys, or a `.env` file holding credentials.** Commit `.env.example` with placeholder values instead. Review `git diff --staged` for credentials before every commit.
- **Name variables, never values.** A brief or ADR names the variable a change depends on and never quotes its value.
- **Environment tiers.** List the tiers that actually exist in `AGENTS.md`; don't invent staging or production. A brief names the tier it was validated in.
- **A committed secret is compromised.** Rotate it: removing it from the latest commit leaves it in history. Report the leak. A force-push still needs authorization (`reference/git-workflow.md`).

## Where the values live

The project chooses one backend at scaffolding and declares it in a tracked `secrets.conf`: `backend = local|vault|gitlab|github`, plus `project = <name>` (and `gitlab_project = group/name` or `github_repo = owner/name`). `.env.example` names the variables under every backend.

| Backend | Values live in | Readable on a host |
|---------|----------------|--------------------|
| `local` | a git-ignored `.env`, mode 600 | that host only |
| `vault` | the project's own KV v2 mount, mapped in `secrets.map` | yes, by whoever holds its read policy |
| `gitlab` | CI/CD variables, masked and protected | no: CI jobs only |
| `github` | Actions secrets | no: write-only |

The `vault-secrets` skill writes and reads these (`init`, `exec`, `check`, `put`). Changing backend is a decision: record it in an ADR.

A forge tracker's CLI token (`GITLAB_TOKEN` for `glab`, `GH_TOKEN` for `gh`) is a secret like any other (`reference/tracker.md`, *Access*).
