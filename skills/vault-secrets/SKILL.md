---
name: vault-secrets
description: "Supply named secrets to one command from a repository-selected Vault project session held in the OS keychain, legacy Vault/AppRole access, a git-ignored .env, or GitLab/GitHub CI variables. Declare the backend and optional vault_role in secrets.conf. USE FOR: initializing a secrets backend, running a command that needs named credentials, setting up a new host, owner login and rotation, or issuing an agent token to a pipe for an isolated launcher. DO NOT USE FOR: reading, printing or copying a secret value, a token or a credential file; administering Vault auth, policies or roles; or substituting a plaintext token cache for a missing keychain. Legacy provision is a human admin step, superseded for session-aligned development projects."
license: MIT
metadata:
  author: armando.martires
  version: "2.4.0"
---

# vault-secrets

Programs keep reading environment variables, so nothing that uses
`$GITHUB_TOKEN` today changes. What changes is where the value comes from:
Vault owns it, and `scripts/vault_secrets.py` fetches it **into one child
process** at the moment that process needs it. It never goes into a shell, a
profile or a file. The decision and its reasons are in the adopting
repository's ADR (ai-toolbox: `ADR-0030`).

A new project chooses where its values live and declares it in a tracked
`secrets.conf` (ai-toolbox: `ADR-0034`). With no `vault_role`, existing Vault behavior stays unchanged, including
legacy AppRole access. A Vault repository opts into session tokens through
`vault_role` in `secrets.conf` (ai-toolbox `ADR-0057`).

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
   or a remote URL.** Named secret values reach an exec command through its environment; an
   issued project token travels only through the explicit pipe handoff.
5. **Never weaken the transport.** `http://` to a non-loopback Vault is
   refused on purpose, and there is no override to look for. A GitLab's
   `--allow-http` is the human's to pass, never an agent's.
6. **Write only on the human's instruction.** With an application identity
   (`VAULT_AUTH_METHOD=approle`), `put` needs no password, so nothing but
   this rule stands between an agent and an overwrite. Versions are kept and
   nothing can delete, but a wrong value still breaks whatever depends on it.
7. **Never copy, print or move the AppRole credential file.** It is the
   codebase's identity, and each host gets its own `secret_id`. The loader
   refuses it once group or others can read it; on Windows, once anyone
   besides its owner, SYSTEM and Administrators can.

8. **Aligned repositories use the daily session only.** The role comes from
   `secrets.conf`, never a shell identity or an AppRole file. An agent must
   stop on a missing session; the human runs the LDAP/TOTP login. Do not read
   the keychain or copy a project token; use the loader or the future launcher.

## Session-issued project tokens

For a registered company project, run
`vault_secrets.py init --backend vault --role <name>`. Its `secrets.conf`
contains `vault_role = <name>` and `project = <name>` (an explicit `--project`
may keep a different display project). Registration and token-role/policy
changes are the owner's work, not `init`'s.

- The daily LDAP/TOTP session carries only `developer` plus the default
  self-service policy and is kept in the native OS keychain, never
  `~/.vault-token`. `admin` and `root` are never stored under any method.
- Windows uses Credential Manager through ctypes; macOS uses `security`
  with the record on stdin; Linux uses Secret Service through `secret-tool`
  stdin. A missing/locked backend stops; no plaintext fallback exists.
- `exec` creates a non-orphan service token through the configured role,
  limited to `<name>-app`, no default policy and at most 8h. It fetches only
  the named mappings, then revokes **before** starting the command, including
  when the command later fails. A failed revocation prevents command start.
- The owner must add explicit `update` on `auth/token/revoke-self` to the app
  policy. `lookup-self` stays unavailable on issued tokens; `check` reports
  readability and remaining daily-session time from its expiry metadata.
- In aligned mode, named values are fetched afresh, even if exported, and
  unnamed mapped exports and implicit Vault credentials are removed from
  the child. Without `vault_role`, the earlier environment-wins rule holds.
- `VAULT_AUTH_METHOD`, `VAULT_APPROLE_FILE`, `VAULT_SECRETS_MAPS` and
  `VAULT_TOKEN` are ignored for selecting an aligned identity. The map uses
  `${VAULT_PROJECTS_MOUNT}/<name>/<secret>#<field>`; the private mount's real
  name stays in host configuration. Explicit maps must stay in that prefix.

