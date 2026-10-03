---
name: vault-secrets
description: "Supply secrets to a command from HashiCorp Vault instead of shell-profile exports - a tracked map names which environment variable comes from which KV v2 secret, and a loader exports only the named ones into one child process. USE FOR: running a command that needs a token or password (a git push, an API call, an MCP server, ansible-vault), setting a project up on a new host, writing or rotating a secret, deciding where a new secret should live. DO NOT USE FOR: secrets a CI job itself consumes - those stay in the CI platform's own store; reading, printing or copying a secret value for any reason; or administering Vault itself (policies, auth methods, unsealing)."
license: MIT
metadata:
  author: armando.martires
  version: "1.0.0"
---

# vault-secrets

Programs keep reading environment variables, so nothing that uses
`$GITHUB_TOKEN` today changes. What changes is where the value comes from:
Vault owns it, and `scripts/vault_secrets.py` fetches it **into one child
process** at the moment that process needs it. It never goes into a shell, a
profile or a file. The decision and its reasons are in the adopting
repository's ADR (ai-toolbox: `ADR-0030`).

## Rules for an agent

1. **Never read, print, echo, log or copy a secret value**, a token, or
   `~/.vault-token`. Not to check it, and not to "verify it works". Use
   `check`, which reports by name only.
2. **Run what needs a secret through `exec`, naming exactly the variables it
   needs:**
   `vault_secrets.py exec GITLAB_PUSH_TOKEN -- git … push origin master`.
   Do not use `--all` unless the command really needs every mapped secret.
3. **A missing or rejected secret is a stop condition**, not something to
   work around. The fix is human-only: logging in, or writing the value with
   `put`. An agent cannot provision its own credential. Report the exact
   message and stop.
4. **Never put a value in argv, a tracked file, a task file, a commit message
   or a remote URL.** A secret reaches a command only through the environment
   that `exec` builds.
5. **Never weaken the transport.** `http://` to a non-loopback Vault is
   refused on purpose, and there is no override to look for.

## Commands

Run from the repository root, which holds `secrets.map`; or pass `--map FILE`.

| Command | What it does |
|---------|--------------|
| `login` | LDAP login (password prompt). Stores a **child token limited to `workstation-read`** in `~/.vault-token` (mode 600). The LDAP token itself, which may carry admin, is never stored. `VAULT_AUTH_METHOD=token` stores a pasted token instead, as given, but never a root token. |
| `exec VAR… -- CMD…` | Fetches the named variables and execs `CMD` with them set. A variable already exported wins, and Vault is not consulted for it. |
| `check` | Vault reachable with the certificate verified; the token's policies and remaining time; for each mapped variable: readable, MISSING, or shadowed by an export. Exits 1 if anything is missing. |
| `put VAR` | Writes one value, read from stdin or a hidden prompt, using a **fresh login held in memory**, never the stored read-only token. Merges into the secret with check-and-set. |
| `logout` | Revokes the stored token and deletes the file. |

Exit status: 0 ok, 1 failure, 2 usage, 3 not logged in or token rejected.

Configuration is the environment: `VAULT_ADDR` (required, `https://`),
`VAULT_CACERT`, `VAULT_AUTH_METHOD`, `VAULT_AUTH_MOUNT`, `VAULT_USER` and
`VAULT_TOKEN`. Meanings are in the script's `--help` and the adopting repo's
`.env.example`.

## The map

`secrets.map` holds **names and paths only**, one entry per line:

```
GITHUB_TOKEN=kv/ai-toolbox/github#token
```

That reads: the variable `GITHUB_TOKEN` is the field `token` of the KV v2
secret `ai-toolbox/github` on the mount `kv`. A malformed line fails with its
line number and is never echoed, because a malformed line may be a pasted
value.

## On a new host

1. Put the internal root CA's public certificate somewhere stable, and export
   `VAULT_CACERT` pointing at it.
2. Export `VAULT_ADDR`. It is not a secret, but it is internal, so it goes in
   the shell profile, never in a tracked file.
3. Run `vault_secrets.py login`, then `vault_secrets.py check`.

The whole procedure for ai-toolbox, including git pushes, is in its runbook,
under *Secrets on a new host*.

## Scripts

- `scripts/vault_secrets.py`: the loader. Python 3 standard library only, so
  HTTP, JSON and TLS run in one process and no token ever appears in a
  command line.

## References

- `references/vault-layout.md`: what the Vault side must provide (mount,
  paths, policies, auth), so it can be rebuilt without the session that first
  built it.
