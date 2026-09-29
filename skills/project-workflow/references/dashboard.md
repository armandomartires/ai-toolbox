# The delivery dashboard

`scripts/build-dashboard.sh` reads a repository's `.ai/` governance layer and
writes **one self-contained HTML5 file**: no CDN, no external font, no network
call, every chart hand-rolled SVG. It opens by double-click from `file://`,
survives being emailed, archived or committed, and needs nothing installed
beyond `python3`.

```sh
skills/project-workflow/scripts/build-dashboard.sh \
    --root .ai --project my-repo --out docs/dashboard.html
```

| Flag | Meaning |
|---|---|
| `--root` | the governance directory. Default `.ai`. Either corpus layout is **detected**; neither is assumed |
| `--repo` | repository root, for git provenance. Default: `--root`'s parent |
| `--out` | output path. Default `dashboard.html` |
| `--project` | accepted for compatibility; the page is titled from the repository directory name, and a mismatch is warned about rather than silently ignored |
| `--json PATH` | also write the underlying model, so the same numbers are available to anything else |
| `--no-git` | do not read git (see *Where a date comes from*) |
| `--theme`, `--css`, `--css-href` | **accepted and ignored, with a warning.** Styling is now an optional `dashboard.custom.css` beside the output, which the page links last. They are accepted so an existing invocation does not break, and warned about so nobody believes a stylesheet was applied when it was not |

## The generator is vendored — do not edit it here

`dashboard/` holds a **copy**. The original lives in the `sigma-llmwiki`
repository, and `build-dashboard.sh` is a thin wrapper over it.

That is deliberate, and the reason is worth knowing before you reach for an
edit: two dashboard generators were once built for this convention in the same
week, in two repositories, neither aware of the other — so the dashboard a
project got depended on which repository it was scaffolded from. One generator,
vendored, is what stops that recurring. Editing the copy here starts it again.

`dashboard/VENDORED.md` records the source commit and a sha256 per file, and
the sync script's `--check` exits non-zero on any drift, so the two copies
matching is a claim a command can refute rather than one somebody remembers
making.

## Why it exists

`.ai/` answers *why* and *what's next* in prose, and prose does not add up. The
one number anyone tried to maintain by hand in this repository —
`BACKLOG.md`'s *"N items are open"* sentence — went stale **twice in two
days** (`B-038`, `TASK-0115`, `TASK-0118`). A generated view cannot go stale,
because it is regenerated; and it re-counts from the rows every time rather
than adjusting a previous count by one. On its first run against this
repository it disagreed with that sentence by one and was right: see
*Findings this has already produced*.

## The tabs

Twelve tabs, a closed set.

| Tab | What it answers |
|---|---|
| **Overview** | Where does the project stand? KPI tiles, state distribution, a compact burn-up, weekly throughput, acceptance-criteria coverage |
| **Burn charts** | Burn-up (scope vs completed), burn-down against a straight-line reference, scope churn |
| **Flow & velocity** | Cumulative flow, velocity per sprint, throughput, cycle-time control chart and histogram, lead-time distribution, ageing WIP |
| **Forecast** | Monte Carlo completion histogram, the confidence curve, p50/p85/p95 dates, and the throughput it sampled |
| **Board** | What is in flight and what is stuck, with blocked-by lists, owners, and per-brief criteria counts |
| **Roadmap** | Sprint history and timeline, roadmap phases, one sprint's own burn-down and burn-up, and work run outside any sprint |
| **Backlog** | Open items by priority × value, raised vs closed, what is next as written down, and the full sortable list |
| **Dependencies** | The layered DAG, the critical path, the ready frontier, prose gates, and any cycles |
| **Decisions** | ADRs over time, by status, with supersession — and the review checkpoints |
| **Activity** | Commit heatmap, contributors, commit↔task linkage, the commit log, audit-log mix |
| **Debt & risk** | Corpus defects, the risk register, open ad-hoc items with ages |
| **Data & theme** | Where every number came from, how each completion date was obtained, the token editor, the raw payload |

A tab whose data a corpus does not record renders **a sentence saying so**,
never an empty chart. A sprint-brief project has no roadmap phases and a
numbered-task project records no per-task dependencies; in both cases the tab
states the absence rather than drawing an axis with nothing on it. An absence
is not a finding.

## What the metrics mean

