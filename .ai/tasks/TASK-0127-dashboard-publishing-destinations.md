# TASK-0127 — Ship GitHub Pages and GitLab Pages as optional dashboard destinations

## Objective

Make `skills/project-workflow/` able to publish the dashboard to **GitHub
Pages** or **GitLab Pages**, as optional destinations beside the local file,
which stays the default and canonical output.

Requested by the human on 2026-09-29, in the same message as `TASK-0126`:
*"The project-workflow should support both github and gitlab pages as optional
dashboard publishing destinations besides the local file system one."*
This is the human reopening **`B-048`**, which they routed on 2026-09-28 to
"ship none of them for now" and to reopen "when a second repository actually
wants the pipeline". A second destination has now arrived — this repository's
own GitLab `origin` (`ADR-0028`) — as well as an explicit request for the skill.

## Minimal context

`B-048` costed three routes and this task takes **route 1**, the only one it
found cannot rot: the skill ships the canonical pipeline source, this
repository's copy is **rendered** from it, and `tests/validate.sh` fails on
drift. That is the `sync-templates.sh` / `decision-standard.md` shape. Route 2
(an ungated template) is what `B-040` found had already rotted five times;
route 3 (prose) cannot be gated.

What the existing pipeline already learned, and must not be lost in the move
(`TASK-0123`, `TASK-0125`):

- **A shallow clone publishes a plausible, wrong page.** `actions/checkout`
  defaults to depth 1, and the generator reads `git log`. The workflow's guard
  catches `commits <= 1`. **GitLab's default clone depth is 20, not 1**, so that
  guard would pass a 20-commit history on GitLab and publish it. The guard must
  ask git whether the clone is shallow, not infer it from a count.
- The model JSON is working data and is removed before publishing.
- `enablement: true` on `configure-pages`; the build and deploy jobs separate;
  one deploy at a time.

Constraints:

- **Nothing under `skills/project-workflow/dashboard/` may change.** It is
  vendored (`AGENTS.md`, `TASK-0125`). Everything here sits beside it.
- **A consumer's CI can only run what is in its clone.** The skill is usually
  installed in `~/.claude/skills/`, which a runner never sees. So the renderer
  must refuse a skill directory outside the repository and say why, rather
  than emit a pipeline that fails on its first run.
- **A consumer may already have a `.gitlab-ci.yml`.** Overwriting it would
  destroy their CI. The GitLab job is therefore rendered to its own file and
  *included*; a stub `.gitlab-ci.yml` is written only where none exists.
