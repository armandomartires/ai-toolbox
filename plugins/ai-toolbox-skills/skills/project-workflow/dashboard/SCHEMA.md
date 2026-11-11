# `.ai/dashboard/` — the contract

Three contracts live here, and nothing outside this file may redefine them:

1. **The data contract** — the exact shape of `dashboard-data.json`, emitted by
   `.ai/scripts/pm_dashboard.py` and consumed by every JS module.
2. **The DOM contract** — the tab ids and mount-point ids in `template.html`.
3. **The module contract** — how the concatenated `js/` files register
   themselves on the single `PM` global, and which CSS custom properties they
   are allowed to depend on.

They exist because the generator and the front end are written separately. A
field renamed on one side and not the other is the failure mode this file
prevents; if you change a name, change it here first.

---

## 0. Why the data looks the way it does

The corpus this dashboard reads — `.ai/workflow/` — was never designed as a
project-management database. Three consequences shape every schema decision
below, and all three are surfaced in the UI rather than hidden:

- **There are no estimates.** No brief carries story points; no sprint carries
  a commitment. So the primary unit is a **task count**, and every metric that
  would conventionally be expressed in points is expressed in tasks. Points are
  supported (`**Points**:` in a brief header) and used automatically when
  present, but `units.points_coverage` always states what fraction of the
  corpus actually has them, and the UI must never present a points figure as
  whole-corpus when coverage is partial.
- **Dates are derived, not recorded.** A brief has no created/closed field. The
  collector resolves both from four different sources in precedence order and
  **records which one it used**, per task. Any chart plotting a task over time
  must be able to say where that date came from.
- **Git history has a floor.** This repo's git history begins at a
  post-migration baseline commit (`provenance.git_baseline`); work that
  happened before it has no git date at all. A git-derived date equal to the
  baseline is therefore *not evidence the work happened that day* — it is
  marked `floored: true` and the UI must render it as approximate.

A dashboard that smoothed these over would be confidently wrong. The rule
throughout: **an unknown is displayed as unknown.**

---

## 1. Data contract — `dashboard-data.json`

`schema_version` is `2`. A consumer finding a different major version must say
so rather than render a guess.

**What changed in v2** (`S028.T001`, [[.ai/workflow/decisions/0029-one-dashboard-shipped-by-the-skill|ADR-0029]]):
the generator now reads **two corpus layouts**, so the payload gained the two
artifact families the second one has — `backlog[]` and `phases[]` — plus
`project.corpus_shape` naming which layout was read. Tasks gained `owner`,
`criteria`, `validations` and `sprint_source`; `state` gained `cancelled`; and
three `DateRef` sources were added for the way that layout records dates.

### 1.1 Envelope

```jsonc
{
  "schema_version": 2,
  "generated_at": "2026-09-28T21:04:11Z",   // UTC ISO-8601, second precision
  "generator": { "name": "pm_dashboard.py", "version": "2.0.0" },
  "project": {
    "name": "sigma",                 // repo directory name
    "workflow_dir": ".ai/workflow",  // root-relative; the corpus that was read
    "corpus_shape": "sprint_brief",  // "sprint_brief" | "numbered_task" — detected, never assumed
    "today": "2026-09-28",           // local date the run happened; `as_of` for every metric
    "git_available": true
  },
  "units": { /* §1.3 */ },
  "tasks":     [ /* §1.4 */ ],
  "sprints":   [ /* §1.5 */ ],
  "adhoc":     [ /* §1.6 */ ],
  "backlog":   [ /* §1.11 */ ],
  "phases":    [ /* §1.12 */ ],
  "decisions": [ /* §1.7 */ ],
  "reviews":   [ /* §1.8 */ ],
  "log":       [ /* §1.9 */ ],
  "commits":   [ /* §1.10 */ ],
  "metrics":   { /* §2 */ },
  "provenance":{ /* §3 */ },
  "defects":   [ "S0xx.T0yy: ...", ... ],  // conformance defects — these GATE
  "advisories":[ "ad-hoc item 6 is ...", ... ]  // findings — these do NOT gate
}
```

**Both layouts fill the same keys.** `backlog[]` comes from a `BACKLOG.md` table
where one exists and from the ad-hoc list where it does not, so a consumer never
has to ask which corpus it is reading; `phases[]` is empty for a layout that has
no roadmap phases. A key that a corpus genuinely has nothing for is an empty
array, never absent.

Every date is a `YYYY-MM-DD` string or `null`. Never a timestamp, never a
locale format. `null` means "not known", and is always distinguishable from
zero.

