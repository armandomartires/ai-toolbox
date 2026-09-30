# TASK-0126 — Make the intranet GitLab the primary remote

## Objective

Make the intranet GitLab instance this repository's **primary** remote
(`origin`), keeping GitHub as a public mirror, so the canonical copy of the
repository lives on infrastructure the human's organisation controls.

Requested by the human on 2026-09-29: *"We have an intra net gitlab instance,
URL and TOKEN are in the user session env vars. This should be our primary
remote."* Four routes were put to the human as multiple choice and all four
answered the same session; they are recorded under **Minimal context**.

## Minimal context

Until now `origin` has been `github.com/armandomartires/ai-toolbox`
(**public**, `TASK-0015`, `TASK-0123`). `GITLAB_URL`/`GITLAB_TOKEN` have been
in the environment since at least `ADR-0009` and are documented as *"a GitLab
mirror; unused by any script today"*.

Measured before planning, 2026-09-29, over the API with the token in a header
only:

- `GITLAB_URL` is **`http://`**, host on the intranet domain, no path. The
  `https://` port **refuses connections**. So any credential git sends to it
  crosses the network in cleartext.
- GitLab **18.10.1**. `GITLAB_TOKEN` belongs to `armando.martires`, is an
  **administrator** token, and carries `api`, `sudo` and `admin_mode` scopes.
- No project matches `ai-toolbox`. Namespaces visible: `armando.martires`,
  `labs`, and two others.
- **Zero online runners** visible to the user. A probe of admin-only endpoints
  (all runners, Pages domains, application settings) was **denied by the Claude
  Code auto-mode classifier** as credential exploration, and not retried —
  whether Pages is enabled on the instance is therefore unknown here. That
  matters to `TASK-0127`, not to this task.

Human's routing, 2026-09-29:

| Question | Answer |
|---|---|
| Remote layout | GitLab = `origin`; GitHub renamed `github`, kept as a mirror and pushed at task end |
| Project | `armando.martires/ai-toolbox`, **private** |
| Credential | the admin token creates a **project access token** (`write_repository`, expiring); git pushes use that, never the admin token |
| GitLab Pages | `TASK-0127` ships it labelled UNVERIFIED |

**The intranet hostname must not enter a tracked file.** The GitHub mirror is
public, so anything committed here is world-readable (`AGENTS.md`). Docs and
the ADR refer to `$GITLAB_URL`, never its value.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `git remote -v` | `TASK-0015` | one remote, `origin` → GitHub, token-free — verified 2026-09-29 |
| `master` | — | `9a6c83b`, tracking `origin/master`, in sync — verified |
| GitLab instance | pre-existing | reachable over `http://` only, no `ai-toolbox` project — verified |
| `GITLAB_URL`, `GITLAB_TOKEN`, `GITHUB_TOKEN` | environment | set — names verified, values not printed |
| `ADR-0007`, `ADR-0009` | `TASK-0013`, `TASK-0015` | `Accepted` |

## Scope

### Included

- Create the private GitLab project and a project access token scoped to it.
- Store that token outside the repository, owner-readable only.
- Rename `origin` → `github`; add GitLab as `origin`; push `master`; set its
  upstream to `origin/master`.
- `ADR-0028` recording the change and why the push token is separate.
- `AGENTS.md`, `docs/operations/runbook.md`, `.env.example` updated to say
  what is now true.

### Not included

- **Dashboard publishing to GitLab Pages** — `TASK-0127`, a separate commit.
- **Server-side mirroring** (GitLab pushing to GitHub itself). It would store
  a GitHub credential on the intranet server and assumes outbound access from
  it that nobody has checked; client-side dual push is enough for now.
- **Moving CI to GitLab.** `validate.yml`, `ci-alert.yml` and `dashboard.yml`
  keep running on the GitHub mirror, which still receives every push. There is
  no online runner to move them to.
- **Enabling https on the instance.** Not this repository's to change; stated
  as a residual risk instead.
- **Rotating or narrowing `GITLAB_TOKEN`.** It is the human's credential. This
  task only stops it being the one git sends.

## Likely files

- `.ai/tasks/TASK-0126-make-gitlab-the-primary-remote.md` (this file)
- `.ai/decisions/0028-gitlab-is-the-primary-remote.md`
- `AGENTS.md` — Commands (env line), Git rules (remote paragraph)
- `docs/operations/runbook.md` — env table, *Authenticating a push*,
  *Verifying remote branch state*, *Human approval required for*