- **GitLab side is UNVERIFIED by the human's routing**: no runner is online, so
  no pipeline can run. The labelling rule is `dashboard.yml`'s: a status label
  moves only against an observed run.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.github/workflows/dashboard.yml` | `TASK-0123`, `TASK-0125` | hand-written, `STATUS: VERIFIED`, guard reads `metrics.totals` |
| `skills/project-workflow/scripts/build-dashboard.sh` | `TASK-0125` | wrapper; `--root`, `--out`, `--json` |
| `skills/project-workflow/SKILL.md` | `TASK-0125` | `5.0.0` |
| `B-048` | `TASK-0124` follow-up | `ready`, unscheduled |
| `origin` on GitLab | `TASK-0126` | project 17, `pages_access_level: private`, 0 runners online |

## Scope

### Included

- `skills/project-workflow/assets/publish/github-pages.yml` and
  `gitlab-pages.yml` — canonical pipeline templates.
- `skills/project-workflow/scripts/publish-dashboard.sh` + `publish_lib.py`:
  `render [--check] [--adopt]` from a repo-root `dashboard-publish.conf`, and
  `guard --model PATH [--expect-shape S]`.
- `skills/project-workflow/scripts/check-publish.sh` — hermetic behaviour
  suite, wired into `tests/validate.sh` together with a drift check of this
  repository's rendered files.
- This repository: `dashboard-publish.conf`; `.github/workflows/dashboard.yml`
  regenerated (adopted); `.gitlab/ci/dashboard-pages.yml` and `.gitlab-ci.yml`
  new.
- `SKILL.md` → `5.1.0`, `references/dashboard.md` *Publishing it*, `AGENTS.md`
  Commands, `B-048` closed, `CURRENT_STATE.md`, registry.

### Not included

- **Registering a GitLab runner, or enabling Pages on the instance.** Neither
  is this repository's to change, and both are needed before the GitLab side
  can be verified.
- **Moving `validate.yml` or `ci-alert.yml` to GitLab.** The request is about
  the dashboard; the gate's CI stays on the mirror (`ADR-0028`).
- **Vendoring the generator into a consumer repository.** Where the skill lives
  outside the repo the renderer refuses and names the fix; copying the skill in
  is the consumer's choice. Doing it for them would make this script a second
  vendoring mechanism beside `sync_dashboard_skill.py`.
- **A `local` subcommand.** The local destination already exists and is
  `build-dashboard.sh`; a second entry point to it would be a second owner.
- **An ADR.** This reverses a backlog routing, not an ADR, along a route
  `B-048` had already costed; the reference documents what is, and this brief
  why.

## Likely files

- `skills/project-workflow/assets/publish/{github-pages,gitlab-pages}.yml` (new)
- `skills/project-workflow/scripts/{publish-dashboard.sh,publish_lib.py,check-publish.sh}` (new)
- `skills/project-workflow/SKILL.md`, `references/dashboard.md`
- `dashboard-publish.conf`, `.gitlab-ci.yml`, `.gitlab/ci/dashboard-pages.yml` (new)
- `.github/workflows/dashboard.yml` (regenerated)
- `tests/validate.sh`
- `AGENTS.md`, `.ai/planning/BACKLOG.md`, `.ai/context/CURRENT_STATE.md`,
  `docs/registry.md`

## Execution plan

1. Write the two templates, carrying every rule the hand-written workflow
   learned, with the guard moved into `publish-dashboard.sh guard`.
2. Write `publish_lib.py`: parse the config; refuse unknown keys and targets;
   refuse a `skill_dir` outside the repo; render; refuse to overwrite a file
   without the generated marker unless `--adopt`; `--check` compares and names
   each stale file; for GitLab, write the stub only where no `.gitlab-ci.yml`
   exists and check that an existing one includes the fragment.
3. `guard`: fail on shallow clone (`git rev-parse --is-shallow-repository`),
   `commits <= 1`, zero tasks, git unavailable, wrong corpus shape.
4. `check-publish.sh` in a temporary git repo, covering each refusal and each
   guard failure; red-proof each by reverting the behaviour it tests.
5. Wire the suite and `render --check` into `tests/validate.sh`.
6. Render this repository with `--adopt`; diff the new `dashboard.yml`
   against the old for behaviour, not text.
7. Docs, backlog, registry; validate; commit; land; push both remotes.
8. **Observe**: the GitHub `dashboard` run on the landed commit, and that the
   page still serves; GitLab's CI lint of the pushed configuration and the
   pipeline it creates.

## Acceptance criteria

- [ ] `publish-dashboard.sh render --check` exits 0 on this repository, and
      exits non-zero naming the file when any rendered file is edited by hand.
- [ ] `render` refuses (non-zero, file untouched) to overwrite a CI file
      lacking the generated marker, without `--adopt`.
- [ ] `render` refuses a `skill_dir` outside the repository, naming why.
- [ ] `render` never overwrites an existing non-generated `.gitlab-ci.yml`,
      and `--check` fails when one does not include the fragment.
- [ ] `guard` fails on a shallow clone **of more than one commit** — the
      GitLab default case the old guard passed.
- [ ] `guard` fails on `commits <= 1`, zero tasks, and a wrong corpus shape.
- [ ] `check-publish.sh` is in `tests/validate.sh`, and each of its cases was
      seen to fail with the behaviour reverted.
- [ ] GitHub's `dashboard` workflow **succeeds** on the landed commit and the
      page returns HTTP 200.
- [ ] GitLab's CI lint reports the pushed configuration **valid**, and the
      pipeline it creates contains a `pages` job. Its status is recorded as it
      is, not as hoped.
- [ ] Nothing under `skills/project-workflow/dashboard/` changed.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — the skill changed
- [ ] `skills/project-workflow/scripts/check-publish.sh`
- [ ] `skills/project-workflow/scripts/check-dashboard.sh` (unchanged generator, still green)
- [ ] `git diff --stat -- skills/project-workflow/dashboard/` empty

## Risks and rollback

- **The regenerated GitHub workflow breaks the live page.** Observed rather
  than assumed in step 8. Rollback: revert the commit; the previous workflow
  deploys again on the next push.
- **A pending GitLab pipeline on every push.** With no runner, each push to
  `origin` queues a `pages` job that never starts. Harmless and visible; it
  starts running the moment a runner is registered.
- **The GitLab job first runs on an image nobody has tested.** It declares
  `python:3.12`, which carries git and bash; a shell-executor runner ignores
  the image. Recorded as UNVERIFIED on the file itself.
- Rollback for the whole task is one `git revert`; nothing outside the
  repository is changed.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `skills/project-workflow/assets/publish/github-pages.yml` | new; the hand-written workflow's rules, placeholders `@@SKILL_DIR@@ @@ROOT@@ @@BRANCH@@ @@STATUS@@ @@GUARD_ARGS@@` |
| `skills/project-workflow/assets/publish/gitlab-pages.yml` | new; `pages` job, `GIT_DEPTH: "0"`, `image: python:3.12`, `resource_group: pages` |
| `skills/project-workflow/scripts/publish-dashboard.sh`, `publish_lib.py` | new, `100755`; `render [--check] [--adopt]`, `guard` |
| `skills/project-workflow/scripts/check-publish.sh` | new, `100755`; 32 cases, hermetic |
| `skills/project-workflow/SKILL.md` | `5.1.0`; description and *The dashboard* name the two destinations |
| `skills/project-workflow/references/dashboard.md` | new section *Publishing it* |
| `dashboard-publish.conf` | new; both targets, `expect_shape = numbered_task`, both statuses UNVERIFIED |
| `.github/workflows/dashboard.yml` | **rendered** (adopted); behaviourally identical except the guard is now the skill's, which adds the shallow-clone check, and the ignored `--project` flag is gone |
| `.gitlab/ci/dashboard-pages.yml`, `.gitlab-ci.yml` | new; rendered fragment and the stub that includes it |
| `tests/validate.sh` | runs `render --check` and `check-publish.sh` |
| `AGENTS.md`, `BACKLOG.md` (`B-048` done, count 12), `CURRENT_STATE.md`, `docs/registry.md` | updated |
| **Not changed** | `skills/project-workflow/dashboard/` (vendored) — `git diff --staged --stat` over it empty; `validate.yml`, `ci-alert.yml` |

**Next task starts here**: both destinations rendered and gated; GitHub's
verified or not per the log below; GitLab's waiting on a runner. **Deviations
from Plan:** (1) the suite first cost 3.4 s and was cut to 1.7 s — see the log;
(2) a comment in `publish_lib.py` quoting the literal `asset("...")` tripped the
gate's `UNTRACKED ASSET` regex, and was reworded rather than the regex changed,
since the regex is right to read literal calls wherever they appear.

## Status

- Status: in_progress
- Owner: agent
- Created: 2026-09-29
- Updated: 2026-09-29

## Execution log

### Attempt 1

- Date: 2026-09-29
- Agent: Claude Code (claude-opus-5-5), worktree `agent/gitlab-primary`
- Actions:
  - Templates, library, wrapper and suite written as planned.
  - First `render` on this repo **refused**: `scripts/publish-dashboard.sh
    not tracked by git, so a clone will not have it` — correct, the file was
    new. Staged with `git update-index --chmod=+x` (this `/mnt/c` checkout has
    `core.filemode` false), rendered again: refused the hand-written
    `dashboard.yml`; `render --adopt` wrote all three files; `render --check`
    → `ok` ×3.
  - Behavioural diff of old vs new `dashboard.yml`, comments and blank lines
    stripped: exactly two hunks — `--project ai-toolbox \` removed, and the
    29-line inline guard replaced by the one-line `publish-dashboard.sh guard
    --model _site/model.json --expect-shape numbered_task`.
- Observations:
  - **Real payload through the guard**: `build-dashboard.sh --json` on this
    repository, then `guard` → `history OK: 265 commits, 124 task briefs,
    shape numbered_task, full clone`, exit 0. So the key paths match the
    generator's real model, not just the suite's fixture.
  - **GitLab CI lint** (`POST /projects/17/ci/lint`, the fragment's content):
    `valid: True`, `errors: []`, `warnings: []`, jobs `['pages']`.
  - **Red proofs, by mutation** of a scratch copy of `publish_lib.py`, running
    the suite from that copy — FAIL counts: no shallow check 1; no marker
    refusal 2; no CRLF normalisation 1; missing key skipped 1; no realpath
    containment 1; no include check 2; no orphan report 1; no status
    requirement 1; **unmutated control 0**. The gate's own drift check: an
    appended `# x` to `.gitlab/ci/dashboard-pages.yml` → `PUBLISH: STALE …`,
    gate not OK; restored → OK.
  - **Gate cost.** `check-publish.sh` was **3.4 s**. Python start (10× 0.12 s),
    git init+commit (10× 0.19 s) and the wrapper (10× 0.13 s) were each fast,
    so the cost was elsewhere: `main()` ran `git rev-parse --show-toplevel` on
    the `/mnt/c` cwd for *every* invocation even with `--repo` given → fixed,
    **2.2 s**; ~40 reads of the script and templates over 9p → the suite now
    runs a byte-identical copy from `mktemp`, **1.7 s**. Whole gate 7.6 s on
    this worktree.