**`defects` vs `advisories`.** Both are arrays of human sentences and both are
rendered in the Debt & risk tab, but they answer different questions and only
one of them gates. A **defect** is a conformance failure that makes the
dashboard's own input untrustworthy — an unreadable `**Status**`, a dependency
on a brief that does not exist, a payload that fails this schema — and
`pm_dashboard.py --check` exits non-zero on any of them. An **advisory** is a
real finding about the corpus that this tool cannot act on, such as a resolved
ad-hoc item whose resolution the audit log never recorded; it is reported and
never gates. The split exists because a gate that goes red over something the
reader cannot fix from there is a gate people learn to skip, which is the exact
failure mode `35.AD_HOC_TASKS.md` item 32 describes.

### 1.2 The `DateRef` convention

Any derived date `X` appears as three sibling keys:

| Key | Type | Meaning |
|---|---|---|
| `X` | `"YYYY-MM-DD"` \| `null` | the resolved date |
| `X_source` | see below | which source produced it |
| `X_floored` | `bool` | the value is a lower bound, not an observation |

`X_source` is exactly one of:

| Value | Meaning | Trust |
|---|---|---|
| `"header_date"` | an explicit `**Date**:` header field (ADRs and reviews carry one) | highest — hand-recorded, purpose-built |
| `"status_line"` | an explicit `(YYYY-MM-DD)` in the brief's `**Status**` line | highest — hand-recorded |
| `"log_md"` | a dated `6.LLMWIKI/log.md` entry naming this task id | high — hand-recorded, audit trail |
| `"filename"` | a `YYYY-MM-DD-*.md` filename (some reviews use this form) | high — hand-chosen |
| `"body_found_during"` | the date in an ad-hoc item's own `**Found during**:` line | high — hand-recorded |
| `"git_added"` | first commit that added the file (`--diff-filter=A`) | good, unless floored |
| `"git_last"` | most recent commit touching the file | good, unless floored |
| `"roadmap_sprint"` | the task's sprint date range in `30.ROADMAP.md` | approximate — sprint granularity |
| `"file_mtime"` | filesystem mtime, last resort when git is unavailable | weak |
| `"unknown"` | nothing resolved; `X` is `null` | none |

Three more exist for the numbered-task layout, which records its dates
differently (added in v2):

| Value | Meaning | Trust |
|---|---|---|
| `"created_field"` | the brief's own `- Created:` line | highest — hand-recorded, purpose-built |
| `"commit_hash"` | the date of a commit the brief itself names | highest — a fact about history, not a field someone remembered to update |
| `"updated_field"` | the brief's own `- Updated:` line | moderate — editable, and edited for reasons other than closure |

Note the ordering this implies, which differs from the sprint-brief layout's on
purpose: there, git outranks everything because the layout records no created
date at all, so the commit that added the brief is the best available evidence.
Here the author is asked to record it, and a hand-recorded date beats an
inferred one. `updated_field` ranks *below* both commit sources for the opposite
reason — it is the field the retired tool fell back to for everything, and it
moves whenever anyone touches the file.

### 1.3 `units`

```jsonc
"units": {
  "primary": "tasks",          // "tasks" | "points" — what the headline numbers count
  "points_available": false,   // any task carries an explicit **Points**
  "points_coverage": 0.0,      // 0.0–1.0 fraction of tasks with explicit points
  "points_total": null,        // sum over tasks with points, else null
  "size_proxy_note": "Size buckets are a proxy derived from brief length, not an estimate."
}
```

`primary` is `"points"` only when `points_coverage == 1.0`. Partial coverage
stays `"tasks"` — mixing a counted task with an estimated one produces a number
that means nothing.

### 1.4 `tasks[]`

One entry per brief, whichever layout produced it. `state` is authoritative and
`workflow_state` is the finer board column derived from the same status text.
In this vault `state` comes from `task_queue.py`; in a vendored copy, which has
no such module, it comes from the same shared classifier that module itself
calls (`pm_briefs.classify_status`), so the two cannot disagree.

