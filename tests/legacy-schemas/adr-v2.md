---
kind: adr
framework: project-migration
id_placeholder: ADR-XXXX
title_placeholder: Title
date_placeholder: YYYY-MM-DD
filename_pattern: decisions/{id}-{name}.md
title_pattern: {id} — {title}
allow_extra: true
max_lines: 80
---

# v2 (ADR-0033). Identification first, as bold fields that dashboards read.
# The v1 shape (a `## Status` section) is frozen in ai-toolbox's
# tests/legacy-schemas/adr-v1.md.

!preamble
!standard
Status: proposed, accepted, rejected, superseded by ADR-XXXX or deprecated.
Task: the task or plan that drove this decision.
!body
**Status**: proposed
**Date**: {date}
**Task**:

## Context
!phase before
!required true
!terse
the concrete event that forced a decision
!standard
The concrete event that forced a decision: task, commit or observation, and when.
!literal
Two to five sentences: what happened (task, commit or observation, with
the date), and why it needs a decision rather than a fix.

## Decision
!phase before
!required true
!terse
the decision, in numbered clauses
!standard
The decision in one sentence, or numbered clauses that can be cited.
Link a normative document rather than restating it.
!literal
State the decision in one sentence, or as numbered clauses 1., 2., 3.

## Alternatives considered
!phase before
!required false
!terse
each rejected option, and why
!standard
Each option not chosen, and why. Delete the section if there were none.
!literal
One bullet per rejected option: the option, then why it was rejected.

## Consequences
!phase before
!required true
!terse
what gets easier, and what gets harder
!standard
What this makes easier, and what it makes harder or rules out.
!literal
Two short lists: what gets easier, then what gets harder. The second list
is never empty.
