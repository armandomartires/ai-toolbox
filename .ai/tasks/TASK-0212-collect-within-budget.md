# TASK-0212 — task-orchestrator's collect answers within its hook's budget

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-02
- Updated: 2026-11-02
- Applies to: `mods/task-orchestrator/` (`hooks/register.tsx`, its test, README, DEVELOPING), `.ai/planning/BACKLOG.md`
- Source: `B-065`, raised by `TASK-0193`'s live check

## Objective

`collect` failed with "no tool.call hook answered this call" while tasks ran, and answered once they had ended. Find why with evidence, fix it, and prove it with a test that fails against 0.4.2.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `register.tsx` `answerCollect` | polls `$.clock.sleep(1000)` until the tasks end or `timeoutMs` (default 600 000) |
| `DEVELOPING.md` | says a wait on `$.clock.sleep` is free of the hook's budget |
| Claude Code 2.1.309 types (`HookBudget`, `$.clock.sleep`) | the hook's own time is 10 000 ms; `$.clock.sleep` is the one `$` call its budget runs on through |

## Scope

- In: bound `collect`'s wait by what is left of its hook's budget, less a margin, and say so in its answer; the test; tool description, README and DEVELOPING; `B-065` closed.
- Out: the `.catch` answer for the mod's own tools; any other mod's waits.

## Likely files

- `mods/task-orchestrator/hooks/register.tsx`, `register.test.tsx`, `README.md`, `DEVELOPING.md`, `.claude-plugin/plugin.json`

## Execution plan

1. Root cause from the build's types and the test kit's `mock.clock`; record it below.
2. Test: a collect on a running task with `timeoutMs: 600000`, the clock advanced past ten seconds, answers with the task still running and a call-again line. Red against 0.4.2.
3. Fix: the wait's deadline is the lesser of `timeoutMs` and `next.budget.remainingMs` less a margin; each sleep is cut to the deadline and takes `next.signal`.
4. Docs, version 0.4.3, `B-065`, `CURRENT_STATE`; gates; one commit.

## Acceptance criteria

- [x] A `collect` on a running task answers before its hook's budget ends, naming the tasks still running and to call `collect` again.
- [x] The new test fails against 0.4.2.
- [x] `tests/test-mods.sh --mod task-orchestrator` and `scripts/check-mods.py` pass.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod task-orchestrator

## Risks and rollback

- A coordinator calls `collect` more often (one call per about eight seconds of waiting); `turn.complete` already notes each ended task to it, so it need not poll.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `task-orchestrator` | 0.4.2 → 0.4.3: `answerCollect` ends its wait at `next.budget.remainingMs` less 1.5 s, cuts each sleep to that deadline and passes `next.signal`; a running task's line says to call again; the tool's description, README and DEVELOPING say why |
| `B-065` | closed |

Next: `B-068`. The organization library copy is still 0.4.2, and it is what sessions on this host load (`~/.claude/plugins/synced/`), so republish 0.4.3 once landed.

## Execution log

- 2026-11-02 · Claude Code (Opus 5.5) · brief written before the change
- 2026-11-02 · Claude Code (Opus 5.5) · done (landing left to the coordinator)
  - Root cause, offline: the 2.1.309 types say a hook's own time is `HookBudget.ms` = 10 000, that the clock stops for every `$` call "a `$.clock` wait excepted", and that through `$.clock.sleep` "its budget runs on". `collect` slept 1 s per poll toward a 600 s default, so on a running task it overran; the `tool.call` hook's `.catch` (no `agentId` on the coordinator's call) ran `next(e)`, where nothing answers the mod's tool. A collect after the tasks ended never slept, which is why the third call in `TASK-0193` answered. No throw or reload is needed to explain it. `DEVELOPING.md`'s "a wait on `$.clock.sleep` is free" was wrong from 0.1.0.
  - Evidence: `tests/test-mods.sh --mod task-orchestrator` against 0.4.2 → `(fail) collect on a running task … [10100.99ms]`, `hook failed closed: … (tool.call; its .catch answered)`; fixed → `PASS task-orchestrator: 34 pass`. `scripts/check-mods.py` → `OK (5 mods)`.
  - Deviation: `tsc` not run, since no TypeScript compiler is installed offline; `claude plugin validate` ran inside `test-mods.sh`. The test needs `timeoutMs: 20_000`: the kit's default five seconds would fail it before the ten-second budget could.
  - Live check for the human, in a session with the mod on: `/orchestrate on`, then ask for one `review` task on a large diff and a `collect` while it runs. Expect an answer in under ten seconds that ends `still running: call collect again`.
  - Seen live 2026-11-02 by the human, in a session started with `--plugin-dir` on this worktree's mod (the `collect` description read "never past about eight seconds"): `collect` on the running R1 answered in about 8.7 s with `still running: call collect again, or wait for its note` and `run: running (R1 running)`; after R1's note a second `collect` returned its report. R1's review raised `B-068`.
