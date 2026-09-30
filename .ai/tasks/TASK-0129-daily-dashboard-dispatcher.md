# TASK-0129 — Rebuild the published dashboard daily from a separate dispatcher

## Objective

Rebuild the published dashboard once a day as well as on every push. A
separate workflow does this: it dispatches the unchanged
`.github/workflows/dashboard.yml` on the configured branch. It ships as the
opt-in `github-pages-daily` target of `skills/project-workflow/`, rendered
here to `.github/workflows/dashboard-daily.yml`. The page is dated by the day
it is built, so a page rebuilt only on push shows its date-dependent figures
as of the last push.

This implements `ADR-0029` clause 3, the second of the three decisions the
human made on 2026-09-30. Discharges no backlog item.

## Minimal context

### Why daily, and why a separate file

- **The page is dated by its build.** `project.today` is the `as_of` of every
  metric (`skills/project-workflow/dashboard/SCHEMA.md`, §1.1), and the page
  header shows it. `TASK-0128`'s brief measures how much of the page moves
  with the date alone; that is not re-measured here.
- **The decision is `ADR-0029` clause 3**: a separate scheduled workflow whose
  only job is to dispatch the publishing pipeline. The alternatives it
  rejects are recorded there, not here. The main one is a `schedule:` inside
  the pipeline file, which fails in three ways:
  - GitHub's 60-day inactivity rule disables that whole file;
  - a schedule fires on the default branch;
  - a skipped scheduled run still joins the pipeline's concurrency group.

### How the dispatch works, as documented (GitHub docs, read 2026-09-30)

- *GITHUB_TOKEN*: events the workflow token triggers start no new run, except
  `workflow_dispatch` and `repository_dispatch`. So a dispatch sent with the
  dispatcher's own token does start `dashboard.yml`.
- *Permissions required for fine-grained personal access tokens*: the
  dispatches endpoint needs `Actions: write`, and nothing else. Scopes not
  named in `permissions:` are none.
- *Deployments and environments*: an environment's branch rule is matched
  against the run's `GITHUB_REF`. The dispatch names the branch, so here the
  run is on `master`, which the `github-pages` environment admits.
- *REST API versions*: this task pins `X-GitHub-Api-Version: 2026-03-10`.
  - A read-only GET with that header returned **200** on 2026-09-30, and a
    bogus `1999-01-01` returned **400**, so the version is live on this
    account.
  - Under it a dispatch answers 200 and names the run it started (GitHub's
    changelog, 2026-02-19). This is not observed here until the manual proof.
  - Under the default `2022-11-28`, the answer is 204 with no body.
- **Not `gh workflow run`**: its output format has changed between releases,
  and a self-hosted runner may not have it installed. One `curl` to the REST
  endpoint keeps the dispatcher REST-only, like `ci-alert.yml` (`ADR-0021`: no
  marketplace action).
- **00:23 UTC**, with no `timezone:` key:
  - The generator's "today" is the hosted runner's date, and that clock is
    UTC, so the run must start after UTC midnight. A `timezone:` key moves
    the trigger, not the runner's date.
  - Minute 23 keeps clear of the start of the hour, which *Events that
    trigger workflows* names as the high-load time when scheduled runs are
    delayed or dropped.
- **Why the dispatcher waits.** A 2023 community report, not documentation,
  says a run dispatched with the workflow token fires no `workflow_run`
  event, so `ci-alert.yml` would never see the nightly build. GitHub also
  notifies the user who *triggered* a run, and for the dispatched run that is
  the token, so a failed nightly build could reach nobody.
  - Asked on 2026-09-30, the human chose **wait and mirror**. The dispatcher
    reads the run id from the dispatch reply, polls that run
    (`GET /repos/{o}/{r}/actions/runs/{id}`; `actions: write` includes read)
    and ends as it ends.
  - A run cancelled in the `pages` group, superseded by a newer run or by
    hand, is not a failure.
  - A failed nightly build therefore fails the dispatcher's *scheduled* run.
    GitHub reports that to whoever last changed the cron line.
  - Whether `ci-alert.yml` watches `dashboard-daily` belongs to `TASK-0130`.
    The human's choice described wait-and-mirror as what makes the daily run
    watchable there.
  - The manual proof observes whether the dispatched run fires `workflow_run`
    at all.

### Found while planning

