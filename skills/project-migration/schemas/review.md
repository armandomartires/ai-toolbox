---
kind: review
framework: project-migration
id_placeholder: REVIEW-XXXX
title_placeholder: Title
filename_pattern: reviews/{id}-{name}.md
title_pattern: {id} — {title}
allow_extra: true
---

# Shape transcribed from the 12 reviews of 2026-09-26 (ADR-0027).

!preamble
!standard
Name what was reviewed and by whom, before anything else. A review is a
point-in-time snapshot: write it once and **don't edit it retroactively** as
reality moves on — that is what the next review is for.
!literal
Replace the two fields below. "Task(s) reviewed" takes one or more task IDs.
"Reviewer" takes the agent or person who did the review.
A review is a snapshot of one moment. Write it once and do NOT come back
later to correct it as things change — write the next review instead.
!body
- Task(s) reviewed:
- Reviewer:

## Diff summary
!phase after
!required false
!terse
what the diff actually contains
!standard
What the diff actually contains — files, and the shape of the change. Delete
this section if you did not read a diff.
!literal
Replace this comment with what the diff contains: which files changed, and
what kind of change each one is.
If you did not read a diff, delete this whole section rather than writing
that you did not.

## Findings
!phase after
!required true
!terse
what the review found, each one checkable
!standard
What the review found. One entry per finding, each stating what is wrong and
where. A review that found nothing says so explicitly rather than leaving
this empty.
!explicit
One entry per finding. Each must name the file and what is wrong with it,
specifically enough that someone else could confirm or refute it. If the
review found nothing, write that sentence — do not leave the section empty,
because an empty section is indistinguishable from an unfinished review.
!literal
Replace this comment with one numbered entry per finding. For each:
  - what is wrong
  - which file and line
  - how someone else could confirm it
If you found nothing, write the sentence "No findings." An empty section
looks the same as an unfinished review.

## Validation results
!phase after
!required true
!terse
the commands run, and what they printed
!standard
The commands run and what they printed. Paste the output, not a summary of
it — "passed" is a claim, the output is the evidence.
!literal
For each command you ran, write the command and then what it printed.
Paste the real output. Do not write "passed" or "all good" on its own:
that is a claim, and the output is what makes it checkable.
If a command was not run, say so.

## Verdict
!phase after
!required true
!terse
approve or request changes
!standard
One of: approve, request changes. With one sentence saying why.
!literal
Replace this comment with one of exactly these two words:
  approve
  request changes
Then one sentence saying why. Use no other verdict word.

## Follow-up tasks
!phase after
!required true
!terse
what this review hands on, or "none"
!standard
What this review hands on: new tasks, backlog entries, or "none". Never
leave it blank — blank and "none" mean different things.
!literal
List anything this review hands on: new task IDs, `B-###` backlog entries,
or the single word "none".
Never leave this blank. Blank means nobody decided; "none" means somebody
decided there was nothing.
