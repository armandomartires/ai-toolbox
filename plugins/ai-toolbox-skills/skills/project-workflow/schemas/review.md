---
kind: review
framework: project-workflow
id_placeholder: S###
date_placeholder: YYYY-MM-DD
sprint_placeholder: S###_Name
filename_pattern: reviews/{id}-checkpoint.md
title_pattern: {id}-checkpoint
allow_extra: true
max_lines: 80
---

!preamble
!terse
a point-in-time snapshot: write once, never edit afterwards
!standard
A snapshot of one date. Write it once; the next checkpoint corrects it.
!body
**Date**: {date}
**Sprint completed**: `{sprint}`

## State of the project
!phase after
!required true
!terse
verifiable facts as of this date
!standard
Facts as of this date: test count, what works, what doesn't, what is
broken but accepted. No plans.
!literal
Bullets only: test count and passes; what works; what does not; what is
broken but accepted, and why.

## What changed this sprint
!phase after
!required true
!terse
links to the briefs, not a retelling
!standard
One line, then links to `../30.ROADMAP.md` and each `../tasks/S###.*` brief.
!literal
One summary line, then one link per brief. Do not re-explain the briefs.

## Open risks / known gaps
!phase after
!required true
!terse
project-level risk, not a copy of the ad-hoc list
!standard
Risks discovered but not fixed. Actionable items go in
`../35.AD_HOC_TASKS.md`; reference them here.
!literal
Bullets naming each risk. Reference ad-hoc entries; do not copy them.

## Confidence assessment
!phase after
!required true
!terse
sure of, untested, needs a second reader
!standard
Three short lists: confident of, untested in practice, wants a second reader.
!literal
Three short lists: confident, untested, needs review. The last two are
never empty.