`load_conf` treats only a line that *starts* with `#` as a comment. The conf
example in `references/dashboard.md` puts its notes after the values, so a
pasted copy is refused: the `targets` line yields
`unknown target(s) # either or both`. This task rewrites those lines anyway,
so it makes them pasteable. `publish-dashboard.sh`'s usage text gets the same
treatment.

### Baselines, measured 2026-09-30 in this worktree before any edit

- `check-publish.sh` printed `OK (32 cases)` in 1.57-1.69 s.
- `render --check` printed `ok` ×3.
- The `.github/workflows/dashboard.yml` blob is
  `6665a781690a65d3f325d729c75675fc4c905e4c`, still `VERIFIED on run
  36608693753`.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `master` | `d69bafe` (`TASK-0128`'s record commit) | equal on local, `origin` and `github`; tree clean |
| `.ai/decisions/0029-the-published-dashboard-is-built-only-by-ci.md` | `TASK-0128` | `Accepted (2026-09-30)`; Decision clause 3 is the separate daily dispatcher |
| `skills/project-workflow/SKILL.md` | `TASK-0128` | `version: "5.1.2"` |
| `skills/project-workflow/scripts/publish_lib.py` | `TASK-0127`, `TASK-0128` (docstring) | `TARGETS` = `github-pages`, `gitlab-pages`; `OPTIONAL` = `root`, `expect_shape`; mode `100755` |
| `skills/project-workflow/scripts/publish-dashboard.sh` | `TASK-0127`, `TASK-0128` (lines 4-9) | `usage()` prints lines `2,46`, ending `# Requires python3, standard library only.`; conf notes inline |
| `skills/project-workflow/scripts/check-publish.sh` | `TASK-0127` | `OK (32 cases)`, 1.57-1.69 s; clears the `GIT_*` variables first |
| `.github/workflows/dashboard.yml` | `TASK-0127`, `TASK-0128` (header) | blob `6665a78…`; `STATUS: VERIFIED on run 36608693753`; has `workflow_dispatch:` |
| `dashboard-publish.conf` | `TASK-0127`, `TASK-0128` (header) | `targets = github-pages gitlab-pages` |
| `skills/project-workflow/references/dashboard.md` | `TASK-0127`, `TASK-0128` | *Publishing it*: two-row table, conf example with inline notes |
| `README.md` | `TASK-0123` | lines 23-26: "republished on every push to `master`", the only live trigger statement |
| `AGENTS.md` | `TASK-0127` | *Dashboard publishing* bullet lists three rendered files |
| `.ai/tasks/TODO.md` | `TASK-0128` | Post-S10 counter `TASK-0129` |
| `.github/workflows/ci-alert.yml` | `TASK-0124` | watches `[validate, dashboard]` by name; untouched here (`TASK-0130`) |
| The GitHub mirror | pre-existing | public; default branch `master`; `dashboard`, `validate`, `ci-alert` active; `github-pages` environment admits only `master` |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. The template `skills/project-workflow/assets/publish/github-pages-daily.yml`:
   - `name: dashboard-daily`;
   - `schedule` at 00:23 UTC, plus `workflow_dispatch`, a stated addition
     for the manual proof, which the human approved on 2026-09-30;
   - `permissions: actions: write` only, and no checkout;
   - one `curl` POST dispatching the github-pages workflow on `@@BRANCH@@`;
   - it then waits for that run and mirrors its conclusion (the human's
     choice).
2. `publish_lib.py`:
   - the `github-pages-daily` target, with a `needs: github-pages` refusal;
   - a `PAGES_WORKFLOW` value read from `TARGETS`, so the dispatched file
     name has one owner;
   - a docstring paragraph.
3. `publish-dashboard.sh`: the usage text names the target and says a `#`
   comment starts its own line; `usage()`'s range grows with the header.
4. `check-publish.sh`: a `daily` fixture publishing `trunk`, and the new
   cases, each red-proved.
5. This repository:
   - `dashboard-publish.conf` gains the target and
     `status.github-pages-daily = UNVERIFIED - no scheduled run observed yet (TASK-0129)`;
   - `render` writes `.github/workflows/dashboard-daily.yml`.
6. Docs:
   - `references/dashboard.md`, *Publishing it*: the table row, a pasteable
     conf example, the refusal, *The daily rebuild*, the GitHub-daily and
     GitLab notes;
   - `SKILL.md` `5.2.0` plus one sentence;
   - `README.md`'s trigger sentence;
   - `AGENTS.md`'s *Dashboard publishing* bullet;
   - `CURRENT_STATE.md` and `TODO.md`.

### Not included

- **`.github/workflows/dashboard.yml`**, byte-identical. Its label stays
  `VERIFIED on run 36608693753`. The same goes for both existing templates,
  the GitLab fragment and stub, `validate.yml` and `tests/validate.sh`.
- **`ci-alert.yml`**: whether it watches `dashboard-daily`, and its close rule,
  are `TASK-0130`'s.
- **A conf key for the time, a `timezone:` key, or keep-alive commits**
  against the 60-day rule (`B-048`'s rule: build no choice for an absent
  consumer).
- **GitLab**: the skill ships no daily rebuild there. A pipeline schedule is
  a project setting, and no runner is online.
- **A conf switch to turn the wait off**: no consumer has asked for one
  (`B-048`).
- **`skills/project-workflow/dashboard/`** (vendored).
- **`SPRINT-CURRENT.md`'s stale counter**. `TODO.md`'s is the one maintained.
- **Backlog items**: the human declined side items.

## Likely files

A forecast, written before the work.

- `.ai/tasks/TASK-0129-daily-dashboard-dispatcher.md` (this file, new)
- `skills/project-workflow/assets/publish/github-pages-daily.yml` (new)
- `.github/workflows/dashboard-daily.yml` (new, rendered)
- `skills/project-workflow/scripts/publish_lib.py`, `publish-dashboard.sh`,
  `check-publish.sh`
- `dashboard-publish.conf`
- `skills/project-workflow/references/dashboard.md`, `SKILL.md`
- `README.md`, `AGENTS.md`
- `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`

**Not expected to change**:

- `.github/workflows/dashboard.yml`;
- `.gitlab/ci/dashboard-pages.yml`, `.gitlab-ci.yml`;
- both existing templates;
- `ci-alert.yml`, `validate.yml`;
- `tests/validate.sh`;
- `docs/registry.md`, since the description is unchanged;
- `ADR-0029`;
- the vendored generator.

## Execution plan

1. Baselines: done, and quoted above.
2. Write this brief first.
3. Write the template, and `git add` it at once: `validate.sh`'s
   `UNTRACKED ASSET` check reads literal `asset(...)` calls.
4. Edit `publish_lib.py` (target, `needs`, `PAGES_WORKFLOW`, docstring) and
   `publish-dashboard.sh` (usage text and range).
5. Add the cases to `check-publish.sh`. Red-prove each on `mktemp` copies,
   never in the worktree. The revert-proof is the pre-task `publish_lib.py`,
   which must fail exactly the new cases.
6. This repository:
   1. add the target to the conf;
   2. `render --check` must say the dispatcher is missing;
   3. `render`, then `render --check`, which must print `ok` ×4;
   4. confirm `dashboard.yml` is byte-identical;
   5. drift proof.
7. Docs.
8. Validate, stage, run the leak scan, and commit through the hook.
9. Land and observe the push runs before the record commit.
10. Make the record commit, which replaces only the two lines.
11. With the human's approval, one manual dispatch of `dashboard-daily`:
    observe the run it starts and whether `ci-alert` sees it. Report it.
12. A later session reads the first scheduled run. A separate observation
    commit then:
    - moves the label;
    - closes this brief;
    - ticks `TODO.md`;
    - updates `CURRENT_STATE.md`.

## Acceptance criteria

A1-A6 are met at the task commit. A7-A10 are met by live observation and
ticked in the observation commit.

- [x] A1 `github-pages-daily` is accepted in `targets`, with its own required
      `status.` line. `render` writes `.github/workflows/dashboard-daily.yml`,
      and `render --check` prints `ok` for all four outputs.
- [x] A2 Without `github-pages`, the daily target is refused (exit 2).
- [x] A2b `--check` reports a dispatcher whose target was dropped, naming the
      file (exit 1).
- [x] A2c A hand-written `dashboard-daily.yml` is refused without `--adopt`,
      by the refusal every rendered file has (its existing case).
- [x] A3 The dispatcher runs on cron `23 0 * * *` in UTC, with no
      `timezone:`, and on `workflow_dispatch`.
- [x] A3b It has `permissions: actions: write` only, and no checkout.
- [x] A3c Its ref is the configured branch, and the file it dispatches is
      read from `TARGETS`.
- [x] A3d It waits for the run it started and ends as it ends, proven
      against a fake API:
      - success ends in success;
      - failure ends in failure;
      - a cancelled run ends in success;
      - a reply that names no run fails loudly;
      - a refused dispatch fails loudly.
- [x] A4 `check-publish.sh` reports `OK (47 cases)` on a `trunk` fixture.
- [x] A4b Run against the pre-task `publish_lib.py`, exactly the new cases
      fail.
- [x] A4c Each single mutation fails exactly its case(s).
- [x] A4d The suite's cost is measured as a median of three runs, before
      and after, and recorded.
- [x] A5 These are byte-identical to `d69bafe`:
      `.github/workflows/dashboard.yml` (still `VERIFIED`), the GitLab
      fragment and stub, both existing templates, `ci-alert.yml`,
      `validate.yml` and `tests/validate.sh`.
- [x] A5b Nothing under `skills/project-workflow/dashboard/` changed.
- [x] A6 The docs are updated, `SKILL.md` reads `5.2.0`, and
      `docs/registry.md` is unchanged.
- [ ] A7 After landing, GitHub lists `dashboard-daily` as `active`, and the
      landed commit's `validate` and `dashboard` push runs succeed.
- [ ] A8 A human-approved dispatch of `dashboard-daily` starts a `dashboard`
      run (`workflow_dispatch`, `master`) whose build and deploy succeed. The
      page's `generated_at` moves to that run.
- [ ] A9 The first scheduled `dashboard-daily` run succeeds, and so does the
      run it dispatches.
- [ ] A9b The page's *as of* date is that UTC day, with no push in between.
- [ ] A10 `status.github-pages-daily` reads `VERIFIED`, naming both runs, and
      `render --check` prints `ok` ×4.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed): the skill changed;
      expect no diff
