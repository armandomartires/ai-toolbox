# Reference: environments and secrets

Linked from `00.CONVENTIONS.md` — read this before touching a secret,
credential, or environment-specific configuration.

## The core rule

**Never commit secrets, tokens, passwords, private keys, or `.env` files
containing credentials.** Provide `.env.example` (with placeholder
values) instead of a real `.env`. This applies to every commit, not just
ones that look security-relevant — a debug print, a hardcoded test
fixture, or a copy-pasted config block are the most common accidental
leaks, not deliberate ones.

## Before committing

- Review `git diff --staged` for anything that looks like a credential,
  API key, connection string with embedded password, or private key
  block, before every commit — not just ones touching obviously
  sensitive files.
- A task brief or ADR should name *which* environment variable or secret
  a change depends on, without ever quoting its value — the same
  discipline the diff review above applies.

## Environment tiers

Not every project has multiple environments (staging/production). State
in the project's own `AGENTS.md` what tiers actually exist — don't invent
a staging/production distinction a local tool or single-environment
project doesn't have. Where tiers do exist, a task brief should name
which tier a change was validated in and which tiers it hasn't touched.

## If a secret is committed by accident

Treat it as compromised immediately — rotating the credential is the
only real fix; removing it from the latest commit does not remove it
from git history. Report it rather than quietly force-pushing a fix
(force-pushes require explicit authorization regardless — see
`reference/git-workflow.md`).
