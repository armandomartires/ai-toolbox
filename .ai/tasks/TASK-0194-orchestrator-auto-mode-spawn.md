# TASK-0194 — task-orchestrator 0.3.0: a spawn auto mode refuses can be retried or handed off

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-28
- Updated: 2026-10-28
- Applies to: `mods/task-orchestrator/` (0.2.0 → 0.3.0)
- Source: the human's request of 2026-10-28: in a desktop session in auto permission mode every `dispatch` was refused with "The server-side auto mode classifier gave no verdict for Agent: the request that produced this action did not ask for one. Issue the action again once, as-is …", while the model's own Agent calls and a Workflow run spawned; the task stays `blocked`, its id cannot be dispatched again, and a dependant waits forever

## Objective

A worker spawn that auto mode cannot evaluate no longer strands the run: the mod re-issues it once, then hands it to the coordinator's own Agent call, which the classifier does evaluate. A re-dispatch under the same id is a counted retry, and a dependant of a task that ended without completing is reported, not left queued in silence.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-orchestrator/` 0.2.0 | its tests pass |
| the engine's types (`.claude-plugin/types/claude-code/index.d.ts`, gitignored, 2.1.312) | `AgentSpawnArgs`, `$.agent.spawn`, `$.tool.call`, `ToolCheckInput` |
| a live probe in this auto-mode desktop session | `dispatch probe-1` refused with the no-verdict deny |

## Scope

- In: recognising the no-verdict deny; one automatic re-issue as-is; a hand-off the model performs with its own Agent call, adopted into the ledger row by `name` and role, with the row's limits and fence applied and nothing of the call rewritten; re-dispatch under an id whose task ended `blocked`, `failed` or `partial` as a retry counted against `maxRetries`; dependants of a task that ended without completing reported by `status` and `collect`, and `collect` no longer waiting on them; a hidden note to the coordinator when a queued task's spawn is refused; `ARCHITECTURE.md` (*Observed, not guaranteed*), `README.md`, `DEVELOPING.md`; 0.3.0.
- Out: `mods/agent-watch/` (its mirror of `TaskStatus` stays valid: no status is added); any allow, permission mode or rewrite of a call after its check; `$.tool.call({ tool: 'Agent' })` as the spawn path (see findings).

## Likely files

- `mods/task-orchestrator/hooks/{ledger.ts,ledger.test.ts,register.tsx,register.test.tsx,contract.ts}`, `types/index.d.ts`, `.claude-plugin/plugin.json`
- `mods/task-orchestrator/{ARCHITECTURE.md,README.md,DEVELOPING.md}`, `.ai/context/CURRENT_STATE.md`, `docs/registry.md`

## Execution plan

1. Findings from the types and the probe, recorded below.
2. Ledger: `isNoVerdict`, `retryTask` (under `mayRetry`), `stalledBy`; tests red then green.
3. Hooks: re-issue once; on a second no-verdict deny, block with `handoff` and the Agent call to make; adopt the model's matching spawn; re-dispatch as a retry; notes for refused queued tasks; `collect` returns stalled dependants.
4. Docs, version, registry, state.

## Acceptance criteria

- [x] A no-verdict deny is re-issued once, as-is; a second one blocks the task with `handoff` and a reason naming the Agent call to make.
- [x] The model's Agent call with that `subagent_type` and `name` is adopted into the row (its id, its allowed files, its limits), unchanged; a call of another role is not.
- [x] `dispatch` under the id of a `blocked`, `failed` or `partial` task requeues it as retry n of `maxRetries`, and is refused past it; a `completed`, `cancelled`, `queued` or `running` id is still refused.
- [x] A dependant of a task that ended without completing is listed by `status` and returned by `collect` at once, naming the dependency and how to retry it.
- [x] Docs say what auto mode allows, under *Observed, not guaranteed*; tests pass, the new ones red-proved.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod task-orchestrator (and --mod agent-watch, unchanged, for the mirror)
- [x] each new test red-proved against its reverted change
- [ ] the hand-off seen live in an auto-mode desktop session: needs the mod reloaded from master, so the human's next session; see the execution log

## Risks and rollback

- The no-verdict deny is matched on its wording; a reworded deny falls back to today's `blocked`, still retryable by re-dispatch.
- Rollback: git revert the task commit.

## Outputs / handover

- `mods/task-orchestrator/` 0.3.0. Ledger: `isNoVerdict`, `retryTask` (a re-dispatch under a `blocked`/`failed`/`partial` id replaces the row as retry n of `maxRetries`, refusing a cycle), `stalledBy` and `stallText` (transitive), `blockers` naming the way out; `Task.handoff`, audited. Hooks: `start` re-issues a no-verdict spawn once, then blocks with `handoff` and the Agent call to make; `dispatch` and `collect` print the assignment of a handed-off task; the `agent.spawn` hook adopts the coordinator's matching Agent call (role and `name`, under `startBlocker`), unchanged; `collect` no longer waits on a stalled task; a queued task refused on `tick` reaches the coordinator as a hidden note. The coordinator protocol names the retry and the hand-off.
- Docs: `ARCHITECTURE.md` (three enforced rows, an *Auto mode* entry under *Observed, not guaranteed*), `README.md` (*In auto permission mode*, retry by re-dispatch), `DEVELOPING.md` (modules, the trap); registry; `CURRENT_STATE.md`.
- Deviations: the hand-off was not in the request's two options; it was added because the findings show a re-issued plugin spawn meets the same refusal, so a retry alone cannot start a worker under auto mode. It adds no allow and rewrites nothing. No status was added to `TaskStatus`, so agent-watch's mirror holds unchanged.
- Next: the live check below, in an auto-mode desktop session once this is on master: dispatch a lookup, make the Agent call `collect` prints, and see the row turn `running` under the task's id.

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · planned in worktree `reverent-ellis-d0d516`
  - Findings, types: `$.agent.spawn` takes `AgentSpawnArgs` = `prompt` plus optional `description`, `subagentType`, `model`, `name`, `cwd`; `tool_use_id` is on `AgentSpawnInput` but engine-filled and pinned, and nothing carries consent or the originating model call. `$.tool.call` runs "the permission check and its dialog … under a `tool_use_id` of its own", with `next.origin` the plugin: no model request stands behind it either, so by the deny's own wording ("the request that produced this action did not ask for one") it should be refused the same way. Not tried live: that needs the changed mod loaded into a session.
  - Findings, probe: `dispatch probe-1` (lookup, haiku/low) in this auto-mode desktop session → `blocked → spawn refused: The server-side auto mode classifier gave no verdict for Agent: …`; this session's own Agent and Workflow calls are not refused.
- 2026-10-28 · Claude Code (Opus 5.5) · done in worktree `reverent-ellis-d0d516`
  - Evidence: `tests/test-mods.sh` → `5 passed, 0 failed` (task-orchestrator `27 pass`, up from 21; agent-watch `21 pass`, unchanged); `tests/validate.sh` → `validate.sh: OK`.
  - Evidence, red-proofs (each reverted alone, the suite re-run, then restored): no re-issue → the re-issue and hand-off tests fail; no adoption → the hand-off test fails; `addTask` for `retryTask` in dispatch → the retry test fails; `collect` waiting on stalled tasks → the hand-off test times out at 5003 ms; a merged retry row → the ledger retry test fails; `stalledBy` not transitive → the stall test fails; no cycle guard → the ledger retry test fails.
  - Not done: the live hand-off. This session loads the mod from the main checkout at 0.2.0, so the adoption is proven against the engine stub only.
