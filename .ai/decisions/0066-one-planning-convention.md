# ADR-0066 — One planning convention: project-workflow's numbered layout, with additions, for both skills

**Status**: accepted 2026-11-13 by the human, who chose the convention and answered the design's four questions; supersedes ADR-0013
**Date**: 2026-11-13
**Task**: `TASK-0294`

## Context

ADR-0013 kept `project-workflow` and `project-migration` as two frameworks: different entry files, folders, task ids, ADR names, brief shapes and status sets. The 2026-11-13 explainer showed the cost: two schema sets, two corpus shapes in the dashboard, and readers unsure which applies. The human chose one convention: project-workflow's numbered files and sprint-prefixed task ids, with ADR files named `ADR-NNNN-title.md`. A read-only design (TASK-0294's log) mapped every artifact and counted the impact here: 276 briefs, 63 ADRs, 13 reviews, 31 sessions, 74 backlog rows, about 5,800 `TASK-NNNN` mentions.

## Decision

1. **Layout.** `.ai/00.CONVENTIONS.md` (entry; replaces `.ai/README.md`), `10.CURRENT_STATE.md` (≤200 lines), `20.PLAN.md` (replaces `planning/SPRINT-CURRENT.md`), `30.ROADMAP.md` (`S###_Name` sprint table), `35.AD_HOC_TASKS.md` (replaces `planning/BACKLOG.md`; `B-NNN` keeps its number as `### NNN.`), `40.RISK_REGISTER.md`, `decisions/`, `tasks/`, `reviews/`, `sessions/`, `reference/`. `AGENTS.md` and `CLAUDE.md` stay at the root. `PROJECT_MAP` and `GLOSSARY` move to `docs/`; the tier and turn tables to `docs/development/`. `tasks/TODO.md`, `templates/`, `planning/plans/` and `planning/sprints/` are retired; existing plans and sprint files move to `.ai/archive/`.
2. **Ids.** Tasks `tasks/S###.T###_PascalName.md`; commit subjects end `(S###.T###)`; branches `agent/S###.T###`. ADRs keep their numbers and titles; only the file name gains the prefix (`ADR-0013-x.md`); the next is ADR-0067. Sprint reviews are `reviews/S###-checkpoint.md`, others `reviews/YYYY-MM-DD-slug.md`.
3. **ai-toolbox's sprints.** S1–S11 become S001–S011, so every existing "S9" or "S11" stays true; the five Post-SN buckets become S012–S016, dated in the roadmap; open tasks join S011. T numbers follow the old TASK order within a sprint.
4. **Brief shape (hybrid).** project-workflow's bold header fields and Goal, Inputs, Plan, Verification and Outputs sections, plus a required `## Acceptance criteria` (the unattended run checks for it) and the statuses `review` and `cancelled`. Existing briefs keep their legacy schema.
5. **History is not rewritten.** Files move with `git mv`; only path references are rewritten. Ids inside closed briefs, ADRs, reviews, sessions, commits and comments stay as written and resolve through `.ai/id-map.tsv` (old id, new id, old path, new path), which the gate checks.
6. **`.ai/GOALS.md` stays**, regenerated with the new ids, until the OpenCode and Codex Compass ports read the `.ai/` layer.
7. **The dashboard reads the new names.** It learns the `ADR-` prefix and the id map. *Amended 2026-11-13:* sigma-llmwiki, which it was vendored from, is retired, so the dashboard is owned here (`dashboard/OWNERSHIP.md`) and changed here (TASK-0295).
8. **Order and consent.** The work lands as TASK-0294 to TASK-0302, each green on its own. Four need the human's authorization written in their task files: the change in sigma-llmwiki (TASK-0295), the renaming of this repository (TASK-0299, in a window with no other session on `.ai/`), dropping the old layout's checks (TASK-0300) and project-migration's deletions (TASK-0301).

## Alternatives considered

- **Keep two frameworks (ADR-0013).** Rejected by the human: the double schema set and the confusion outweigh the migration.
- **project-migration's convention for both.** Offered and not chosen.
- **Renumber sprints by date.** Breaks every existing sprint mention.
- **Rewrite ids in history.** History would claim names it never had; a map resolves them instead.

## Consequences

- One schema set, one dashboard shape, one scaffold. project-migration becomes the retrofit path into this convention.
- A one-time rename of about 400 files here; other repositories run the same tool.
- Old `(TASK-NNNN)` commits link to their tasks only through the map, and only once the dashboard reads it.
- In-flight branches on `.ai/` must land or park before TASK-0300.