`issue --agent <name> --token-fd <fd>` hands one `<name>-agent` token plus a
newline to an inherited pipe/socket descriptor above 2. On Windows, the
launcher can use `--token-handle <HANDLE>` for an inherited non-standard
pipe handle. Nothing goes to stdout or a regular file. A failed handoff
revokes the token; a successful handoff leaves revocation to the launcher
and the daily session's lifecycle. The launcher/container are not supplied
here; integration is **Unexercised**, tracked in B-074.

## Choosing a backend

Ask the human; never pick for them. Then run
`vault_secrets.py init --backend <b> --project <name>`. For an aligned Vault
project use `init --backend vault --role <name>`.

| Backend | Values live in | Readable on a host | Who writes them |
|---------|----------------|--------------------|-----------------|
| `local` | a git-ignored `.env`, mode 600 | yes, that host only | `put VAR` |
| `vault` | a registered prefix on the shared projects mount (`--role`), or a legacy own mount | yes, via `exec` | owner `put VAR`; aligned roles/policies are registered separately |
| `gitlab` | GitLab CI/CD variables, masked and protected (`--gitlab-project`) | no: CI only | `put VAR` (GitLab API) |
| `github` | GitHub Actions secrets (`--github-repo`) | no: write-only | `put VAR` (through `gh`) |

- `init` writes `secrets.conf`, adds the `.env` ignores to `.gitignore`, and creates `.env.example` (and, for `vault`, `secrets.map`). It never overwrites: a second identical run changes nothing, and a different backend is refused. Change one by editing `secrets.conf` by hand.
- `.env.example` is the list of names under every backend.
- With `gitlab` or `github`, `exec` refuses: the values belong to CI. A local run exports the variable itself.
- For legacy own-mount projects the project name becomes the Vault mount, so `sys`, `auth`, `identity`, `cubbyhole`, `kv` and `secret` are refused.

## Commands

Run from the repository root, which holds `secrets.conf` and `secrets.map`; or pass `--map FILE` (vault only).

| Command | What it does |
|---------|--------------|
| `init` | Declares the backend; see *Choosing a backend*. An agent may run it once the human has chosen. |
| `login` | With `vault_role`: LDAP/TOTP into the native OS keychain, retaining only developer plus default; no token file. Legacy LDAP stores its narrow read child in `~/.vault-token`; legacy pasted tokens are accepted only without admin/root. AppRole verifies and stores nothing. |
| `exec VAR… -- CMD…` | With `vault_role`: issue, fetch only named mappings and revoke before CMD; revocation failure stops. Legacy environment-wins and AppRole behavior remain unchanged. POSIX exec replaces the process; Windows waits and returns CMD's status. |
| `check` | Aligned: mapped names/readability plus remaining keychain session time, with no issued-token lookup-self. Legacy: transport/token/map status; local and CI backends retain their names-only checks. |
| `put VAR` | Aligned Vault uses a scoped issued project token and revokes it after CAS. Otherwise writes one value, read from stdin or a hidden prompt, using a **fresh login held in memory**, never the stored read-only token; with `approle`, no prompt at all. Merges into the secret with check-and-set. With `local`, replaces the line in `.env` (mode 600), and refuses while `.env` is not git-ignored. With `github`, runs `gh secret set` with the value **on stdin, never in argv**. With `gitlab`, creates or updates a masked, protected CI/CD variable through the API, using `GITLAB_URL` and `GITLAB_TOKEN` (api scope; prompted for if unset). An `http://` GitLab is refused unless the human passes `--allow-http`, because the token and the value would cross the network in cleartext. |
| `import --from FILE [VAR…]` | Moves values from an existing env file, such as a migrated repository's old `.env`, into the declared backend. It writes the named variables, or every one the file sets. A variable missing from `.env.example`, empty in the file, or (for `vault`) unmapped is skipped by name. Naming one that cannot be imported writes nothing. Values go straight from the file to the store, nothing is printed, and the source file is left in place. It writes values, so it is the human's step; `--dry-run` contacts nothing and lists names only, so an agent may run it. |
| `logout` | Aligned: revoke the daily session and its descendants, then clear its keychain item. Legacy: revoke the stored token and remove its file. |
| `issue --agent NAME --token-fd FD` | Issue `NAME-agent` only for this repository's `vault_role`; hand off through a pipe/socket, never stdout/file. Windows also accepts `--token-handle HANDLE`. The future launcher owns revocation after successful handoff. |
| `provision [--dry-run]` | **Superseded for aligned development projects; retained for legacy Vault projects, a human admin step.** Creates the project's own KV v2 mount `<project>/`, the policies `<project>-read`, `-write` and `-app`, and the AppRole `<project>`. It takes the admin token from `VAULT_TOKEN`, a fresh LDAP login or a prompt, holds it in memory, and refuses a root token or an AppRole identity. It reads everything first and refuses, before any write, anything that exists in another shape. It never deletes, never edits another policy, and never enables an auth method. `--dry-run` contacts nothing and prints the plan, so an agent may run it. |