```jsonc
{
  "id": "S015.T009",
  "sprint_id": "S015",
  "sprint": "Gemma12BReliability",
  "name": "CoverThreeModes",
  "title": "Cover Three Modes",        // name de-camel-cased for display
  "path": ".ai/workflow/tasks/S015_Gemma12BReliability.T009_CoverThreeModes.md",

  "state": "done",                     // "done" | "pending" | "cancelled" | "unparseable"
  "workflow_state": "done",            // + "cancelled"; else "in_progress" | "blocked" | "not_started" | "unparseable"
  "status_raw": "CLOSED (2026-09-24) — every Plan step done…",
  "lane": "code",                      // "code" | "model" | "operator" | "hardware"; "task" where the layout has no lanes

  "owner": null,                       // v2: "- Owner:" where recorded, else null — never a default
  "criteria": { "total": 0, "checked": 0 },     // v2: "## Acceptance criteria" checkboxes
  "validations": { "total": 0, "checked": 0 },  // v2: "## Mandatory validations" checkboxes
  "sprint_source": "filename",         // v2: "filename" | "todo" | "sprint_file" | "none"

  "depends_on": ["S015.T013"],         // resolved ids; always [] for the numbered layout
  "blocks": ["S015.T010"],             // reverse edges, computed here
  "prose_gates": [],                   // unresolved free-text blockers
  "blocked_by_unmet": ["S015.T013"],   // subset of depends_on not yet done

  "points": null,                      // explicit **Points**, else null
  "size_bytes": 362902,
  "size_bucket": 5,                    // 1–5 quintile across the corpus; a PROXY
  "commits": ["c32dee8"],              // 7+ hex hashes parsed from **Commits**
  "commit_count": 1,
  "goal": "First 400 chars of ## Goal, whitespace-collapsed.",
  "files_touched": 12,                 // count of bullets under ## Files touched

  "created_at": "2026-09-20",          // when this scope arrived — see §1.2
  "created_at_source": "git_added",
  "created_at_floored": false,
  "closed_at": "2026-09-24",           // null unless state == "done"
  "closed_at_source": "status_line",
  "closed_at_floored": false,

  "cycle_time_days": 4,                // closed_at - created_at; null if either null
  "age_days": null,                    // today - created_at, pending tasks only
  "defects": []
}
```

**`cancelled` is excluded from scope.** It is neither delivered nor outstanding,
so it leaves the denominator of `completion_pct` and every burn, flow, velocity
and forecast series. Counting it as done overstates delivery; counting it as
pending leaves a burn-down that can never reach zero. `metrics.totals.tasks`
still reports what is on disk, and `metrics.totals.in_scope` is what completion
is measured over — the two differ by exactly `metrics.totals.cancelled`.

**`sprint_source` distinguishes a record from an inference.** The sprint-brief
layout carries the sprint in the filename, so it is `"filename"` and certain.
The numbered layout records membership in `TODO.md` (`"todo"`); where that file
is silent, a sprint file merely *mentioning* the task is used as a fallback
(`"sprint_file"`), which is weaker — a sprint review names tasks it deferred and
depended on as well as ones it closed. A consumer presenting per-sprint figures
should be able to say which it is standing on.

### 1.5 `sprints[]`

Ordered by `id`. Every sprint that has at least one brief **or** a row in
`30.ROADMAP.md`'s sprint table appears — a planned sprint with no briefs yet is
real information, not an error.

```jsonc
{
  "id": "S015",
  "name": "Gemma12BReliability",
  "label": "S015_Gemma12BReliability",
  "theme": "Hardens the Gemma-12B-QAT qualification path end-to-end…",  // roadmap table, may be ""
  "roadmap_dates": "2026-09-08 → ongoing",   // verbatim table cell, may be ""
  "start": "2026-09-08", "start_source": "roadmap_sprint", "start_floored": false,
  "end": null,          "end_source": "unknown",         "end_floored": false,
  "ongoing": true,
  "state": "active",                   // "planned" | "active" | "closed"
  "task_ids": ["S015.T001", "…"],
  "task_count": 13, "done_count": 9, "pending_count": 4, "unparseable_count": 0,
  "points_total": null,
  "completion_pct": 69.2,
  "in_roadmap": true,                  // has a row in the sprint table
  "has_briefs": true
}
```

### 1.6 `adhoc[]`

From `35.AD_HOC_TASKS.md`. `## Open` / `## Resolved` are the two sections;
items are `### <n>. <title>` headings.

```jsonc
{
  "number": 31,
  "title": "S015.T010's first diagnostic sweep recorded 90/90 FAIL, but …",
  "state": "resolved",                 // "open" | "resolved"
  "found_at": "2026-09-27", "found_at_source": "body_found_during", "found_at_floored": false,
  "resolved_at": "2026-09-28", "resolved_at_source": "log_md", "resolved_at_floored": false,
  "age_days": 1,                       // resolved: resolved-found; open: today-found
  "size_bytes": 8421,
  "promoted_to": "S025.T001",          // task id if the body names one, else null
  "task_ids": ["S015.T010"]            // task ids mentioned in the body
}
```

`found_at_source` may additionally be `"body_found_during"` — a
`**Found during**: … (YYYY-MM-DD)` line in the item body, which is this file's
own established convention and outranks git for these items.

### 1.7 `decisions[]`

From `.ai/workflow/decisions/NNNN-slug.md`, excluding `0000-TEMPLATE.md`.

