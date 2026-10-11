# TASK-0163 — Push to `origin` over `https://` with a per-command rewrite

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-11
- Updated: 2026-10-11
- Applies to: `docs/operations/runbook.md` (*Authenticating a push*, *Landing work*), `AGENTS.md`, `.ai/context/CURRENT_STATE.md`
- Source: human request 2026-10-11, after the `TASK-0162` push to `origin` hung

## Objective

The runbook's `vgit GITLAB_PUSH_TOKEN git-push push origin master` no longer works. `origin` is `http://`, GitLab answers 301 to `https://`, and libcurl does not resend `http.extraheader` across a scheme or port change, so git gets a 401 and waits on a username prompt. Make the recipe push over `https://` without changing the remote, and make an auth failure fail fast.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `origin` | `http://` URL in untracked `.git/config`; GitLab redirects it to `https://` |
| `GITLAB_PUSH_TOKEN` | valid: over `https://`, `info/refs?service=git-receive-pack` returned 200 with basic auth, 401 without (human, 2026-10-11) |
| runbook *Authenticating a push* | `vgit` sends the header to the `http://` URL |

## Scope

- In: `vgit` sets `GIT_TERMINAL_PROMPT=0`; a `vgit_origin` wrapper adds `-c url.https://<host>/.insteadOf=http://<host>/`, the host read from `git remote get-url origin`; the verification step uses it; AGENTS.md and CURRENT_STATE follow.
- Out: re-pointing `origin` to `https://` and amending `ADR-0028`'s "http:// only" (the human's decision, asked); the runbook's `put --allow-http` note, which is about `$GITLAB_URL`, not `origin`; history.

## Likely files

- `docs/operations/runbook.md`, `AGENTS.md`, `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`, this brief

## Execution plan

1. Add `GIT_TERMINAL_PROMPT=0` to `vgit`; add `vgit_origin`, which rewrites only an `http://` origin and passes any other through.
2. Use `vgit_origin` for the push, the `ls-remote` check and the *Landing work* pointer; explain the redirect in prose, with no host name.
3. Extract the recipe from the runbook and run it read-only against `origin`; run the old form to confirm it now fails fast.
4. Update AGENTS.md and the CURRENT_STATE open item; `tests/validate.sh`; commit; push with the new recipe.

## Acceptance criteria

- [x] The recipe, extracted verbatim from the runbook, reads `origin`'s `master` hash.
- [x] The old form fails in seconds with `terminal prompts disabled` instead of hanging.
- [x] No tracked file names the intranet host: `scripts/check-private-names.sh` passes inside the gate.
- [x] This task's commit is pushed to `origin` with `vgit_origin` and to `github`, and both hashes match `HEAD`.

## Mandatory validations

- [x] tests/validate.sh (WSL, AlmaLinux-10)
- [x] the extracted recipe: `vgit_origin ls-remote origin master`

## Risks and rollback

- **An `origin` URL with a port** would be rewritten to `https://` on that same port. Today's has none.
- **Commands run without `vgit_origin`** (a bare `git fetch origin`) still go to `http://`; only re-pointing `origin` removes that.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| runbook | `vgit` with `GIT_TERMINAL_PROMPT=0`; `vgit_origin` for push and check |
| CURRENT_STATE | open item: `origin` still `http://`, re-pointing is the human's |

Next: the human decides whether to re-point `origin` to `https://` and amend `ADR-0028`.

## Execution log

- 2026-10-11 · Claude Code (Opus 5.5) · done
  - Evidence: extracted recipe, `vgit_origin ls-remote origin master` → `6f020f4… refs/heads/master`, rc 0, 2 s
  - Evidence: `vgit GITLAB_PUSH_TOKEN git-push ls-remote origin master` → `fatal: could not read Username for 'https://…': terminal prompts disabled`, rc 128, 1 s
  - Evidence: `tests/validate.sh` (AlmaLinux-10) → `validate.sh: OK`
  - Evidence: the recipe's first live push, `TASK-0165` → `To https://…  e56018b..0a4b07d  HEAD -> master`, `ls-remote` equal on both remotes
  - Deviation: worked in a `scripts/worktree.sh` worktree; the Claude Code worktree was checked out by Windows git with CRLF, which WSL git reads as every file modified.
  - Deviation: the first commit through the hook set `core.bare = true` in the shared config, twice. That bug was fixed first as `TASK-0165`, at the human's choice. These changes were then reapplied on top of it with a 3-way patch.
