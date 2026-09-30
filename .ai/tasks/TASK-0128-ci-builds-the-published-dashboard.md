# TASK-0128 — Record why only CI builds the published dashboard

## Objective

Record the human's decisions of 2026-09-30 about how the published dashboard
is built, in `ADR-0029`, with every route weighed and why each was rejected:

- the page on every Pages destination is built only by that destination's
  own CI, from a full clone of the pushed branch, and a workstation build is
  never uploaded;
- a local build is a preview;
- the up-to-date copy is the published page, fetched back;
- the page's date-dependent figures are kept current by a separate scheduled
  workflow that dispatches the pipeline. That is built as its own task.

State the rule where readers look, each place linking `ADR-0029`:
`AGENTS.md`'s *Delivery dashboard* bullet, for this repository, and
`skills/project-workflow/references/dashboard.md`'s *Publishing it*, for
every project that uses the skill. Remove the wording that invited the
question. The phrase "the local file is the canonical output; this is an
optional copy of it on the web" reads as if the published page were an upload
of the local file. Correct `build-dashboard.sh`'s header, which says nothing
runs the script although both rendered pipelines do.

The question was asked on 2026-09-30 and nothing in the repository answered
it. Discharges no backlog item.

## Minimal context

### The question nothing answered

The human asked why the published page is generated separately from the local
one, and why the local file is not built first and sent to GitHub Pages.

`TASK-0123` gives the goal: *"current without anyone running a command and
without the HTML ever being committed"*. It does not say why the builder is
CI. Several places present the page as a copy of the local file, which reads
as an invitation to upload it:

- each rendered pipeline's header: *"the canonical output; this is an optional
  copy of it on the web"*;
- `dashboard-publish.conf`'s header;
- `references/dashboard.md`;
- `SKILL.md`.

