# The delivery dashboard

`scripts/build-dashboard.sh` reads a repository's `.ai/` layer and writes one self-contained HTML5 file:
- no CDN and no network call
- hand-rolled SVG charts
- `python3` standard library only

The file opens from `file://`.

```sh
skills/project-workflow/scripts/build-dashboard.sh \
    --root .ai --project my-repo --out docs/dashboard.html
```

| Flag | Meaning |
|---|---|
| `--root` | The governance directory (default `.ai`). The corpus layout is detected. |
| `--repo` | Repository root, for git provenance. Default: `--root`'s parent. |
| `--out` | Output path. Default: `dashboard.html`. |
| `--project` | Accepted for compatibility. The title comes from the directory name, and a mismatch is warned about. |
| `--json PATH` | Also writes the underlying model. |
| `--no-git` | Don't read git; dates fall back to hand-recorded fields. |
| `--theme`, `--css`, `--css-href` | Accepted and ignored, with a warning. Style the page with `dashboard.custom.css` instead (see *Customizing it*). |

**The generator is vendored: do not edit it here.** `dashboard/` is a copy of the generator developed in `sigma-llmwiki`. `dashboard/VENDORED.md` records the source commit and a sha256 per file. That repo's `sync_dashboard_skill.py --check` exits non-zero on drift. Change the generator there and re-sync.

## The tabs

| Tab | Shows |
|---|---|
| Overview | KPI tiles, state distribution, a compact burn-up, throughput, criteria coverage |
| Burn charts | Burn-up, burn-down, scope churn |
| Flow & velocity | Cumulative flow, velocity, throughput, cycle-time control chart, lead time, ageing WIP |
| Forecast | Monte Carlo completion dates: p50, p85, p95 |
| Board | Work in flight and stuck work, owners, criteria counts |
| Roadmap | Sprint timeline, roadmap phases, per-sprint burn charts |
| Backlog | Priority × value, raised vs closed, the full list |
| Dependencies | DAG, critical path, ready frontier, cycles |
| Decisions | ADRs by status and over time, supersession, reviews |
| Activity | Commit heatmap, contributors, commit ↔ task linkage |
| Debt & risk | Corpus defects, risks, open ad-hoc items |
| Data & theme | The source of every number, the token editor, the raw payload |

A tab whose data the corpus does not record says so in a sentence. It never draws an empty chart.

## What the metrics mean

- **Points.** One per task, unless a brief carries `Points:`, `Estimate:`, `Story points:` or `Size:`.
- **Cycle time** runs from Created to closed. **Lead time** runs from the earliest evidence (or Created) to closed. Both are reported at p50 and p85, never as a mean. Quote p85.
- **Throughput** is tasks closed per week. **Velocity** is points per sprint.
- **Burn-up** is the chart to read first, because scope added later shows as a rising top line. Only a sprint gets an ideal burn-down line. The release burn-down uses a three-week trend.
- **Forecast** is a Monte Carlo over the project's own daily throughput, zero days included, with a seed so the same history gives the same forecast.

## Where a date comes from

Closed date, in order of preference:
1. the commit date of a hash recorded in the brief, as an exact 7-character short hash
2. the newest commit whose subject names the task
3. `Updated`
4. a log entry
5. the brief's last git touch

Under "git is the record" (ADR-0033 in ai-toolbox), step 2 is the normal source.

Created date: the `Created` field, then the date git added the brief.

## Fields that must keep their shape

Rename any of these and the dashboard quietly loses data: it degrades to zeros and "unassigned", not to an error.

| Layout | Read from |
|---|---|
| sprint-brief (`project-workflow`) | Filename `S###.T###_Name.md` (the sprint comes only from this). In the first 14–20 lines: `**Status**`, `**Created**`, `**Updated**`, `**Points**`, `**Depends on**`, `**Commits**`. Sections `## Goal`, `## Files touched`. |
| numbered-task (`project-migration`) | Filename `TASK-####-slug.md`. `## Status` with `- Status:`, `- Owner:`, `- Created:`, `- Updated:` (or those lines within the first 40). `## Objective`/`## Goal`. `## Acceptance criteria` and `## Mandatory validations` checkboxes. `## Likely files` bullets. `Commit:` lines anywhere. |
| both | `TASK-####` or `S###.T###` in commit subjects. ADRs: `NNNN-*.md` with `**Status**:` and `**Date**:` in the first 20 lines (a `## Status` section reads as `unknown`). Reviews: `**Date**:`. |
| plans | numbered-task: `tasks/TODO.md` sprint headings (`## … S#`, `Post-S#`) with `- [x] TASK-####` lines; a `planning/sprints/*S#*.md` with "closed/complete" plus a date in its first 40 lines; "No sprint is open" in the first 400 characters of `SPRINT-CURRENT.md`; `## Phase N — Title (complete, date)` in `ROADMAP.md`; `BACKLOG.md` with the backlog as the first table, columns unchanged. sprint-brief: `30.ROADMAP.md` sprint table, `35.AD_HOC_TASKS.md` `### N.` entries under `## Open`/`## Resolved`. |

