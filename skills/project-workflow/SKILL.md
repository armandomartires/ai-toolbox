---
name: project-workflow
description: "Scaffolds and maintains a project's .ai/ directory - a consistent plan/develop/test/validate documentation convention (sprint-prefixed task briefs, architecture decision records, roadmap, ad-hoc task list, review checkpoints), and generates each artifact from the schema that owns its shape. USE FOR: setting up project planning docs, scaffolding .ai, writing a task brief, writing an ADR, recording a decision, tracking sprint history, starting a new project's documentation structure, standardizing how a project plans/develops/tests/validates work. DO NOT USE FOR: writing normative project documentation (AGENTS.md, docs/ reference guides) - this skill is only for the WHY/WHAT'S-NEXT layer, never the WHAT-IS layer."
license: MIT
metadata:
  author: armando.martires
  version: "4.0.0"
---

# project-workflow

Scaffolds `.ai/`, maintains its plan/develop/test/validate convention
(full text: `templates/00.CONVENTIONS.md`, copied verbatim). Use for:
scaffolding; a task brief; an ADR; an ad-hoc item; a checkpoint.

**Not `project-migration`.** That skill retrofits a *live* repo onto a
**different** framework (`context/`, `planning/`, `sessions/`,
`templates/`, `TASK-####`, `ADR-NNNN-*.md`). This one owns the
`00.CONVENTIONS.md` + `20/30/35` + `reference/` layout with
`S###.T###` tasks and `NNNN-title.md` ADRs. Deliberately divergent —
ADR-0013; don't "align" them. The two share the generator below and
nothing else: a tool, not a shape.

> **`.ai/` = why/next. `AGENTS.md`+`docs/` = what is. Git = what
> changed.** One owner per fact — link, never copy.

## Scaffolding

1. Resolve `root`/`entrypoint` via `.ai-layout.json`
   (`templates/reference/layout-declaration.md`); default
   `.ai/`+`00.CONVENTIONS.md`.
2. Don't overwrite an existing layer; ask if names mismatch.
3. Copy `templates/` into `root` as-is; skip `00.CONVENTIONS.md` if
   `entrypoint` differs. **Copy, never symlink.**
4. Fill `20.PLAN.md`/`30.ROADMAP.md` with real state, not placeholders;
   offer (don't assume) a `git log` back-fill.
5. Pointer to `<root>/<entrypoint>` from `AGENTS.md`/`README.md`, unless
   `entrypoint` **is** `AGENTS.md`.

## Generating an artifact

**Generate the skeleton; don't copy a template and imitate it.**

```
scripts/new-artifact.sh --kind task|adr|review|adhoc \
    [--framework project-migration] [--guidance LEVEL] \
    --id S002.T004_CacheHeaders --sprint S002_Performance --out PATH
```

It emits every heading in schema order with the identifiers and date
already substituted, and guidance in `<!-- FILL: … -->` comments you
replace. You never type a heading, choose an order, or invent an ID — so
none of those can drift.

`scripts/check-artifact.sh <file> [--kind task]` proves a finished
artifact matches its schema: required headings present, in order, no
superseded heading, no marker left behind, no after-the-work section left
empty on something marked complete. It reads the headings *from the
schema*, so changing a schema never means editing the checker.

**`schemas/` owns the shape** — `schemas/README.md` is the format.
`templates/` is *generated* from it by `../../scripts/sync-templates.sh`
and carries a do-not-edit banner; edit a schema and re-run. Before
ADR-0027 the shape was prose in four places and this skill's own template
contradicted this file about the task ID format.

### `--guidance`

Four prose densities. **The filled artifact is identical at every level** —
guidance lives only inside comments, which is verified by generating all
four, stripping the comments and diffing.

| Level | Suggested for | Slot carries |
|---|---|---|
| `terse` | frontier, 500b, 300b | a noun phrase |
| `standard` | 120b | one or two sentences of intent (default) |
| `explicit` | 60b, 30b | numbered instruction naming each field |
| `literal` | 12b | step-by-step, ending in "delete this comment" |

**That column is a suggestion, not a resolver.** No tier name appears in
any schema or script, and nothing maps a model to a level — model
references have one owner and it is not here (ADR-0018 clause 7,
ADR-0027 clause 4).

## Task briefs and ADRs

`tasks/S###.T###_Name.md` (scheme: `templates/reference/task-lifecycle.md`):
Goal+Inputs+Plan before, Verification+Outputs+Status after (incl.
fails-when-reverted). The schema marks which is which with `!phase`, so
the rule is checkable rather than remembered. `Inputs`/`Outputs` are the
handover contract — a task must be startable cold; see
`templates/reference/session-handover.md`.

`decisions/NNNN-title.md`: calls expensive to reverse. Link the affected
doc; don't restate it.

## Maintaining

`templates/reference/skill-maintenance.md`. Content changes bump the
version above; a change to how artifacts are produced is a major bump.
