# TASK-0166 — Re-point `origin` to `https://`; amend ADR-0028

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-11
- Updated: 2026-10-11
- Applies to: this clone's `origin` (untracked `.git/config`), `ADR-0028`, `AGENTS.md`, runbook, `.env.example`, `.ai/context/CURRENT_STATE.md`
- Source: human decision 2026-10-11, "origin is to be permanently re-pointed to https://", the open question from `TASK-0163`

## Objective

`origin` was `http://`. GitLab redirects it to `https://`, and every push needed `vgit_origin`'s per-command rewrite (`TASK-0163`). Re-point the remote itself, and correct the records that still say the instance is `http://` only.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `origin` | `http://` URL; `https://` on the same host answers, with the push token accepted (`TASK-0163`) |
| `ADR-0028` | Context says "answers on `http://` only; its `https://` port refuses connections" |
| runbook, `.env.example`, AGENTS.md | describe `origin` or `$GITLAB_URL` as `http://` only |

## Scope

- In: `git remote set-url origin` to the `https://` form, with the host derived from the current URL and never printed; an ADR-0028 Status amendment; runbook steps to re-point other clones; the `put`, `curl` and `.env.example` notes.
- Out: the human's own `GITLAB_URL` value, which lives outside the repository and is still `http://`; other clones on other hosts; ADR-0028's body, which stays as written, as with its earlier amendments.

## Likely files

- `.ai/decisions/0028-gitlab-is-the-primary-remote.md`, `docs/operations/runbook.md`, `AGENTS.md`, `.env.example`, `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`, this brief

## Execution plan

1. Re-point `origin` from `http://` to `https://`, deriving the URL, and confirm `git remote -v` is token-free.
2. Read `master` with plain `vgit` (no rewrite) and with `vgit_origin`, and fetch.
3. Check that Windows git also reaches the new URL over TLS (`TASK-0148`'s CA setup).
4. Amend the ADR, update the docs, run `tests/validate.sh`, commit, push to both remotes and compare hashes.

## Acceptance criteria

- [x] `git remote get-url origin` starts with `https://`, and `git remote -v` holds no userinfo.
- [x] Plain `vgit GITLAB_PUSH_TOKEN git-push ls-remote origin master` prints `master`'s hash.
- [x] No tracked file states that the instance is `http://` only, except history and closed briefs.
- [x] No tracked file names the host: `check-private-names.sh` passes in the gate.

## Mandatory validations

- [x] tests/validate.sh (WSL, AlmaLinux-10)
- [x] `vgit` and `vgit_origin` `ls-remote origin master` after the re-point

## Risks and rollback

- **Other clones** keep `http://` until re-pointed. They still push through `vgit_origin`, and the runbook gives the re-point steps.
- **`GITLAB_URL` is still `http://`** in the human's environment. `put` to a GitLab backend then needs `--allow-http` until it is changed.
- Rollback: git revert the task commit; `git remote set-url origin` back to the `http://` form.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `origin` | `https://`, token-free |
| `ADR-0028` | amended 2026-10-11: `https://` served, `origin` re-pointed |
| runbook | re-point steps for an `http://` clone; `put` and `curl` notes corrected |

Next: the human sets `GITLAB_URL` to `https://` in their environment.

## Execution log

- 2026-10-11 · Claude Code (Opus 5.5) · done
  - Evidence: `git remote set-url origin https://…` → `git remote -v` shows `https://<host>/armando.martires/ai-toolbox.git`, no userinfo
  - Evidence: plain `vgit … ls-remote origin master` → `bfa7aad… refs/heads/master`, rc 0; `vgit_origin` the same; `vgit … fetch origin` → ok
  - Evidence: Windows git, no credential → `could not read Username for 'https://…'`, so the TLS handshake succeeded
  - Evidence: `tests/validate.sh` (AlmaLinux-10, through the hook) → `validate.sh: OK`
  - Deviation: none
