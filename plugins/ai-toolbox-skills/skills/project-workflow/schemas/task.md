---
kind: task
framework: project-workflow
id_placeholder: S###.T###_Name
sprint_placeholder: S###_SprintName
date_placeholder: YYYY-MM-DD
superseded: Preconditions, Dependencies, Expected result
allow_extra: true
filename_pattern: tasks/{id}.md
title_pattern: {id}
max_lines: 80
---

# One task, one module (ADR-0033 in ai-toolbox): identification first, then
# the procedure, then the record. Git is the record of commits: the commit
# subject carries the task id, so no hash is written here. The bold fields
# are the ones the dashboard reads (references/dashboard.md).

!preamble
!standard
Status is one of: not started, in progress, blocked, completed. Applies to:
components and environment. Points is optional. Depends on: task ids, or none.
!body
**Status**: not started
**Sprint**: `{sprint}`
**Created**: {date}
**Updated**: {date}
**Applies to**:
**Depends on**: none

## Goal
!phase before
!required true
!terse
what changes, and why now
!standard
One to three sentences: what changes, and why now. Link the item in
`../35.AD_HOC_TASKS.md` or `../30.ROADMAP.md` it closes.
!literal
Write 1-3 sentences: (1) what will change, (2) why now, (3) the
`35.AD_HOC_TASKS.md` or `30.ROADMAP.md` item it closes, or "none".

## Inputs
!phase before
!required true
!terse
every artifact consumed, with its expected state
!standard
One row per artifact this task reads, so it can start cold. Verify each
state before starting (`../reference/session-handover.md`).
!literal
One row per file, document or tool this task reads. Expected state is
specific: a version, a size, a passing suite. Check it before you start.
!body
| Artifact | Expected state |
|---|---|
| | |

## Plan
!phase before
!required true
!terse
numbered steps, written before starting
!standard
Numbered steps, one action each, written before starting. Record a
deviation under Verification; do not rewrite the plan.
!literal
Number the steps, one action each, before you start. If the plan changes,
leave it and record the difference under Verification.
!body
1.

## Verification
!phase after
!required true
!terse
the proof, including the fails-when-reverted check
!standard
What you observed, quoted. For new behaviour, all three items below.
!literal
Answer each item with the real output. Never write "passed" alone.
!body
1. Test suite: `command` → `result`
2. Fails when reverted: the new test, run against the reverted change, fails for the expected reason
3. Manual or measured check, if a test cannot show it

## Outputs / handover
!phase after
!required true
!terse
end state of every changed artifact, and where the next task starts
!standard
Written after the work: what each changed artifact now holds. Next: one line.
!literal
After the work, one row per file created or changed. Then replace the text
after "Next:" with the state the next task starts from.
!body
| Artifact | End state |
|---|---|
| | |

Next:

## Status notes
!phase after
!required false
!standard
Only if the work differed from the plan: what differed, and any blocker.
!literal
Leave empty if the work went to plan. Otherwise: what differed, and why.
