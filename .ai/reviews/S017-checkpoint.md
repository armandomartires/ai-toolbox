# S017-checkpoint

**Date**: 2026-11-14
**Sprint completed**: `S017_OnePlanningConvention`

## State of the project

- `tests/validate.sh` passes at `ee09afd` in the pre-commit hook and in CI.
- Both planning skills use one convention, project-workflow's numbered layout
  (`ADR-0066`): `.ai/00.CONVENTIONS.md` to `35.AD_HOC_TASKS.md`, briefs
  `tasks/S###.T###_Name.md`, decisions `ADR-NNNN-*.md`, the id map
  `.ai/id-map.tsv`.
- This repository moved onto it in one commit; the gate rejects the old
  folders (`.ai/planning`, `.ai/context`, `.ai/templates`, `TODO.md`).
- project-migration 6.0.0 scaffolds the convention from project-workflow's
  templates and retrofits a numbered-task repository with `migrate-layout.py`.
- The dashboard reads both ADR names and the id map: 287 tasks before and after
  the rename, all mapped; renamed decisions keep their first-added date.
- Broken but accepted: briefs renamed in the move keep their legacy body
  (`ADR-0066` clause 5); the gate checks them against frozen schemas in
  `tests/legacy-schemas/`.

## What changed this sprint

One planning convention for both skills, and this repository moved onto it.
See `../30.ROADMAP.md` and the briefs:
`../tasks/S017.T001_OnePlanningConventionAdr.md` and the other eight briefs
`../tasks/S017.T00*_*.md` (`S017.T001` to `S017.T009`).

## Open risks / known gaps

- `migrate-layout.py` has run on this repository only; no other older-layout
  repository has gone through project-migration's Phase 3.
- project-migration now needs project-workflow installed beside it; installed
  alone it stops with a message.
- Stale wording: project-workflow's SKILL.md and engine comments, and the
  ansible-ops, design-flow and unattended-ops SKILL.md files, still describe
  project-migration as a separate framework (proposed for S018).
- Another session wrote to `.ai/` during the rename; the one-writer window
  `ADR-0066` asked for was not held.

## Confidence assessment

- Confident of: the rename (every task mapped, the dashboard and Compass agree
  with the id map), the gate's rejection of the old folders, the scaffold's
  output (checked byte for byte against the templates).
- Untested in practice: a retrofit of a repository other than this one; the
  session-schema boundary `SESSION-20261114`, a name compare.
- Wants a second reader: the frozen legacy schemas and where each boundary
  falls (`FIRST_PW_ADR=66`, the id-map rule for briefs).
