---
kind: adr
framework: project-workflow
id_placeholder: NNNN
title_placeholder: Short, decision-shaped title
date_placeholder: YYYY-MM-DD
sprint_placeholder: S###_Name / S###.T###_Name
filename_pattern: decisions/{id}-{name}.md
title_pattern: {id} — {title}
allow_extra: true
---

!preamble
**Status**: proposed | accepted | superseded by NNNN | deprecated
**Date**: {date}
**Sprint / task**: `{sprint}`

## Context
!phase before
!required true
!terse
the concrete situation that forced a decision
!standard
What situation forced a decision? What was the actual, concrete problem —
not the abstract category of problem. Link to the specific commit, bug
report, or incident that made this real, not hypothetical.
!explicit
Name the concrete event that forced this. Include the commit, bug report or
incident that made it real. A context that describes a category of problem
rather than an instance of one is the failure this section guards against.
!literal
Replace this comment with 2-5 sentences answering, in order:
(1) What happened, concretely? Name the commit, incident or report.
(2) Why did it need a decision rather than a fix?
Do not describe the general category of problem. Describe what occurred.
Delete this comment when done.

## Decision
!phase before
!required true
!terse
what was decided, in one sentence
!standard
What was decided, stated as a single clear sentence if possible. If the
decision is codified in `AGENTS.md` or elsewhere, **link to it** rather than
restating it here — this file explains *why*, the normative doc states
*what*.
!literal
Replace this comment with the decision, in one sentence if you can.
If the rule is already written in `AGENTS.md` or another normative document,
link to that document instead of copying its words here. This file records
why; that document records what. Delete this comment when done.

## Alternatives considered
!phase before
!required true
!terse
what else was possible, and why each was rejected
!standard
What else could have been done, and why it was rejected. Include the option
that was *not* chosen even if it seems obviously wrong in hindsight — the
fact that it was considered and rejected (rather than never occurring to
anyone) is exactly what this file exists to preserve.
!literal
List each option that was NOT chosen. For each one write:
  - the option, in a few words
  - why it was rejected
Include options that look obviously wrong now. Recording that they were
considered and rejected, rather than never thought of, is the whole point
of this section. Delete this comment when done.

## Consequences
!phase before
!required true
!terse
what this makes easier, and what it forecloses
!standard
What does this decision make easier? What does it make harder or foreclose?
Be honest about trade-offs — a decision with no downsides usually means the
downsides haven't been found yet.
!literal
Replace this comment with two bullet lists:
(1) What this decision makes easier.
(2) What it makes harder, or rules out entirely.
The second list must not be empty. A decision with no downsides means the
downsides have not been found yet. Delete this comment when done.

## Provenance
!phase after
!required true
!terse
commits, related ADRs, related tasks
!standard
Fill in once the decision is committed.
!literal
Fill in each line below once the work is committed. Replace the
angle-bracketed text; delete a line only if it genuinely does not apply.
Delete this comment when done.
!body
- Commit(s): `<hash>` — `<subject line>`
- Related ADRs: (if any)
- Related task(s): `tasks/S###.T###_Name.md`