- [x] `skills/project-workflow/scripts/check-publish.sh`: `OK (47 cases)`, and
      the red proofs (a)-(l), run on `mktemp` copies
- [x] `publish-dashboard.sh render --check`: seen reporting the dispatcher
      missing before `render`, and `ok` ×4 after
- [x] The byte-identity checks: the `dashboard.yml` blob, and
      `git diff --exit-code d69bafe -- <the A5 list>`
- [x] The drift proof: a hand edit of `dashboard-daily.yml` fails
      `render --check` and `tests/validate.sh`
- [x] `skills/project-workflow/scripts/check-dashboard.sh` (unchanged
      generator)
- [x] `bash -n` on the two shell scripts; `publish_lib.py` parses; `--help`
      still ends on its last header line; the modes are unchanged
- [x] `skills/project-migration/scripts/check-artifact.sh` on this brief
      (`--kind task`)
- [x] The staged-diff leak scan, run after staging
- [ ] The landed commit's runs and the manual dispatch, both read from the
      API

## Risks and rollback

- **The dispatch is refused.** A 403 on permissions, a 400 on the pinned
  version or a 404 on the file name fails the dispatcher loudly. The manual
  proof exercises this before the schedule depends on it. Fix it forward in a
  targeted commit and record that as Attempt 2.
