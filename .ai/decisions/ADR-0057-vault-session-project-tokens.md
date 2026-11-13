# ADR-0057 — Opt Vault repositories into session-issued project tokens

**Status**: accepted
**Date**: 2026-11-08
**Task**: TASK-0259
**Amends**: ADR-0030, ADR-0031 and ADR-0034 for repositories declaring vault_role
**Upstream decision**: sigma-infrastructure ADR 0036 (proposed; clauses decided by the owner)

## Context

Long-lived project AppRole secret_ids on development machines select an identity through the shell and leave reusable credentials in files. The owner chose a daily MFA login, OS keychain storage and short-lived project tokens issued through registered roles. Existing repositories must keep working until explicitly aligned.

## Decision

1. A vault repository opts in with vault_role in secrets.conf. The role and secret prefix come from that file, never a shell project identity. VAULT_AUTH_METHOD, VAULT_APPROLE_FILE, VAULT_SECRETS_MAPS and VAULT_TOKEN do not select an aligned identity. Explicit maps remain permitted only inside that role's prefix. Without vault_role, legacy behavior stays unchanged except the required refusal to store admin/root tokens.
2. The daily session is obtained by LDAP followed by Vault's TOTP challenge. Only developer plus default is retained. Default supplies the session's own lifecycle operations; developer supplies named token-role creation. During transition, workstation-read is removed through a non-orphan child; the parent is never stored and cannot be revoked on success because that would revoke the retained session too. Identity-derived broad grants that cannot be removed are refused. No admin/root token is ever stored, including pasted tokens in legacy mode.
3. The daily session lives in Windows Credential Manager (current OS logon session), macOS Keychain or Secret Service. Windows uses ctypes. macOS security -i -q receives one bounded base64 record command on stdin, with no shell, history or secret argv. Secret Service receives its payload on secret-tool's stdin. Missing, locked or unsupported backends fail closed; there is no file fallback. Keychain metadata holds the token's expiry, not a second secret file.
4. Owner tools mint a non-orphan service token through auth/token/create/<role>, with <role>-app only, no default policy and an explicit 8h maximum. exec fetches the requested mapped variables afresh, removes unnamed mapped exports and implicit Vault credentials, and revokes before starting the command. All failure paths attempt revocation; unconfirmed revocation is a failure that prevents command start. This satisfies the lifecycle goal more reliably than cleanup after POSIX exec.
5. The owner approved an external prerequisite: every project app policy explicitly grants update on auth/token/revoke-self. It intentionally does not gain lookup-self. The supplied policy generator lacks the revoke grant; applying it is the owner's separate sigma-infrastructure task. This loader changes no real policy, role or Vault object.
6. check reports mapped names and readability using an issued project token, and the remaining daily-session time from keychain expiry. It never calls lookup-self on an issued token. Aligned put/import use the same scoped lifecycle, including CAS and revocation, rather than a legacy AppRole.
7. issue --agent <role> --token-fd <fd> writes one ASCII token plus newline to an inherited pipe/socket descriptor above 2. Windows launchers may instead supply --token-handle with an inherited non-standard pipe HANDLE. Regular files and standard output/error are refused. A failed handoff revokes; a successful handoff transfers revocation responsibility to the future launcher. Revoking the daily session still revokes its descendants. The launcher/container are outside this task, and this interface is the third Unexercised backlog item.
8. init --backend vault --role <role> writes vault_role and a map stub using the literal ${VAULT_PROJECTS_MOUNT} placeholder. The private mount is resolved from configuration at runtime and never rendered into tracked files. The one-mount-per-project provision command remains available for legacy use but is superseded for aligned development projects.

## Consequences

- ai-toolbox itself is not aligned here: its secrets.conf, per-host AppRole, map and push authentication remain unchanged. Alignment and CI are a later task.
- Session modules ship beside the loader. Fake keychains are injected by tests, never enabled by a production environment switch; importing the session modules writes no bytecode cache.
- The standard-library code depends on native security/secret-tool commands where applicable. No platform is silently replaced by plaintext storage.
- Native keychain and live daily-identity verification remain the owner's pending step. Offline transport and fake Vault tests do not claim live verification or launcher integration.
- A rollback removes the opt-in loader feature; it changes no Vault configuration or existing repository alignment.

## References

- [Apple security interactive input](https://github.com/apple-oss-distributions/Security/blob/main/SecurityTool/macOS/security.c)
- [Apple input reader](https://github.com/apple-oss-distributions/Security/blob/main/SecurityTool/sharedTool/readline.c)
- [Windows credential structure](https://learn.microsoft.com/en-us/windows/win32/api/wincred/ns-wincred-credentialw)
- [Secret Service CLI stdin contract](https://manpages.debian.org/trixie/libsecret-tools/secret-tool.1.en.html)
- [Vault token API](https://developer.hashicorp.com/vault/api-docs/auth/token)

References inspected 2026-11-08. No real session or credential was used for implementation tests.
