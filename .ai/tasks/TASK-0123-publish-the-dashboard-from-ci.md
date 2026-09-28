# TASK-0123 — Publish the dashboard from CI to GitHub Pages

## Objective

Have CI regenerate the delivery dashboard on every push to `master` and
deploy it to GitHub Pages, so the page is current without anyone running a
command and without the HTML ever being committed. Also correct `AGENTS.md`'s
claim that this repository is private, which it is not.

Requested by the human on 2026-09-28, immediately after `TASK-0122` shipped
the generator. Discharges no backlog item.

## Minimal context

### The repository is public, and the normative doc says otherwise

`AGENTS.md` line 96 states the remote is `armandomartires/ai-toolbox`
**(private)**. The GitHub API returns `"visibility": "public"`,
`"private": false`, and `.ai/planning/BACKLOG.md` reads over
`raw.githubusercontent.com` **with no token at all**. The human confirmed on
2026-09-28 that public is intended, so the doc is what is wrong.

This matters more than a stale adjective: `AGENTS.md` is the file every agent
reads first, and an agent that believes the repo is private may reason
differently about what is safe to write down. It is corrected here rather
than raised, because publishing a page off a repository whose stated
visibility is wrong would be building on it.

**Publishing adds no exposure.** Everything the dashboard renders — task
titles, commit subjects, author names, the whole backlog — is already
world-readable in the repo it is generated from. Pages changes the
convenience, not the exposure.

### The trap this task exists to avoid, measured before writing the workflow

`actions/checkout@v4` defaults to `fetch-depth: 1`. The dashboard reads
`git log` for completion dates and its whole Activity tab. Measured on
2026-09-28 by cloning this repository both ways:

| Checkout | What the generator reports |
|---|---|
| full | `119 tasks (114 done, 4 open), 10 sprints, … 249 commits` |
| `--depth 1` | `… 1 commits` + `warning: 3 task(s) are marked done but carry no date` |

So a default workflow would publish a **plausible-looking page that is
quietly wrong** — an empty Activity tab and completion dates silently
degraded from commit timestamps to the editable `Updated` field. That is the
`ADR-0009` failure shape exactly: not a crash, a green run producing
something still trusted. `fetch-depth: 0` is therefore not a tuning choice,
and the workflow asserts the result rather than assuming the flag stayed.

### Why a second workflow and not a step in `validate.yml`

`validate.yml`'s own header reasons about what belongs in it and excludes
`smoke-mcp.sh` for needing the network. The same logic excludes this: the
gate is the mandatory, hermetic check on every branch and every PR;
publishing is a `master`-only side effect that needs `pages: write` and an
`id-token`. Putting a deploy permission on the gate workflow would widen the
token of the job that runs on every pull request.

### `UNVERIFIED` until a run exists