`TASK-0127` excluded a `local` subcommand (*"a second entry point to it would
be a second owner"*). It also declined an ADR (*"the reference documents what
is, and this brief why"*). No document weighs and rejects "build locally and
upload".

### Measured before this task, 2026-09-30

`TASK-0123` measured the shallow-checkout trap *before writing the workflow*.
In the same way, these figures were measured the same day by read-only
research, before this brief was written, and are not re-measured here. **This
brief owns the figures.** `ADR-0029` states what they establish and links here.

| What | Measured |
|---|---|
| One command, one generator | CI runs the same `build-dashboard.sh` as the local route, over the same vendored generator. At `cafbfe3`, with a clean tree, the local build and the live page were both **838,497 bytes**, and the embedded models differed only in `generated_at`. The HTML was byte-identical once that one timestamp was swapped |
| GitHub's deploy route | Pages here is `build_type: workflow` (`TASK-0123`). Its only deploy API, `POST /repos/{o}/{r}/pages/deployments`, requires an `oidc_token` "issued by GitHub Actions" and an artifact belonging to the repository. The Artifacts REST API has no upload endpoint. The `github-pages` environment admits only `master` |
| Dispatch payloads | `workflow_dispatch` inputs are capped at **65,535** characters and a `repository_dispatch` payload at **64 KB**. The page is **838,497** bytes; gzipped it is **196,180**, about **261,576** characters once base64-encoded |
| Every other GitHub route | Committing the HTML to `master` fails because a page can never include the commit that adds it. A `gh-pages` branch needs a Pages settings change by an admin, then a force-push or a compressed copy of about **191 KB** per publish on the public mirror (zlib-9 of one copy; git's real delta not measured); Jekyll runs unless `.nojekyll` is present, and branch builds have a **10 per hour** soft limit. The third route is a release asset. **Each still ends in an Actions run.** GitHub advises against self-hosted runners on public repositories. Actions is free for public repositories |
| GitLab's route | No Pages upload API; a Pages job needs a runner, and none is online. GitLab fails a job pending **1 h** with no matching runner (`stuck_pending_no_matching_runners`). That is documented, not observed here |
| Cost | CI generation takes **0-1 s**. A successful run takes **23 s** minimum and **28 s** median, most of it job setup and `deploy-pages` (**6-12 s**). The local build takes about **35 s**, **32.4 s** of it in two `git log` calls over **3,874** loose objects and no packs on `/mnt/c` |
| What a local build reads | `.ai/` from the working tree and `git log` of the checked-out `HEAD`, with no `--all`, so uncommitted and unpushed content appears. Built in a directory named like a worktree, the page takes that name as its title (*"session-record — project dashboard"*; scratch directory with `--no-git`, not a real worktree). Eight briefs record pre-rebase hashes that are reachable only from worktree branches. The documented command also leaves `docs/dashboard-data.json` (**439,350** bytes) beside the page: the model CI deletes before upload |
| Timing against the two-commit rule | Replayed in memory: built before the task commit, `TASK-0120`'s closure read **2026-09-27** instead of **2026-09-30**. Between the task commit and the record commit, the date source degrades (`git_last` instead of `commit_hash`). Only a build after the last push matches |
| A local copy goes stale | `docs/dashboard.html` built at 12:26:15Z from `6ea0c28` (286 commits) was one commit behind the live page (12:31:38Z, `cafbfe3`, 287) within five minutes |
| Time zone | Workstation on UTC+2, runner on UTC, so "today" differs from **22:00 to 24:00 UTC**. It did in **2 of 32** runs. A one-day shift changes **9 of 28** metric groups (`aging_wip`, `as_of`, `burndown`, `burnup`, `cfd`, `debt`, `forecast`, `kpis`, `window`); seven days also change `activity`, `scope_churn` and `throughput`. The page rebuilds on push or manual dispatch only, so these freeze at that build's UTC date |
| Fetching the page back | An unauthenticated GET returns the exact deployed bytes (`cache-control: max-age=600`). The run's `github-pages` artifact needs a token and expires after **1 day** |
| The vendored `--install-hook` | Cannot work here. It writes `.git/hooks/post-commit` and ignores `core.hooksPath` (`.githooks`). Its hook body calls `.ai/scripts/pm_dashboard.py`, which is absent here, and swallows the error. Its default output is the gitignored `dashboard/build/`. Vendored, so not fixable here |
| `build-dashboard.sh:24` | *"Nothing in this repository runs this script automatically"*. False since `TASK-0123`: both rendered pipelines run it on every push to `master` |

`TASK-0123`'s *"Publishing adds no exposure"* therefore holds only for a build
of the pushed commit. A local build can put text that was never committed on
a public page.

### The human's decisions, 2026-09-30

Asked as multiple choice, in two rounds. Planned as separate tasks, because
each is one logical change:

1. **Keep CI as the only builder of the published page, and record why.**
   This covers:
   - `ADR-0029` with the rejected routes;
   - the rule in `references/dashboard.md` and `AGENTS.md`;
   - the stale `build-dashboard.sh` header.

   **This task.**
2. **A daily scheduled rebuild, as a separate dispatcher workflow.** It is an
   opt-in rendered file whose only job, once a day, is to dispatch the
   existing pipeline. The alternative was a schedule inside the pipeline
   file, and the human chose against it. GitHub disables a scheduled workflow
   in a public repository after 60 days without activity, and disabling is
   per file, so a schedule there would also stop publishing on push,
   silently. `ADR-0029` records the decision; building it is its own task.
3. **Fix `ci-alert.yml`'s close rule**, which today closes the alert on any
   green run. Its own task; not part of `ADR-0029`.

Not chosen: backlogging the other side findings (the vendored install hook,
GitLab's one-hour pending limit, the absolute `core.hooksPath`), and
`git gc` to speed up local builds.

### Why an ADR, when `TASK-0127` declined one

`TASK-0127` reversed a backlog routing along a route `B-048` had already
costed, so the reference could say what is and the brief why. This task is
different. It chooses between platform routes that will be proposed again,
and it decides what a public page may contain. That is a decision with lasting
impact (`AGENTS.md`, *Documentation rules*), and its rejected alternatives are
what an ADR exists to keep.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `master` | `cafbfe3` | equal on local, `origin` and `github`; tree clean; only the main checkout in `git worktree list` |
| `.github/workflows/dashboard.yml`, `.gitlab/ci/dashboard-pages.yml` | `TASK-0127` (rendered) | `render --check` ok ×3; GitHub `VERIFIED on run 36608693753`, GitLab `UNVERIFIED`; lines 10-12 carry the "canonical output … optional copy" sentence |
| `skills/project-workflow/assets/publish/{github,gitlab}-pages.yml` | `TASK-0127` | the same sentence at lines 10-12 |
| `dashboard-publish.conf` | `TASK-0127` | lines 1-2: "besides the local file … which is the canonical output" |
| `skills/project-workflow/references/dashboard.md` | `TASK-0122`, `TASK-0125`, `TASK-0127` | *Publishing it* at line 207, opening **The local file is the dashboard.**; no rule on who builds the published page |
| `skills/project-workflow/scripts/build-dashboard.sh` | `TASK-0125` | `100755`; lines 24-27 claim nothing runs it; `--help` prints lines 2-52 (51 lines) |
| `skills/project-workflow/scripts/publish-dashboard.sh` | `TASK-0127` | line 4: "THE LOCAL FILE IS THE CANONICAL OUTPUT, AND NEEDS NONE OF THIS." |
| `skills/project-workflow/SKILL.md` | `TASK-0117` | `version: "5.1.1"`; line 117 "**Publishing is optional; the local file is the dashboard.**" |
| `AGENTS.md` | ongoing | *Delivery dashboard* bullet at lines 59-68; no local-versus-published rule |
| `README.md` | `TASK-0123` | line 23 owns the page URL, line 24 its trigger sentence; untouched here |
| `ADR-0028` | `TASK-0126` | `Accepted`; a forgotten mirror push leaves the public dashboard behind |
| `.ai/tasks/TODO.md` | `a35e0fe` (last writer) | Post-S10; last entry `TASK-0127` at 825-827; counter at 676 reads `TASK-0121`, stale since 2026-09-28 |
| `.ai/context/CURRENT_STATE.md` | ongoing | newest first; top section is `TASK-0116`'s |
| The published page | the `cafbfe3` push | HTTP 200, 838,497 bytes; embedded `decisions` 28, `tasks` 124, `commits` 287 |
| The measurements above | research, 2026-09-30, before this brief | as quoted under *Minimal context* |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. `ADR-0029`, new, `Accepted` 2026-09-30: the human's decisions 1 and 2 as
   four clauses, eight routes rejected and one adopted.
2. `references/dashboard.md`, *Publishing it*:
   - the lead reworded, so it no longer implies that the local file is what
     gets published;
   - one paragraph with the rule, the GitHub reason, the GitLab reason, the
     preview rule, the fetch-back route and `ADR-0029`.
3. `AGENTS.md`, *Delivery dashboard*:
   - the published page is the current `master` dashboard;
   - a local build only previews and is never uploaded;
   - a link to `ADR-0029`.

   The URL and the trigger stay in `README.md`.
4. `build-dashboard.sh` lines 24-27 rewritten as four lines: comments only.
5. The "canonical output / optional copy" framing removed where it implies an
   upload, all comment-only:
   - `dashboard-publish.conf`'s header;
   - both templates' header sentence, with a re-render and the `STATUS:`
     lines unchanged;
   - `SKILL.md:117`, one clause;
   - `publish-dashboard.sh:4`.
6. `project-workflow` `5.1.1` → `5.1.2`, because skill content changed
   (`templates/reference/skill-maintenance.md`).
7. The `TODO.md` entry and counter; the `CURRENT_STATE.md` section.

### Not included

- **Any behaviour change to the pipelines.** No trigger, step, permission or
  `STATUS:` label moves. The re-render changes comment lines only.
- **The daily dispatcher** (decision 2) and **the `ci-alert.yml` fix**
  (decision 3). Each is its own task and its own commit.
- **The generator** (`skills/project-workflow/dashboard/`, vendored),
  including its `--install-hook`: recorded as a rejected route, not fixed.
- **`git gc`** or any repacking to speed up local builds: not chosen.
- **Backlog items for the side findings**: not chosen.
- **`README.md`**: it owns the URL and the only trigger sentence.
- **Statements that only say publishing is optional**: they are true, and
  are left.
- **Any new check.** Whether someone uploads a local build is not visible in
  the tree, and a prose check in the gate would be a check that guesses
  (`check-artifact.sh`'s header; `ADR-0008`).
- **`SPRINT-CURRENT.md`'s own counter** (`TASK-0122`). Its text defers to
  `.ai/tasks/`, so it is left as it is.

## Likely files

A forecast, written before the work.

- `.ai/tasks/TASK-0128-ci-builds-the-published-dashboard.md` (this file, new)
- `.ai/decisions/0029-the-published-dashboard-is-built-only-by-ci.md` (new)
- `skills/project-workflow/references/dashboard.md`
- `skills/project-workflow/scripts/build-dashboard.sh`, `publish-dashboard.sh`
  (comments only)
- `skills/project-workflow/assets/publish/github-pages.yml`, `gitlab-pages.yml`
  (comments only), re-rendered into `.github/workflows/dashboard.yml` and
  `.gitlab/ci/dashboard-pages.yml`
- `dashboard-publish.conf` (header comment only)
- `skills/project-workflow/SKILL.md` (version, one clause)
- `AGENTS.md`
- `.ai/tasks/TODO.md`, `.ai/context/CURRENT_STATE.md`

**Not expected to change**:

- `docs/registry.md`, because the skill's description is unchanged;
- `README.md`;
- `.gitlab-ci.yml`;
- the vendored generator;
- `BACKLOG.md`.

## Execution plan

1. Measure before planning: done 2026-09-30; quoted under *Minimal context*.
2. Take a worktree (`scripts/worktree.sh add published-dashboard`). Write this
   brief first; `TODO.md`'s counter moves to `TASK-0129`.
3. Generate `ADR-0029` with `new-artifact.sh`, and fill it from the human's
   decisions with no figures.
4. In `references/dashboard.md`, reword the lead of *Publishing it* and add
   the rule paragraph after the destinations table.
5. In `AGENTS.md`, add the rule to the *Delivery dashboard* bullet.
6. Rewrite `build-dashboard.sh` lines 24-27 as four lines, so `--help`'s
   `sed -n '2,52p'` still ends at the header. Prove the diff is comment-only.
7. Remove the framing:
   - the conf header;
   - both templates, then `render` and `render --check`, and a
     comment-stripped diff of both rendered files;
   - `SKILL.md:117`;
   - `publish-dashboard.sh:4`.
8. Set `SKILL.md` to `5.1.2`, and update `TODO.md` and `CURRENT_STATE.md`.
9. Validate. Stage explicit paths and run the leak scan on the staged diff.
   Commit through the hook.
10. Land from the worktree: push `origin`, then `github`, and compare hashes.
    Observe the landed commit's runs before pushing anything else, because
    `concurrency: pages` would cancel a deploy in progress. Then make the
    record commit.

## Acceptance criteria

- [x] The ADR file exists with an H1 of `# ADR-0029 — …`.
- [x] Its `## Status` reads `Accepted (2026-09-30)` and says which clauses
      the human chose.
- [x] `check-artifact.sh --kind adr` prints `OK` on it, and the same check
      fails on a copy without `## Consequences`.
- [x] `ADR-0029` rejects each of these routes, with its reason:
      - uploading a local build;
      - a commit to `master`;
      - a `gh-pages` branch;
      - a dispatch payload;
      - a release asset;
      - a self-hosted runner;
      - the vendored `--install-hook`;
      - a schedule inside the pipeline file.
- [x] `ADR-0029` records fetching the published page back as adopted.
- [x] `ADR-0029` carries no measured figure; the figure grep under
      *Mandatory validations* prints nothing.
- [x] *Publishing it* says only the destination's pipeline builds the
      published page.
- [x] *Publishing it* gives the GitHub reason and the GitLab reason in a
      sentence each.
- [x] *Publishing it* calls a local build a preview, says to download the
      published page for an up-to-date copy, and cites `ADR-0029`.
- [x] The lead of *Publishing it* no longer says "canonical output".
- [x] `AGENTS.md`'s *Delivery dashboard* says the published page is the
      current `master` dashboard.
- [x] It says a local build only previews unpushed state and is never
      uploaded, and it cites `ADR-0029`.
- [x] `git grep -n 'github.io' -- AGENTS.md skills/` prints nothing.
- [x] `build-dashboard.sh` no longer contains *"Nothing in this repository
      runs this script automatically"*; the sentence was at line 24 at
      `cafbfe3`.
- [x] Its comment-stripped diff is empty and `bash -n` passes.
- [x] `--help` still prints 51 lines, ending on the header's last line.
- [x] The index still records the file as `100755`.
- [x] No "canonical output … optional copy" sentence is left in the conf, the
      templates, the rendered pipelines, `SKILL.md` or
      `publish-dashboard.sh`.
- [x] `render --check` prints `ok` ×3.
- [x] Both rendered files differ from `cafbfe3` only in comment lines.
- [x] `SKILL.md` reads `version: "5.1.2"`, and `docs/registry.md` is
      unchanged after `scripts/sync-registry.sh`.
- [x] `TODO.md` lists `TASK-0128` after `TASK-0127`, and its counter reads
      `TASK-0129`, keeping the stale value's history.
- [x] `CURRENT_STATE.md` opens with the `TASK-0128` / `ADR-0029` section,
      which links the rule rather than restating it.
- [x] `tests/validate.sh` prints `validate.sh: OK`, both by hand and from
      the hook.
- [x] Nothing changed under `skills/project-workflow/dashboard/`, and
      `README.md`, `docs/registry.md` and `.gitlab-ci.yml` are unchanged.
- [x] The staged diff carries no token value, no token prefix, and neither
      the intranet host nor its parent domain (case-insensitive).

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed): the skill changed;
      expect no diff, since its description did not
- [x] `skills/project-migration/scripts/check-artifact.sh`, on `ADR-0029`
      with `--kind adr` and on this brief with `--kind task`
- [x] The negative control
      `check-artifact.sh <(sed '/^## Consequences$/,$d' <ADR-0029>) --kind adr`
      exits 1
- [x] `skills/project-workflow/scripts/check-dashboard.sh` (component check;
      expected unchanged)
- [x] For `build-dashboard.sh`:
      - `bash -n`;
      - the comment-stripped diff;
      - `--help | wc -l` and `--help | tail -n 1`;
      - `git ls-files -s`, which must show `100755`.
- [x] `publish-dashboard.sh render --check`, plus a comment-stripped diff of
      both rendered files against `cafbfe3`
- [x] `grep -nE '[0-9]{1,3},[0-9]{3}|\b[0-9.]+ ?(s|KB|MB|bytes|chars|h)\b'
      .ai/decisions/0029-*.md` prints nothing
- [x] `git diff --check --staged`, and the leak scan of the staged diff, both
      run after staging

**DoD point 2 does not apply as a behaviour test.** This task changes no
behaviour, and a test of prose would not fail on revert in any useful way.
Two checks stand in for it:

- The negative control shows that the gate's artifact check can fail on this
  ADR. The gate already checks every `.ai/decisions/*.md` and every brief
  from `TASK-0024`.
- The stale-sentence `grep` is the one check here that flips when the change
  is reverted.

Neither is added to the gate.

## Risks and rollback

- **The rule contradicts the lead.** "The local file is the dashboard" sits
  beside "never upload it". The lead is reworded, and the section is reviewed
  as a whole.
- **`ADR-0029` could be confused with `sigma-llmwiki`'s**, which the vendored
  generator's comments cite. `ADR-0029`'s Status says so, and the reference
  says "ai-toolbox's".
- **`--help` prints the wrong lines** if the header changes length. Four lines
  replace four, and this is checked.
- **A rendered file edited by hand.** The rendered files are only ever written
  by `render`, and `render --check` confirms it.
- **The mode or line endings flip on `/mnt/c`.** Checked with
  `git ls-files -s` and `git diff --check`.
- **The record push cancels the task commit's deploy** (`cancel-in-progress`).
  Observe the deploy first, then push the record commit.
- **A cached page read as new** (`max-age=600`). Judge by `generated_at` and
  the short hash.
- **The mirror push forgotten.** The page then stays behind silently
  (`ADR-0028`). The three-hash comparison catches it.
- **Public mirror.**
  - Rule: no intranet host and no location name in any file.
  - Check: the leak scan runs on the staged diff.
- **Rollback**: a targeted commit restoring the changed passages. This brief
  is kept, marked `blocked`, and gets an Attempt 2. A plain `git revert`
  would also delete this brief and `ADR-0029`, which is a deletion
  `AGENTS.md` says needs authorization.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `.ai/decisions/0029-the-published-dashboard-is-built-only-by-ci.md` | **New**, `Accepted (2026-09-30)`, with four clauses: CI is the only builder; a local build is a preview; the up-to-date copy is the published page, fetched back; a separate scheduled dispatcher rebuilds the page daily, never a schedule inside the pipeline file. Eight routes are rejected and one adopted. No measured figure |
| `skills/project-workflow/references/dashboard.md` | *Publishing it*: the lead is reworded to "the local file is the dashboard until you publish it", with no "canonical output". A new rule paragraph after the destinations table cites ai-toolbox's `ADR-0029` |
| `AGENTS.md` | *Delivery dashboard*: the published page is the current `master` dashboard; a local build previews and is never uploaded (`ADR-0029`). The URL and trigger are left to `README.md` |
| `skills/project-workflow/scripts/build-dashboard.sh` | Lines 24-27 rewritten, four lines for four. Comments only; mode `100755`; `--help` still prints 51 lines |
| `skills/project-workflow/scripts/publish-dashboard.sh` | Lines 4-9 rewritten, six lines for six. Comments only; `--help` prints 45 lines, as before |
| `skills/project-workflow/scripts/publish_lib.py` | Docstring lines 6-8: publishing is optional, and "the destination's CI builds the page". **Not forecast** under *Likely files*; the leftover grep found it |
| `skills/project-workflow/assets/publish/{github,gitlab}-pages.yml` | Header lines 10-12: this pipeline's build, from a full clone of the pushed branch, is the published page; a local build is a preview and is never uploaded |
| `.github/workflows/dashboard.yml`, `.gitlab/ci/dashboard-pages.yml` | Re-rendered. The comment-stripped diff against `cafbfe3` is empty, the `STATUS:` lines are unchanged, and `render --check` prints `ok` ×3 |
| `dashboard-publish.conf` | Header comment only; targets and status lines unchanged |
| `skills/project-workflow/SKILL.md` | Version `5.1.2`; line 117 now reads "unpublished, the local file is the dashboard" |
| `.ai/tasks/TODO.md` | The `TASK-0128` entry. The Post-S10 counter reads `TASK-0129`, with its history extended |
| `.ai/context/CURRENT_STATE.md` | A new top section |
| **Not changed** | `skills/project-workflow/dashboard/` (vendored); `README.md`; `docs/registry.md` (`sync-registry.sh` shows no diff); `.gitlab-ci.yml`; `BACKLOG.md`; `SPRINT-CURRENT.md`; no pipeline's behaviour or label |

**Next task starts here**: `master` is at this task's landed commit.
`ADR-0029` clause 3, a separate daily dispatcher, is decided but not built.
The only statement of when the page is rebuilt is `README.md:24`'s push
trigger. **Deviation from the Plan**: `publish_lib.py`'s docstring carried the
same framing, and was reworded too.

## Status

- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent (the decisions are the human's)
- Created: 2026-09-30
- Updated: 2026-09-30

## Execution log

### Attempt 1

- Date: 2026-09-30
- Agent: Claude Code (claude-opus-5-5), worktree `agent/published-dashboard`
- Actions:
  - `scripts/worktree.sh add published-dashboard` reported
    `gate : runs as a bare path`.
  - Generated this brief first (`new-artifact.sh --kind task --id
    TASK-0128`), then `ADR-0029` (`--kind adr --id ADR-0029 --out
    .ai/decisions/0029-…`), and filled both.
  - Applied the text edits with a script that refused to write unless each
    old passage matched exactly once. All matched.
  - Ran `publish-dashboard.sh render`, which printed `wrote
    .github/workflows/dashboard.yml`, `wrote .gitlab/ci/dashboard-pages.yml`
    and `ok .gitlab-ci.yml`.
- Observations:
  - After the planned edits, a leftover grep for `canonical output|optional
    copy` found one more instance, `publish_lib.py:7`, reworded here. The
    grep then exited 1 over the conf, the skill (vendored `dashboard/`
    excluded), both rendered files, `AGENTS.md` and `README.md`.
  - `GITLAB_PUSH_TOKEN` was unset in the session's shell, although the
    profile exports it. It is loaded per command for `origin` calls and never
    replaced by `GITLAB_TOKEN`.
- Validation:
  - `check-artifact.sh` on the ADR (`--kind adr`) and on this brief
    (`--kind task`) printed `OK` for both.
  - The negative control printed `FAIL /dev/fd/63 - missing required
    section: ## Consequences` and exited 1.
  - `tests/validate.sh` printed `validate.sh: OK` by hand (7.5 s), and runs
    again from the hook at commit.
  - `check-dashboard.sh` printed `OK (36 assertions, sprint-brief fixture)`.
  - `sync-registry.sh` left `docs/registry.md` unchanged.
  - `build-dashboard.sh`:
    - `bash -n` passes and the comment-stripped diff is empty;
    - `--help | wc -l` prints `51`, and the last line is `# no network. …`;
    - the mode is `100755`;
    - the stale-sentence grep exits 1 here and matches line 24 at `cafbfe3`;
    - the new lines are 75, 76, 75 and 75 characters.
  - `publish-dashboard.sh`: `bash -n` passes, the comment-stripped diff is
    empty, `--help` prints 45 lines before and after, and the mode is
    `100755`.
  - `publish_lib.py` parses, and its mode is `100755`.
  - `render --check` prints `ok` ×3. The comment-stripped diffs of both
    rendered files against `cafbfe3` are empty, and the `STATUS:` lines are
    unchanged.
  - The ADR figure grep prints nothing, and so does
    `git grep github.io -- AGENTS.md skills/`.
  - `git diff --stat` over `skills/project-workflow/dashboard/`,
    `README.md`, `.gitlab-ci.yml` and `docs/registry.md` is empty.
  - After staging the 15 paths, the leak scan of the staged diff found 0 hits
    for the intranet host and its parent domain (case-insensitive), 0 for
    each of the three token values, and 0 for the token prefixes.
    `git diff --check --staged` printed nothing.
- Result: done. The page's rebuild on the landed commit is observed before
  the record commit and reported to the human. It is not recorded here,
  because the record commit replaces only the two lines below.
- Commit: `d3981d1` — *Record why only CI builds the published dashboard
  (TASK-0128)*, plus the record-keeping commit after it
- Push: **confirmed to both remotes** — `cafbfe3..d3981d1 HEAD -> master` to
  `origin` and to `github`; `HEAD`, `origin/master` and `github/master` all
  read `d3981d1`, and `git remote -v` is token-free
