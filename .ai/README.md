# .ai — governance layer

- `context/` — CURRENT_STATE.md, PROJECT_MAP.md, GLOSSARY.md
- `decisions/` — NNNN-short-title.md (lasting decisions only). The
  *identifier* stays `ADR-NNNN`, in each file's H1 and in prose; only the
  filename omits the prefix, matching the `project-workflow` convention
  (`00.CONVENTIONS.md`). TASK-0024.
- `planning/` — ROADMAP.md, BACKLOG.md, SPRINT-CURRENT.md, plans/
  - **Closing a backlog row**: a row whose Status says done or closed names
    what closed it in its *Ready when* cell, as *Closed <date> by
    `TASK-NNNN`* (or an `ADR-` or `REVIEW-`). Without that phrase, the first
    id cited counts. The artifact must exist, and a closing task's Status must
    read `done` or `cancelled`. Close the row in the same commit that closes
    the task. `scripts/check-backlog-closures.py` checks this in
    `tests/validate.sh`; it cannot see a row left open after its task closed
    (B-038, TASK-0142).
- `tasks/` — TODO.md, TASK-*.md, completed/
- `sessions/` — SESSION-*.md, INDEX.md (short records, not transcripts)
- `reviews/` — REVIEW-*.md
- `templates/` — PLAN, TASK, SESSION, ADR, REVIEW

Process, statuses, and definition of done are defined in AGENTS.md.
