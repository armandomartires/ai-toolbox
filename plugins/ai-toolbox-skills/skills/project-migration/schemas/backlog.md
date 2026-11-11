---
kind: backlog
framework: project-migration
id_placeholder: B-XXX
title_placeholder: Short statement of the problem observed
date_placeholder: YYYY-MM-DD
task_placeholder: TASK-XXXX
filename_pattern: planning/BACKLOG.md
title_prefix: "| "
title_pattern: {id} | {title} | medium | medium | none | low | **ready** | Raised {date} by `{task}`. What was observed, and what would make it ready. |
columns: ID | Title | Priority | Value | Dependencies | Risk | Status | Ready when
allow_extra: true
---

# One row of BACKLOG.md's table. `columns:` is the one owner of the header,
# checked by scripts/check-backlog-closures.py (B-042, TASK-0147).

!preamble
!terse
one backlog row; replace each cell, keep the pipes
!standard
One row for BACKLOG.md's table: paste it as a single line. Priority, Value
and Risk take low, medium or high. Status is a bold word, **ready** or
**waiting**. "Ready when" says what was observed, by whom, and what would
make it executable.
!literal
Copy the one line that starts with "| " into BACKLOG.md's table, as one
line, below the last row. Then replace, keeping every " | " separator:
  B-XXX        — the next free B- number.
  the title    — one sentence naming the problem you observed.
  medium medium none low — Priority, Value, Dependencies, Risk. Use low,
                 medium or high for Priority, Value and Risk; "none" or the
                 B- ids this depends on for Dependencies.
  **ready**    — or **waiting**, if something must happen first.
  last cell    — when and by which task it was raised, what you observed,
                 and what would make it ready to become a task.
Then update the "N items are open" sentence below the table.