```jsonc
{
  "number": 25,
  "slug": "bounded-profile-hardware-qualification",
  "title": "Bounded-profile hardware qualification",   // H1 text, or the slug humanised
  "path": ".ai/workflow/decisions/0025-bounded-profile-hardware-qualification.md",
  "status": "accepted",                // parsed from a Status line; "unknown" if absent
  "date": "2026-09-22", "date_source": "git_added", "date_floored": false,
  "size_bytes": 7100,
  "superseded_by": null                // ADR number, if a Status/Superseded line names one
}
```

### 1.8 `reviews[]`

```jsonc
{ "id": "S011-S014-checkpoint", "title": "…", "path": "…",
  "date": "2026-09-18", "date_source": "filename", "date_floored": false,
  "size_bytes": 12000 }
```

`date_source` may be `"filename"` for the `YYYY-MM-DD-*.md` form.

### 1.9 `log[]`

From the project audit log (`6.LLMWIKI/log.md` here; `project.log_path` records
where it was found). One entry per `## [YYYY-MM-DD] type | description` line,
in file order.

```jsonc
{ "date": "2026-09-28", "type": "maintenance", "chars": 4210,
  "description": "First 300 chars…", "task_ids": ["S015.T010"] }
```

`type` is free text as written; the UI must tolerate a type it does not know
rather than dropping the entry.

### 1.10 `commits[]`

From `git log --numstat`, newest first. Empty array when
`project.git_available` is false.

```jsonc
{ "hash": "1aa6f8b", "date": "2026-09-28", "subject": "Classify unscoreable trials…",
  "author": "Armando Martires", "files": 7, "insertions": 412, "deletions": 20,
  "areas": ["scripts", "tests"],       // top-level buckets touched
  "task_ids": []                       // task ids named in the subject
}
```

`areas` values are drawn from a fixed set so they can be colour-coded:
`scripts`, `tests`, `workflow`, `docs`, `agent-config`, `wiki`, `other`.

### 1.11 `backlog[]` *(v2)*

Work that has been written down but not yet turned into a brief. Read from
`planning/BACKLOG.md`'s table where one exists, and projected from the ad-hoc
list where it does not, so **one key serves both layouts**.

```jsonc
{
  "id": "B-001",                       // "B-<n>" from a table, "A-<n>" from an ad-hoc item
  "title": "Subagent-run registry validation",
  "priority": "low",                   // "high" | "medium" | "low" | "unrated"
  "value": "medium",                   // same vocabulary
  "risk": "low",                       // same vocabulary
  "state": "done",                     // "open" | "done" | "cancelled"
  "status_raw": "done",                // the cell as written, markup stripped
  "dependencies": "Phase 3",           // free text; this is not a resolvable edge
  "note": "TASK-0018 — closed as superseded…",   // the "Ready when" cell, ≤400 chars
  "source": "backlog_table"            // "backlog_table" | "adhoc"
}
```

An ungraded cell is `"unrated"`, never a middle value: a backlog nobody has
prioritised must not be rendered as one where everything is medium. `source`
exists so a consumer can say which it is looking at — an ad-hoc list grades
nothing, so an all-`unrated` matrix from that source is expected rather than a
finding.

`dependencies` is deliberately **free text and never parsed into edges.** These
cells say things like "Phase 3", "none" and "after the linter lands"; turning
that into a dependency graph would manufacture structure the corpus does not
have.

### 1.12 `phases[]` *(v2)*

Roadmap phases, from `## Phase N — Name (complete, YYYY-MM-DD)` headings. Empty
for a layout with no such headings, which is not an error.

```jsonc
{
  "number": 1,
  "title": "Foundation",               // heading text, everything from the first "(" stripped
  "state": "done",                     // "done" if the heading says complete, else "open"
  "path": ".ai/planning/ROADMAP.md",
  "date": "2026-09-13",                // §1.2 DateRef; null when the heading carries none
  "date_source": "header_date",
  "date_floored": false
}
```

A phase with `date: null` is rendered in tables and **omitted from any
timeline**. Placing it at a guessed position on the one chart people read as a
schedule would be an invented fact.

---

## 2. `metrics`

All series are **ascending by date/period** and pre-aggregated: a chart module
renders what it is given and never re-derives a statistic. A series that could
not be computed is `[]` and its sibling `*_usable` flag (where present) is
`false`, with a human sentence in `provenance.notes`.

