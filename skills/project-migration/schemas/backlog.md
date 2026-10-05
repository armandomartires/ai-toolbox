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

# An entry, not a file: one row of BACKLOG.md's table, which is an index
# holding many of them and is not regenerated (the same reason
# 35.AD_HOC_TASKS.md is not). The generator prints the row for pasting.
#
# Transcribed from a count of the 53 rows on 2026-10-05 (B-042, TASK-0147),
# not designed. Every row had exactly these 8 cells, under this header.
# `columns:` is the ONE owner of that list: ai-toolbox's
# scripts/check-backlog-closures.py checks BACKLOG.md's header and each row's
# cell count against it, and tests/validate.sh checks the scaffold's header.
#
# Observed but NOT enforced, because no rule states them yet (ADR-0008):
# Priority, Value and Risk were low/medium/high in all 159 cells; Status is a
# bold word, **ready** or **waiting** while open; a closed row follows
# .ai/README.md's *Closing a backlog row*.

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
Do not paste this comment.