Exit status: 0 ok, 1 failure, 2 usage, 3 not logged in or token rejected.

Vault transport and legacy authentication configuration use the environment: `VAULT_ADDR` (required, `https://`),
`VAULT_CACERT`, `VAULT_AUTH_METHOD` (`ldap`, `approle` or `token`),
`VAULT_AUTH_MOUNT`, `VAULT_USER`, `VAULT_APPROLE_FILE`, `VAULT_TOKEN` and
`VAULT_SECRETS_MAPS`. Meanings are in the script's `--help` and the adopting repo's
`.env.example`. Aligned mode additionally uses `VAULT_PROJECTS_MOUNT` and
`VAULT_LDAP_MOUNT` (default `ldap`); its project identity is only the repository
configuration. No environment variable enables a fake keychain.

## The map

`secrets.map` holds **names and paths only**, one entry per line:

```
GITHUB_TOKEN=kv/ai-toolbox/github#token
```

That reads: the variable `GITHUB_TOKEN` is the field `token` of the KV v2
secret `ai-toolbox/github` on the mount `kv`. A malformed line fails with its
line number and is never echoed, because a malformed line may be a pasted
value.

**Several maps combine.** Repeat `--map`, or list the maps once in
`VAULT_SECRETS_MAPS` (colon-separated). A variable mapped in two files is an
error, never an override. A repository's tracked map holds only what its own
procedures need. Names that describe internal systems belong in a private
map outside the repository, because a tracked map is published with the
code.

## An application identity (AppRole)

This remains for servers/CI and repositories not yet aligned. Aligned
development projects use the session model above and keep no project
AppRole secret_id on the machine.

A codebase can have its own Vault identity, so its commands can read and
write its secrets without a human password:

```bash
export VAULT_AUTH_METHOD=approle
export VAULT_APPROLE_FILE=~/.config/vault/<codebase>.approle   # role_id + secret_id, mode 600 (Windows: private to you)
```

- Each command logs in for itself and keeps no token. `exec` revokes its
  token **before** the child starts; `check` and `put` revoke theirs when
  they finish.
- The policy grants create, read and update on the codebase's own prefix,
  and no delete, so every overwrite stays recoverable.
- Issuing, rotating and revoking a `secret_id` is a human step. See
  `references/vault-layout.md`.

## On a new host

For a repository with `vault_role`, have the owner finish the daily identity
and registered role setup first, including the explicit self-revocation
grant. Provide the native keychain: Windows Credential Manager, macOS
Keychain, or an unlocked Secret Service keyring with `secret-tool`. Configure
`VAULT_PROJECTS_MOUNT` outside the repository; it is private and must never
be expanded into a tracked map. `VAULT_LDAP_MOUNT` defaults to `ldap` and is
separate from a host's legacy AppRole mount. Then use the public CA and Vault
address steps below, and have the human run `login` followed by `check`.

Without `vault_role`, keep the existing host configuration. This task does
not align ai-toolbox itself, remove its AppRole/map, or change its push path.


1. Put the internal root CA's public certificate somewhere stable, and export
   `VAULT_CACERT` pointing at it.
2. Export `VAULT_ADDR`. It is not a secret, but it is internal, so it goes in
   the shell profile, never in a tracked file.
3. Run `vault_secrets.py login`, then `vault_secrets.py check`.

The whole procedure for ai-toolbox, including git pushes, is in its runbook,
under *Secrets on a new host*.

## Scripts

- `scripts/vault_secrets.py`: the loader; ship it together with
  `vault_sessions.py` and `vault_keychain.py` in the same directory. Python 3 standard library only, so
  HTTP, JSON and TLS run in one process and no token ever appears in a
  command line.

## References

- `references/vault-layout.md`: what the Vault side must provide (mount,
  paths, policies, auth), so it can be rebuilt without the session that first
  built it. Its *A project's own mount* section holds the one policy a Vault admin creates once for `provision`.

## Assets

- `assets/policies/{read,write,app}.hcl`: the three per-project policies `provision` writes, with `@@MOUNT@@` replaced by the project name.
