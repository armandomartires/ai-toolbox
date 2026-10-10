---
kind: adr
framework: project-workflow
id_placeholder: NNNN
title_placeholder: Short, decision-shaped title
date_placeholder: YYYY-MM-DD
sprint_placeholder: S###_Name / S###.T###_Name
filename_pattern: decisions/{id}-{name}.md
title_pattern: {id} — {title}
superseded: Provenance
allow_extra: true
max_lines: 80
---

# Identification first, as the bold fields the dashboard reads. No
# Provenance section: git is the record (ADR-0033 in ai-toolbox), and the
# deciding task is named in the preamble.

!preamble
!standard
Status: proposed, accepted, superseded by NNNN, or deprecated.
!body
**Status**: proposed
**Date**: {date}
**Sprint / task**: `{sprint}`

## Context
!phase before
!required true
!terse
the concrete event that forced a decision
!standard
The concrete event that forced a decision: commit, incident or report, and when.
!literal
Two to five sentences: what happened (commit, incident or report), and why
it needs a decision rather than a fix.

## Decision
!phase before
!required true
!terse
the decision, in one sentence or numbered clauses
!standard
The decision in one sentence, or numbered clauses. Link `AGENTS.md` or the
normative doc rather than restating it: this file says why, that one says what.
!literal
State the decision in one sentence, or as numbered clauses 1., 2., 3.

## Alternatives considered
!phase before
!required true
!terse
each rejected option, and why
!standard
Each option not chosen, and why, including the ones that now look obvious.
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
