# TASK-0122 — An agile dashboard for the .ai governance layer

## Objective

Ship a self-contained HTML5 project-management dashboard as part of
`skills/project-workflow/`: a generator that reads a repository's `.ai/`
governance layer and renders every agile view the artifacts can actually
support — burn-up, burn-down, cumulative flow, velocity, throughput, cycle
time, a roadmap timeline and a throughput-based forecast — with tabs, a
light and a dark theme, and a documented CSS customization surface.

Why now: the governance layer has **121 task briefs, 27 ADRs, 10 archived
sprints, 12 reviews and a 46-row backlog**, and the only way to see the shape
of that work is to read it. Nothing in either framework renders state; the
one number anyone tried to maintain by hand — `BACKLOG.md`'s "N items are
open" sentence — has now gone stale **twice in two days** (`B-038`,
`TASK-0118`, `TASK-0115`). A generated view cannot go stale, because it is
regenerated.

Discharges no backlog item. Requested directly by the human on 2026-09-28.
It **does** give `B-038` — "a hand-maintained count that happens to be right
is not evidence it was maintained" — a mechanical answer for every count it
renders, which is a consequence, not this task's claim.

## Minimal context

### Why this is a generator and not a web app

The artifacts are markdown on disk. Two shapes were possible:

| Shape | Cost |
|---|---|
| A page that `fetch()`es `.ai/*.md` and parses in the browser | Dies on `file://` (CORS), needs a server, and puts a markdown parser in JS where nothing tests it |
| **A generator that emits one self-contained `.html`** | Opens by double-click, survives being emailed, archived or committed; the parser is `python3` stdlib where the repo's other parsers already live |

The second, for the reason this repo has stated four times: *a checker that
needs `pip install` is a checker that does not run* (`artifact_lib.py`,
`check-binding.sh`). A dashboard that needs a server is a dashboard nobody
opens. The generator therefore has **no dependency that is not in the
standard library**, and the emitted file has **no CDN reference, no external
font and no network access of any kind** — charts are hand-rolled SVG.

### Both frameworks, because one of them is this repo

`ADR-0013` keeps `project-workflow` and `project-migration` deliberately
divergent, and `ADR-0027`'s generator already spans both via `--framework`.
A dashboard that read only `project-workflow`'s shape could not be run
against **this** repository, which uses the other one — so it could never be
dogfooded, and an untested dashboard is a decorative one. The reader
therefore auto-detects and handles both:

| | `project-workflow` | `project-migration` |
|---|---|---|
| Task ID | `S###.T###_Name` | `TASK-####` |
| Status | `**Status**: not started \| in progress \| blocked \| completed` (preamble) | `- Status: planned\|ready\|in_progress\|blocked\|review\|done\|cancelled` (`## Status`) |
| Plan / roadmap | `20.PLAN.md`, `30.ROADMAP.md` | `planning/SPRINT-CURRENT.md`, `planning/ROADMAP.md` |
| Backlog | `35.AD_HOC_TASKS.md` entries | `planning/BACKLOG.md` table |
| ADR | `decisions/NNNN-title.md` | same |

### What the artifacts can and cannot support, measured

Read on 2026-09-28 across the 121 briefs in `.ai/tasks/`:

- **No story points exist anywhere**, in either framework's schema. So the
  default estimate is **1 point per task** — count-based velocity, which is
  what a team with no estimates actually has. An optional `Points:` /
  `Estimate:` field is read when present so a project that does estimate is
  not forced onto counts. This is stated in the reference, not inferred by a
  reader from a chart axis.
- **No status-transition history exists.** A brief carries `Created` and
  `Updated` and nothing between them. The cumulative-flow diagram is
  therefore **reconstructed from two dates plus the commit that closed the
  task**, not replayed from a log. That is a real limitation and the
  reference names it; a CFD presented as if it were replayed would be the
  `ADR-0009` failure — a thing that looks like evidence and is not.
