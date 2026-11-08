<!-- Rendered by ai-toolbox's scripts/sync-templates.sh. Shape is owned by
     ai-toolbox's skills/project-migration/schemas/task.md (its ADR-0027).
     In ai-toolbox, edit the schema and re-render; tests/validate.sh fails on
     drift. A copy in another repository is not regenerated or checked there. -->

# TASK-0259 — Issue project Vault tokens from a keychain-held daily session

## Status

- Status: done
- Owner: agent (Codex)
- Created: 2026-11-08
- Updated: 2026-11-08
- Applies to: skills/vault-secrets/, tests/test-vault-secrets.sh, loader documentation and governance
- Source: sigma-infrastructure S096.T004; owner's request and approval to carry only the uncommitted TOTP login diff (tests T58-T61).

## Objective

Opt repositories into session-issued project tokens through vault_role in secrets.conf. Keep the daily session in the native OS keychain and project tokens in memory only; preserve every unaligned repository's legacy path and this repository's push authentication.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| Read-only sibling requirements | sigma-infrastructure ADR 0036 and S096.T001/T002/T004/T005 reviewed; no changes there |
| Branch base | origin/master f77076d; local master 1dc2677 is 12 ahead and 2 behind; the task must not publish those unrelated local commits |
| Other branches and worktrees | 35 refs and worktrees initially checked; final recheck found a concurrent TASK-0258, so this task takes free TASK-0259 |
| Human TOTP diff | carry only vault_secrets.py and tests T58-T61; leave master untouched |

## Scope

- In: optional vault_role; native keychain interface and injected fake; LDAP/TOTP login and refusal to store admin/root tokens; scoped token issue/fetch/revoke; issue --agent through an inherited descriptor; init --role; minor version and specified docs/tests/registry.
- Authorized git operations: create an isolated task branch from origin/master, apply only the approved TOTP diff, rebase the unpublished task commit onto origin/master as needed, and push origin only without force. No changes to the main checkout.
- Out: aligning ai-toolbox itself or changing secrets.conf; agent container/launcher (S096.T005); repository move (S066.T024); changes or re-vendoring in sigma-infrastructure; real logins, secret values, Vault writes, policies or roles. Real verification is the owner's pending step after the daily identity exists.

## Likely files

- skills/vault-secrets/ loader, keychain/session modules, SKILL.md and vault-layout.md
- tests/test-vault-secrets.sh and vault-session-cases.py; .env.example, runbook, registry and CHANGELOG.md
- ADR-0057 and amendment pointers; CURRENT_STATE.md, TODO.md, GOALS.md and BACKLOG.md

## Execution plan

1. Select origin/master in the isolated worktree; apply only the approved TOTP diff.
2. Resolve the revocation policy gap; implement native keychains and opt-in session dispatch.
3. Add symbolic init --role, descriptor-only issuance and failure/leakage tests.
4. Update docs, version, ADR and third Unexercised row; validate, review, commit once and push origin.

## Acceptance criteria

- [x] vault_role, never shell identity, selects the project; absent vault_role keeps legacy tests unchanged except required global admin-token storage refusal.
- [x] Keychain backends have no token in argv or plaintext files; session login writes no .vault-token and refuses admin/root policies.
- [x] exec fetches only requested mappings, revokes before the command and on failure, and cannot launch after an unconfirmed revocation.
- [x] check reports names/readability and session time without child lookup-self; issue --agent sends only to a descriptor/pipe.
- [x] init --role writes no private mount name; provision remains available but superseded.
- [x] Docs, version, registry and task boards updated; issue launcher integration is the third Unexercised row; live verification explicitly pending.

## Mandatory validations

- [x] tests/test-vault-secrets.sh: 169/169 passed; fake Vault/keychain, TOTP T58-T61 retained
- [x] tests/validate.sh: validate.sh: OK
- [x] staged diff reviewed; credential-pattern scan and private-name check pass (gitleaks unavailable locally)

## Risks and rollback

- Revocation policy gap: the supplied generator grants KV only to app tokens and no default policy; developer grants token creation only. Owner approved requiring explicit update on auth/token/revoke-self in each app policy; applied separately in sigma-infrastructure. The loader fails closed on unconfirmed revocation.
- Store the narrowest daily session capable of named role creation. Retain developer plus default (needed for self-service lifecycle); transitional workstation-read is stripped through a non-orphan child, whose unstored LDAP parent must remain alive. An identity-derived broad grant that cannot be stripped is refused. Never retain admin/root or workstation-read.
- Native keychains and the agent launcher need the owner's live checks; fake transport tests do not establish live compatibility.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| Loader | session opt-in, narrow native keychain storage, strict revocation and descriptor handoff implemented |
| Skill/docs | version 2.4.0; legacy provision superseded for aligned development; registry updated |
| Pending live work | owner daily identity, explicit app self-revocation grant, native keychain verification and launcher integration (B-074) |
| External requirements | read only; no new-model real Vault or keychain operation performed |

Next: owner applies the explicit self-revocation grant and daily identity, then verifies native keychains and the launcher; no live result is claimed here.

## Execution log

- 2026-11-08 - Codex - selected origin/master f77076d; owner approved carrying only TOTP changes and requiring an external app-policy self-revocation grant.
  - Evidence: 35 refs/worktree task files checked; TASK-0258 initially free; concurrent reservation moved this brief to TASK-0259. Main master is 12 ahead/2 behind; approved legacy/TOTP baseline 130/130. Helper preliminary full baseline was stopped; no pass claimed.
- 2026-11-08 - Codex - implemented session modules, native transports, scoped put/import and safe handoff; left ai-toolbox unaligned and main unchanged.
  - Evidence: final fake suite 169/169, including T15 no leaks/T42 no DELETE; synthetic native transport tests only. Scoped provision and path traversal fail closed.
- 2026-11-08 - Codex - initial AppRole fetch failed, then succeeded after the owner restored the host credential.
  - Evidence: unchanged vgit_origin fetch origin master succeeded; remote base unchanged. No new-model live login or Vault change attempted.
- 2026-11-08 - Codex - shortened the over-budget brief; full tests/validate.sh passed (validate.sh: OK); reviewed staged diff and credential patterns, private-name check passed. Live verification remains the owner's step.