`validate.yml` carries a `STATUS: VERIFIED` header that was *"UNVERIFIED
until a run actually existed, and was changed only after observing one — not
on the assumption that a green file is a green build."* This workflow follows
that rule: it ships labelled `UNVERIFIED` and the label is changed only after
a real run is observed through the API.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/project-workflow/scripts/build-dashboard.sh` | `TASK-0122` | Runs from a fresh clone; `--out` creates parent dirs; verified on a clean `git clone` at `3c3c0e4` |
| `skills/project-workflow/assets/dashboard.html` | `TASK-0122`, fixed `3c3c0e4` | **Tracked**. It was not, until `3c3c0e4`; an unanchored gitignore had swallowed it and no fresh clone could build |
| `.github/workflows/validate.yml` | `TASK-0010` | `VERIFIED`; runs on every branch and PR; must not gain deploy permissions |
| `AGENTS.md` | ongoing | Line 96 says `(private)`; the API says public. Corrected by this task |
| `.gitignore` | `TASK-0122`, fixed `3c3c0e4` | `/dashboard.html` and `/docs/dashboard.html`, anchored. CI writes to `_site/`, which must also not be committed |
| GitHub Pages | pre-existing | **Not enabled** — `has_pages: false`, `GET /pages` → 404. Enabled by the workflow, or by hand if the token lacks the scope |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. `.github/workflows/dashboard.yml` — build on push to `master` plus
   `workflow_dispatch`, deploy to Pages.
2. **`fetch-depth: 0`**, and an assertion on the generated model that the
   history was actually there, so the trap above cannot return silently.
3. `AGENTS.md` corrected: the remote is public, and what that means.
4. `_site/` ignored.
5. The workflow labelled `UNVERIFIED`, then changed to `VERIFIED` with the
   run number once a run is observed.

### Not included

- **No change to `validate.yml`.** It keeps its narrow permissions and its
  every-branch trigger.
- **No committed dashboard HTML.** The `.gitignore` reasoning from
  `TASK-0122` stands: a file that reads the git log is stale when committed.
- **No branch protection, no Pages custom domain, no artifact retention
  tuning.** Not asked for.
- **No making the dashboard a gate.** It stays a view. A failed *deploy*
  fails this workflow; a dashboard that reports bad numbers does not fail
  anything, because it audits nothing.

## Likely files

A forecast, written before the work.

- `.github/workflows/dashboard.yml` — new
- `AGENTS.md` — the visibility correction
- `.gitignore` — `_site/`
- `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`, this file

**Not expected to change**: `validate.yml`, any skill, any script.

## Execution plan

1. Measure the shallow-checkout behaviour before writing the workflow. Done —
   quoted under Minimal context.
2. Correct `AGENTS.md`.
3. Write the workflow with `fetch-depth: 0` and a post-generation assertion.
4. Commit and push; **observe the run through the API** rather than assuming.
5. Confirm the page serves and carries full history, by fetching it.
6. Flip the label to `VERIFIED` with the run number; update
   `CURRENT_STATE.md` and `TODO.md`.

## Acceptance criteria

- [ ] A push to `master` triggers the workflow and it concludes `success`,
      observed through the API, not inferred.
- [ ] The deployed page is reachable over HTTPS and returns 200.
- [ ] The deployed page reports the **full** commit count, not 1 — the
      shallow-checkout trap, checked on the live page.
- [ ] The workflow fails, rather than deploying, if the generated model
      carries a degenerate history.
- [ ] No dashboard HTML is committed; `git status` is clean after a run.
- [ ] `validate.yml` is unchanged.
- [ ] `AGENTS.md` no longer claims the repository is private.
- [ ] The workflow's status label matches observed reality.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed)
- [ ] The workflow run's conclusion, read from the API
- [ ] An HTTP fetch of the published page, with its commit count

## Risks and rollback

- **Publishing a quietly-wrong page.** The whole reason for criterion 3 and
  the in-workflow assertion. A degraded page is worse than none, because it
  looks authoritative.
- **Widening the gate workflow's token.** Avoided by using a second workflow;
  named here because folding them together is the obvious shortcut.
- **Enabling Pages may need a scope this token lacks.** Then the workflow
  fails at `configure-pages` and a human enables it once in Settings. That is
  a documented fallback, not a silent failure.
- **Believing a green file is a green build.** The `validate.yml` lesson.
  Mitigated by shipping `UNVERIFIED` and observing a run.
- **Rollback:** delete `.github/workflows/dashboard.yml` and disable Pages in
  Settings. Nothing else is touched and no artifact is committed.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          | what it now contains, plus anything deliberately *not* changed |

**Next task starts here**: one line naming the state the next task picks
up from — not a prediction of what that task will be. Record any
deviation from the Plan here too: the next task may have been scoped
against the original.

## Status

- Status: blocked   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent (blocked on one human action: enable Pages)
- Created: 2026-09-28
- Updated: 2026-09-28

Requested by the human on 2026-09-28 with no sprint open, who also confirmed
that public visibility is intended — a decision this task records rather than
takes.

## Execution log

### Attempt 1

- Date: 2026-09-28
- Agent: Claude Opus 5 (1M context), Claude Code
- Actions: Measured the shallow-checkout behaviour first; corrected
  `AGENTS.md`; wrote `.github/workflows/dashboard.yml` with `fetch-depth: 0`
  and an assertion on the generated model; pushed; read the runs through the
  API. Hit a blocker that stopped the whole gate, diagnosed it, fixed it in
  its own commit.

- Observations:

  **1. The blocker was not this task's, and it was hiding in plain sight.**
  The first push showed `dashboard` failing — expected to be Pages — and
  `validate` failing too. Reading back through the API, **`validate` had
  failed on every one of at least fourteen consecutive commits**, back past
  `TASK-0113`, while `tests/validate.sh` passed locally every single time and
  `validate.yml`'s header said `STATUS: VERIFIED`.

  The message was `STANDARD: scripts/sync-decision-standard.sh failed`. The
  cause is **a file mode, not that script**. This checkout is on `/mnt/c`
  where `core.filemode` is false, so `chmod +x` changes nothing git records,
  and drvfs reports every file executable anyway — a script committed
  `100644` runs perfectly here and nowhere else. `validate.sh` invokes that
  one *without* an interpreter prefix. **Eleven tracked scripts were in that
  state, three of them added by `TASK-0122` the same day.** Reproduced by
  cloning to ext4 and running the gate, where the CI message appears
  verbatim. Fixed in `bd4160c` with `git update-index --chmod=+x` and gated:
  a tracked file beginning `#!` must be recorded executable, no carve-outs.
  **`validate` is green on `bd4160c`, the first green run in fourteen
  commits.**

  I had already met this defect and not recognised it: running
  `build-dashboard.sh` in a fresh clone during `TASK-0122` gave
  `Permission denied`, and I worked around it with `bash` instead of asking
  why.

  **2. The workflow's own build half is proven; only the deploy is not.**
  On both `c30a568` and `bd4160c`, checkout, `Generate the dashboard`,
  `Refuse to publish a degraded page` and the model cleanup all **succeed**
  on a clean runner — so `fetch-depth: 0` works and the guard passes against
  real full history. The run then fails at `actions/configure-pages` with
  `Get Pages site failed. Error: Not Found`.

  **3. Pages cannot be enabled from here, and that is a permission, not a
  bug.** `POST /repos/armandomartires/ai-toolbox/pages` with the owner PAT
  returns `403 Resource not accessible by personal access token`; creating a
  Pages site needs repo admin. `enablement: true` in the workflow is
  necessary and not sufficient. This is the `TASK-0016`/`TASK-0017` shape:
  the agent writes the procedure, the human executes it, the agent records
  the evidence.

  **4. The visibility correction stands on measurement.** `AGENTS.md` said
  `(private)`; the API says `"visibility": "public"` and
  `raw.githubusercontent.com` serves `.ai/planning/BACKLOG.md` with no token.
  Confirmed as intended by the human, so the line is corrected and now states
  plainly that everything committed here is world-readable.