**Estimate.** Neither framework's task schema has a points field, and none is
being added — `ADR-0008` forbids a tool authoring a requirement, and adding
one would invalidate every existing brief. So the default is **one point per
task**: count-based velocity, which is what a team with no estimates actually
has. A brief that *does* carry `Points:`, `Estimate:`, `Story points:` or
`Size:` has that number read instead, so a project that estimates is not
forced onto counts.

**Lead time** = Created → closed. **Cycle time** = started → closed, where
"started" is the Execution log's first `Date:`. Both are reported at the
**50th and 85th percentiles**, never as a mean: the mean hides the tail, and
the tail is the part that hurts. Quote the 85th.

**Throughput** = tasks closed per week. **Velocity** = points delivered per
sprint, shown against points committed so a shortfall is visible.

**Burn-up** is the chart to read first. It plots scope and completed work as
two cumulative lines, so work *added* after the start is visible as the top
line rising. A burn-down collapses both into one line and hides that.

**Burn-down** gets an **ideal line only per sprint**, because a sprint has a
declared end. The release burn-down gets a **least-squares trend** over the
last three weeks projected to zero instead — a claim about observed pace, not
a commitment. No target date exists anywhere in `.ai/`, and drawing an ideal
line to one would invent a commitment nobody made.

**The forecast** is a Monte Carlo over 5,000 runs, sampling the project's own
daily throughput *including its zero days* — dropping those is how a forecast
becomes optimistic. It needs no estimate and no target date. The run is
**seeded**, so the same history always gives the same forecast; a number that
moves when nothing moved is not a forecast.

## Where a date comes from

In preference order, and the order matters:

1. **the commit date** of a hash the brief records — an instant no later edit
   can move;
2. the commit whose subject line names the task;
3. **`Updated`**, which is a field a human maintains, and therefore the
   weakest of the three.

The Tasks tab shows the split. In this repository it is 99 by commit, 14 by
`Updated`, 6 with no date. With `--no-git` everything falls back to step 3
and the Activity tab says so rather than rendering empty.

## What this does not prove

Read this section before quoting any figure off the dashboard.

- **It does not audit anything.** It renders what the artifacts say. A brief
  recording a passing suite it never ran is rendered as a suite that passed.
  This is the same boundary `tests/validate.sh` draws when it checks source
  completeness and stops (`ADR-0009`).
- **The cumulative flow diagram is reconstructed, not replayed.** Neither
  schema records status transitions. Each task's history is rebuilt from three
  instants — Created, the Execution log's first `Date:`, and the commit that
  closed it. A task that went to blocked and back looks as though it never
  did. Band *widths* are readable; the *moment* a band changed is not. The
  chart card says so on its face, not only here.
- **Cycle time is only as good as the start signal.** 112 of 119 briefs here
  carry an Execution log date. The seven that do not fall back to Created, so
  their cycle time equals their lead time. `project-workflow`'s task schema
  has **no** start field at all, so in that layout cycle time always equals
  lead time.
- **One point per task is not an estimate.** Velocity in this repository
  counts tasks, and tasks are not the same size. Treat it as cadence, not
  capacity.
- **Sprint membership is read from the index**, not from the briefs: in
  `project-migration` a task belongs to the sprint whose `## Sprint S#`
  heading lists it in `tasks/TODO.md`. A sprint archive file's *mentions* are
  a fallback only, because those files cite earlier tasks in their narrative —
  `S10`'s names 35 task ids.
- **The counts are of what parsed.** A brief with no recognisable `Status`
  line is reported in a warning box on the Overview tab rather than dropped
  silently, but it is still not on the charts.
- **Nothing here is scoped to a date range except what says it is.** The
  sprint and status filters scope tables and task-level charts; the cumulative
  timelines always show the whole project, and the filter row says so while a
  filter is active.

## Customizing it

Everything visual is a CSS custom property read at draw time, and **no chart
module names a colour** — series marks take `pm-s1`–`pm-s8` / `pm-a1`–`pm-a8`
and the semantic `pm-ok` / `pm-warn` / `pm-bad` / `pm-ref` / `pm-muted`, all
bound to tokens in one stylesheet. If you find yourself editing JavaScript to
change a colour, the token is missing and that is a bug in the base sheet.

Three routes, in ascending order of permanence:

| Route | Where | Persistence |
|---|---|---|
| Theme toggle | header button, or `t` | `localStorage` |
| Token editor | Data & theme tab — edit any token live, then export a ready-made stylesheet | `localStorage`, as inline styles |
| `dashboard.custom.css` | a file **beside the generated page** | the file, across regenerations |