```jsonc
"metrics": {
  "as_of": "2026-09-28",
  "window": { "start": "2026-07-27", "end": "2026-09-28", "days": 64, "weeks": 10 },

  "totals": {
    "tasks": 118,          // every brief on disk
    "in_scope": 118,       // v2: tasks - cancelled; the completion denominator
    "done": 105, "pending": 13, "cancelled": 0, "unparseable": 0,
    "in_progress": 1, "blocked": 5, "not_started": 7,
    "sprints": 24, "sprints_active": 3, "sprints_closed": 20, "sprints_planned": 1,
    "decisions": 27, "reviews": 2,
    "adhoc_open": 1, "adhoc_resolved": 31,
    "log_entries": 254, "commits": 566,
    "insertions": 412000, "deletions": 90000,
    "tasks_with_dates": 110, "tasks_without_dates": 8,
    "completion_pct": 89.0
  },

  // Headline tiles, in display order. The UI renders this array; it does not
  // hardcode a tile list, so adding a KPI is a generator change only.
  "kpis": [
    { "key": "completion", "label": "Scope complete", "value": 89.0, "unit": "%",
      "sub": "105 of 118 tasks", "tone": "good",        // "good" | "warn" | "bad" | "neutral"
      "trend": 4.2,                                      // change over the trailing 14 days, null if unknown
      "hint": "Closed briefs as a share of all briefs." }
  ],

  // §2.1 Burn-up: cumulative scope vs cumulative done. One point per period.
  "burnup":   [ { "date": "2026-07-27", "scope": 6, "done": 6, "remaining": 0 } ],
  // §2.2 Burn-down: remaining, with the ideal line anchored at the first period.
  "burndown": [ { "date": "2026-07-27", "remaining": 0, "ideal": 13.0 } ],
  // §2.3 Cumulative flow: stacked, bottom-to-top in this key order.
  "cfd":      [ { "date": "…", "done": 105, "in_progress": 1, "blocked": 5, "not_started": 7 } ],
  "series_granularity": "week",        // "day" | "week" — what one point spans

  // §2.4 Velocity, one entry per sprint with at least one closed task.
  "velocity": [ { "sprint_id": "S000", "label": "S000_Foundations", "closed": 6,
                  "points": null, "rolling_avg": 6.0 } ],
  "velocity_avg": 4.4, "velocity_stddev": 3.1,

  // §2.5 Weekly throughput (closed tasks per ISO week).
  "throughput": [ { "period": "2026-W31", "start": "2026-07-27", "count": 6 } ],

  // §2.6 Cycle time (created→closed) and lead time (first evidence→closed).
  "cycle_time": {
    "samples": [ { "id": "S015.T009", "closed_at": "2026-09-24", "days": 4,
                   "sprint_id": "S015", "lane": "code", "approximate": false } ],
    "n": 96, "avg": 3.2, "p50": 1, "p85": 6, "p95": 12, "max": 31,
    "usable": true
  },
  "lead_time": { /* identical shape */ },

  // §2.7 Aging work in progress — pending tasks by age, oldest first.
  "aging_wip": [ { "id": "S015.T010", "title": "Calibrate Workflows", "age_days": 6,
                   "workflow_state": "in_progress", "lane": "code",
                   "sprint_id": "S015", "blocked_by_unmet": [], "approximate": false,
                   "percentile_band": "p50" } ],   // "p50"|"p85"|"p95"|"over_p95"|"unknown"

  // §2.8 Scope churn — arrivals vs departures per period. `net > 0` is growth.
  "scope_churn": [ { "period": "2026-W38", "start": "2026-09-14",
                     "added": 6, "closed": 5, "net": 1 } ],

  // §2.9 Monte Carlo forecast over historical weekly throughput.
  "forecast": {
    "method": "monte_carlo_weekly_throughput",
    "usable": true,
    "trials": 10000,
    "remaining": 13,
    "sample_weeks": 9,                 // historical weeks drawn from
    "sample_values": [3, 0, 5, 1, 0, 2, 6, 4, 1],
    "zero_weeks": 3,                   // weeks with no closures, kept in the sample on purpose
    "weeks": { "p50": 5, "p85": 11, "p95": 15 },
    "percentiles": { "p50": "2026-11-02", "p85": "2026-12-14", "p95": "2027-01-11" },
    "histogram": [ { "date": "2026-10-26", "weeks": 4, "count": 812, "cumulative_pct": 8.1 } ],
    "cone": [ { "date": "2026-10-05", "p50": 10, "p85": 12, "p95": 13 } ],   // remaining, projected
    "note": "Samples every week in the window, including the 3 with no closures."
  },

  // §2.10 Dependency graph, already layered so the renderer does no graph maths.
  "dependencies": {
    "nodes": [ { "id": "S015.T010", "layer": 2, "state": "pending",
                 "workflow_state": "in_progress", "lane": "code", "sprint_id": "S015",
                 "in_degree": 1, "out_degree": 2, "on_critical_path": true } ],
    "edges": [ { "from": "S015.T013", "to": "S015.T010", "satisfied": true } ],
    "layer_count": 4,
    "cycles": [],                      // each entry an array of ids forming a cycle
    "critical_path": ["S015.T013", "S015.T010", "S015.T011", "S015.T012"],
    "ready": ["S015.T010", "S017.T003"],   // from task_queue's own frontier
    "prose_gated": ["S016.T001"]
  },

  "lanes": [ { "lane": "code", "total": 40, "done": 38, "pending": 2 } ],
  "states": [ { "state": "done", "count": 105 } ],   // for the board / donut

  "activity": {
    "calendar": [ { "date": "2026-09-28", "commits": 4, "log_entries": 3,
                    "tasks_closed": 0, "score": 7 } ],
    "by_month": [ { "month": "2026-09", "commits": 520, "log_entries": 180,
                    "tasks_closed": 84, "decisions": 12 } ],
    "log_types": [ { "month": "2026-09", "types": { "maintenance": 90, "system": 30 },
                     "total": 180 } ],
    "code_volume": [ { "period": "2026-W39", "start": "2026-09-21",
                       "insertions": 41000, "deletions": 9000, "commits": 120 } ],
    "top_areas": [ { "area": "tests", "commits": 300 } ]
  },

  "debt": {
    "adhoc_trend": [ { "date": "2026-09-28", "open": 1, "resolved_cumulative": 31 } ],
    "open_items": [ /* adhoc[] entries with state == "open", oldest first */ ],
    "adr_cadence": [ { "month": "2026-09", "count": 12 } ],
    "risks": [ { "id": "S016.T001", "kind": "prose_gate", "severity": "high",
                 "label": "S016.T001", "detail": "Gated on: …" } ]
  },

  // --- schema v2 -------------------------------------------------------
  "backlog": {
    "matrix": [ { "priority": "high", "value": "medium", "count": 2,
                  "ids": ["B-012", "B-031"] } ],   // OPEN items only
    "mix":    [ { "priority": "high", "open": 1, "closed": 13 } ],
    "grades": ["high", "medium", "low", "unrated"],  // any extra grade is appended, never coerced
    "totals": { "total": 48, "open": 13, "closed": 35, "cancelled": 0,
                "high_open": 1, "graded": 13 },
    "source": "backlog_table"                      // or "adhoc"; see §1.11
  },
  "phases": {
    "timeline": [ { "number": 2, "title": "Multi-client deployment",
                    "state": "done", "start": "2026-09-13",   // previous phase's date
                    "end": "2026-09-13", "dated": true, "days": 0 } ],
    "dated": 10
  },
  "sprint_burn": {
    "S010": [ { "date": "2026-09-23", "scope": 8, "done": 3,
                "remaining": 5, "ideal": 5.33 } ]
  },
  "criteria": {
    "by_sprint": [ { "sprint": "S9", "total": 120, "checked": 4 } ],
    "total": 953, "checked": 41, "recorded": true, "tasks_with_criteria": 108
  },
  "owners": [ { "owner": "agent", "tasks": 97, "done": 96 } ],
  "closure_sources": [ { "source": "commit_hash", "count": 97 } ]
}
```

