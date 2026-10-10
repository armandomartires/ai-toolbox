# Reference: environments and secrets

Read this before touching a secret, a credential, or environment-specific configuration.

- **Never commit secrets, tokens, passwords, private keys, or a `.env` file holding credentials.** Commit `.env.example` with placeholder values instead. Review `git diff --staged` for credentials before every commit.
- **Name variables, never values.** A brief or ADR names the variable a change depends on and never quotes its value.
- **Environment tiers.** List the tiers that actually exist in `AGENTS.md`; don't invent staging or production. A brief names the tier it was validated in.
- **A committed secret is compromised.** Rotate it: removing it from the latest commit leaves it in history. Report the leak. A force-push still needs authorization (`reference/git-workflow.md`).