The generated page links `dashboard.custom.css` last, so a plain declaration
there beats every stylesheet — but an inline style from the token editor beats
any stylesheet, so add `!important` when you want the file to be the final word
in a browser where you have used the editor. A missing file is **not** an
error: a `<link>` to a same-directory file resolves over `file://` where a
`fetch` would not, which is what makes this a usable hook rather than a
required build input.

The easy path is to tune it in the browser, export from the Data tab, and drop
the result next to the page.

**If you substitute the series hues, validate them.** The defaults are the
`dataviz` skill's reference instance and were checked in both modes before any
chart existed — light `ALL CHECKS PASS` (worst adjacent CVD ΔE 9.1,
normal-vision 19.6, contrast WARN on three slots), dark `ALL CHECKS PASS`
(8.4 / 19.3, every slot ≥ 3:1). Run `scripts/validate_palette.js` on your own
against your own surfaces. Fix every `FAIL`; a contrast `WARN` is
dischargeable — the table views discharge it here — but it is not dismissable.

**Themes.** Light and dark are both *selected*, not inverted: the same hues
stepped for the dark surface, because flipping lightness produces colours that
fail the dark band. `auto` follows `prefers-color-scheme`; the header toggle
cycles `auto → light → dark`. The choice is persisted **twice** — in
`localStorage` where it works, and in the URL hash, because Chrome and Firefox
treat a `file://` page as an opaque origin and *throw* on `localStorage`,
which is exactly how this file is meant to be opened.

**Band colours are literal, never `var(--series-2)`.** The renderer reads them
through `getComputedStyle`, and an engine that does not substitute an inner
`var()` hands an SVG presentation attribute the string `var(--series-2)`,
which paints nothing. Set them in both theme blocks.

## Publishing it

**The local file is the dashboard.** `build-dashboard.sh` writes one
self-contained HTML file and that is the canonical output; it needs no config,
no CI and no network. Publishing the same page to the web is optional, and
there are two destinations:

| Target | Rendered to | Runs on |
|---|---|---|
| `github-pages` | `.github/workflows/dashboard.yml` | GitHub Actions; deploys with `actions/deploy-pages` |
| `gitlab-pages` | `.gitlab/ci/dashboard-pages.yml`, included from `.gitlab-ci.yml` | a GitLab runner; the `pages` job publishes `public/` |

**1. Declare the destinations** in `dashboard-publish.conf` at the repository
root:

```
targets      = github-pages gitlab-pages      # either or both
skill_dir    = skills/project-workflow        # MUST be inside the repository
branch       = main                           # the branch that publishes
root         = .ai                            # optional, default .ai
expect_shape = sprint_brief                   # optional: sprint_brief | numbered_task
status.github-pages = UNVERIFIED - never run  # required, per target
status.gitlab-pages = UNVERIFIED - never run
```

Unknown keys, unknown targets and a target without a `status.` line are
refused. The status is copied into the rendered file's header; change it only
after watching a run succeed, and name the run.

**2. Render**, then commit what it wrote:

```
bash skills/project-workflow/scripts/publish-dashboard.sh render
```

**3. Gate it.** Add `publish-dashboard.sh render --check` to the project's own
checks. It writes nothing and exits 1 naming every stale, missing or orphaned
file. Without it the rendered copy is just a copy, and drifts.

**What the renderer refuses, and why:**

- **A skill directory outside the repository.** A runner clones the repository
  and nothing else. A skill installed in `~/.claude/skills/`, or symlinked in
  from elsewhere, does not exist on the runner, so the pipeline would fail on
  its first step. Copy the skill into the repository and point `skill_dir` at
  it. The two scripts it calls must also be tracked by git.
- **Overwriting a CI file it did not generate.** Every rendered file starts
  with `# GENERATED by`. A hand-written `.github/workflows/dashboard.yml` is
  refused; pass `--adopt` once to replace it deliberately.
- **Editing your `.gitlab-ci.yml`.** A project's GitLab CI file is often its
  whole CI, so the dashboard job is a separate fragment. A stub
  `.gitlab-ci.yml` that includes it is written only when none exists.
  Otherwise add the include yourself, and `--check` fails until you do:

  ```yaml
  include:
    - local: .gitlab/ci/dashboard-pages.yml
  ```