`debt.risks[].kind` is one of `prose_gate`, `unmet_dependency`, `cycle`,
`stale_wip`, `unparseable_status`, `open_adhoc`, `undated_task`,
`no_lane`. `severity` is `low` | `medium` | `high`.

---

## 3. `provenance`

The panel that keeps the dashboard honest. Rendered in the **Data** tab and
linked from any chart whose series contains approximate points.

```jsonc
"provenance": {
  "date_sources": { "status_line": 44, "log_md": 40, "git_added": 26,
                    "git_last": 0, "roadmap_sprint": 8, "file_mtime": 0, "unknown": 0 },
  "git_baseline": { "available": true, "date": "2026-09-07", "hash": "dcd0f64",
                    "subject": "Baseline: vault state after Nextcloud host migration",
                    "note": "History begins here; earlier work has no git date." },
  "floored_dates": 31,
  "approximate_tasks": ["S000.T001", "…"],     // any date floored or roadmap-granularity
  "excluded_from_timeseries": [],              // tasks with no usable date at all
  "estimates_present": false,
  "sources_read": [ { "path": ".ai/workflow/tasks", "kind": "task_briefs", "count": 118 } ],
  "notes": [ "…one sentence per caveat the reader needs…" ]
}
```

---

## 4. DOM contract — `template.html`

The generator substitutes exactly four placeholders, each on its own line:

| Placeholder | Replaced with |
|---|---|
| `/*{{STYLES}}*/` | every `css/*.css` file, concatenated in filename order |
| `/*{{SCRIPT}}*/` | every `js/*.js` file, concatenated in filename order |
| `/*{{DATA}}*/` | the JSON payload, as the body of a `<script type="application/json" id="pm-data">` |
| `<!--{{META}}-->` | `<title>` and generated-at meta |

Structure the modules may rely on:

