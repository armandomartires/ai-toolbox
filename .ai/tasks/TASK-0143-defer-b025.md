# TASK-0143 — Close B-025 as deferred until a second role wants the term

## Objective

Close `B-025` as **deferred**, on the human's decision of 2026-10-05. The row
asks for a capability term meaning *"may call only this MCP server"*. By its
own condition, it is ready only when a second role wants that term, and only
`gate-runner` does. Record the deferral and the trigger to raise it again, so
the row stops counting as open work that nobody can do.

## Minimal context

- The row has been `waiting` since 2026-09-25, by the human's earlier choice:
  *"one instance is a case, two is a vocabulary"*.
- On 2026-10-05 the human was offered three choices: close as deferred,
  define the term now, or leave it open. They chose to close it as deferred.
- **The re-raise trigger is unchanged**: a second role, in `agents/`, that
  needs to reach exactly one MCP server and no other tool. Raise it as a new
  row then, citing this one; do not reopen this row.
- `B-038`'s check (`TASK-0142`) requires a closed row to name its closer.
  This brief is that closer.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/planning/BACKLOG.md` | `TASK-0142` | `B-025` `waiting`; four open |
| `.ai/planning/SPRINT-CURRENT.md` | `TASK-0105` and later | item 3 lists `B-025` as `waiting` |
| `agents/` | ongoing | `gate-runner` is the only role wanting the term |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. `B-025` closed as `deferred`, with its re-raise trigger.
2. `SPRINT-CURRENT.md` item 3, annotated rather than rewritten.
3. `TODO.md`, `CURRENT_STATE.md`, this brief.

### Not included

- Defining the term, which the human declined.

## Likely files

`.ai/planning/BACKLOG.md`, `.ai/planning/SPRINT-CURRENT.md`,
`.ai/tasks/TODO.md`, `.ai/context/CURRENT_STATE.md`, this brief.

## Execution plan

1. Confirm that no second role wants the term: `grep` `agents/` for MCP-only
   wording.
2. Edit the ledger; `tests/validate.sh`; commit; push both remotes; record
   commit.

## Acceptance criteria

- [x] `B-025` reads closed as deferred, with its trigger, and the closure
      check passes.
- [x] `SPRINT-CURRENT.md` no longer lists it as waiting without a note.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed): none changed

## Risks and rollback

- **The trigger is forgotten.** It is written into the row, which the
  dashboard renders, and into this brief.
- **Rollback:** `git revert` the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `BACKLOG.md` | `B-025` `closed — deferred`; three open |
| `SPRINT-CURRENT.md`, `TODO.md`, `CURRENT_STATE.md` | annotated |

**Next task starts here**: `master` at the record commit.

## Status

- Status: done
- Owner: agent (Claude Code); the decision is the human's
- Created: 2026-10-05
- Updated: 2026-10-05

## Execution log

### Attempt 1

- Date: 2026-10-05
- Agent: Claude Code (Opus 5.5), main checkout
- Actions: checked `agents/`, then edited the row, the sprint item, the task
  index and the current state.
- Observations: `git grep -n -i mcp -- agents` printed nothing, so no role
  in `agents/` mentions an MCP server at all. `B-025` now reads
  `**closed — deferred**`, which `check-backlog-closures.py` counts as closed
  (50 rows) and checks: its closer is this brief, and it reads `done`. A bare
  `deferred` was tried first and is counted by neither the check nor the
  recount, so the status says `closed`.
- Validation: `tests/validate.sh` printed `validate.sh: OK`.
- Result: done.
- Commit: recorded in the follow-up record commit
- Push: recorded in the follow-up record commit
