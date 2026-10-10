<!-- Rendered by ai-toolbox's scripts/sync-templates.sh. Shape is owned by
     ai-toolbox's skills/project-workflow/schemas/task.md (its ADR-0027).
     In ai-toolbox, edit the schema and re-render; tests/validate.sh fails on
     drift. A copy in another repository is not regenerated or checked there. -->

# S###.T###_Name

<!-- FILL: Status is one of: not started, in progress, blocked, completed. Applies to:
     components and environment. Points is optional. Depends on: task ids, or none. -->

**Status**: not started
**Sprint**: `S###_SprintName`
**Created**: YYYY-MM-DD
**Updated**: YYYY-MM-DD
**Applies to**:
**Depends on**: none

## Goal

<!-- FILL: One to three sentences: what changes, and why now. Link the item in
     `../35.AD_HOC_TASKS.md` or `../30.ROADMAP.md` it closes. -->

## Inputs

<!-- FILL: One row per artifact this task reads, so it can start cold. Verify each
     state before starting (`../reference/session-handover.md`). -->

| Artifact | Expected state |
|---|---|
| | |

## Plan

<!-- FILL: Numbered steps, one action each, written before starting. Record a
     deviation under Verification; do not rewrite the plan. -->

1.

## Verification

<!-- FILL: What you observed, quoted. For new behaviour, all three items below. -->

1. Test suite: `command` → `result`
2. Fails when reverted: the new test, run against the reverted change, fails for the expected reason
3. Manual or measured check, if a test cannot show it

## Outputs / handover

<!-- FILL: Written after the work: what each changed artifact now holds. Next: one line. -->

| Artifact | End state |
|---|---|
| | |

Next:

## Status notes

<!-- FILL: Only if the work differed from the plan: what differed, and any blocker. -->
