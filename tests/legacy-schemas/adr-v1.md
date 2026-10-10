---
kind: adr
framework: project-migration
id_placeholder: ADR-XXXX
title_placeholder: Title
date_placeholder: YYYY-MM-DD
filename_pattern: decisions/{id}-{name}.md
title_pattern: {id} — {title}
allow_extra: true
---

# FROZEN (ADR-0033, TASK-0151): the adr shape before v2. tests/validate.sh
# checks ADR-0001 to ADR-0033 against this copy; never edit it.

# Transcribed from a census of the 27 ADRs in .ai/decisions/ taken
# 2026-09-26, NOT from .ai/templates/ADR.md -- that file is 71 bytes of bare
# headings while real ADRs reach 37 KB, the largest template/reality gap in
# the repo and one of the three findings that motivated ADR-0027.
#
# Status, Context, Decision and Consequences appear in all 27 and are
# required. Alternatives appears in 11, under TWO spellings -- "considered"
# (7) and "rejected" (4). The canonical form is declared below and is
# optional; the variant is NOT listed as superseded, because picking a winner
# would flag four accepted ADRs over a synonym. A future task may settle it.
#
# allow_extra: true -- real ADRs add "Falsifiable claims", "Clarification"
# and "What ratification unblocks", and those are load-bearing.

## Status
!phase before
!required true
!terse
proposed / accepted / rejected / superseded, with a date
!standard
One of: proposed, accepted, rejected, superseded by ADR-XXXX, deprecated —
with the date it reached that state.
!literal
Replace this comment with one line: the status word, then the date.
The status must be one of: proposed, accepted, rejected,
superseded by ADR-XXXX, deprecated. Use no other word.
Then, if a task drove this decision, add a line naming it.
Delete this comment when done.

## Context
!phase before
!required true
!terse
the concrete situation that forced a decision
!standard
What situation forced a decision? The actual, concrete problem — not the
abstract category of problem. Name the commit, task, or observation that
made it real.
!explicit
Name the concrete event that forced this decision: the commit, task, review
finding or observation, with its date. A context describing a category of
problem rather than an instance of one is the failure this guards against.
!literal
Replace this comment with 2-6 sentences answering, in order:
(1) What actually happened? Name the task, commit or observation, and when.
(2) Why did it need a decision rather than just a fix?
Describe what occurred, not the general class of problem it belongs to.
Delete this comment when done.

## Decision
!phase before
!required true
!terse
what was decided, in one sentence
!standard
What was decided. State it as a single sentence where possible, then number
the clauses if it has parts. If a normative document states the rule, link
that document rather than restating it here.
!literal
Replace this comment with the decision.
State it in one sentence if you can. If it has several parts, number them
1., 2., 3. so they can be cited individually later.
If the rule is already written in `AGENTS.md` or another normative document,
link to that document instead of copying its words. Delete this comment.

## Alternatives considered
!phase before
!required false
!terse
what else was possible, and why each was rejected
!standard
What else could have been done, and why each was rejected. Include options
that look obviously wrong in hindsight — recording that they were considered
and rejected, rather than never thought of, is what this preserves.
!literal
List each option that was NOT chosen. For each one write:
  - the option, in a few words
  - why it was rejected
Include options that look obviously wrong now. That they were considered
and rejected, rather than never thought of, is the point. Delete this
comment when done, or delete the whole section if there were no
alternatives worth recording.

## Consequences
!phase before
!required true
!terse
what this makes easier, and what it forecloses
!standard
What this makes easier, and what it makes harder or rules out. Be honest
about trade-offs — a decision with no downsides usually means the downsides
haven't been found yet.
!literal
Replace this comment with two bullet lists:
(1) What this decision makes easier.
(2) What it makes harder, or rules out entirely.
The second list must not be empty. A decision with no downsides means the
downsides have not been found yet. Delete this comment when done.
