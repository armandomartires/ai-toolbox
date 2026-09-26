---
kind: task
framework: project-workflow
id_placeholder: S###.T###_Name
sprint_placeholder: S###_SprintName
superseded: Preconditions, Dependencies, Expected result
allow_extra: true
filename_pattern: tasks/{id}.md
title_pattern: {id}
---

!preamble
**Status**: not started | in progress | blocked | completed
**Sprint**: `{sprint}` (see `../30.ROADMAP.md` for what this sprint means)
**Commits**: `<hash>` — filled in once committed; may be more than one

## Goal
!phase before
!required true
!terse
goal — what this is for, and why now
!standard
One or two sentences. What is this task for, and why does it matter right
now? If it closes a gap noted in `../35.AD_HOC_TASKS.md` or answers an open
question in `../30.ROADMAP.md`, link to it.
!explicit
Write 1-3 sentences. Sentence 1: what changes. Sentence 2: why now. If this
closes an item in `../35.AD_HOC_TASKS.md` or `../30.ROADMAP.md`, link it.
No sub-headings.
!literal
Replace this comment with 1-3 sentences, answering in this order:
(1) What will change?
(2) Why does it need to happen now rather than later?
(3) Which item in `../35.AD_HOC_TASKS.md` or `../30.ROADMAP.md` does it
    close? Write "none" if there is no such item.
Do not add sub-headings. Delete this comment when you have written them.

## Inputs
!phase before
!required true
!terse
every artifact consumed — one row each
!standard
Every artifact this task consumes, so it can be started cold in a fresh
session (`../reference/session-handover.md`). One row each — a paragraph
lets you write "depends on the last task" and stop.
!explicit
One table row per artifact this task reads or depends on. A paragraph here
lets you write "depends on the last task" and stop, which is the failure
this section exists to prevent. Fill every column of every row.
!literal
Add one row to the table below for each file, document or tool this task
reads or depends on. For each row fill all three columns:
  Artifact       — the path, in backticks.
  Produced by    — the task ID that made it, or the words: pre-existing
  Expected state — the specific state assumed: a version, a size, a
                   passing suite. Not the word "current".
Do not replace the table with a paragraph. Delete this comment when done.
!body
| Artifact | Produced by | Expected state |
|---|---|---|
| `path/or/doc` | `S###.T###_Name`, or "pre-existing" | the state this task assumes — a version, a size, a passing suite |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Plan
!phase before
!required true
!terse
what you intend to do — written before starting
!standard
What you intend to do, written **before** starting. Bullet list is fine.
If the plan changes materially during the work, note the deviation in
Verification rather than silently rewriting this section.
!literal
Replace this comment with a bullet list of the steps you intend to take,
written BEFORE you start the work.
If the plan later changes, do NOT edit this section — record what actually
happened under Verification instead. Delete this comment when done.

## Verification
!phase after
!required true
!terse
the specific proof, including the fails-when-reverted check
!standard
How you know it actually works — not just "tests pass," but the specific
proof appropriate to this change. For new behaviour this must include the
three numbered items below.
!explicit
Record the evidence, not the intention. Each numbered item below must be
answered with what you actually observed, quoted, not summarised.
!literal
Answer each of the three numbered items below with what you actually saw.
Quote the real output; do not summarise it and do not write "passed" alone.
Delete this comment when all three are answered.
!body
1. Full test suite result (e.g. `pytest -q` → `N passed`)
2. **The fails-when-reverted check**: `git stash push -- <files>`, re-run
   the specific new test, confirm it fails for the *expected* reason, then
   `git stash pop`. Record what the failure looked like.
3. Any manual/empirical verification (e.g. measured timing, a real
   before/after comparison) that a test alone couldn't capture.

## Outputs / handover
!phase after
!required true
!terse
every file changed, and what the next session inherits
!standard
Every file this task created or changed, and what the next session
inherits. Written **after** the work, because until it is verified you are
describing an intention rather than a state.
!literal
Add one row to the table below for every file this task created or changed.
Then replace the angle-bracketed text after "Next task starts here" with
one sentence naming the state the next session picks up from.
Write this section AFTER the work, never before. Delete this comment.
!body
| Artifact | End state |
|---|---|
| `path/to/file.py` | what it now contains and why, plus anything deliberately *not* changed |

**Next task starts here**: one line naming the state the next task picks
up from — not a prediction of what that task will be. If this task
deviated from its Plan, say so here too: the next task may have been
scoped against the original.

## Status notes
!phase after
!required false
!standard
Anything that changed between Plan and what actually happened. Blockers hit
and how they were resolved. Leave empty if the task went exactly to plan.
!literal
If the work went exactly as written under Plan, leave this section empty
and delete this comment. Otherwise write what differed and why, and name
any blocker you hit and how it was resolved.
