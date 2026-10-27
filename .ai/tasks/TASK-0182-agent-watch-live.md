# TASK-0182 — agent-watch 0.2.0: live activity, failure alerts, band interactions

## Status

- Status: done
- Owner: agent (Claude Code), with the human checking in the desktop app
- Created: 2026-10-27
- Updated: 2026-10-27
- Applies to: `mods/agent-watch/` (0.1.0 → 0.2.0); registry; `CURRENT_STATE.md`
- Source: the human's pick among the improvements proposed after `TASK-0181`; plan approved 2026-10-27

## Objective

Each running subagent's row says what it is doing now (the tool call in flight, its call count, its tokens so far), a failed or stopped subagent raises one toast the moment it stops, and the band above the prompt is clickable: an agent's icon opens its transcript, the step text opens the pane, and a status-line entry counts the running agents.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/agent-watch/` 0.1.0 | `tests/test-mods.sh --mod agent-watch` → 9 pass (`TASK-0181`, `774209d`) |
| Engine API (2.1.308 types) | `tool.call` and `turn.complete` carry `agentId` in a subagent's loop; `turn.complete` carries `usage`; `agent.spawn`'s answer carries `model`; `classic.SubagentStop`; `$.ui.toast`, `$.ui.status`, `$.ui.view` (press handlers only) |
| This session | hot-loads the mod through the link in its mods folder |

## Scope

- In: the three features, their tests, README, DEVELOPING.md, version 0.2.0, registry, state.
- Out: settings in `/config` (not picked); band hotkeys (a bare digit in an empty composer would press one); per-agent cost in money (the engine gives none per agent); publishing (human step).

## Likely files

- `mods/agent-watch/types/index.d.ts`, `hooks/model.ts`, `hooks/register.tsx`, `hooks/view.tsx`, `hooks/band.tsx`, `hooks/*.test.ts*`, `.claude-plugin/plugin.json`, `README.md`, `DEVELOPING.md`
- `docs/registry.md`, `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`

## Execution plan

1. `AgentRow` gains `model?`, `calls`, `tokens`, `activity?`, `isAlerted?`; no new `$.state` key.
2. Model: `summarizeCall`, `callStarted`, `callEnded`, `tokensOf`, `turnCounted`, `activityLine`, `endedBadly`, `markAlerted`, `alertText`, `runningText`; `spawnedRow` and `mergeListed` carry the new fields.
3. Register: activity around `next(e)` in a subagent's `tool.call`; tokens and model at its `turn.complete`; alerts and the status line from `refresh`; `classic.SubagentStop` refreshes at once.
4. View: a second caption line under a running row. Band: icon and step buttons.
5. Tests per feature, red-proved; docs; 0.2.0; live check in this session; commit; push `origin`.

## Acceptance criteria

- [x] A running row shows the tool in flight, then `n calls · k tok` after its turn, in this session.
- [x] A failed or stopped subagent raises exactly one toast: at `SubagentStop` in a session without the security plugin, else from its `turn.complete` or the next one-second tick (proven by the tests; not exercised live, since no subagent failed in this session).
- [x] The band's icon opens the agent's transcript; the step opens the pane; the status line counts running agents and clears at zero.
- [x] Validate's own suites and the mod's tests pass; each new test fails with its feature reverted. The gate was red only on another session's folder in this checkout; committed with `--no-verify` on the human's decision, CI being the second opinion.

## Mandatory validations

- [x] tests/validate.sh (red on `mods/task-orchestrator` only, not this diff)
- [x] tests/test-mods.sh --mod agent-watch
- [x] each new test red-proved against its reverted change

## Risks and rollback

- Two `agents` writes per subagent tool call, racing the one-second refresh: `update` retries; revisit if the pane flickers.
- `SubagentStop` may fire before the list reports `failed`: the toast then comes one tick later.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mods/agent-watch/` 0.2.0 | activity line, toasts, status line, band buttons; 14 tests; README, DEVELOPING.md |

Next: publish 0.2.0 to the organization plugin library (human step); the other session's `mods/task-orchestrator` should move to its own worktree (`ADR-0023`).

## Execution log

- 2026-10-27 · Claude Code (Fable 5.1) · started
  - Built: types, model, register, view, band; 0.2.0; README, DEVELOPING.md; state; registry row; TODO line.
  - Evidence: `claude plugin test mods/agent-watch` → 14 pass (9 before). Red-proofs: activity branch off → 2 fail; `SubagentStop` hook passing through → 2 fail; band keys renamed → 1 fail; restored → 14 pass.
  - Blocked at the gate: `tests/validate.sh` → `MOD SHAPE: mods/task-orchestrator: missing README.md`, another session's work in progress in this same checkout (`TASK-0183`, against `ADR-0023`). Its files, its TODO line and an untracked `.ai/GOALS.md` are left untouched; this task's index holds only its own changes.
  - Observed in this session after the reload: `agent-watch: its classic.SubagentStop hook was skipped. "cc-plugin-sec-default" runs first and sent the event on past it.` Recorded in DEVELOPING.md; the toast path falls back to `turn.complete` and the tick.
  - Committed with `--no-verify` on the human's decision (the gate's failure is another session's folder); CI reruns the gate on the pushed tree.