```html
<body data-theme="auto">
  <header id="pm-header">…  #pm-project-name  #pm-generated-at  #pm-theme-toggle …</header>
  <nav id="pm-tabs" role="tablist">
    <button class="pm-tab" role="tab" data-tab="overview" …>
  </nav>
  <main id="pm-main">
    <section class="pm-panel" id="tab-overview"  role="tabpanel" hidden></section>
    <section class="pm-panel" id="tab-burn"      role="tabpanel" hidden></section>
    <section class="pm-panel" id="tab-flow"      role="tabpanel" hidden></section>
    <section class="pm-panel" id="tab-forecast"  role="tabpanel" hidden></section>
    <section class="pm-panel" id="tab-board"     role="tabpanel" hidden></section>
    <section class="pm-panel" id="tab-roadmap"   role="tabpanel" hidden></section>
    <section class="pm-panel" id="tab-backlog"   role="tabpanel" hidden></section>
    <section class="pm-panel" id="tab-deps"      role="tabpanel" hidden></section>
    <section class="pm-panel" id="tab-decisions" role="tabpanel" hidden></section>
    <section class="pm-panel" id="tab-activity"  role="tabpanel" hidden></section>
    <section class="pm-panel" id="tab-debt"      role="tabpanel" hidden></section>
    <section class="pm-panel" id="tab-data"      role="tabpanel" hidden></section>
  </main>
  <div id="pm-tooltip" role="status" aria-live="polite" hidden></div>
  <link rel="stylesheet" href="dashboard.custom.css">   <!-- last; user override -->
</body>
```

The **twelve** tab ids above are the complete, closed set. Adding a tab means
editing five places together, and missing one fails silently rather than
loudly: `template.html` (the button **and** the panel), `PM.app`'s `TABS`
array, this table, the module table in §5, and `pm_dashboard_smoke.py`'s own
`TABS` — a tab absent from the last one is simply never rendered by the check
that exists to prove it renders.

---

## 5. Module contract — `js/`

Files are concatenated in filename order into one `<script>`. There are no
modules, no imports and no bundler; the ordering prefix in each filename is the
dependency order.

| File | Owns | May call |
|---|---|---|
| `00-util.js` | `PM.util` — dates, formatting, DOM builders, stats | — |
| `10-svg.js` | `PM.svg` — scales, axes, paths, legend, tooltip wiring | `PM.util` |
| `20-burn.js` | tab `burn` | `PM.util`, `PM.svg` |
| `21-flow.js` | tab `flow` | `PM.util`, `PM.svg` |
| `22-forecast.js` | tab `forecast` | `PM.util`, `PM.svg` |
| `23-board.js` | tabs `board`, `roadmap` | `PM.util`, `PM.svg` |
| `24-deps.js` | tab `deps` | `PM.util`, `PM.svg` |
| `25-activity.js` | tabs `activity`, `decisions` | `PM.util`, `PM.svg` |
| `26-debt.js` | tab `debt` | `PM.util`, `PM.svg` |
| `27-overview.js` | tab `overview` | `PM.util`, `PM.svg` |
| `28-backlog.js` | tab `backlog` | `PM.util`, `PM.svg` |
| `40-theme.js` | `PM.theme` + tab `data` | `PM.util`, `PM.svg` |
| `90-app.js` | `PM.app` — bootstrap, routing, filters, resize | everything |

**No module may call another view module.** A tab that wants a chart another
tab also shows re-renders it from the same `metrics` series; duplication of a
40-line renderer is cheaper than a dependency between two agents' files.

### 5.1 Registration

Every file opens with the same idempotent preamble and never assumes it ran
first:

```js
window.PM = window.PM || {};
PM.views = PM.views || {};
PM.views.burn = function (root, data) { /* … */ };
```

A view function receives `(root, data)` — `root` is its own
`<section class="pm-panel">`, already empty, and `data` is the whole payload
from §1. It must be **idempotent**: `PM.app` calls it again on theme change and
on resize, and it must clear and rebuild rather than append.

A view must not touch anything outside `root` except `PM.svg`'s shared tooltip.

### 5.2 `PM.util` (see `js/00-util.js` for the implementation)

`fmt.n`, `fmt.pct`, `fmt.date`, `fmt.dateLong`, `fmt.days`, `fmt.bytes`,
`fmt.compact`, `fmt.plural`, `fmt.deCamel`; `d.parse`, `d.iso`, `d.addDays`,
`d.diffDays`, `d.startOfWeek`, `d.monthLabel`, `d.range`; `st.percentile`,
`st.mean`, `st.stddev`, `st.max`, `st.sum`; `el(tag, attrs, children)`,
`frag`, `clear`, `card(title, subtitle)`, `kpi(spec)`, `table(cols, rows)`,
`badge(text, tone)`, `empty(message)`, `note(text)`, `section(title, sub)`,
`toneFor(value, thresholds)`, `download(filename, text, mime)`.

