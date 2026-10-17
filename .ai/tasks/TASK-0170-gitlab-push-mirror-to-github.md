# TASK-0170 — Let GitLab push the public mirror, so agents push `origin` only

## Status

- Status: planned
- Owner: the human (the mirror in GitLab), then agent (repo changes)
- Created: 2026-10-17
- Updated: 2026-10-17
- Applies to: `AGENTS.md` (Commands, Git rules, task report), `docs/operations/runbook.md`, `.env.example`, `secrets.map` header, `.ai/decisions/0028-gitlab-is-the-primary-remote.md`, `.ai/context/CURRENT_STATE.md`; per-host `~/.config/vault/ai-toolbox.map` (untracked)
- Source: the human's request of 2026-10-17 ("gitlab as main and gitlab pushing to github"); completes `TASK-0169` step 6

## Objective

Every push now needs two credentials, and the GitHub one in Vault is dead: `GET /user` returned 401 on
2026-10-17, so the mirror stopped at `81f8df4`. A GitLab push mirror moves the GitHub credential into GitLab's
settings. Agents then push `origin` only, and `retire github-token` can run.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| GitLab push mirror on `origin` (human, Settings → Repository → Mirroring repositories) | Direction push, to `https://github.com/armandomartires/ai-toolbox.git`, protected branches only, last update successful |
| Its GitHub credential | A fine-grained token for that one repository: Contents and **Workflows** read/write. Without Workflows, GitHub refuses any push that changes `.github/workflows/`, which this repo renders |
| `git ls-remote github refs/heads/master` (public, no token) | Equals `origin`'s `master` within minutes of a push |
| `GITHUB_PUSH_TOKEN` | Mapped only in the per-host map (`TASK-0169`); its Vault value returns 401 on GitHub |

## Scope

- In: the push procedure and its docs; dropping `GITHUB_PUSH_TOKEN` from every tracked file and, by the human, from each per-host map.
- Out: creating the mirror and its token (the human, in GitLab and GitHub); moving the project into the GitLab group (SIGMA-infrastructure `S066`); `.github/workflows/`, whose `secrets.GITHUB_TOKEN` is Actions' own token; running `retire github-token`.

## Likely files

`AGENTS.md`, `docs/operations/runbook.md`, `.env.example`, `secrets.map`, `.ai/decisions/0028-gitlab-is-the-primary-remote.md`, `.ai/context/CURRENT_STATE.md`.

## Execution plan

1. Re-verify every Inputs row. Stop if the mirror's last update failed: the GitLab server may not reach `github.com`.
2. Confirm the mirror carries a push: `github`'s `master` must equal `dadbc72` or a later `origin` hash, read with plain `git ls-remote`.
3. AGENTS.md Git rules: push `origin` only, then confirm `github` by `git ls-remote`, polling a few minutes. Keep the task report's `github ✓` meaning "the mirror caught up".
4. Runbook, *Authenticating a push* and *Always confirm the push landed*: drop the `vgit GITHUB_PUSH_TOKEN` line; say the `github` remote is for reading, and name where to see the mirror's status.
5. Remove `GITHUB_PUSH_TOKEN` from `.env.example`, the `secrets.map` header and AGENTS.md Commands.
6. Amend ADR-0028: GitLab pushes the mirror; no agent holds a GitHub credential.
7. Human, on each workstation: delete the `GITHUB_PUSH_TOKEN` line from `~/.config/vault/ai-toolbox.map`.
8. Hand back to `TASK-0169` step 8: the human runs `retire github-token`, dry, then `--apply`.

## Acceptance criteria

- [ ] A push to `origin` alone reaches `github`: both `ls-remote` hashes equal `HEAD`.
- [ ] No tracked file names `GITHUB_PUSH_TOKEN`, and no per-host map maps it.
- [ ] AGENTS.md and the runbook tell an agent to push `origin` only.
- [ ] GitHub Actions still run on the mirrored push (`validate.yml` for that commit).

## Mandatory validations

- [ ] tests/validate.sh
- [ ] `scripts/check-private-names.sh`: the GitLab host stays out of every tracked file

## Risks and rollback

- A direct push to `github` makes it diverge, and the mirror then fails on that branch. Push `origin` only, and read the mirror's status if `github` lags.
- A mirror failure is silent from this clone. The `ls-remote` comparison in step 3 is the only check, so it is mandatory.
- Rollback: git revert the task commit, and push `github` with a token again. Disabling the mirror is the human's step in GitLab.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next:

## Execution log

- 2026-10-17 · claude/opus-5.5 · brief written at the human's request; the human sets up the mirror meanwhile
  - Evidence: `vgit GITHUB_PUSH_TOKEN … push github master` → `could not read Username`; the same token on `GET /user` → `401`
  - Deviation: none