**What each pipeline guards.** After building, both run `publish-dashboard.sh
guard`, which refuses to publish when:

- **the clone is shallow**, asked of git directly. This is the trap the
  pipelines were written around. The generator reads `git log` for every
  completion date and the whole Activity tab, so a truncated history produces a
  complete-looking page that is wrong. `actions/checkout` defaults to depth 1,
  and **GitLab defaults to 20**. A 20-commit history passes any count-based
  check, which is why the guard asks git and does not count. Both templates set
  full depth.
- the history has one commit or fewer, no task brief parsed, or git was
  unavailable to the generator;
- the detected corpus shape is not `expect_shape`, when that key is set;
- a field the guard reads is **missing** from the model. A guard that reads a
  key that no longer exists never fires, and the deploy it was meant to stop
  then looks checked.

The model JSON is deleted before upload: it is working data, and publishing it
would put a second, unlabelled copy of every figure on the web.

**Per-destination notes.**

- *GitHub Pages*: `configure-pages` runs with `enablement: true`, which needs
  repository admin on the token. Without it the step fails loudly, and you
  enable Pages once in Settings. A public repository publishes a public page.
- *GitLab Pages*: the instance must have Pages enabled and a runner online, and
  neither is visible from the repository. The job declares `image: python:3.12`
  for git, bash and python3. A shell-executor runner ignores `image` and needs
  those three on its host. Who can see the page follows the project's
  *Pages* visibility setting, not the repository's.

**What publishing does not change:** the page is the same file either way.
Nothing here is a gate on a commit. A failed deploy fails its own pipeline, and
a dashboard showing uncomfortable numbers fails nothing.

## Both corpus layouts

| | sprint-brief (`project-workflow`) | numbered-task (`project-migration`) |
|---|---|---|
| Brief filename | `S###.T###_Name.md`, or `S###_Sprint.T###_Name.md` | `TASK-####-slug.md` |
| Status | `**Status**:` in the preamble | `- Status:` under `## Status` |
| Status words | `not started` / `in progress` / `blocked` / `completed` | adds `planned`, `ready`, `review`, `cancelled` |
| Dates | `**Created**` / `**Updated**` where present, else git | `- Created:` / `- Updated:`, and commit hashes the brief names |
| Criteria | *no checkbox list — `## Verification` instead* | `## Acceptance criteria` |
| Sprint | the filename, or `**Sprint**:` | `tasks/TODO.md` headings |
| Plan | `20.PLAN.md`, `30.ROADMAP.md` | `planning/SPRINT-CURRENT.md`, `planning/ROADMAP.md` |
| Backlog | `35.AD_HOC_TASKS.md` entries | `planning/BACKLOG.md` table |
| Dependencies | `**Depends on**:` — a real graph | *not recorded* |

Which one a corpus uses is decided from the briefs' own filenames and recorded
in the payload as `project.corpus_shape`, so the Data tab always says which
reader produced the numbers.

A card whose data the layout does not record says so, rather than showing an
empty chart — "No brief in this layout records acceptance criteria as
checkboxes" is not the same statement as "no data", and a reader deserves the
first one.

**Both layouts fill the same payload keys.** `backlog[]` comes from a
`BACKLOG.md` table where one exists and from the ad-hoc list where it does not;
`phases[]` is empty for a layout with no roadmap phases. A key a corpus has
nothing for is an empty array, never absent — so a consumer never has to ask
which shape it is reading before it can index the payload.

## Findings this has already produced

Recorded because a tool's first real run is its best test, and because these
are the argument for having built it.

- **`B-015`.** `BACKLOG.md`'s prose sentence counts twelve open items and
  names `B-015` among them. `B-015`'s own row reads `**done**`, *"Closed
  2026-09-16 by REVIEW-0008"*. The dashboard counts eleven, from the rows.
  Raised as `B-047`, not silently corrected.
- **The `project-workflow` fixture found three parser defects** that this
  repository structurally could not: the task-id pattern swallowed the file
  extension, an identifier field was cleaned as prose (`S001_Foundation` →
  `S001Foundation (see ../30.ROADMAP.md…)`), and a sprint named `S002` in the
  plan never matched a brief saying `S002_Performance`, so every sprint in
  that layout fell into the "outside a sprint" bucket with the velocity chart
  empty. This repository uses the other framework and would never have shown
  any of them.