### 5.3 `PM.svg` (see `js/10-svg.js` for the implementation)

`PM.svg.chart(host, opts)` returns a chart handle with a fixed API:

```js
const c = PM.svg.chart(host, {
  height: 280,            // width comes from the host element
  margin: { t: 16, r: 16, b: 34, l: 48 },
  title: "Burn-up",       // optional caption rendered by the card, not the svg
  xType: "time",          // "time" | "band" | "linear"
  yType: "linear",
  x: { domain: [minDate, maxDate] },   // Date[] for time, string[] for band
  y: { domain: [0, 120], nice: true },
});
c.xAxis({ ticks: 6, format: PM.util.fmt.date });
c.yAxis({ ticks: 5, grid: true });
c.area(points, { x: p => p.date, y0: 0, y1: p => p.scope, cls: "pm-a1" });
c.line(points, { x: p => p.date, y: p => p.done, cls: "pm-s2", width: 2 });
c.bars(points, { x: p => p.period, y: p => p.count, cls: "pm-s1" });
c.stack(points, { x: p => p.date, keys: ["done","in_progress"], cls: k => "pm-a"+i });
c.dots(points, { x: …, y: …, r: 3, cls: "pm-s3" });
c.hLine(6, { cls: "pm-ref", label: "p85 = 6d" });
c.vLine(date, { cls: "pm-ref", label: "today" });
c.legend([{ label: "Scope", cls: "pm-a1" }, …]);
c.hover(points, { x: …, label: p => `${p.date}: ${p.scope}` });
c.done();               // finalises; returns the <svg>
```

Colours are **never** literals in a module. Use the `pm-s1..pm-s8` (series) and
`pm-a1..pm-a8` (area/fill) classes, plus semantic `pm-ok`, `pm-warn`, `pm-bad`,
`pm-ref`, `pm-muted`. `css/30-charts.css` binds those to the theme tokens, so
one stylesheet edit re-themes every chart.

### 5.4 Accessibility and degradation

- Every chart card carries a `<table class="pm-sr-only">` fallback, or an
  `aria-label` summarising the series, built by `PM.util.card`.
- A view given an empty series renders `PM.util.empty("…")` explaining *why* it
  is empty — never a blank box, never an axis with no data.
- Keyboard: tabs are real `<button role="tab">`; arrow keys move between them.
  Nothing may depend on hover alone.

---

## 6. CSS contract — `css/`

`css/00-tokens.css` is the only file that may define a custom property, and it
defines them twice: once under `[data-theme="light"]` and once under
`[data-theme="dark"]`, with `[data-theme="auto"]` mapping to a
`prefers-color-scheme` media query. Every other stylesheet and every JS module
consumes tokens only.

The token set is closed — the theme editor in `40-theme.js` enumerates exactly
these, so a new token must be added to `00-tokens.css` **and** to that
editor's group list:

| Group | Tokens |
|---|---|
| Surface | `--pm-bg`, `--pm-bg-elev`, `--pm-bg-sunken`, `--pm-border`, `--pm-border-strong` |
| Text | `--pm-fg`, `--pm-fg-muted`, `--pm-fg-faint`, `--pm-fg-inverse` |
| Accent | `--pm-accent`, `--pm-accent-fg`, `--pm-accent-weak` |
| Semantic | `--pm-ok`, `--pm-warn`, `--pm-bad`, `--pm-info`, and `-weak` variants |
| Series | `--pm-series-1` … `--pm-series-8` |
| Chart | `--pm-grid`, `--pm-axis`, `--pm-ref`, `--pm-tooltip-bg`, `--pm-tooltip-fg` |
| Shape | `--pm-radius`, `--pm-radius-sm`, `--pm-gap`, `--pm-pad`, `--pm-shadow` |
| Type | `--pm-font`, `--pm-font-mono`, `--pm-fs-base`, `--pm-fs-sm`, `--pm-fs-lg`, `--pm-fs-xl` |

Three customisation routes, all required to work:

1. **Theme toggle** — `body[data-theme]` cycles `auto` → `light` → `dark`,
   persisted in `localStorage` under `pm.theme`.
2. **Token editor** (Data tab) — live-edits any token above onto
   `document.body.style`, persists to `localStorage` under `pm.tokens`, and
   exports a ready-to-use `dashboard.custom.css`.
3. **`dashboard.custom.css`** — a sibling file, linked last in `template.html`.
   It is absent by default and that must not error; when present it wins over
   everything, including the token editor's inline values, only if the author
   uses `!important` — this precedence is documented in `README.md`.
