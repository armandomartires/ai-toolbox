# TASK-0125 — Retire this repo's dashboard generator for the vendored canonical one

## Objective

Replace `skills/project-workflow/`'s own dashboard implementation with a
vendored copy of the generator built in `sigma-llmwiki`, so that **one**
generator serves every project the skill is applied to and every such project
renders the same dashboard.

Requested by the human on 2026-09-29, after noticing that the dashboard in
`sigma-llmwiki` and the page this repository publishes to GitHub Pages differ.
They differ because they are **different programs**, written the same week in
two repositories that did not know about each other.

## Minimal context

### There are two generators, not one that drifted

| | this repo (`TASK-0122`) | `sigma-llmwiki` (`S027.T001`) |
|---|---|---|
| Reader | `scripts/dashboard_lib.py`, 1,218 lines | `pm_collect.py` + `pm_metrics.py` |
| Front end | `assets/dashboard.{html,css,js}`, 2,236 lines | `template.html` + `css/` + `js/`, concatenated in filename order |
| Corpus shapes | both, from the start | one, until `S028.T001` taught it the second |
| Tabs | 9 | 12 |

`TASK-0122` shipped the first; `TASK-0123` published it. Neither was wrong. But
two generators means two answers to "what does the dashboard show", and which
answer a project gets depends on which repository it was scaffolded from —
which is precisely what the skill exists to prevent.

### Why the other one survives, stated plainly

Not because it is better in every respect. **This repository's reader handled
both corpus layouts first**, and the one replacing it had to be taught the
second (`S028.T001`). What it has instead is the structure: a `template.html`
plus `css/*` plus `js/2*.js` concatenated in filename order, where adding a
chart is a new file that sorts into place rather than an edit inside an
1,800-line script. Per-date provenance is the other half — it records *which
source* dated every figure, where `done_source` here records one of three.

The capability was portable. The structure was the expensive part.

### `B-048` is not overturned by this task

`B-048` records the human's decision, taken 2026-09-28, **not** to ship the
publishing pipeline from the skill, to be reopened "when a second repository
actually wants the pipeline". A second repository now owns the generator — and
it explicitly does **not** want the pipeline: its stated position is that the
locally generated file is canonical and GitHub Pages is an optional publisher.

So `B-048` stands exactly as routed. This task ships the generator, not the
workflow, and `.github/workflows/dashboard.yml` remains a property of this
repository.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/project-workflow/dashboard/` | `sigma-llmwiki` `S028.T003` | **New**, 27 vendored files + `VENDORED.md` recording source commit and a sha256 each |
| `skills/project-workflow/scripts/build-dashboard.sh` | `TASK-0122` | Wrapper over `dashboard_lib.py`; its flag surface is called by `dashboard.yml` and cited by `skills/project-migration/SKILL.md:59`, so the **path and flags must survive** |
| `skills/project-workflow/scripts/check-dashboard.sh` | `TASK-0122` | 26 assertions over `fixtures/dashboard/`; the **only** cover for an open sprint, which this repo's own corpus cannot exercise |
| `skills/project-workflow/fixtures/dashboard/` | `TASK-0122` | 10 files, `project-workflow`-shaped. **Kept** |
| `.github/workflows/dashboard.yml` | `TASK-0123` | `VERIFIED`; its guard asserts `series.kpi.commits`, `series.kpi.tasks`, `project.git` — **none of which exist in the new payload** |
| `AGENTS.md` | ongoing | Names `build-dashboard.sh`, `check-dashboard.sh`, `references/dashboard.md` |
| `SKILL.md` | `TASK-0122` | `metadata.version: "4.1.0"`; `## The dashboard` names nine tabs |
| `tests/validate.sh` | `TASK-0010`+ | Must stay `OK`. Its `NOT EXECUTABLE` check requires a tracked `#!` file to be recorded `100755` |

**Verify the expected state; don't assume it.**

## Scope

### Included

1. Vendor the generator to `skills/project-workflow/dashboard/` (done from the
   source side by its own sync script, which also writes the drift manifest).
2. Retire `scripts/dashboard_lib.py`, `assets/dashboard.{html,css,js}` and
   `assets/custom.css.example`.
3. Rewrite `build-dashboard.sh` as a thin wrapper keeping its current flags.
4. Re-point `check-dashboard.sh` at the vendored package, keeping the fixture.
5. Rewrite `dashboard.yml`'s degraded-page guard against the new payload.
6. `SKILL.md` major bump and a rewritten `## The dashboard`; `AGENTS.md`
   corrected; registry regenerated; `CURRENT_STATE.md` updated.
