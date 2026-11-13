---
name: project-workflow
description: "Scaffolds and maintains a project's .ai/ planning layer - a plan/develop/test/validate convention of sprint-prefixed task briefs, ADRs, roadmap, ad-hoc task list and review checkpoints - generating each artifact from the schema that owns its shape. USE FOR: scaffolding .ai or a new project's documentation structure, writing a task brief or ADR, recording a decision, tracking sprint history, building the agile HTML delivery dashboard (burn-up, velocity, forecast) or publishing it to GitHub or GitLab Pages, and mapping artifacts to issues, milestones, boards and the wiki on a GitLab or GitHub tracker. DO NOT USE FOR: normative project documentation (AGENTS.md, docs/ reference guides) - this skill owns only the WHY/WHAT'S-NEXT layer, never the WHAT-IS layer."
license: MIT
metadata:
  author: armando.martires
  version: "8.0.0"
---

# project-workflow

Scaffolds `.ai/` and maintains its plan/develop/test/validate convention. The full convention is `templates/00.CONVENTIONS.md`, which is copied verbatim. Use this skill for scaffolding, a task brief, an ADR, an ad-hoc item or a checkpoint.

**This is not `project-migration`.** That skill retrofits a live repository onto a different framework: `TASK-####` briefs, `ADR-NNNN-*.md`, `context/`, `planning/`. This one owns:
- the `00.CONVENTIONS.md` + `10.CURRENT_STATE.md` + `20/30/35` + `40.RISK_REGISTER.md` + `sessions/` + `reference/` layout (`10` is state, at most 200 lines; `40` carries a `Last reviewed` date; `sessions/` holds one record per working session)
- `S###.T###` task ids
- `ADR-NNNN-title.md` ADRs (`new-artifact.sh --kind adr` numbers the next one past both `NNNN-` and `ADR-NNNN-` files)

The divergence was deliberate (ADR-0013 in ai-toolbox), and ADR-0066 now replaces it with one convention: this skill's numbered layout, with `ADR-NNNN-title.md` decision files, for both skills. Templates for `10.CURRENT_STATE.md`, `40.RISK_REGISTER.md` and sessions are generated from their schemas like the rest.

> **`.ai/` = why and what's next. `AGENTS.md` + `docs/` = what is. Git = what changed.** Each fact has one owner: link to it, never copy it.

## Principles (ADR-0033 in ai-toolbox)

- **One task, one module.** Identification comes first (Status, Sprint, dates, Applies to, Depends on), then the procedure, then the record.
- **Git is the record.** A commit subject carries the task id, so a brief never holds its own hash.
- **A brief is hybrid (ADR-0066).** Bold header fields, Goal, Inputs, Plan, a required `## Acceptance criteria`, Verification, Outputs / handover. Statuses: not started, in progress, review, blocked, completed, cancelled. Briefs written to the earlier shape check against `tests/legacy-schemas/workflow-task-v1.md` in ai-toolbox.
- **Budgets are gated.** A schema's `max_lines` is enforced by `check-artifact.sh`: 80 lines for a brief, an ADR or a review.
- **Live files hold state, not history.** `20.PLAN.md` and `30.ROADMAP.md` say where things are now; git keeps how they got there.
- **Every task ends with a short report:**

  ```
  Result:   done | blocked | partial — one line
  Changed:  file or component — what
  Verified: command → observed output
  Pushed:   remote ✓ @<short hash>   (or: not pushed — why)
  Next:     one line
  ```

## Scaffolding

1. Resolve `root` and `entrypoint` through `.ai-layout.json` (`templates/reference/layout-declaration.md`). The default is `.ai/` + `00.CONVENTIONS.md`.
2. Never overwrite an existing layer. Ask if the names do not match.
3. Ask which **work tracker** the project uses: **files** (this layer), **GitLab** (issues, milestones, boards, labels, wiki) or **GitHub** (issues, milestones, Projects, wiki). Never choose for the human. Run `scripts/tracker.sh init --tracker files|gitlab|github [--gitlab-project group/name | --github-repo owner/name]`. On a forge, set the project up by hand per `templates/reference/tracker.md`.
4. Copy `templates/` into `root` as-is. Copy; never symlink. Skip `templates/forge/` (the forge variant). On a forge tracker, copy only `00.CONVENTIONS.md`, `decisions/` and `reference/`, plus `templates/forge/20.PLAN.md` as `<root>/20.PLAN.md`.
5. Files tracker: fill `20.PLAN.md` and `30.ROADMAP.md` with real state. Offer a `git log` back-fill, but do not assume one is wanted. Forge tracker: fill the forge `20.PLAN.md` (current state, open milestone and board by name, blocked, next action; no task list) with real state.
6. Point to `<root>/<entrypoint>` from `AGENTS.md` or `README.md`.
7. Ask how the project handles secrets: **local** `.env`, **HashiCorp Vault** (its own KV mount), **GitLab** CI variables, or **GitHub** Actions secrets. Never choose for the human. With the `vault-secrets` skill installed, run its `scripts/vault_secrets.py init --backend <choice> --project <name>`; without it, write `secrets.conf` by hand (`templates/reference/environments-and-secrets.md`). Creating a Vault mount is a Vault admin's step, never the agent's.
8. Files tracker only: with a remote, run `scripts/publish-dashboard.sh decision`. On exit 1, ask whether to publish the dashboard to **GitHub Pages**, **GitLab Pages**, both or neither, and which forge each `unknown` host is. Never choose for the human. **Yes:** write `dashboard-publish.conf` (every `status.` line `UNVERIFIED - never run`), `render`, commit. **No:** write `targets = none` with a dated comment, so it is not asked again.

