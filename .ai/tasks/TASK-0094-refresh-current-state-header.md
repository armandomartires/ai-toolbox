# TASK-0094 — Refresh the stale opening paragraph of CURRENT_STATE.md

## Objective

Replace the opening paragraph of `.ai/context/CURRENT_STATE.md` — the one that
begins `Last updated 2026-09-23. **Sprint S8 is CLOSED. No sprint is open…` —
with one that states the current sprint and its deliverables' statuses,
**copied from `.ai/planning/SPRINT-CURRENT.md`**, not recalled.

## Minimal context

The paragraph at the top of `CURRENT_STATE.md` was written before S9 and S10
were promoted and has not been updated since: it still says no sprint is
open, while `## Sprint S10 is OPEN` sits a few lines below it. `TASK-0086`
deliberately left it alone as out of scope and did not bump its date, so it
would not look current. Every section below it is correct and dated; only the
opening paragraph is stale.

**This task is settled.** The content is copied, not composed: the sprint
name and each deliverable's status come from the deliverables table in
`.ai/planning/SPRINT-CURRENT.md` as that file stands when this task runs. It
is one of the two tasks of the S10.7 pilot (`TASK-0092`), chosen by the human.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/context/CURRENT_STATE.md` | many tasks | Opening paragraph (the lines between the `# Current State` heading and the first `##` heading) is stale |
| `.ai/planning/SPRINT-CURRENT.md` | `TASK-0085` et al. | Deliverables table with a status per S10 row |

## Scope

### Included

- `.ai/context/CURRENT_STATE.md`: **only** the paragraph between the
  `# Current State` heading and the first `##` heading.

### Not included

- Any `##` section of `CURRENT_STATE.md`, or any other file.
- Any status not present in `SPRINT-CURRENT.md`'s deliverables table.

## Likely files

- `.ai/context/CURRENT_STATE.md`

## Execution plan

1. Read the deliverables table in `.ai/planning/SPRINT-CURRENT.md`.
2. Replace the opening paragraph with, in order:
   - `Last updated <the date this task runs, YYYY-MM-DD>.`
   - The sprint that is open, named as `SPRINT-CURRENT.md`'s title names it.
   - One short clause per deliverable row (`S10.1` … `S10.7`, and the review
     row), giving the status exactly as that row's Status cell gives it,
     shortened only by dropping markdown emphasis.
   - A pointer: the dated `##` sections below carry the detail.
3. Run `tests/validate.sh`.

## Acceptance criteria

- [ ] The opening paragraph no longer says a sprint is closed or that no
      sprint is open.
- [ ] It names the open sprint as `SPRINT-CURRENT.md` names it.
- [ ] Every deliverable row of `SPRINT-CURRENT.md`'s table appears with the
      status that row gives — no status that is not in the table.
- [ ] Its date is the date the task ran.
- [ ] No `##` section of `CURRENT_STATE.md` changes, and no other file changes.
- [ ] `tests/validate.sh` passes.

## Mandatory validations

- [ ] `tests/validate.sh`

## Risks and rollback

- Copying a status wrongly is the only real risk, and it is exactly what the
  refuter checks against the table. Rollback: `git revert`.

## Outputs / handover

*Not yet written — forecast until verified.*

| Artifact | End state |
|----------|-----------|
|          |           |

**Next task starts here**: —

## Status
- Status: ready
- Owner: agent (unattended pilot, `TASK-0092`)
- Created: 2026-09-24
- Updated: 2026-09-24

## Execution log
### Attempt 1
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