7. Every vendored `.py` recorded `100755`.

### Not included

- **No publishing pipeline in the skill.** `B-048` stands; see above.
- **No edit to the vendored files here.** They are a copy. Changing one makes
  the two diverge, which is the failure this whole task is undoing.
- **No change to `validate.yml`**, `artifact_lib.py`, or any other skill.

## Likely files

- `skills/project-workflow/dashboard/**` — new, vendored
- `skills/project-workflow/scripts/{build-dashboard.sh,check-dashboard.sh}`
- `skills/project-workflow/{SKILL.md,references/dashboard.md}`
- `skills/project-workflow/{scripts/dashboard_lib.py,assets/dashboard.*}` — deleted
- `.github/workflows/dashboard.yml`, `AGENTS.md`, `docs/registry.md`,
  `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`, this file

## Execution plan

1. Vendor from the source repository; confirm the copy runs from its own
   location against this repository's corpus.
2. Rewrite the two scripts; run the fixture check.
3. Rewrite the workflow guard and exercise it **both ways** — full history
   passes, degraded history fails — before pushing.
4. Docs, version, registry, `CURRENT_STATE.md`.
5. `tests/validate.sh`; fix the executable bits it reports.
6. Commit. Push only on the human's say-so.

## Acceptance criteria

- [ ] `build-dashboard.sh --root .ai --project ai-toolbox --out … --json …`
      runs from a clean checkout and writes both files.
- [ ] The emitted page is self-contained: `grep -Eic '(src|href)="(https?:|//)|@import'` → 0.
- [ ] Counts match this repository, verified independently: 121 briefs,
      48 backlog rows, 10 phases, 27 ADRs, 12 reviews.
- [ ] `check-dashboard.sh` passes against the fixture, including its open sprint.
- [ ] `tests/validate.sh` → `OK`.
- [ ] `scripts/sync-registry.sh` leaves `docs/registry.md` with no diff.
- [ ] The workflow guard fails on a degraded history and passes on a full one,
      both observed.
- [ ] No dashboard HTML is committed.
- [ ] The drift check reports in sync from the source side.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh
- [ ] `check-dashboard.sh`
- [ ] The self-containment grep
- [ ] The guard, exercised both ways

## Risks and rollback

- **A vendored copy that someone edits here.** It would re-create the exact
  divergence this task removes, silently. Mitigated by `VENDORED.md` saying so
  at the top of the directory and by a drift check that exits non-zero.
- **The workflow guard silently passing on a degraded page.** Its keys no
  longer exist, and a guard reading `undefined` would never fire. Mitigated by
  rewriting it against the real payload and running it both ways.
- **The executable-bit trap.** `chmod` is a no-op on this `/mnt/c` checkout, so
  seven new `#!` files would ship `100644` and fail the gate on a real runner.
  Mitigated by `git update-index --chmod=+x` and by the gate itself.
- **Rollback:** `git revert` of the single commit restores
  `dashboard_lib.py` and the assets; the vendored directory is additive and can
  be deleted.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `skills/project-workflow/dashboard/` | **New.** 27 vendored files + `VENDORED.md` |
| `scripts/dashboard_lib.py`, `assets/dashboard.{html,css,js}`, `assets/custom.css.example` | **Deleted** |
| `scripts/build-dashboard.sh` | Rewritten as a wrapper; same path, same flags |
| `scripts/check-dashboard.sh` | Re-pointed at the vendored package; fixture kept |
| `.github/workflows/dashboard.yml` | Guard rewritten against the new payload |
| `SKILL.md` | `4.1.0` → `5.0.0`; `## The dashboard` rewritten for twelve tabs |
| `AGENTS.md`, `docs/registry.md`, `.ai/context/CURRENT_STATE.md` | Updated |

**Next task starts here**: one generator, vendored, with drift mechanically
checkable from the source side.

## Status

- Status: review   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent (implementation) / human (push)
- Created: 2026-09-29
- Updated: 2026-09-29

`review` rather than `done`: everything is committed locally and verified, but
nothing is pushed, and one acceptance criterion cannot be met on this machine
for a reason that predates this task. Both are below.

## Execution log

### Attempt 1

