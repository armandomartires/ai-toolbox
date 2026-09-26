---
kind: review
framework: project-workflow
id_placeholder: S###
date_placeholder: YYYY-MM-DD
sprint_placeholder: S###_Name
filename_pattern: reviews/{id}-checkpoint.md
title_pattern: {id}-checkpoint
allow_extra: true
---

!preamble
**Date**: {date}
**Sprint completed**: `{sprint}`

## State of the project
!phase after
!required true
!terse
verifiable facts as of this date
!standard
Concrete, verifiable facts as of this date: test count, what works, what
doesn't, what's known-broken-but-accepted.
!explicit
Write only facts you can point at: the test count, the components that work,
the ones that do not, and what is known-broken and deliberately accepted.
No plans and no intentions — those belong in the roadmap.
!literal
Replace this comment with a bullet list of facts true on the date above:
  - how many tests there are, and how many pass
  - what works
  - what does not work
  - what is broken but deliberately accepted, and why
Write only things you can verify right now. Do not write plans.
Delete this comment when done.

## What changed this sprint
!phase after
!required true
!terse
brief summary — link the briefs, don't re-explain them
!standard
Brief summary — link to `../30.ROADMAP.md`'s sprint table and the individual
`../tasks/S###.*` briefs rather than re-explaining each one.
!literal
Replace this comment with a short summary, then links.
Link to `../30.ROADMAP.md` and to each `../tasks/S###.*` brief from this
sprint. Do NOT re-explain what each task did — the brief already says it,
and a second copy here will drift from it. Delete this comment when done.

## Open risks / known gaps
!phase after
!required true
!terse
project-level risk framing, not a duplicate of the ad-hoc list
!standard
Anything discovered but not fixed. Should already be in
`../35.AD_HOC_TASKS.md` if it's actionable — this section is for framing
risk at the project level, not duplicating that list.
!literal
Replace this comment with the risks and gaps you know about but have not
fixed. If an item is actionable it belongs in `../35.AD_HOC_TASKS.md`; put
it there and reference it here rather than copying it. This section is for
naming risk at the project level. Delete this comment when done.

## Confidence assessment
!phase after
!required true
!terse
what you are sure of, what is untested, what needs a second reader
!standard
Honest self-assessment: what are you confident is correct, what is untested
in practice, what would you want a second pair of eyes on.
!literal
Replace this comment with three short lists:
(1) What you are confident is correct, and why.
(2) What has not been tested in real use.
(3) What you would want another person to review.
List (2) and (3) must not be empty. Delete this comment when done.