- Validation:
  - `tests/validate.sh` → `OK` locally, and **`success` in CI on `bd4160c`**
    (run listed against that sha) — the figure that matters, since local
    green was exactly what was misleading.
  - The workflow guard dry-run before pushing: full history →
    `history OK: 249 commits, 120 task briefs, 10 sprints`, exit 0; shallow
    clone → `::error::git history is degenerate (1 commit(s)) …`, exit 1.
  - Both workflow files parsed as YAML before pushing.
  - The mode check observed failing on a reverted bit
    (`NOT EXECUTABLE: scripts/sync-decision-standard.sh …`) and passing on
    restore.
  - Not yet validated: the deployed page. No deploy has run.

- Result: **Blocked on one human action**, with everything either side of it
  done and evidenced. Acceptance criteria 1-3 and 8 cannot be met until Pages
  exists. Criteria 4-7 are met: the guard is proven on both inputs, nothing
  is committed, `validate.yml` is unchanged in behaviour, and `AGENTS.md` no
  longer claims the repo is private.

  **The human action, once:**
  `Settings → Pages → Build and deployment → Source: "GitHub Actions"`,
  then `Actions → dashboard → Run workflow`. The page then serves at
  `https://armandomartires.github.io/ai-toolbox/` and updates on every push
  to `master`.

- Commit: `c30a568` (workflow, `AGENTS.md`, `.gitignore`); `bd4160c` (the
  executable-bit fix and its gate — separate because it is a different
  defect, found while running this one). A third records this log.
- Push: **confirmed** for both — `884f859..c30a568` and `c30a568..bd4160c`
  to `origin/master`.
