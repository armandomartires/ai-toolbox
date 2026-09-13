---
name: project-workflow
description: "Scaffolds and maintains a project's .ai/ directory - a consistent plan/develop/test/validate documentation convention (sprint-prefixed task briefs, architecture decision records, roadmap, ad-hoc task list, review checkpoints). USE FOR: setting up project planning docs, scaffolding .ai, writing a task brief, writing an ADR, recording a decision, tracking sprint history, starting a new project's documentation structure, standardizing how a project plans/develops/tests/validates work. DO NOT USE FOR: writing normative project documentation (AGENTS.md, docs/ reference guides) - this skill is only for the WHY/WHAT'S-NEXT layer, never the WHAT-IS layer."
license: MIT
metadata:
  author: armando.martires
  version: "3.0.0"
---

# project-workflow

Scaffolds `.ai/`, maintains its plan/develop/test/validate convention
(full text: `templates/00.CONVENTIONS.md`, copied verbatim). Use for:
scaffolding; a task brief; an ADR; an ad-hoc item; a checkpoint.

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

## Task briefs and ADRs

`templates/tasks/0000_TEMPLATE.md` → `tasks/S###.T###_Name.md`: Goal+Plan
before, Verification+Status after (incl. fails-when-reverted).

`templates/decisions/0000-TEMPLATE.md` → `decisions/NNNN-title.md`: calls
expensive to reverse. Link the affected doc; don't restate it.

## Maintaining

`templates/reference/skill-maintenance.md`. Content changes bump the
version above.
