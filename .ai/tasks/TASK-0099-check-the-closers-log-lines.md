# TASK-0099 — The closer writes fixed commit and push lines, and the driver checks them

## Objective

Close `B-031`: what the `closer` writes about its own commit and about
pushing is **given to it, not composed by it**, and the OpenCode driver
halts the run when the committed task file says anything else.

## Minimal context

`TASK-0092` finding 17: the closer wrote *"Commit: recorded by the closer role
in a follow-up commit"* into both pilot task files and made no follow-up
commit. The refuter had already run, so nothing in the loop read it; the
supervising session corrected it by hand in `53dba10`.

**A commit cannot contain its own hash**, so the closer can never write the
true one. And the true one is not even the closer's: at landing the human
rebased `agent/pilot`, and `d80d843` became `57dbd49` on `master`. The hash
belongs to landing.

**The human's decision, 2026-09-25 (multiple choice, the recommended
option):** *a fixed placeholder, checked by the driver*. The closer writes
exactly

- `- Commit: pending — recorded at landing (run <run-id>)`
- `- Push: not taken — the run pushes nothing`

and whoever lands the run replaces them with the landed hash and the push
result, in a follow-up commit — the form this repository already uses.

**Halt, not park:** the check runs after the commit exists, so undoing it is
a history rewrite (`TASK-0097`'s reasoning, `loop.md` "Escalate without
retrying").

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `…/bindings/opencode/driver.py` | `TASK-0098` | `step10_close()` verifies hash, parent, porcelain, task id, file list |
| `agents/closer/agent.md` | S9, `TASK-0083` | seven-step close; "report the hash" |
| `docs/operations/runbook.md` | `TASK-0070`… | worktree landing procedure |

## Scope

### Included

- `driver.py`: the two lines are handed to the closer as `log_lines`; after
  the close verifies, every **added** line of the task file that reads as a
  `Commit:` or `Push:` entry must be one of them, and each must appear once.
  Otherwise halt, quoting the line.
- `agents/closer/agent.md`: write the lines you are handed, verbatim, and
  why you cannot write a hash.
- `docs/operations/runbook.md`: landing an unattended run replaces the
  placeholders.
- Tests: the pilot's exact false claim halts; a missing placeholder halts;
  the happy path writes the lines and closes.

### Not included

- Free prose in the log claiming a push or a commit. The check reads the
  labelled `Commit:` / `Push:` entries only; stated as a limit.
- The Claude Code binding (no `closer` role there).

## Likely files

`…/opencode/driver.py`, `…/opencode/tests/test_driver.py`,
`…/opencode/binding.md`, `agents/closer/agent.md`,
`docs/operations/runbook.md`, `.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`,
`.ai/planning/SPRINT-CURRENT.md`, `.ai/context/CURRENT_STATE.md`.

## Execution plan

1. Tests first; watch the two new ones fail.
2. Implement in `step10_close()`; run the suite; revert-prove.
3. Role body, runbook, binding deviations; state; commit; push.

## Acceptance criteria

- [x] A closer writing the pilot's claim halts the run, quoting it; no
      `close` is journalled.
- [x] A closer writing no `Commit:` placeholder halts the run.
- [x] The closer's prompt carries the two lines verbatim.
- [x] The new tests fail when the check is removed.
- [x] The OpenCode suite and `tests/validate.sh` pass.

## Mandatory validations

- [x] `python3 -m unittest discover -s tests` (OpenCode binding dir)
- [x] `tests/validate.sh`

## Risks and rollback

- A task file whose log uses another label (`Hash:`) passes unchecked —
  the stated limit. Rollback: `git revert`.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `driver.py` | `Driver.log_lines()`; the lines go to the closer as `log_lines`; `step10_close()` halts on an unexpected or missing `Commit:`/`Push:` entry among the task file's **added** lines, after the file-list check |
| `tests/test_driver.py` | `LOG_LINES`, `closer_sh()`; the happy closer now writes the lines; the bulk-stage test keeps `git add -- .`; + 3 tests (31 in the suite) |
| `agents/closer/agent.md` | New section: the Commit and Push entries are handed to you; why no hash |
| `docs/operations/runbook.md` | Landing an unattended run's branch: replace the placeholders in a follow-up commit |
| `binding.md` (OpenCode) | Rule-4 row names the check and its limit |
| Emitted `~/.config/opencode/agents/closer.md` | **Stale until re-emitted** — done once at the end of this backlog pass |

**Next task starts here**: `B-030`, `B-031` closed; OpenCode suite 31
tests, green.

## Status
- Status: done
- Owner: agent (decision: human, 2026-09-25)
- Created: 2026-09-25
- Updated: 2026-09-25

## Execution log
### Attempt 1
- Date: 2026-09-25
- Agent: Claude Opus 5.5 (1M context)
- Actions: tests first; `log_lines` and the check in `step10_close()`;
  closer body, runbook, binding row.
- Validation: before the fix, `KeyError: 'log_lines'` and two `0 != 1` —
  red for the right reasons. After: `Ran 31 tests … OK`. Check disabled
  (`if False and …`) → the two halt tests fail; `driver.py` at `HEAD` → all
  three fail; restored and `cmp`-verified. `tests/validate.sh` OK;
  `sync-registry.sh` left `docs/registry.md` unchanged.
- Deviation: the brief's first draft of the bulk-stage test staged
  `stray.txt` by name; put back to the pilot's exact `git add -- .` before
  running, so that test still reproduces finding 18.
- Result: **done.**
- Commit: `706643e`. Pre-commit hook ran `tests/validate.sh`: OK.
- Push: **confirmed** — `75ce882..706643e`, local and remote hash equal.
