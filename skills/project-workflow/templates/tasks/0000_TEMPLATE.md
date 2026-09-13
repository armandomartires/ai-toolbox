# S###_SprintName.T###_TaskName

> Copy this file to `S###_SprintName.T###_TaskName.md` and fill it in.
> Delete this blockquote block when done. Write the Goal and Plan sections
> **before** starting the work; fill in Verification and Status **after**.

**Status**: not started | in progress | blocked | completed
**Sprint**: `S###_SprintName` (see `../30.ROADMAP.md` for what this sprint means)
**Commits**: `<hash>` — filled in once committed; may be more than one

## Goal

One or two sentences. What is this task for, and why does it matter right
now? If it closes a gap noted in `../35.AD_HOC_TASKS.md` or answers an
open question in `../30.ROADMAP.md`, link to it.

## Plan

What you intend to do, written **before** starting. Bullet list is fine.
If the plan changes materially during the work, note the deviation in
Verification rather than silently rewriting this section.

## Files touched

- `path/to/file.py` — one line on what changed and why

## Verification

How you know it actually works — not just "tests pass," but the specific
proof appropriate to this change. For new behaviour, this must include:

1. Full test suite result (e.g. `pytest -q` → `N passed`)
2. **The fails-when-reverted check**: `git stash push -- <files>`, re-run
   the specific new test, confirm it fails for the *expected* reason, then
   `git stash pop`. Record what the failure looked like.
3. Any manual/empirical verification (e.g. measured timing, a real
   before/after comparison) that a test alone couldn't capture.

## Status notes

Anything that changed between Plan and what actually happened. Blockers
hit and how they were resolved. Leave empty if the task went exactly to
plan.