- **A nightly build fails, and the report depends on the wait.** The
  dispatched run is token-triggered, so it may notify nobody and may never
  reach `ci-alert`. The wait makes the dispatcher's scheduled run fail with
  it, and GitHub reports that to whoever last changed the cron line.
  `ci-alert` watching `dashboard-daily` is `TASK-0130`'s.
- **A poll that never ends.** A failed poll is retried, and the job's
  `timeout-minutes: 30` ends a lasting one, which fails the run.
- **The 60-day rule** can disable `dashboard-daily.yml`, which is exactly what
  the separate file allows: push publishing is unaffected. The workflow's
  state then reads `disabled_inactivity`, and it can be re-enabled from the
  Actions tab or with `gh workflow enable`.
- **Concurrency at 00:23**: the dispatched run joins group `pages`, so it
  cancels a push run in progress, and a later push cancels it. The newest
  queued run publishes.
- **The record push cancels the task commit's deploy.** Observe the deploy
  first. The manual dispatch waits until the record commit's runs finish.
- **The first scheduled slot is missed or delayed.** The label stays
  `UNVERIFIED`, and this brief stays `in_progress`.
- **Consumers**:
  - a private repository spends Actions minutes twice a day;
  - a project whose `branch` is not the default branch must keep the
    dispatcher on the default branch;
  - a GitHub Enterprise Server may not accept the pinned API version, which
    fails loudly.