- `.env.example` — GitLab block
- `.ai/context/CURRENT_STATE.md`
- Not tracked: `.git/config` (remotes), `~/.config/ai-toolbox/env` (token)

## Execution plan

1. Create `armando.martires/ai-toolbox`, `visibility: private`, no
   `initialize_with_readme`, so the first push defines `master`.
2. Create a project access token: `write_repository` + `read_repository`,
   Maintainer (the first push to `master` creates it, and a protected branch
   admits Maintainers), expiring **2027-09-28**. Write its value straight from
   the API response to `~/.config/ai-toolbox/env` as `GITLAB_PUSH_TOKEN`, mode
   `600`, never printing it.
3. `git remote rename origin github`; `git remote add origin
   "$GITLAB_URL/armando.martires/ai-toolbox.git"`.
4. Push `master` to `origin` with basic auth in a per-command
   `http.extraheader`; `git branch -u origin/master master`.
5. Confirm by hash: `git rev-parse master` = `git ls-remote origin master` =
   `git ls-remote github master`. Confirm `git remote -v` is token-free.
6. Read back the project over the API: visibility `private`, default branch
   `master`, `master` protected against force push.
7. Write `ADR-0028`; update `AGENTS.md`, runbook, `.env.example`,
   `CURRENT_STATE.md`.
8. `tests/validate.sh`; commit; land on `master`; push to **both** remotes;
   record hashes.

## Acceptance criteria

- [x] `git remote -v` lists exactly `origin` (GitLab) and `github`, and
      neither URL carries a credential.
- [x] `master` tracks `origin/master`.
- [x] After landing, `git ls-remote origin master` and
      `git ls-remote github master` both equal `git rev-parse master`.
- [x] The GitLab project reads back `private`, default branch `master`.
- [x] The push used the project token: a push with that token succeeds, and
      the token's scopes read back as `read_repository`, `write_repository`
      only.
- [x] `~/.config/ai-toolbox/env` is mode `600` and no tracked file contains the
      token or the intranet hostname (met in Attempt 1; the file was removed in
      Attempt 2, the token now lives in `~/.bashrc`):
      `git grep -I -e "$GITLAB_PUSH_TOKEN" -e "<host>"` returns nothing.
- [x] `ADR-0028` passes `check-artifact.sh`; `tests/validate.sh` exits OK.

## Mandatory validations

- [x] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — no component changes;
      not applicable
- [x] `git grep` for the token value and the intranet host returns nothing
- [x] hash comparison against both remotes

## Risks and rollback

- **Cleartext credential on the intranet.** Mitigated, not removed: the token
  sent is scoped to one project's repository and expires. Removal needs https
  on the instance.
- **Other checkouts still think `origin` is GitHub.** Any other clone keeps
  pushing to GitHub, which is now the mirror. Harmless — the mirror still
  accepts it — but it would bypass GitLab. The runbook says how to re-point.
- **Rollback**: `git remote remove origin && git remote rename github origin
  && git branch -u origin/master master`; revoke the project token; delete the
  GitLab project (the human's authorization required — `AGENTS.md`,
  *Destructive changes*). No history is rewritten at any step.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| GitLab project `armando.martires/ai-toolbox` | id 17, `private`, default branch `master`, `master` protected (push: Maintainer, force push: off) |
| Project access token `ai-toolbox-git-push` | id 9, `read_repository` + `write_repository`, active, expires 2027-09-28 |
| `~/.config/ai-toolbox/env` (untracked, WSL home) | `GITLAB_PUSH_TOKEN=…`, mode `600`, directory `700` |
| `.git/config` (untracked) | `origin` → `$GITLAB_URL/armando.martires/ai-toolbox.git`; `github` → the old GitHub URL; `master` tracks `origin/master` |
| `ADR-0028` | new, `Accepted` |
| `AGENTS.md` | Commands env line and Git rules remote/push paragraphs describe two remotes |
| `docs/operations/runbook.md` | env table, landing block, *Authenticating a push* (both remotes, rotation, re-pointing a clone), hash check, approval line |
| `.env.example` | GitLab block rewritten; `GITLAB_PUSH_TOKEN` added |
| `scripts/worktree.sh` | header comment and `add`'s landing hint name the mirror push |
| `.ai/context/CURRENT_STATE.md` | new top section |
| **Not changed** | `.github/workflows/*` (CI stays on the mirror); `TASK-0015`, which already names the host's stem and is public — left as written |