- Date: 2026-09-29
- Agent: Claude Opus 5, Claude Code
- Actions: Vendored the generator from `sigma-llmwiki`, rewrote the two
  scripts, rewrote the workflow guard, retired the old implementation, updated
  the docs and the registry, and fixed the executable bits.

- Observations:

  **1. The fixture found three defects in the incoming generator — a tool that
  was passing every check in its own repository.** This is the second time
  `fixtures/dashboard/` has paid for itself.

  - It parsed to **zero tasks**. Its briefs are named `S001.T001_Name.md`; the
    reader required `S001_Sprint.T001_Name.md`, the spelling its author's own
    repository happens to use. A reader that accepts one project's spelling
    works in exactly one project.
  - Every pending task raised **"no lane assigned in LANES"** — that repo's
    execution-lane table, keyed by *its* task ids, applied to a foreign corpus.
    `--check` would have failed for every consumer of this skill, over a policy
    they do not have.
  - Hand-recorded `**Created**`/`**Updated**` fields were **ignored** in favour
    of git and then the filesystem mtime, so a fixture carrying real dates
    produced none and its per-sprint burn-down had no window at all.

  All three were fixed at the source and re-vendored, not patched here.

  **2. The workflow guard could not have fired.** It asserted
  `series.kpi.commits`, `series.kpi.tasks` and `project.git` — none of which
  exist in the new payload. A guard reading `undefined` never fails, and a
  deploy it was supposed to stop would have looked checked. Rewritten against
  `metrics.totals` and `project.git_available`, plus a new assertion that the
  detected corpus shape is `numbered_task`, and **exercised both ways**: full
  history prints `history OK: 258 commits, 122 task briefs, 16 sprints, shape
  numbered_task` and exits 0; a `--no-git` payload prints two `::error::` lines
  and exits 1.

  **3. `tests/validate.sh` cannot run on this Windows checkout, and that
  predates this task.** Its `UNTRACKED ASSET` block does `path.split("/")[1]`
  over `glob.glob("skills/*/scripts/*")`; on Windows those paths come back
  backslash-separated, the split yields one element, and the block raises
  `IndexError`, taking the whole gate to exit 1.

  Checked rather than assumed: a clean `git worktree` at `b74e8e4`, carrying
  none of this task's changes, **fails identically**. The gate's failure set is
  **unchanged** by this task — diffed, and the set added is empty. CI runs on
  Linux and is unaffected, which is why this has never been visible.

  It is **not fixed here**, deliberately: it is a pre-existing platform defect
  in the mandatory gate, it deserves its own record rather than riding along
  inside a dashboard task, and changing the gate is not something to do as a
  footnote.

  **4. `B-048` was checked before assuming it was overtaken.** It records the
  human's decision not to ship the publishing pipeline from the skill, to be
  reopened "when a second repository actually wants the pipeline". A second
  repository now owns the generator and explicitly does **not** want it — its
  stated position is that the local file is canonical and Pages is optional. So
  the routing stands and nothing about publishing moved into the skill.

- Validation:
  - `check-dashboard.sh` → **OK (36 assertions, sprint-brief fixture)**, up
    from 26, including the open sprint and a fully-estimated corpus
    (`units.primary` flips to `points`) — two branches this repository cannot
    exercise.
  - The wrapper, with the exact CI invocation
    (`--root .ai --project ai-toolbox --out … --json …`): writes both files;
    `122 task(s): 116 done, 4 pending (96.7% complete)`.
  - Counts cross-checked independently against this repository: 48 backlog
    rows, 10 phases, 27 ADRs, 12 reviews, 10 sprint files.
  - Self-containment: `grep -Eic '(src|href)="(https?:|//)|@import'` → **0**.
  - The vendored copy runs **from its own location**, with the repository root
    as `--root`, producing the same figures as the source checkout.
  - `sync_dashboard_skill.py --check` → **in sync, 27 files**.
  - `scripts/sync-registry.sh` → `docs/registry.md` regenerated; the only diff
    is the skill description.
  - Seven vendored `.py` files recorded **100755** via
    `git update-index --chmod=+x` — `chmod` is a no-op on this checkout, the
    trap `TASK-0123` hit for fourteen commits.
  - `tests/validate.sh` → exit 1, **unchanged from HEAD**; see observation 3.

  **Not proven:** the published page. Nothing has been pushed.

- Result: **Committed locally, not pushed.** Awaiting the human on two points:
  whether to push, and what to do about the gate's Windows crash.
- Commit: recorded on the follow-up, since a commit cannot contain its own hash.
- Push: **not done.**
