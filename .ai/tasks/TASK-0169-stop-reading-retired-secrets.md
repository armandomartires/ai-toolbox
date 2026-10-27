# TASK-0169 — Stop reading three retired secrets, so SIGMA-infrastructure can retire them

## Status

- Status: done
- Owner: agent, then the human (per-host maps and the Vault deletions)
- Created: 2026-10-17
- Updated: 2026-10-18
- Applies to: `secrets.map`, `skills/vault-secrets/`, `skills/ansible-ops/SKILL.md`, `docs/operations/runbook.md`, `AGENTS.md` (Git rules); per-host `~/.config/vault/ai-toolbox.map` (untracked)
- Source: the human's request of 2026-10-17, a handover from SIGMA-infrastructure `S066.T021`

## Objective

SIGMA-infrastructure's revocation script has three steps gated on this repo: revoke `GITHUB_TOKEN`, destroy the old GitLab admin-token copy (`GITLAB_TOKEN` here)
and the retired ansible-vault password. Remove each read here, so the human can run them.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `secrets.map` (tracked) | `GITLAB_PUSH_TOKEN`, `GITLAB_TOKEN`, `GITHUB_TOKEN`, all on the `kv/` mount. That mount was retired 2026-10-15 (SIGMA-infrastructure ADR 0025), so every lookup through this file fails |
| `GITLAB_PUSH_TOKEN`'s secret | Revoked and destroyed (SIGMA-infrastructure `S073`). AGENTS.md's Git rules and the runbook's *Authenticating a push* still push `origin` with it |
| `~/.config/vault/ai-toolbox.map` (untracked, one per workstation; the second workstation has one) | On the new projects mount. Maps `GITHUB_PUSH_TOKEN` to the `github` secret and `ANSIBLE_VAULT_PASSWORD` to the `ansible` secret. Has no `GITLAB_TOKEN` |
| `skills/vault-secrets/scripts/vault_secrets.py` | The `gitlab` backend reads `GITLAB_TOKEN`, or else prompts for it |
| `skills/ansible-ops/SKILL.md` | Names `ANSIBLE_VAULT_PASSWORD`. SIGMA-infrastructure no longer uses ansible-vault: its secrets moved to Vault (its ADR 0018) |
| Vault's audit log, read 2026-10-17 from SIGMA-infrastructure | No job has read the three secrets since 2026-10-15. The ai-toolbox AppRole has read nothing at all since then, so this silence does not show the secrets are unused |

## Scope

- In: every read of the three secrets by this repository and its per-host maps; the push procedure that names the destroyed `GITLAB_PUSH_TOKEN`.
- Out: moving this project into the GitLab group and its server-side mirror (SIGMA-infrastructure `S066`); running the revocations, which the human does from SIGMA-infrastructure; rotating any value; `.github/workflows/`, whose `secrets.GITHUB_TOKEN` is Actions' built-in token, not the Vault secret.

## Likely files

`secrets.map`, `skills/vault-secrets/SKILL.md`, `skills/vault-secrets/scripts/vault_secrets.py`, `tests/test-vault-secrets.sh`, `skills/ansible-ops/SKILL.md`, `docs/operations/runbook.md`, `AGENTS.md`, `.env.example`.

## Execution plan

1. Re-verify every Inputs row (all read 2026-10-17).
2. **Stop and ask the human** how the tracked `secrets.map` names the new mount: its name is private (AGENTS.md, Git rules). One option: names tracked, paths only in the per-host map.
3. Remove `GITLAB_PUSH_TOKEN` from `secrets.map`, `.env.example` and the tests.
   Ask the human how `origin` is pushed until the move; record it in AGENTS.md.
4. Remove `GITLAB_TOKEN` from `secrets.map`: no agent-readable identity holds the admin token (SIGMA-infrastructure ADR 0021 clause 5). The `gitlab` backend keeps its prompt, which the human answers.
5. Remove `ANSIBLE_VAULT_PASSWORD` from `skills/ansible-ops/SKILL.md`.
6. Keep `GITHUB_TOKEN` until a server-side mirror pushes the public `github`
   remote. Then drop it from `secrets.map`, AGENTS.md and the runbook.
