---
name: project-workflow
description: "Scaffolds and maintains a project's .ai/ directory - a consistent plan/develop/test/validate documentation convention (sprint-prefixed task briefs, architecture decision records, roadmap, ad-hoc task list, review checkpoints), and generates each artifact from the schema that owns its shape. USE FOR: setting up project planning docs, scaffolding .ai, writing a task brief, writing an ADR, recording a decision, tracking sprint history, starting a new project's documentation structure, standardizing how a project plans/develops/tests/validates work, and rendering that layer as an agile HTML dashboard (burn-up, burn-down, cumulative flow, velocity, cycle time, dependencies, backlog, roadmap, forecast), optionally published to GitHub Pages or GitLab Pages. DO NOT USE FOR: writing normative project documentation (AGENTS.md, docs/ reference guides) - this skill is only for the WHY/WHAT'S-NEXT layer, never the WHAT-IS layer."
license: MIT
metadata:
  author: armando.martires
  version: "6.0.0"
---

# project-workflow

Scaffolds `.ai/` and maintains its plan/develop/test/validate convention. The full convention is `templates/00.CONVENTIONS.md`, which is copied verbatim. Use this skill for scaffolding, a task brief, an ADR, an ad-hoc item or a checkpoint.

**This is not `project-migration`.** That skill retrofits a live repository onto a different framework: `TASK-####` briefs, `ADR-NNNN-*.md`, `context/`, `planning/`. This one owns:
- the `00.CONVENTIONS.md` + `20/30/35` + `reference/` layout
- `S###.T###` task ids
- `NNNN-title.md` ADRs

The divergence is deliberate (ADR-0013 in ai-toolbox). The two skills share only the generator.

> **`.ai/` = why and what's next. `AGENTS.md` + `docs/` = what is. Git = what changed.** Each fact has one owner: link to it, never copy it.

## Principles (ADR-0033 in ai-toolbox)

- **One task, one module.** Identification comes first (Status, Sprint, dates, Applies to, Depends on), then the procedure, then the record.
- **Git is the record.** A commit subject carries the task id, so a brief never holds its own hash.
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
3. Copy `templates/` into `root` as-is. Copy; never symlink.
4. Fill `20.PLAN.md` and `30.ROADMAP.md` with real state. Offer a `git log` back-fill, but do not assume one is wanted.
5. Point to `<root>/<entrypoint>` from `AGENTS.md` or `README.md`.

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

**ADR:** `decisions/NNNN-title.md`, for calls that are expensive to reverse. Link the affected doc; don't restate it.

## The dashboard

`scripts/build-dashboard.sh --root .ai --out docs/dashboard.html` renders the layer as one self-contained HTML file: burn-up, burn-down, flow, velocity, cycle time, dependencies, backlog, roadmap and forecast. It detects both corpus layouts.

`references/dashboard.md` covers what each metric does not prove, and which fields and headings must keep their shape.

- **Vendored.** `dashboard/` is a copy synced from `sigma-llmwiki` (`dashboard/VENDORED.md`). Never edit it here.
- **Publishing is optional.** Declare destinations in `dashboard-publish.conf`, then run `scripts/publish-dashboard.sh render` to write GitHub Pages and/or GitLab Pages pipelines. `render --check` fails on drift. Full procedure: `references/dashboard.md`, *Publishing it*.

## Maintaining

See `templates/reference/skill-maintenance.md`. A content change bumps the version. A change to how artifacts are produced is a major bump.