## The work tracker

`tracker.conf` at the repository root says where work is tracked (ai-toolbox `ADR-0037`). A missing file means `files`.

- **files:** everything in this skill applies as written.
- **gitlab / github:** tasks are issues, sprints are milestones, the board is the plan, backlog and ad-hoc items are labelled issues, review checkpoints are issues, and end-user docs live in the wiki. `00.CONVENTIONS.md`, `reference/`, ADRs and developer docs stay in the repository, and so does one state file, `20.PLAN.md` in its forge variant (`templates/forge/20.PLAN.md`): current state, the open milestone and board by name, what is blocked and the next action, with no task list, so a session starts without calling the forge. Same size budget as the files-tracker one. Changing tracker to a forge leaves the old files only in git: tag the last commit that holds them `pre-forge-migration` before the `git rm` (`tracker.md`, *Changing the tracker*). The mapping, labels, commit subjects (`(#123)`), access and tier limits are in `templates/reference/tracker.md`.
- `scripts/tracker.sh check` prints the declaration for scripts; `scripts/tracker.sh decision` shows it beside the remotes. Neither calls the forge.
- Issue bodies are still generated with `new-artifact.sh` and checked with `check-artifact.sh` before they are pasted.

## Generating an artifact

Generate the skeleton; never copy a template and imitate it.

```
scripts/new-artifact.sh --kind task|adr|review|adhoc \
    [--framework project-migration] [--guidance terse|standard|explicit|literal] \
    --id S002.T004_CacheHeaders --sprint S002_Performance --date 2026-01-31 --out PATH
```

- **Generate.** Headings, their order and the ids come from `schemas/`. Guidance sits in `<!-- FILL: … -->` comments, which you delete as you fill. `--guidance` changes only those comments; the filled file is the same at every level.
- **Check.** `scripts/check-artifact.sh <file> [--kind task]` checks:
  - required headings are present, in order
  - no superseded heading remains
  - no marker is left
  - no after-the-work section is empty on a completed artifact
  - the file is within its line budget
- **Change a shape** by editing its schema (format: `schemas/README.md`). `templates/` is generated from the schemas by ai-toolbox's `scripts/sync-templates.sh`.

**Task brief:** `tasks/S###.T###_Name.md`. Goal, Inputs and Plan are written before the work. Verification (including the fails-when-reverted check), Outputs and Status notes are written after it. Inputs and Outputs are the handover contract (`templates/reference/session-handover.md`).

**ADR:** `decisions/ADR-NNNN-title.md`, for calls that are expensive to reverse. Link the affected doc; don't restate it.

## The dashboard

**Files tracker only.** On a forge, `build-dashboard.sh` exits 2 with `not applicable`, `publish-dashboard.sh decision` answers `not applicable`, and `render --check` reports a conf that still declares targets (`references/dashboard.md`, *Files tracker only*).

`scripts/build-dashboard.sh --root .ai --out docs/dashboard.html` renders the layer as one self-contained HTML file: burn-up, burn-down, flow, velocity, cycle time, dependencies, backlog, roadmap and forecast. It detects both corpus layouts.

`references/dashboard.md` covers what each metric does not prove, and which fields and headings must keep their shape.

- **Owned here.** `dashboard/` is edited in this repository (`dashboard/OWNERSHIP.md`); its checks are `scripts/check-dashboard.sh` and its fixtures.
- **Rebuild it** (a step, not a hook; the output stays gitignored):
  - when a plan is approved **and** every file it touches is written: `20.PLAN.md`, `30.ROADMAP.md`, briefs, ADRs, `35.AD_HOC_TASKS.md`;
  - after the push to every remote is confirmed. Before that push, if `publish-dashboard.sh decision` exits 1, ask (Scaffolding, step 8). A published page is rebuilt by its own CI on that push; never upload the local file.
- **Publishing is optional.** Declare destinations in `dashboard-publish.conf`, then run `scripts/publish-dashboard.sh render` to write GitHub Pages and/or GitLab Pages pipelines. `render --check` fails on drift. The pipeline runs a copy of this skill inside the project: make and update it only with `scripts/vendor-skill.sh --into <repo> --write`, check it with `--check`, and gate it with `--verify`. Full procedure: `references/dashboard.md`, *Publishing it*.

## Maintaining

See `templates/reference/skill-maintenance.md`. A content change bumps the version. A change to how artifacts are produced is a major bump.