## What this does not prove

- **Nothing is audited.** The dashboard renders what the artifacts say (`ADR-0009`).
- **Cumulative flow is reconstructed.** It is built from Created and closed alone, because no schema records status transitions. Band widths are meaningful; the moment a band changed is not.
- **Cycle time includes queue time,** because it starts at Created. No schema has a start field.
- **One point per task measures cadence, not capacity.**
- **Sprint membership comes from the index,** not from the briefs. In the numbered layout that index is `tasks/TODO.md`.
- **Only what parsed is counted.** A brief with no readable status is shown in a warning box and left off the charts.

## Customizing it

Every colour is a CSS custom property, so no chart names a colour directly. There are three ways to customize, from least to most permanent:
1. The theme toggle (`t`).
2. The token editor, on the Data & theme tab. It can export a stylesheet.
3. A `dashboard.custom.css` beside the page. The page links it last.

An inline style from the editor beats the file, so use `!important` in the file if it must win. If you replace the series hues, run `scripts/validate_palette.js` and fix every `FAIL`.

The light and dark themes are each designed separately, not one inverted from the other. The chosen theme is persisted in `localStorage` and in the URL hash, because `file://` pages often cannot use `localStorage`.

## Publishing it

The local file is the dashboard until you publish it. Only the destination's own pipeline builds the published page, from a full clone of the pushed branch. Never upload a workstation build: it reflects the working tree, not what was pushed (ai-toolbox `ADR-0029`).

| Target | Rendered to | Notes |
|---|---|---|
| `github-pages` | `.github/workflows/dashboard.yml` | Deploys with `actions/deploy-pages`. Needs admin on the token, or Pages enabled once in Settings. |
| `github-pages-daily` | `.github/workflows/dashboard-daily.yml` | Dispatches `github-pages` daily and waits for it. Requires `github-pages`. See below. |
| `gitlab-pages` | `.gitlab/ci/dashboard-pages.yml` | The `pages` job publishes `public/`. Needs Pages enabled and a runner, with git, bash and python3 if it uses a shell executor. |

1. **Declare** the targets in `dashboard-publish.conf` at the repository root:
   ```
   targets   = github-pages github-pages-daily gitlab-pages
   skill_dir = skills/project-workflow     # must be inside the repository
   branch    = main
   root      = .ai                         # optional
   expect_shape = sprint_brief             # optional: sprint_brief | numbered_task
   status.github-pages       = UNVERIFIED - never run
   status.github-pages-daily = UNVERIFIED - never run
   status.gitlab-pages       = UNVERIFIED - never run
   ```
   Change a `status.` line only after watching a run succeed, and name that run.
2. **Render:** run `bash skills/project-workflow/scripts/publish-dashboard.sh render` and commit what it writes.
3. **Gate:** add `publish-dashboard.sh render --check` to the project's checks. It exits 1 on any stale, missing or orphaned file.

**The renderer refuses:**
- a `skill_dir` outside the repository, since a runner clones nothing else
- overwriting a CI file it did not generate (pass `--adopt` once to do it deliberately)
- editing an existing `.gitlab-ci.yml`. Add `include: - local: .gitlab/ci/dashboard-pages.yml` yourself.

**Each pipeline runs `publish-dashboard.sh guard`,** which refuses to publish when:
- the clone is shallow (GitLab clones 20 commits by default)
- there is one commit or fewer
- no brief parsed
- git was unavailable
- the shape is not `expect_shape`
- a field the guard reads is missing from the model

The model JSON is never published.

**The daily rebuild.** The page is dated by its build day. GitHub disables a schedule after 60 days without repository activity; re-enable it with `gh workflow enable dashboard-daily.yml`. Scheduled runs start late: ai-toolbox's 00:23 UTC runs start 5 to 6 hours late, which still lands on the same day. The skill ships no GitLab schedule, because a schedule there is a project setting.

## Both corpus layouts

| | sprint-brief | numbered-task |
|---|---|---|
| Status words | `not started`, `in progress`, `blocked`, `completed` | the same, plus `planned`, `ready`, `review`, `cancelled` |
| Criteria | none as checkboxes (`## Verification`) | `## Acceptance criteria` |
| Sprint | the filename | `tasks/TODO.md` headings |
| Backlog | `35.AD_HOC_TASKS.md` | `planning/BACKLOG.md` |
| Dependencies | `**Depends on**:` | not recorded |

The detected layout is recorded as `project.corpus_shape`. Both layouts fill the same payload keys; a key with no data is an empty array, never absent.