- Validation: `tests/validate.sh` → `validate.sh: OK`; `check-publish.sh` →
  `OK (32 cases)`; `check-dashboard.sh` → `OK (36 assertions, sprint-brief
  fixture)`; `sync-registry.sh` → one line changed (the version); staged diff
  scanned for both GitLab tokens, `GITHUB_TOKEN`, `glpat-`/`ghp_` and the
  intranet host and its stem → nothing.
- **Incident — the first commit attempt damaged the repository, through the
  pre-commit hook.** Every check above was run by hand and was green. The
  commit ran the same suite **from the hook**, which exports `GIT_DIR` and
  `GIT_INDEX_FILE`; both override `git -C`, so the suite's throwaway `git
  init`, `add -A` and `commit` ran against this repository. Observed effects,
  each checked: shared `.git/config` gained **`core.bare = true`** (the main
  checkout then refused every command with *must be run in a work tree*;
  `filemode`, `ignorecase`, `hooksPath` and both remotes were unchanged); this
  worktree's index was replaced by the scratch repo's three files; and commit
  **`941c014 one`** landed on `agent/gitlab-primary`, deleting 423 files. The
  hook then refused the real commit (16 of 32 cases failed). **Nothing was
  pushed** — `origin/master` stayed `4927fcb`. The main checkout's index and
  working tree were not touched: same three vendored files modified before and
  after, `HEAD` `9a6c83b`.
- **Repair.** `core.bare` set back to `false` (the main checkout was a working
  tree until minutes before; that is the known prior value). The session
  branch reset `--mixed` from `941c014` to `5a265e2`, discarding only the
  stray commit — local, unpushed, made by this task's own test; `git reflog`
  still holds it. A `git revert` was rejected: it would have put a 423-file
  deletion and its undo into the history that lands on `master`. A stray
  directory `On branch agent/`, 9 empty or stub files written by the suite's
  corrupted paths, was listed and removed.
- **Fix, proven against a sacrificial repository, never this one.**
  `check-publish.sh` unsets every git repo-locating variable before its first
  git call, and `publish_lib.git()` strips them from each call's environment,
  so `-C` means what it says. Simulated hook (`GIT_DIR`/`GIT_INDEX_FILE`
  pointed at a scratch "victim" repo): **fixed** suite → `OK (32 cases)`,
  victim byte-identical (one commit, index `keep.txt`, clean); **fix removed**
  → `16 of 32 FAILED` and the victim gained commit `one` with its index
  replaced — the incident reproduced exactly. (That red run, too, wrote a
  debris directory into its cwd — 3 stub files, 11 bytes — listed and removed.)
- **Latent elsewhere, recorded not fixed**: the unattended-run binding suites
  (`test_driver.py`, `unattended-run.test.mjs`) also run git in scratch
  repositories. They are outside the gate today (`B-037`); whoever wires them
  in inherits this trap unless the same variables are cleared.
- Result: built and gated; live observation below.
- Commit: recorded in the follow-up commit.
- Push: recorded in the follow-up commit.