7. Human, on each workstation: delete the `ANSIBLE_VAULT_PASSWORD` line from
   `~/.config/vault/ai-toolbox.map`, and the `GITHUB_PUSH_TOKEN` line once
   step 6 is done.
8. Hand back: the human runs SIGMA-infrastructure's `_up_s066_gitlab.py retire
   admin-copy ansible-vault-password`, dry, then `--apply`; `github-token` after 6.

## Acceptance criteria

- [x] No tracked file maps `GITLAB_PUSH_TOKEN` or `GITLAB_TOKEN`, and none names the private mount.
- [x] No per-host map names `ANSIBLE_VAULT_PASSWORD`: none on this workstation, and none on the second workstation (the human's `grep -c`, 2026-10-18).
- [x] ~~After a day of normal work, the audit-log reader shows no ai-toolbox read of `gitlab-admin`, `ansible` or `github`.~~ Not run: the human ran step 8 after the day. All three are destroyed, so no reader is left.
- [x] The human reports the gated `retire` steps done (2026-10-18).

## Mandatory validations

- [x] tests/validate.sh
- [ ] `scripts/check-private-names.sh` (passed on its 3 derived patterns), after placing `.git/info/private-patterns`, which a fresh clone lacks (runbook, *Secrets on a new host*)

## Risks and rollback

- Revoking `GITHUB_TOKEN` before a server-side mirror exists stops the public mirror, so step 6 waits for that mirror.
- Destroying a secret cannot be undone. Only the human runs those steps, and only after the acceptance criteria above hold.
- Rollback: git revert the task commit. The Vault deletions have no rollback.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `secrets.map`, `.env.example`, AGENTS.md, runbook, ADR-0030, `ansible-ops` 1.2.2 | `secrets.map` header only, and T16 fails if it maps a git remote token. Mirror pushed with `GITHUB_PUSH_TOKEN`; `GITLAB_TOKEN` and `ANSIBLE_VAULT_PASSWORD` in no tracked file's procedure; runbook step 4 places the per-host map; ADR clause 1 amended for the retired `kv/` |

| Vault, `sigmarecon-projects/ai-toolbox/` | Only `gitlab-push`, the new `origin` token (step 3). `github`, `ansible`, `gitlab-admin` destroyed (step 8); step 6 done by `TASK-0170` |

Next: none. `private-patterns` is the human's per-clone step (runbook, *Secrets on a new host*).

## Execution log

- 2026-10-17 · claude/opus-5.5 (in SIGMA-infrastructure) · brief written at the human's request; no change made
  - Evidence: Inputs read from this clone and the per-host map (names and paths only), and from Vault's audit log (aggregates only)
  - Deviation: none
- 2026-10-17 · claude/opus-5.5 · steps 1-5 done; 6-8 wait on the human. Decisions (human): step 2, names tracked and paths per-host, the mirror pushed with the per-host `GITHUB_PUSH_TOKEN`. Step 3, a new project token for `origin`, still named `GITLAB_PUSH_TOKEN`, mapped per-host only
  - Evidence: Inputs rows re-read and matched. `test-vault-secrets` 114/114; with the old `secrets.map` restored, the new T16 check fails naming all three tokens. `check-private-names: OK (3 patterns)`. The diff does not name the mount. Deviation: `GITLAB_PUSH_TOKEN` stays in `.env.example`, because it is still read. Step 6 changed only the dead tracked `GITHUB_TOKEN` mapping. The per-host `GITHUB_PUSH_TOKEN` still reads the `github` secret, so `retire github-token` still waits
- 2026-10-18 · claude/opus-5.5 · steps 3, 6-8 done by the human; recorded
  - Evidence: the human's `retire github-token admin-copy ansible-vault-password` dry run, `--apply` and re-run (all "done already"). As ai-toolbox's AppRole: `LIST …/ai-toolbox/` → `['gitlab-push']`; `github`, `ansible`, `gitlab-admin` → 404. `vgit_origin` push of `105eaad` worked with the new token. Deviation: acceptance 3's audit-log read was not run before the destruction
- 2026-10-18 · claude/opus-5.5 · closed: the human's `grep -c '^ANSIBLE_VAULT_PASSWORD='` on the second workstation's map printed 0