**Next task starts here**: `origin` is GitLab and `github` is the mirror; both
at the commit recorded below. `TASK-0127` (dashboard publishing destinations)
starts from that state. **Deviation from Plan:** `scripts/worktree.sh` was not
forecast under *Likely files*; its landing hint told every session to push
`origin` only, which would silently skip the mirror.

## Status

- Status: done
- Owner: agent
- Created: 2026-09-29
- Updated: 2026-09-30

## Execution log

### Attempt 1

- Date: 2026-09-29
- Agent: Claude Code (claude-opus-5-5), worktree `agent/gitlab-primary`
- Actions:
  - `POST /projects` → **201**, `armando.martires/ai-toolbox`, id 17,
    `private`, no README.
  - `POST /projects/17/access_tokens` → **201**, id 9, scopes
    `read_repository`, `write_repository`, expires 2027-09-28. The value went
    from the response straight to `~/.config/ai-toolbox/env`; it was never
    printed.
  - `git remote rename origin github`; `git remote add origin
    "$GITLAB_URL/armando.martires/ai-toolbox.git"`; `git push origin master`
    with basic auth carrying `GITLAB_PUSH_TOKEN` in a per-command
    `http.extraheader` → `* [new branch] master -> master`;
    `git branch -u origin/master master`.
  - Docs and `ADR-0028` written in worktree `agent/gitlab-primary`.
- Observations:
  - Local, `origin` and `github` all `9a6c83b6744170202a39888b7b8539d757c51c00`.
  - Read back over the API: `visibility: private`, `default_branch: master`,
    `master` protected with push `[40]` (Maintainer), `allow_force_push:
    False`; one token, active, scopes as created. The push above **succeeded
    with the project token**, which is the proof the token is sufficient.
  - `pages_access_level: private`, `builds_access_level: enabled` on the new
    project. Suggestive that Pages exists on the instance; not proof it serves.
  - `git remote -v` shows no credential in either URL.
  - **Every commit's author email is on the intranet domain**
    (`…@<intranet domain>` — redacted 2026-09-30; this line first spelled it out, which
    the rule above forbids, and a case-sensitive leak scan missed it), and the mirror is public, so the domain has been
    world-readable since the first commit regardless of any file. Noted for the
    human; nothing here changes it.
- Validation: `tests/validate.sh` → `validate.sh: OK`.
  `git grep -I` for the push token, the admin token and the full hostname →
  nothing; the stem matches only `TASK-0015:28`, pre-existing. `check-artifact.sh`
  → `OK` for `ADR-0028` and this brief.
- Result: done.
- Commit: `4927fcb` (this task), plus this record-keeping commit after it.
- Push: **confirmed to both remotes** — `9a6c83b..4927fcb HEAD -> master` to
  `origin` and to `github`; local, `origin` and `github` all read
  `4927fcb3719c2e971b6b7bf1fd11e55f81e4875d` by `ls-remote`. The fetch and
  push to `origin` used `GITLAB_PUSH_TOKEN`.

### Attempt 2

- Date: 2026-09-30
- Agent: Claude Code (claude-opus-5-5), worktree `agent/push-token-in-bashrc`
- Actions: on the human's routing (*"the GITLAB_TOKEN is in the env vars of the
  user session"*; asked as multiple choice, answered *push token into
  `~/.bashrc`*), `export GITLAB_PUSH_TOKEN=…` was inserted in `~/.bashrc`
  directly below `GITLAB_TOKEN`, with a two-line comment. The value was read
  from the old file and never printed. `~/.config/ai-toolbox/env` and its
  directory were deleted **after** the new source was proven. Runbook,
  `.env.example`, `CURRENT_STATE.md` corrected; `ADR-0028` amended with a dated
  bullet, its original text left as written.
- Observations: a fresh `bash -i` exports a `GITLAB_PUSH_TOKEN`
  byte-identical to the stored one (`cmp`), and `ls-remote origin master` with
  it returned `a14cc24`, matching `origin/master`. **`~/.bashrc` is mode
  `644`**, readable by every account on this machine, and it already held
  `GITLAB_TOKEN` and `GITHUB_TOKEN`. Reported to the human, not changed: it is
  their file.
- Validation: see the commit's gate run.
- Result: done. The part of the decision about which token git sends is
  unchanged.
- Commit / Push: this commit, landed to both remotes.