- **Rollback**: a targeted commit that removes `github-pages-daily` from the
  conf, then deletes the rendered file, which `render --check` would
  otherwise report as an orphan. Deleting that file needs the human's
  authorization written here first (`AGENTS.md`, *Destructive changes*).
  Never `git revert` the task commit, because that deletes this brief.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `skills/project-workflow/assets/publish/github-pages-daily.yml` | **New**, `100644`. `dashboard-daily`: runs on the 00:23 UTC `schedule` and on `workflow_dispatch`; `actions: write` only, no checkout, 30-minute timeout. One step dispatches `@@PAGES_WORKFLOW@@` on `@@BRANCH@@` with API version `2026-03-10`, then polls the run the reply names and ends as it ends (a cancelled run is not a failure). GitHub's limits are linked, not restated |
| `skills/project-workflow/scripts/publish_lib.py` | The `github-pages-daily` target with `needs: github-pages`; the `needs` refusal in `load_conf`; `PAGES_WORKFLOW` read from `TARGETS`; a docstring paragraph. `100755` |
| `skills/project-workflow/scripts/publish-dashboard.sh` | Usage text names the target, and says a `#` comment starts its own line; `usage()` now prints `2,51`, still ending on `Requires python3, standard library only.`. `100755` |
| `skills/project-workflow/scripts/check-publish.sh` | 15 new cases in a `trunk` fixture: 8 on the rendered dispatcher, 5 running its shell against a stubbed `curl`/`sleep`, and 2 on the conf rules. `OK (47 cases)`. `100755` |
| `dashboard-publish.conf` | `targets = github-pages github-pages-daily gitlab-pages`, plus `status.github-pages-daily = UNVERIFIED - no scheduled run observed yet (TASK-0129)`. The other two status lines are unchanged |
| `.github/workflows/dashboard-daily.yml` | **New**, rendered, `100644`; dispatches `dashboard.yml` on `master` |
| `skills/project-workflow/references/dashboard.md` | *Publishing it*: table row; a pasteable conf example, proven to load; the refusal; *The daily rebuild*; the *GitHub Pages, daily* note (60-day rule, re-enable, default branch, delays, who is told, API version, private-repo minutes); GitLab: no daily rebuild shipped |
| `skills/project-workflow/SKILL.md` | `5.2.0`, and one sentence |
| `README.md` | The daily rebuild is described as *configured*, with its `STATUS:` line saying whether it has been observed |
| `AGENTS.md` | *Dashboard publishing* lists `dashboard-daily.yml` |
| `.ai/tasks/TODO.md` | The `TASK-0129` entry, unticked; the counter reads `TASK-0130` |
| `.ai/context/CURRENT_STATE.md` | A new top section, "configured, not yet verified" |
| **Not changed** (identical to `d69bafe`) | `.github/workflows/dashboard.yml` (blob `6665a78…`, still `VERIFIED`); the GitLab fragment and stub; both existing templates; `ci-alert.yml`; `validate.yml`; `tests/validate.sh`; `.ai/decisions/`; `SPRINT-CURRENT.md`; the vendored `dashboard/`; `docs/registry.md` |

**Next task starts here**: `master` carries the dispatcher; its label reads
`UNVERIFIED` until a scheduled run is observed, and this brief stays
`in_progress` until then.

**Deviations from the Plan**:

1. The human's third-round decision (wait and mirror) came after this brief
   was written. It changed the template and the suite, and A3d, A4, A4b and
   A4d were revised to match.
2. The planned cost budget (+0.4 s for 9 cases) is exceeded. The suite went
   from 1.57-1.69 s to 2.08-2.16 s, about +0.5 s, for 15 cases. Five of them
   run the dispatcher's real shell, which is the price of testing behaviour
   rather than text.

## Status

