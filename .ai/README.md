# .ai — governance layer

Live files hold state, not history (ADR-0033); their line budgets are gated.

- `context/`: CURRENT_STATE.md (≤ 200 lines), PROJECT_MAP.md, GLOSSARY.md.
- `decisions/`: `NNNN-short-title.md`, for lasting decisions only. The identifier is still `ADR-NNNN`, in the H1 and in prose (TASK-0024).
- `planning/`: ROADMAP.md, BACKLOG.md, SPRINT-CURRENT.md (≤ 80 lines), `plans/`.
  - **Closing a backlog row.** The closed row's *Ready when* cell reads *Closed <date> by `TASK-NNNN`* (or an `ADR-` or `REVIEW-` id). That artifact must exist, and a task must read `done` or `cancelled`.
  - Update the "N items are open" sentence in the same commit. `scripts/check-backlog-closures.py` checks both (B-038, B-047).
- `tasks/`: TODO.md (≤ 400 lines, one line per task), `TASK-*.md`, `completed/`.
- `sessions/`: `SESSION-*.md` and INDEX.md. These are short records, not transcripts.
- `reviews/`: `REVIEW-*.md`.
- `templates/`: PLAN, TASK, SESSION, ADR and REVIEW, rendered from the project-migration schemas.

Process, statuses and the definition of done are defined in AGENTS.md.