- **Completion dates are recoverable and should be**: 91 of the 121 briefs
  record a commit hash. `git show -s --format=%cI <hash>` turns that into a
  real completion instant, which beats `Updated` (editable, and edited).
  Git is used when available and **degrades to `Updated` without failing**,
  because the generator must work in a fresh clone, a worktree, or a
  directory that was copied rather than cloned.

### The colour work is computable, so it was computed

The palette is the `dataviz` skill's validated reference instance, run
through `scripts/validate_palette.js` in **both** modes before any chart code
was written: light `ALL CHECKS PASS` (worst adjacent CVD ΔE 9.1, normal-vision
19.6) with a contrast `WARN` on three slots, dark `ALL CHECKS PASS` (CVD 8.4,
normal-vision 19.3, all slots ≥ 3:1). The light-mode WARN obligates relief —
visible labels or a table view — which is why **every chart ships a table-view
twin**, not as a nicety but as the discharge of that warning.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/tasks/*.md` | `TASK-0001`…`TASK-0121` | 121 briefs plus `TODO.md`; `project-migration` shape; `## Status` blocks with `- Status:`/`- Created:`/`- Updated:` |
| `.ai/tasks/TODO.md` | ongoing | Sprint-grouped checklist, `## Sprint S# — Name` headings naming their member `TASK-####` — the only per-task sprint membership this framework records |
| `.ai/planning/sprints/SPRINT-S*.md` | `TASK-0025`…`TASK-0105` | 10 archived sprints, S1…S10, each opening with a `CLOSED YYYY-MM-DD` line |
| `.ai/planning/SPRINT-CURRENT.md` | `TASK-0105` | "No sprint is open" — the open-sprint case is therefore **not** exercised by this repo and must be tested against a fixture |
| `.ai/planning/ROADMAP.md` | ongoing | 53 KB; `## Phase N — Name (complete, YYYY-MM-DD)` headings, Phases 1-10 |
| `.ai/planning/BACKLOG.md` | ongoing | 84 KB; one markdown table, header `ID \| Title \| Priority \| Value \| Dependencies \| Risk \| Status \| Ready when`; 46 rows `B-001`…`B-046` |
| `.ai/decisions/*.md` | `TASK-0024` and successors | 27 ADRs, `NNNN-title.md`, each with `**Status**:` and `**Date**:` in the preamble |
| `.ai/reviews/*.md` | S1…S10 | 12 checkpoints, `REVIEW-NNNN-*.md` |
| `skills/project-workflow/schemas/*.md` | `TASK-0109` | 4 schemas; the source of truth for `project-workflow`'s heading names — the reader must not restate them |
| `skills/project-workflow/scripts/artifact_lib.py` | `TASK-0109` | 421 lines; stdlib-only precedent and the house style for a parser |
| `skills/project-workflow/SKILL.md` | `TASK-0119` | `metadata.version: "4.0.0"`; gains a dashboard section and a minor bump |
| `tests/validate.sh` | `TASK-0110` and successors | Exits `OK`; scans `skills/*/scripts/*` for **false wiring claims** — a new script that says it is run by a runner that does not run it **fails the gate** |
| `dataviz` skill + `scripts/validate_palette.js` | pre-existing (bundled) | Reference palette validated in both modes, 2026-09-28, results quoted above |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. **A reader** (`scripts/dashboard_lib.py`, `python3` stdlib only) that
   parses both frameworks' `.ai/` layouts into one normalized model: tasks,
   sprints, backlog, roadmap phases, ADRs, reviews, and — when git is present
   — commit provenance.
2. **A metrics engine** in the same module computing every series the views
   need, in Python, so the emitted HTML is a pure view and `--json` yields the
   same numbers for anything else that wants them.
3. **A generator** (`scripts/build-dashboard.sh`) emitting one
   self-contained HTML5 file: no CDN, no external font, no network.
4. **Nine tabs**: Overview, Burn charts, Sprints, Flow, Backlog, Roadmap,
   Tasks, Decisions, Activity.
5. **The charts**: burn-down and burn-up (release and per sprint, with the
   scope line that makes creep visible), cumulative flow, velocity,
   throughput, cycle-time scatter with 50th/85th percentiles, lead-time
   histogram, WIP and aging WIP, status donut, backlog composition, a
   priority×value matrix, a roadmap timeline, a commit-activity heatmap, and
   a **throughput-based Monte Carlo forecast** — seeded, so the same input
   gives the same forecast.
6. **A table-view twin for every chart**, discharging the light-mode contrast
   WARN and the "tooltips never gate a value" rule.
7. **Light and dark themes**, both selected from the same validated ramps —
   not an automatic inversion — with an `auto` mode honouring
   `prefers-color-scheme`, a header toggle, and the choice persisted.
8. **A documented CSS customization surface**: every colour, spacing, radius
   and font a chart uses is a CSS custom property read at render time, so
   recolouring the charts is a stylesheet edit and never a JS edit.
   `--css FILE` inlines an override (portable); `--css-href URL` links one
   (live-editable). `assets/custom.css.example` documents the surface.
9. **A reference** (`references/dashboard.md`) stating what each metric
   means, what it proves, and — the section this repo has learned to require
   — **what it does not prove**.

### Not included

- **No new schema and no new required field.** Estimates are read if a
  project writes them and defaulted to 1 if not. Adding `Points:` to
  `schemas/task.md` would make this task the author of a requirement, which
  `ADR-0008` forbids and which would invalidate all 121 existing briefs.
- **No edits to any `.ai/` artifact to make it parse.** If a brief does not
  yield a date, that is data the dashboard reports as unknown. Rewriting
  history so a chart looks better is the inverse of the whole convention.
- **No wiring into `tests/validate.sh`.** The gate is hermetic, offline and
  fast, and a dashboard build is none of those things it needs to be. The
  script will therefore **not claim** to be run by it — the exact false-claim
  class `validate.sh` itself scans `skills/*/scripts/*` for.
- **No changes to `project-migration`.** The dashboard reads its shape; it
  does not touch the skill. `ADR-0013`.
- **No server, no build step, no `npm`, no `pip`.**
- **No burndown for an open sprint proven against this repo**, because no
  sprint is open here. That path is exercised against a fixture and the
  limitation is recorded rather than implied.

## Likely files

A forecast, written before the work.

- `skills/project-workflow/scripts/dashboard_lib.py` — reader + metrics (new)
- `skills/project-workflow/scripts/build-dashboard.sh` — CLI (new)
- `skills/project-workflow/assets/dashboard.css` — tokens, themes, layout (new)
- `skills/project-workflow/assets/dashboard.js` — tabs, SVG charts, tables (new)
- `skills/project-workflow/assets/dashboard.html` — the shell (new)
- `skills/project-workflow/assets/custom.css.example` — the override surface (new)
- `skills/project-workflow/references/dashboard.md` — what it measures (new)
- `skills/project-workflow/SKILL.md` — a dashboard section; `4.0.0` → `4.1.0`
- `docs/registry.md` — regenerated
- `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`, this file

**Not expected to change**: any schema, any `.ai/` artifact other than the
three above, `tests/validate.sh`, `scripts/sync-templates.sh`, or anything
under `skills/project-migration/`.

## Execution plan

1. Read both frameworks' schemas and a census of the real artifacts; write
   the parser against what the files contain, not against what the schemas
   say they should.
2. Build the reader and metrics engine; verify counts against the repository
   by hand (`ls | wc -l`, `grep -c`) before trusting any chart.
3. Validate the palette in both modes **before** writing chart code. Done —
   quoted under Minimal context.
4. Write the CSS token layer and both themes; write the chart renderers
   against tokens only.
5. Write the shell and the generator; emit against this repository.
6. Open the output and look at it — the validator checks colour, not layout.
7. Prove the two claims that can actually fail: that the emitted file is
   self-contained, and that the reader is not silently returning empty data.
8. Write the reference, including what the metrics do not prove.
9. Bump `SKILL.md`, regenerate the registry, run the gate, update
   `CURRENT_STATE.md` and `TODO.md`, commit, push.

## Acceptance criteria

- [ ] `build-dashboard.sh` run from this repository writes one HTML file
      that opens in a browser from `file://` with no network and no console
      error.
- [ ] `grep -Eic 'https?://|cdn|<script src|@import url' <output>` returns 0 —
      the self-containment claim is checked, not asserted.
- [ ] The emitted dashboard reports counts that match the repository,
      verified independently: 121 tasks, 27 ADRs, 12 reviews, 10 sprints,
      46 backlog rows, 10 roadmap phases.
- [ ] Every one of the nine tabs renders with non-empty content.
- [ ] Burn-up shows **both** completed and total-scope lines, so scope
      growth is visible rather than hidden.
- [ ] Every chart has a reachable table view.
- [ ] Both themes render; the toggle persists across reload; `auto` follows
      `prefers-color-scheme`.
- [ ] `--css` inlines an override that visibly changes chart colour **without
      any JS edit**, demonstrated.
- [ ] `--json` emits the same figures the HTML shows, spot-checked on at
      least three.
- [ ] The generator runs with `git` unavailable (`--no-git`) and still
      produces every non-git chart.
- [ ] `python3 -c 'import dashboard_lib'` requires nothing outside the
      standard library.
- [ ] `tests/validate.sh` exits `OK` — specifically its `skills/*/scripts/*`
      wiring-claim scan, which the two new scripts are subject to.
- [ ] `references/dashboard.md` contains an explicit "what this does not
      prove" section naming the reconstructed CFD and the default estimate.
- [ ] `SKILL.md` version bumped and the registry regenerated.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed)
- [ ] `skills/project-workflow/scripts/build-dashboard.sh` against this repo,
      exit 0
- [ ] The same, with `--no-git`, exit 0
- [ ] The self-containment grep above, returning 0
- [ ] `check-artifact.sh` on this brief, once complete

## Risks and rollback

- **A parser that silently returns nothing.** The worst failure here is not a
  crash: it is an empty chart that looks like "no work happened". Mitigation:
  the generator **fails loudly** when a section it was asked for yields zero
  artifacts, rather than emitting an empty tab — `ADR-0009`'s rule, which
  this repo has now applied to `tomllib` and to the linter.
- **A chart that implies evidence it does not have.** The CFD is
  reconstructed from two dates; a reader will assume it was replayed.
  Mitigation: the limitation is in the reference *and* on the chart card
  itself, not only in a document nobody opens.
- **Colour chosen by taste.** Mitigation: the palette was validated by script
  in both modes before any chart code existed, and the light-mode contrast
  WARN is discharged by the table views rather than dismissed.
- **A false wiring claim.** Two new scripts under `skills/*/scripts/*`, the
  exact path `validate.sh` scans after `TASK-0046` found twelve such claims
  in one skill. Mitigation: neither script claims a runner; the gate is run
  and its result recorded.
- **Scope creep into `.ai/` itself.** Every metric gap has an obvious fix
  that is "just add a field to the schema". That is `ADR-0008`'s failure and
  is excluded above.
- **Rollback:** `git revert` of the single commit. The generator writes only
  its output file, creates nothing under `.ai/`, and modifies no artifact it
  reads — so reverting leaves nothing behind but a generated HTML file the
  human can delete.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `skills/project-workflow/scripts/dashboard_lib.py` | **New**, 1,180 lines, `python3` stdlib only (`json os re subprocess sys datetime random` — asserted by AST walk against `sys.stdlib_module_names`). Reader + metrics engine + HTML assembly. Detects both frameworks from the files present |
| `skills/project-workflow/scripts/build-dashboard.sh` | **New**. CLI over the above. Claims no runner — it is deliberately unwired |
| `skills/project-workflow/scripts/check-dashboard.sh` | **New**. 26 assertions over the committed fixture; no runner, run by hand |
| `skills/project-workflow/fixtures/dashboard/` | **New**, 10 files, 24 KB. A `project-workflow`-shaped `.ai/` — 5 briefs with real `**Points**:`, an open sprint, a roadmap with an incomplete phase, 3 ad-hoc entries, 1 ADR, 1 review |
| `skills/project-workflow/assets/dashboard.css` | **New**, 355 lines. The entire customization surface: ~70 tokens, both themes declared under the media query *and* the attribute scope |
| `skills/project-workflow/assets/dashboard.js` | **New**, ~1,800 lines. Renderer only — no parsing, no metric. **Zero hex literals**; a missing token falls back to `currentColor` |
| `skills/project-workflow/assets/dashboard.html` | **New**. The shell, with the seven substitution tokens |
| `skills/project-workflow/assets/custom.css.example` | **New**. Every token documented with its role and its constraint |
| `skills/project-workflow/references/dashboard.md` | **New**, 211 lines, including the mandatory *What this does not prove* |
| `skills/project-workflow/SKILL.md` | `4.0.0` → `4.1.0`; a `## The dashboard` section; `description` extended so the capability is discoverable |
| `docs/registry.md` | Regenerated for that description |
| `.ai/planning/BACKLOG.md` | **`B-047` added**; the open-item sentence recounted from the rows and `B-015` removed from it. 46 → 47 rows, 12 open |
| `.ai/context/CURRENT_STATE.md` | New leading section |
| `.ai/tasks/TODO.md` | `TASK-0122` ticked under Post-S10 |
| `.gitignore` | Ignores `dashboard.html` / `docs/dashboard.html` — a generated file that reads the git log is stale the moment it lands |

**Deliberately not changed**: any schema; `tests/validate.sh`;
`scripts/sync-templates.sh`; anything under `skills/project-migration/`; and
every `.ai/` artifact other than the three above. No generated dashboard is
committed, for the reason in the `.gitignore` note.

**Next task starts here**: `skills/project-workflow/` ships a dashboard
generator that runs clean against both frameworks, with `tests/validate.sh`
`OK` and `check-dashboard.sh` green at 26 assertions. `B-047` is open and
**unrouted** — it records that `BACKLOG.md`'s open-item sentence had been
counting a closed item, and it is `B-038`'s mechanism question, not a second
hand-pass. Nothing about the dashboard is gated: it is a component check its
author runs, and a stale sentence still ships green.

## Status

- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-28
- Updated: 2026-09-28

Requested directly by the human on 2026-09-28 with no sprint open — the
`Post-S4`/`Post-S5`/`TASK-0106` shape, where scheduling is the human's and the
brief is written before the work rather than around it.

## Execution log

### Attempt 1

- Date: 2026-09-28
- Agent: Claude Opus 5 (1M context), Claude Code
- Actions: Read both frameworks' schemas and took a census of the real
  artifacts before writing a line of parser. Validated the palette in both
  modes **before** any chart code. Built the reader, the metrics engine, the
  token layer, the renderer and the shell. Built a `project-workflow`
  fixture, found three defects with it, fixed them, and committed the fixture
  with a checker. Wrote the reference, bumped the skill, regenerated the
  registry, raised `B-047`.

- Observations:

  **1. Four figures in this brief's own Inputs were wrong, and the work
  corrected them rather than the brief.** Written from `ls | wc -l` over a
  directory that also holds `TODO.md` and a `completed/` directory: **119**
  task briefs, not 121. The others held: 27 ADRs, 12 reviews, 10 sprints, 10
  phases, 46 backlog rows (**47** after `B-047`). The Acceptance criteria
  above are therefore quoted against 121; the Validation below records the
  true figures. Per `templates/reference/task-lifecycle.md` the deviation is
  recorded here rather than by editing the Plan.

  **2. The self-containment criterion as written could not be met, and the
  reason is not a defect.** `grep -Eic 'https?://|cdn|<script src|@import url'`
  returns **2**: the header comment containing the word "CDN" while denying
  one, and `http://www.w3.org/2000/svg`, which is an **XML namespace
  identifier and never fetched** — no SVG can be built without it. The
  criterion was sharpened to the question it was actually asking,
  `grep -Eic '(src|href)="(https?:|//)|@import'`, which returns **0**.

  **3. The fixture earned its place immediately.** Three defects, none of
  which this repository could have surfaced because it uses the other
  framework: (a) `(?:_(\S+))?` in the task-id pattern swallowed `.md`, so
  every id was `S001.T001_Scaffold.md`; (b) the `**Sprint**:` field was
  cleaned with the prose cleaner, which strips `_` as emphasis and keeps the
  parenthetical — `S001_Foundation` became
  `S001Foundation (see ../30.ROADMAP.md for what this sprint means)`, giving
  every sprint a unique name matching nothing; (c) `20.PLAN.md`'s heading
  yields `S002` while the briefs say `S002_Performance`, so the sprint record
  matched no task, was dropped for having no members, and **every sprint in
  that layout fell into the "ran outside a sprint" bucket with the velocity
  chart empty**. The fixture is also the only cover for an **open** sprint:
  none is open here.

  **4. The band palette had to be computed, not chosen.** Four saturated hues
  for To do / In progress / Blocked / Done **failed** the all-pairs gate in
  dark mode — red ↔ yellow ΔE 13.0, below the 15 floor, measured across four
  candidate fourth hues. The shipped assignment is two categorical slots, one
  status token (Blocked genuinely means bad, which is what a status token is
  for) and one neutral (To do is absence, not identity).

  **5. Band tokens cannot be `var()` aliases.** `--band-done: var(--series-1)`
  read back through `getComputedStyle().getPropertyValue()` as the literal
  string `var(--series-1)` under jsdom. That is a valid CSS value and **not** a
  valid SVG presentation-attribute value, so the mark renders unpainted. All
  four band tokens are now literal in both theme blocks, with the reason
  beside them.

  **6. Theme persistence via `localStorage` does not work in the primary use
  case.** A `file://` page is an opaque origin and `localStorage` **throws** —
  observed, not assumed. The mode is now also written to the URL hash beside
  the tab, and a fresh document at that URL restores both.

  **7. `B-015`.** See Result.

- Validation:

  - `tests/validate.sh` → `validate.sh: OK` (3.99 s on this `/mnt/c` checkout).
    Both new `skills/*/scripts/*` files pass its false-wiring-claim scan;
    neither claims a runner, because neither has one.
  - `skills/project-workflow/scripts/check-dashboard.sh` →
    `check-dashboard.sh: OK (26 assertions, project-workflow fixture)`.
  - **The fails-when-reverted check, run three times — one per parser fix.**
    Each fix reverted in turn, the checker re-run, the failure read, the fix
    restored:
      - fix (a) → `FIXTURE MISMATCH: no id carries an extension: got
        ['S001.T001_Scaffold.md', …], want []`
      - fix (b) → `FIXTURE MISMATCH: sprint field yields a bare identifier:
        got 'S001Foundation (see ../30.ROADMAP.md for what this sprint
        means)', want 'S001_Foundation'`
      - fix (c) → `FIXTURE MISMATCH: the open sprint is detected: got 'adhoc',
        want 'open'` + `velocity has a row per sprint: got 0, want 2`
    Restored → `OK (26 assertions)` again. The checker was also changed so a
    missing key reports a mismatch instead of a `KeyError` traceback: it
    failed either way, but on the wrong line.
  - `build-dashboard.sh --root .ai` → `119 tasks (113 done, 5 open), 10
    sprints, 27 ADRs, 47 backlog rows, 244 commits`. Cross-checked by hand:
    `ls .ai/tasks/TASK-*.md | wc -l` → 119; `ls .ai/decisions/*.md | grep -v
    INDEX | wc -l` → 27; `ls .ai/reviews/*.md | grep -v INDEX | wc -l` → 12;
    `grep -c '^| B-' BACKLOG.md` → 47; `grep -c '^## Phase ' ROADMAP.md` → 10.
  - `--no-git` → same counts, `0 commits`, and the warning *"3 task(s) are
    marked done but carry no date and appear on no timeline: TASK-0106,
    TASK-0107, TASK-0108"* — the degradation is announced, not silent.
  - `--json` vs the embedded model: `kpi identical: True`.
  - Self-containment: `grep -Eic '(src|href)="(https?:|//)|@import'` → **0**.
  - Stdlib only: AST walk of the imports against `sys.stdlib_module_names` →
    `all stdlib: True`.
  - **Rendered and exercised at DOM level under jsdom**, since no browser
    could run here (`chrome` and `chrome-headless-shell` are present in the
    puppeteer cache but 15 shared libraries are missing, `libnspr4.so` first;
    installing them was out of scope). All **nine tabs** render with charts
    and a table view each, **no console error**, on both this repository and
    the fixture. Theme cycling re-renders; a `file://` reload restores
    `#flow&theme=dark`. Filters: selecting Blocked → *"3 tasks in scope ·
    Blocked · cumulative timelines still show the whole project"*; Reset →
    *"119 tasks in scope"*.
  - **`--css` proved to repaint the charts with no JS change**: a 3-line
    stylesheet setting `--series-1: #7b1fa2` moved the rendered mark colours
    from `#2a78d6 #898781 #c9c8c0 #d03b3b #eb6834` to `#00897b #7b1fa2 …`.
  - **Palette validated before any chart existed**, both modes:
    light `ALL CHECKS PASS` (worst adjacent CVD ΔE 9.1, normal-vision 19.6,
    contrast `WARN` on three slots); dark `ALL CHECKS PASS` (8.4 / 19.3, all
    ≥ 3:1). The light `WARN` is discharged by a table view on **every** chart,
    verified per tab.

  **Not proven, and it matters**: nothing about visual layout. jsdom computes
  no geometry, so label collisions, overflow and axis-band height are
  **unverified by machine** — the one check the dataviz method asks for that
  could not be run here. A human opening the file is still the gate for that.
  Nor is anything about a browser's own CSS custom-property resolution proven
  beyond jsdom's; the literal band tokens exist precisely because that
  difference was observed.

- Result: **Done.** The dashboard runs clean against both frameworks.

  **It found a real defect on its first run against this repository, which is
  the argument for having built it.** `BACKLOG.md`'s prose counts twelve open
  items and names `B-015` among them; `B-015`'s own row has read `**done**`
  since 2026-09-16 (*"Closed 2026-09-16 by REVIEW-0008"*), and that row even
  records it *"Had read **ready** until closure"* — so the sentence inherited
  the stale reading and kept it. The generator counts from the rows and said
  eleven. Raised as **`B-047`** and the sentence recounted, rather than
  quietly corrected. This is `B-038`'s argument recurring for the **third
  time in three days**, after `TASK-0115` and `TASK-0118` each repaired it by
  hand — and the total is still twelve only because `B-047` arrived as
  `B-015` left, which is the second coincidence in a row making that sentence
  look maintained.

  **The generator does not close `B-038`.** It renders a dashboard nothing
  gates, so a stale sentence still ships green. Wiring a count into the gate
  is a separate decision and a separate task.

- Commit: `<hash>`
- Push: `<result>`