- Status: in_progress   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent (the decision is the human's)
- Created: 2026-09-30
- Updated: 2026-09-30

## Execution log

### Attempt 1

- Date: 2026-09-30
- Agent: Claude Code (claude-opus-5-5), worktree `agent/daily-dispatcher`
- Actions:
  - `scripts/worktree.sh add daily-dispatcher` reported
    `gate : runs as a bare path`.
  - Wrote the brief first, then the template, which was staged at once
    (`UNTRACKED ASSET`).
  - Edited `publish_lib.py`, `publish-dashboard.sh` and `check-publish.sh`.
    Every edit went through a script that refused unless each old passage
    matched exactly once.
  - An edit whose heredoc nested another heredoc misfired. Its python half
    failed, so no file changed. Its tail ran as shell, and every write under
    `$TMP`, which was unset, was refused under `/`. Checked afterwards:
    `git status` in both checkouts showed nothing stray, and no file existed
    under `/fakebin` or `/api-*`. Redone from a script file.
  - Then the conf, `render`, and the docs.
- Observations:
  - **Baseline** `check-publish.sh`: `OK (32 cases)` in 1.57 and 1.69 s.
  - **After**: `OK (47 cases)` in 2.08, 2.14 and 2.16 s.
  - **API version**: a read-only GET with `X-GitHub-Api-Version: 2026-03-10`
    returned 200, and one with `1999-01-01` returned 400.
  - **Red proofs**, each on a `mktemp` copy of `scripts/` + `assets/`; the
    worktree's `git status --porcelain` was unchanged afterwards:

    | Mutation | Result |
    |---|---|
    | (a) the pre-task `publish_lib.py` | `15 of 47 case(s) FAILED`, exactly the 15 new cases |
    | (b) the `needs` check removed | 1 failure: the refusal |
    | (c) `"ref":"master"` hard-coded | 1: the branch case |
    | (d) `PAGES_WORKFLOW` = `pages.yml` | 1: the file-name case |
    | (e) the cron line deleted | 1 |
    | (f) `workflow_dispatch:` deleted from `github-pages.yml` | 1 |
    | (g) the orphan report deleted | 2: the old and the new orphan cases |
    | (h) the `permissions:` block deleted | 1 |
    | (i) a malformed `@@PAGES-WORKFLOW@@` in a comment | 1: no placeholder survives |
    | (j) a failed run mirrored as success | 1 |
    | (k) the cancelled arm removed | 1 |
    | (l) unmutated control | `OK (47 cases)` |
  - **This repository**:
    - `render --check` first printed
      `STALE .github/workflows/dashboard-daily.yml is missing`;
    - `render` then printed `wrote .github/workflows/dashboard-daily.yml`,
      with `ok` for the other three;
    - `render --check` then printed `ok` ×4;
    - the `dashboard.yml` blob stayed `6665a781690a65d3f325d729c75675fc4c905e4c`,
      and the three sha256s were unchanged.
  - **Drift proof**: appending `# x` to the rendered dispatcher made
    `render --check` exit 1, and made `tests/validate.sh` print
    `PUBLISH: STALE .github/workflows/dashboard-daily.yml is stale` and fail.
    `render` restored it, identical to the staged copy.
  - **The conf example**: the old one, extracted from `HEAD`, was refused by
    `load_conf` with
    `unknown target(s) # either or both. Known: github-pages
    github-pages-daily gitlab-pages`. The new one loads, with targets
    `['github-pages', 'github-pages-daily', 'gitlab-pages']`.
- Validation:
  - `tests/validate.sh` printed `validate.sh: OK`.
  - `sync-registry.sh` left `docs/registry.md` unchanged.
  - `check-dashboard.sh` printed `OK (36 assertions, sprint-brief fixture)`.
  - `check-artifact.sh --kind task` printed `OK`.
  - `git diff --exit-code d69bafe -- <the A5 list, .ai/decisions/,
    SPRINT-CURRENT.md>` was empty.
  - The three scripts are `100755`, and both new YAML files `100644`.
  - `git grep github.io -- AGENTS.md skills/` printed nothing.
  - `bash -n` passes on both shell scripts, and `publish_lib.py` parses.
  - After staging the 13 paths, the leak scan found 0 hits for the
    intranet host and both parent domains (case-insensitive), 0 for each
    of the three token values, and 0 for the token prefixes.
    `git diff --check --staged` printed nothing.
- Result: built, gated and ready to land. The live checks A7-A10 (the
  manual dispatch, then the first scheduled run) are pending, and are
  recorded in a later commit.
- Commit: recorded in the follow-up record commit
- Push: recorded in the follow-up record commit
