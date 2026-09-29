# SESSION-20260930-0100 — GitLab becomes primary; the dashboard gains Pages destinations

- Date: 2026-09-29 – 2026-09-30
- Agent/model: Claude Code (claude-opus-5-5; the first question answered on
  claude-sonnet-5-5), worktrees `agent/gitlab-primary`,
  `agent/push-token-in-bashrc`, `agent/session-record`
- Objective: two requests from the human in one message — make the intranet
  GitLab (`$GITLAB_URL`) the primary remote, and have `project-workflow`
  support GitHub Pages and GitLab Pages as optional dashboard destinations
  beside the local file. A follow-up the next day: the push token belongs in
  the session environment, beside `GITLAB_TOKEN`.
- Context consulted: `AGENTS.md`, `CURRENT_STATE.md`, `ADR-0007`, `ADR-0009`,
  `ADR-0023`, `B-048`, `.github/workflows/dashboard.yml`,
  `skills/project-workflow/{SKILL.md,scripts/build-dashboard.sh}`,
  `tests/validate.sh`, the runbook; the GitLab API (version, user, token
  scopes, projects, namespaces, runners).
- Tasks worked on: `TASK-0126` (done, two attempts), `TASK-0127` (done).
  **`B-048` closed.** `ADR-0028` written, then amended.
- Decisions: see **Decisions** below. All five routing choices were the
  human's, asked as multiple choice; the recommended option was taken each time.
- Commands and validations: `tests/validate.sh` OK on every commit, run by the
  pre-commit hook; `check-publish.sh` 32/32; `check-dashboard.sh` 36
  assertions; `check-artifact.sh` OK for `ADR-0028`, both briefs and this
  record; GitLab CI lint `valid: true`; GitHub `dashboard` run 36608693753 and
  `validate` run 36608693502 both `success`; page HTTP 200. Red proofs by eight
  mutations plus an unmutated control, and a simulated-hook reproduction
  against a sacrificial repository.
- Problems: one serious incident, repaired before anything was pushed — see
  **Findings** 1.
- Commit/push: `4927fcb`, `5a265e2`, `36ac929`, `a14cc24`, `6348413`,
  `5e9028e`, plus this record's commit; every one pushed to **both** `origin`
  and `github` and confirmed by `ls-remote` hash, never by exit code.
- Next action: the human registers a GitLab runner and confirms Pages is
  enabled on the instance, then the GitLab `STATUS:` label can move against a
  real run. Nothing else is in flight.

## Decisions

- **GitLab = `origin`, GitHub renamed `github` and kept as a public mirror**,
  pushed at every task end. Dropping GitHub would have silently stopped
  `validate.yml`, `ci-alert.yml` and `dashboard.yml`, with no GitLab runner to
  take them over.
- **Project `armando.martires/ai-toolbox`, private.**
- **Git never sends `GITLAB_TOKEN`.** The instance is `http://` only (the
  https port refuses connections), and that token is an admin token with
  `sudo`. A project access token (`read_repository` + `write_repository`,
  Maintainer, expires 2027-09-28) goes over the wire instead. **Amended
  2026-09-30:** it lives in `~/.bashrc` beside `GITLAB_TOKEN`, not in a separate
  file.
- **`B-048` route 1**: the pipelines are templates in the skill, this repo's
  copies are rendered from them, and the gate fails on drift. The GitLab job is
  an *included fragment*, so a consumer's own `.gitlab-ci.yml` is never
  overwritten.
- **GitLab Pages shipped labelled UNVERIFIED**: no runner is online, so it
  cannot run.

## Findings

**1. The new test suite, run from the pre-commit hook, damaged this
repository.** The hook exports `GIT_DIR` and `GIT_INDEX_FILE`, which override
`git -C`, so the suite's scratch `git init`, `add -A` and `commit` hit the real
repository. They set `core.bare = true` in the shared config, which broke the
main checkout, replaced the session's index, and put a 423-file-deletion commit
on the session branch. **Nothing was pushed**, and the main checkout's own index
and working tree were untouched. Repaired (`core.bare` back to `false`, branch
reset off the stray commit, which the reflog still holds) and fixed: the suite
and `publish_lib.git()` clear the repo-locating variables. Proven by
reproduction: under a simulated hook the fixed suite leaves a sacrificial repo
byte-identical, and the unfixed suite repeats the damage on it exactly. **Every
check had been green when run by hand**: the only place the defect existed was
the hook. **The binding suites share the trap** and will hit it the day `B-037`
wires them into the gate.

**2. The old guard would have published a wrong page on GitLab.** It caught a
shallow clone by `commits <= 1`. GitLab clones 20 commits by default, which
that check passes. The new guard asks git (`--is-shallow-repository`), and on
the GitHub runner it printed `266 commits … full clone`.

**3. A leak scan that is case-sensitive is not a leak scan.** `TASK-0126`'s log
spelled out the intranet domain in upper case, and the scan (lower case) passed
it; it was pushed to the public mirror. The domain was already public through
every commit's author email, so no new information left, but the rule was
broken. Redacted in `5e9028e`; the published history keeps it. `TASK-0015`
names the host's short name and has been public since 2026-09-13.

**4. Gate cost was measured, and then cut.** `check-publish.sh` first cost
3.4 s: the library made a `/mnt/c` git call on every invocation even with
`--repo` given, and ~40 script reads crossed the 9p bridge. Fixing both brought
it to 1.7 s. Python startup, `git init` and the wrapper each measured fast on
their own, so the cost was not in the obvious places.

**5. `scripts/worktree.sh remove` reports a branch deleted when it is not.** Its
`git branch -d … || true` fails whenever the local `master` is behind
`origin/master`, which is the normal state after landing from a worktree, and
the success line prints anyway. Seen twice this session; both branches were
confirmed to be on `origin/master` and deleted by hand. **Not fixed; raised
as `B-049`.**

**6. For the human, not changed:** `~/.bashrc` is mode `644` and holds three
tokens; the main checkout's `master` is behind `origin/master`, and it still
carries three uncommitted vendored files this session did not make.
