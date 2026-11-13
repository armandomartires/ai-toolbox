---
kind: current-state
framework: project-workflow
id_placeholder: current-state
filename_pattern: 10.CURRENT_STATE.md
title_pattern: Current State
max_lines: 200
allow_extra: true
---

# 10.CURRENT_STATE.md (ADR-0066): what is true now, read every session. State,
# not history: edit the fact, never append a narrative; the commit log keeps
# how it got there. The 200-line budget is enforced by check-artifact.sh.

!preamble
!terse
the project's state right now, not its history
!standard
Edit this file to match reality after any significant change. Do not add a
dated log: history is in `reviews/`, `tasks/` and the commit log.
!literal
Change a line so it is true today. Never add "on <date> we did X".
!body

## Where the project is
!phase after
!required true
!terse
one short paragraph: what exists and what is in flight
!standard
What exists and what is in flight, as of the last change. Link the sprint in
`20.PLAN.md`, never copy its tasks.
!literal
Write 3-6 lines: what is built, what is being built, and what is blocked.
!body
Sprint: `S###_Name` (see `20.PLAN.md`).

## Components
!phase after
!required true
!terse
a table of what ships and its state
!standard
One row per component or area: where it lives and its state now.
!literal
One table row per component. State is one word or a short phrase.
!body
| Component | State |
|---|---|
| | |

## Open items
!phase after
!required true
!terse
known gaps, each linked to its owner
!standard
Things known to be unfinished or unverified, each linked to a task or an
`35.AD_HOC_TASKS.md` entry. "none" is a valid answer.
!literal
One bullet per gap, each linking a task or ad-hoc entry. Write "none" if
there are no gaps.
!body
- none

## Standing decisions
!phase after
!required false
!standard
The decisions a reader must hold in mind, one line each, linking the ADR.
!literal
One line per decision with its ADR number. Do not restate the ADR.
!body
- ADR-0000:

## Environment
!phase after
!required false
!standard
What the project runs on and how to run its gate, in a few lines.
!literal
Write the commands to build, test and validate, and the runtime versions.
!body
- Validate:
