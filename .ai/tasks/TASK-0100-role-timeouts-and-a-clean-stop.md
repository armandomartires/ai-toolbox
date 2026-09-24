# TASK-0100 — Per-role timeouts, and a run that can be stopped cleanly

## Objective

Close `B-033`: a binding can size each role's timeout on its own; a signal
to the driver stops the run **with a handover and no retry**; and a role call
killed from outside the driver is a stop, not a mechanical failure to retry.

## Minimal context

Three `TASK-0092` findings, one row:

- **Finding 9** — `role_timeout: 10m` was too short for a thorough refuter
  (27–40 model rounds per attempt); the human raised it to 30m. But one
  number for every role means **finding 3**'s cost at 30m: a silent stall
  in a quick role (preflight, gate-runner) burns 30 minutes × the mechanical
  bound of 3 before the task parks.
- **Finding 11** — the human stopped `s10-7-live` by PID. Killing the
  adjudicator's `opencode run` made the driver **retry it** (an orphan once
  the driver died), and the driver, killed with 143, **wrote no handover**.
  Stopping cleanly meant knowing to kill the driver first — and even then
  nothing was written.

**Decisions (the agent's; `B-033` named the problems, not the routes):**

1. `role_timeouts:` — an **optional** mapping of role → duration, overriding
   `role_timeout` for the roles it names. Optional rather than a new required
   slot, so every existing filled binding stays valid; unknown role names and
   unreadable durations are refused. Sizing guidance from the pilot goes in
   `binding.md`, not as pre-filled numbers: a timeout is the consumer's
   model-and-machine fact, and an inherited number is a guess.
2. **SIGTERM, SIGINT or SIGHUP to the driver** is a halt reason: the current
   role call's whole process group is killed, nothing is retried, the journal
   gets `halt` and `run-end`, and the driver **writes the handover itself**
   without invoking `run-scribe` — a stop asked for by a human does not start
   another model call. Uncommitted work is **left in the tree** and listed,
   never stashed or discarded: parking is a role call, and the stop is the
   human's to resolve (as attempt 4 was, by hand).
3. **A role call whose process dies of a signal** the driver did not send
   (negative return code, or 128 + INT/KILL/TERM) halts the run instead of
   entering the mechanical retry.

Role calls move from `subprocess.run` to `Popen(start_new_session=True)`, so
the driver can kill a role's whole group — `opencode run` spawns children.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `…/bindings/opencode/driver.py` | `TASK-0099` | one `role_timeout`; `invoke()` via `subprocess.run`; no signal handling |
| `…/bindings/opencode/tests/` | `TASK-0099` | 31 tests, green |

## Scope

### Included

- `driver.py`: `role_timeouts`; `invoke()` on `Popen` with group kill on
  timeout and on any exception; signal handlers; the killed-child halt; a
  stop-labelled handover.
- Tests: per-role override used; a bad override refused; SIGTERM mid-role →
  one invocation, no orphan, `halt`, handover; a role killed from outside →
  halt, not retried.
- `binding.md`: the optional slot, sizing guidance, how to stop a run.

### Not included

- The Claude Code binding (its Workflow host owns stopping).
- Making a stop park the task. Stated above.

## Likely files

`…/opencode/driver.py`, `…/opencode/tests/test_driver.py`,
`…/opencode/binding.md`, `.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`,
`.ai/planning/SPRINT-CURRENT.md`, `.ai/context/CURRENT_STATE.md`.

## Execution plan

1. Tests first; watch them fail.
2. Implement; run the suite; revert-prove each behaviour.
3. `binding.md`; state; commit; push.

## Acceptance criteria

- [x] A role named in `role_timeouts` is timed out at its own value; others
      at `role_timeout`.
- [x] An unknown role or unreadable duration in `role_timeouts` is refused
      (exit 2).
- [x] SIGTERM during a role call: exit 1, the role invoked once, its process
      group gone, `halt` + `run-end` journalled, a handover labelled as a stop.
- [x] A role process killed from outside halts the run without a retry.
- [x] Each new test fails when its behaviour is reverted.
- [x] The OpenCode suite and `tests/validate.sh` pass.

## Mandatory validations

- [x] `python3 -m unittest discover -s tests` (OpenCode binding dir)
- [x] `tests/validate.sh`

## Risks and rollback

- A signal landing inside the closer's commit leaves a commit the journal
  does not record as a close. The stop handover lists `git log` since the
  start, so it is visible. Rollback: `git revert`.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `driver.py` | `Stopped(Halt)`; `Binding.role_timeouts` (validated); `invoke()` on `Popen(start_new_session=True)` with `kill_group()` on timeout and on any exception; `KILLED_EXITS` / negative return → halt; `Driver.on_signal()` for TERM/INT/HUP; step 14 skips `run-scribe` on a stop and writes a *STOPPED* handover |
| `tests/test_driver.py` | `with_role_timeouts()`, `driver_argv()`, `start_driver()`, `wait_for_invocation()`; + `TestTimeoutsAndStopping`, 4 tests (35 in the suite) |
| `binding.md` (OpenCode) | "Role timeouts, and how to stop a run": the optional slot, pilot measurements as sizing guidance, the stop procedure and its limit |
| Not changed | The Claude Code binding; a gate already running at a stop keeps running to its watchdog |

**Next task starts here**: `B-030`, `B-031`, `B-033` closed; OpenCode
suite 35 tests, green.

## Status
- Status: done
- Owner: agent (instruction: human, 2026-09-25)
- Created: 2026-09-25
- Updated: 2026-09-25

## Execution log
### Attempt 1
- Date: 2026-09-25
- Agent: Claude Opus 5.5 (1M context)
- Actions: tests first; implementation; binding section; five targeted
  reverts.
- Validation: before the fix all four new tests red for the right reason —
  override ignored (`[] is not true`), bad entries accepted (`0 != 2` ×2),
  SIGTERM killed the driver outright (`-15 != 1`), a killed role was retried
  (`0 != 1`). After: `Ran 35 tests … OK`. Each behaviour reverted on its own
  and its test watched fail: override ignored; validation off; no signal
  handlers (`-15 != 1`); **direct-child kill instead of the group** —
  `'14769\n14802' != ''`, the role's `sleep` outlived the stop; killed exit
  treated as mechanical. Restored and `cmp`-verified; no orphan left.
- **Found by re-running, not by the first green:** the new `binding.md`
  paragraph was an **uncited rule** (`check-binding.sh`, line 146) — the
  full suite had passed only because the binding-checker test ran before the
  edit landed. Cited `loops/unattended-run/loop.md` step 14; checker test
  OK; full suite re-run on the final files.
- Result: **done.**
- Commit: `7851af0`. Pre-commit hook ran `tests/validate.sh`: OK.
- Push: **confirmed** — `f9f0aa3..7851af0`, local and remote hash equal.
