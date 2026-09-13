# S###_SprintName.T###_TaskName

> Copy this file to `S###_SprintName.T###_TaskName.md` and fill it in.
> Delete this blockquote block when done. Write Goal, **Inputs** and Plan
> **before** starting the work; fill in Verification, **Outputs / handover**
> and Status **after**.

**Status**: not started | in progress | blocked | completed
**Sprint**: `S###_SprintName` (see `../30.ROADMAP.md` for what this sprint means)
**Commits**: `<hash>` — filled in once committed; may be more than one

## Goal

One or two sentences. What is this task for, and why does it matter right
now? If it closes a gap noted in `../35.AD_HOC_TASKS.md` or answers an
open question in `../30.ROADMAP.md`, link to it.

## Inputs

Every artifact this task consumes, so it can be started cold in a fresh
session (`../reference/session-handover.md`). One row each — a paragraph
lets you write "depends on the last task" and stop.

| Artifact | Produced by | Expected state |
|---|---|---|
| `path/or/doc` | `S###.T###_Name`, or "pre-existing" | the state this task assumes — a version, a size, a passing suite |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Plan

What you intend to do, written **before** starting. Bullet list is fine.
If the plan changes materially during the work, note the deviation in
Verification rather than silently rewriting this section.

## Verification

How you know it actually works — not just "tests pass," but the specific
proof appropriate to this change. For new behaviour, this must include:

1. Full test suite result (e.g. `pytest -q` → `N passed`)
2. **The fails-when-reverted check**: `git stash push -- <files>`, re-run
   the specific new test, confirm it fails for the *expected* reason, then
   `git stash pop`. Record what the failure looked like.
3. Any manual/empirical verification (e.g. measured timing, a real
   before/after comparison) that a test alone couldn't capture.

## Outputs / handover

Every file this task created or changed, and what the next session
inherits. Written **after** the work, because until it is verified you are
describing an intention rather than a state.

| Artifact | End state |
|---|---|
| `path/to/file.py` | what it now contains and why, plus anything deliberately *not* changed |

**Next task starts here**: one line naming the state the next task picks
up from — not a prediction of what that task will be. If this task
deviated from its Plan, say so here too: the next task may have been
scoped against the original.

## Status notes

Anything that changed between Plan and what actually happened. Blockers
hit and how they were resolved. Leave empty if the task went exactly to
plan.
