# TASK-0097 — The driver checks a closed commit's files against the declared paths

## Objective

Close Phase 10 criterion 4 at the binding layer: after the `closer` commits,
the OpenCode driver verifies that every file in the commit is one the task
declared; a commit with any other file **halts the run** for the human.

## Minimal context

`TASK-0092` finding 18, observed against the real client: with the closer's
exact emitted permissions, `git add -- "."` and `git add -- .` are both
**allowed** and stage the whole tree (`git add -A` is denied). `TASK-0083`
had recorded that `git add -- .` cannot be closed at the glob layer; the pilot
confirmed it live. What stood in the way was prose in `agents/closer/` and the
closer's own porcelain re-check. The driver verified one commit, its parent, a
clean tree and the task id — **not the commit's file list**.

**The human's decision, 2026-09-24 (multiple choice; the agent chose none):**
*"Add the driver check"* — the driver verifies the commit's files are a
subset of the declared paths; a bulk-staged commit halts the run.

**Halt, not park:** the commit already exists on the branch, so undoing it is
a history rewrite — the human's (`loops/unattended-run/loop.md`, "Escalate
without retrying").

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `…/bindings/opencode/driver.py` | `TASK-0086`…`0096` | `step10_close()` verifies hash, parent, porcelain, task id |

## Scope

### Included

- `step10_close()`: the declared set (the implementer's `files_changed`, the
  task file, the tracker unless `not-applicable`) is computed once and both
  handed to the closer and checked against `git show --name-only HEAD`.
- A stub test: a closer that bulk-stages an extra file → the run halts, the
  close is not journalled as a close. Shown failing when reverted.

### Not included

- The Claude Code binding, which has the same gap: its `verifyHead()` does
  not read the commit's files either. Recorded for the review.
- `agents/closer/` — unchanged.

## Likely files

`skills/unattended-ops/templates/bindings/opencode/driver.py`,
`skills/unattended-ops/templates/bindings/opencode/tests/test_driver.py`.

## Execution plan

1. Test first; watch it fail.
2. Implement; run the suite; revert-prove.
3. Commit; push.

## Acceptance criteria

- [x] A commit containing a file outside the declared paths halts the run,
      naming the file.
- [x] The happy path still closes.
- [x] The test fails when the check is removed.
- [x] The OpenCode suite and `tests/validate.sh` pass.

## Mandatory validations

- [x] `python3 -m unittest discover -s tests` (OpenCode binding dir)
- [x] `tests/validate.sh`

## Risks and rollback

- A legitimate file the implementer changed but did not report would now halt
  a run. That is the intended direction: an unreported change is itself a
  finding. Rollback: `git revert`.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `driver.py` | `step10_close()` computes the declared set once, hands it to the closer, and halts on any committed file outside it |
| `tests/test_driver.py` | + one test (20 driver tests, 26 in the suite) |
| Claude Code binding | **Same gap, not fixed** — recorded for the review |

**Next task starts here**: the S10 review.

## Status
- Status: done
- Owner: agent (decision: human)
- Created: 2026-09-24
- Updated: 2026-09-24

## Execution log
### Attempt 1
- Date: 2026-09-24
- Agent: Claude Opus 5.5 (1M context)
- Actions: test first — a closer that runs `git add -- .` with a stray file
  present; implemented the subset check; revert-proved.
- Validation: new test red (the run closed) → green (halt naming
  `stray.txt`); check disabled → `FAILED (failures=1)`, restored and
  `cmp`-verified; OpenCode suite OK; `tests/validate.sh` OK.
- Result: **done.**
- Commit: `577074e`. Pre-commit hook ran `tests/validate.sh`: OK.
- Push: **confirmed** — `4fdec0c..577074e`.
