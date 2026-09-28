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

- Status: in_progress   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-28
- Updated: 2026-09-28

Requested by the human on 2026-09-28 with no sprint open, who also confirmed
that public visibility is intended — a decision this task records rather than
takes.

## Execution log

### Attempt 1

- Date: 2026-09-28
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
