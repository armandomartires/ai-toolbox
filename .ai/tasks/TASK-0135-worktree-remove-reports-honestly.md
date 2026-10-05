# TASK-0135 — worktree.sh remove deletes a landed branch and reports honestly (B-049)

## Objective

Close `B-049`. `scripts/worktree.sh remove` runs `git branch -d` with its
error discarded, then prints `removed … and branch …` whether or not the
branch went. After the documented landing procedure, the main checkout's
`master` is behind `origin/master`, so `-d` refuses every time and the script
claims a deletion it did not make. Make it delete a branch whose work is
safely elsewhere, and say plainly when it did not. Routed by the human on
2026-10-05 (*"closing all backlog tasks"*).

## Minimal context

- `scripts/worktree.sh:118` already computes `ahead`: commits on the branch
  reachable from neither `master` nor `origin/master`. `remove` refuses
  unless it is 0. So when the delete runs, every commit on the branch is
  already in one of those two refs, and `-d`'s "merged into `HEAD`" test is
  the wrong question.
- The fix the row names: delete when the branch is contained where its work
  is safe, and report honestly otherwise.
- `worktree.sh` has no test. `tests/` holds one script per tested component,
  each run unconditionally by `tests/validate.sh` (`ADR-0009`).

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `scripts/worktree.sh` | `TASK-0070`, `TASK-0126` | `remove` ends `git branch -d "$branch" 2>/dev/null \|\| true`, then an unconditional `echo "worktree.sh: removed $path and branch $branch"` |
| `tests/validate.sh` | ongoing | `validate.sh: OK` at `ca5b2dc` |
| `.ai/planning/BACKLOG.md` | `TASK-0134` | `B-049` `ready`; twelve open |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. `scripts/worktree.sh` `remove`: delete the branch with `-D` only when its
   tip is an ancestor of `master` or `origin/master`; otherwise keep it. Print
   which happened, and exit 1 if a branch that should have gone is still
   there.
2. `tests/test-worktree.sh`: a hermetic fixture (a bare `origin`, a clone, a
   copy of the script). It runs the documented landing, with the main
   checkout's `master` left behind, and asserts that the branch is gone and
   the message says so. It also asserts that the refusal on unlanded work
   still holds. Run by `tests/validate.sh`.
3. `BACKLOG.md` (`B-049` done, recount), `TODO.md`, `CURRENT_STATE.md`, this
   brief.

### Not included

- `add` and `list`, which are unchanged.
- The runbook's landing procedure, which is correct; the script was wrong.

## Likely files

`scripts/worktree.sh`, `tests/test-worktree.sh` (new), `tests/validate.sh`,
`.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`,
`.ai/context/CURRENT_STATE.md`, this brief.

## Execution plan

1. This brief first.
2. Write the test, and run it against the current script: it must fail on
   the landed-branch case, for the reason the row names.
3. Fix `remove`; the test passes. Wire it into `tests/validate.sh`.
4. Ledger; validate; commit; push both remotes; record commit.

## Acceptance criteria

- [x] After landing from a worktree with the main `master` behind
      `origin/master`, `remove` deletes `agent/<name>` and says so.
- [x] Unlanded commits still make `remove` refuse, exit 1, with both the
      worktree and the branch kept.
- [x] The test fails against the pre-task script, on the landed-branch case.
- [x] `tests/validate.sh` runs the test unconditionally.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed): no component changed
- [x] the revert proof against the pre-task `scripts/worktree.sh`

## Risks and rollback

- **Deleting work.** `-D` skips git's own merge check, so the ancestry test
  replaces it. The `ahead` refusal still runs before anything is removed.
- **Rollback:** `git revert` the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `scripts/worktree.sh` | `remove` deletes a landed branch with `-D` after an ancestry check, and prints `removed <path> and branch <branch>` only when the branch is gone |
| `tests/test-worktree.sh` | new; hermetic; `OK (8 cases)` in about 0.4 s |
| `tests/validate.sh` | runs it unconditionally |
| `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md` | `B-049` done; eleven open |

**Next task starts here**: `master` at the record commit.

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-05
- Updated: 2026-10-05

## Execution log

### Attempt 1

- Date: 2026-10-05
- Agent: Claude Code (Opus 5.5), main checkout (no other session holds a worktree)
- Actions: wrote the brief, then `tests/test-worktree.sh`, then the fix,
  then the gate wiring.
- Observations:
  - **Against the pre-task script** the test printed `2 of 8 case(s)
    FAILED`: `W1 landed branch agent/w1 is deleted` and `W1 message claims
    the branch only if it is gone`. Both quoted the old line
    `worktree.sh: removed …/w1 and branch agent/w1` while the branch
    still existed. That is `B-049`, reproduced.
  - **After the fix**: `test-worktree.sh: OK (8 cases)`, 0.37 s.
  - **Mutation**: with the `origin/master` ancestry arm replaced by `false`,
    exactly the two W1 cases failed, and the output read `removed …/w1, but
    KEPT branch agent/w1:`. So a kept branch is reported, not hidden.
- Validation: `tests/validate.sh` printed `validate.sh: OK`.
  `scripts/sync-registry.sh` left `docs/registry.md` unchanged.
- Result: done.
- Commit: `c03d88c` — *Delete a landed worktree branch and report it honestly (TASK-0135)*, plus the record-keeping commit after it
- Push: **confirmed to both remotes** — `ca5b2dc..c03d88c master -> master` to
  `origin` and to `github`; `HEAD`, `origin/master` and `github/master` all
  read `c03d88c`, and `git remote -v` is token-free
