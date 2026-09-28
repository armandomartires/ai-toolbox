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
| `--root` | the governance directory. Default `.ai`. Either framework's layout is **detected**; neither is assumed |
| `--repo` | repository root, for git provenance. Default: `--root`'s parent |
| `--out` | output path. Default `dashboard.html` |
| `--project` | display name. Default: the repo directory's name |
| `--theme` | initial theme: `auto` (default), `light`, `dark` |
| `--css FILE` | a stylesheet **inlined** after the base one. Repeatable; the output stays one portable file |
| `--css-href URL` | a stylesheet **linked** instead — editable without regenerating, at the cost of self-containment |
| `--json PATH` | also write the underlying model, so the same numbers are available to anything else |
| `--no-git` | do not shell out to git (see *Where a date comes from*) |

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

| Tab | What it answers |
|---|---|
| **Overview** | Are we delivering? One hero figure, eight tiles, the release burn-up, velocity, throughput, ageing work |
| **Burn charts** | Burn-up (scope vs completed), burn-down with a trend projection, cumulative flow, work in progress |
| **Sprints** | A timeline of every sprint; per-sprint burn-down against an ideal line, and per-sprint burn-up; committed vs delivered; work run outside any sprint |
| **Flow** | Cycle time scatter with percentiles, lead-time distribution, ageing WIP, tasks closed per day |
| **Backlog** | Open items by priority × value, raised vs closed, and the full sortable table |
| **Roadmap & forecast** | Declared phases, a Monte Carlo forecast over observed throughput, and the written-down list of what is next |
| **Tasks** | Every brief, sortable, with criteria and validation counts and how its date was obtained |
| **Decisions** | ADRs accepted over time, by status, and the review checkpoints |
| **Activity** | Commit heatmap, contributors, and how many commits name a task |

Every chart has a **table view** (the `Table` button on its card, or
`Show all tables`). That is not a nicety: the light-mode palette carries a
contrast `WARN` on three slots, and a visible table is the relief that
warning requires. It is also why no value on this dashboard is reachable only
by hovering.

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

Everything visual is a CSS custom property read at draw time. **There is not
one hex value in `assets/dashboard.js`** — a missing token falls back to
`currentColor`, which is still the stylesheet's decision. That is the contract
that makes `assets/custom.css.example` a complete surface: if you find
yourself editing JavaScript to change a colour, the token is missing and that
is a bug in the base sheet.

```sh
build-dashboard.sh --css my-brand.css          # inlined, stays portable
build-dashboard.sh --css-href ./my-brand.css   # linked, live-editable
```

Both are applied after the base sheet, so any token you set wins. Start from
`assets/custom.css.example`, which documents every token with its role.

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

## Both frameworks

| | `project-workflow` | `project-migration` |
|---|---|---|
| Task id | `S###.T###_Name` | `TASK-####` |
| Status | `**Status**:` in the preamble | `- Status:` under `## Status` |
| Started | *not recorded by the schema* | `## Execution log` → first `- Date:` |
| Criteria | *no checkbox list — `## Verification` instead* | `## Acceptance criteria` |
| Sprint | `**Sprint**:` on the brief | `tasks/TODO.md` headings |
| Plan | `20.PLAN.md`, `30.ROADMAP.md` | `planning/SPRINT-CURRENT.md`, `planning/ROADMAP.md` |
| Backlog | `35.AD_HOC_TASKS.md` entries | `planning/BACKLOG.md` table |

A card whose data the layout does not record says which schema difference
caused it, rather than showing an empty chart — "No brief in this layout
records acceptance criteria as checkboxes" is not the same statement as "no
data", and a reader deserves the first one.

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
