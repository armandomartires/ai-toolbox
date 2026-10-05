---
kind: plan
framework: project-migration
id_placeholder: PLAN-XXXX
title_placeholder: Title
date_placeholder: YYYY-MM-DD
filename_pattern: planning/plans/{id}-{name}.md
title_pattern: {id} — {title}
allow_extra: true
---

# Transcribed from a count of the six plans in .ai/planning/plans/ taken
# 2026-10-05 (B-042, TASK-0146), NOT designed. Until then the only statement
# of this shape was a heredoc in ai-project-scaffold.sh.
#
# Objective and Context consulted appear in all six and are required.
# Everything else is optional, because at least one accepted plan lacks it:
#   Findings that shape this plan  3 of 6 (always after Context)
#   Phases / steps                 3 of 6 by this name; "Phases" (2) and
#                                  "The shape of the work" (1) are the same
#                                  section under other names
#   Tasks generated                5 of 6
#   Acceptance criteria            3 of 6 exact; 2 more as
#                                  "Acceptance criteria (plan level)"
#   Risks, Human decisions req.    5 of 6
# Variants are NOT listed as superseded: picking a winner would flag accepted
# plans over a synonym, as the ADR schema reasons about its Alternatives.
#
# allow_extra: true -- real plans add "Resolved ambiguities", "Scope", "Out
# of scope" and "Known unknowns", and those are load-bearing.

## Objective
!phase before
!required true
!terse
what this plan delivers, and why now
!standard
What the plan sets out to deliver and why now: the outcome, not the steps.
Name the request, review or finding that made it necessary.
!literal
Replace this comment with 2-5 sentences answering, in order:
(1) What will be true when this plan is finished?
(2) Who asked for it, or which finding made it necessary, and when?
Do not list steps here; they go under Phases / steps. Delete this comment.

## Context consulted
!phase before
!required true
!terse
what was read before planning, and what it said
!standard
What was read before planning — files, ADRs, live state, vendor
documentation — and what each said that matters here. Fetched or read this
session, not recalled.
!literal
Replace this comment with a list. One line per source you actually read
before writing this plan: its path or URL, then what it told you that this
plan depends on. Do not list anything you did not open. Delete this comment.

## Findings that shape this plan
!phase before
!required false
!terse
what the context showed that changes the plan
!standard
What reading the context revealed that changes what the plan does: each
finding stated as observed, with its evidence.
!literal
Replace this comment with numbered findings, F1, F2, ... Each one says what
you observed, where, and how it changes the plan. A finding you did not
observe yourself does not go here. Delete this comment when done.

## Phases / steps
!phase before
!required false
!terse
the phases, in order, each with its tasks
!standard
The phases in order, each naming the tasks it produces and what must be true
before the next phase starts.
!literal
Replace this comment with one level-3 subsection per phase, in order, titled
"Phase N — Name (TASK-XXXX)". Under each, say what it delivers and what must
be true before the next phase starts. Delete this comment when done.

## Tasks generated
!phase before
!required false
!terse
the task briefs this plan produces
!standard
The task briefs this plan produces, one per line, each with the phase it
belongs to.
!literal
Replace this comment with one line per task: its id, its title, and the
phase it belongs to. Delete this comment when done.

## Acceptance criteria
!phase before
!required false
!terse
how the plan as a whole is judged done
!standard
How the plan as a whole is judged done, as checkable statements, beyond its
tasks' own criteria.
!literal
Replace this comment with a checklist, one "- [ ]" line per criterion. Each
must be something a person can check by reading a file or running a command.
Delete this comment when done.

## Risks
!phase before
!required false
!terse
what could go wrong, and what is done about each
!standard
What could go wrong, how likely it is, and what the plan does about each.
!literal
Replace this comment with one bullet per risk: what could happen, then what
this plan does to prevent or detect it. Delete this comment when done.

## Human decisions required
!phase before
!required false
!terse
the decisions only a human can make, and when
!standard
The decisions only a human can make, each with the options and the point in
the plan where it blocks.
!literal
Replace this comment with one numbered item per decision: the question, the
options, and which phase cannot start until it is answered. Delete this
comment when done.
