# TASK-0203 — task-orchestrator 0.4.2: hand off on the role's profile, the effort on the call

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-28
- Updated: 2026-10-28
- Applies to: `mods/task-orchestrator/` (0.4.1 → 0.4.2)
- Source: the live run of `TASK-0202`, then the human's "Yes, fix it"

## Objective

A task handed off at other settings than its role's table starts in the turn its hand-off is printed: the hand-off names the role's own profile, always registered, and carries model, effort and isolation on the Agent call.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-orchestrator/` 0.4.1 | the hand-off names a per-settings profile (`builder--sonnet-high`), registered when the task starts |
| the live run of `TASK-0202` | that profile was no Agent type in the same turn (`Agent type 'task-orchestrator:builder--sonnet-high' not found`) |
| a live probe, 2026-10-28 | the scout profile at low, an Agent call with `effort "medium"` → `observed claude-haiku-5-5/medium`: the call's effort wins over the profile's |

## Scope

- In: `handoffCall` names `<role>`, model, effort, and `isolation "worktree"` for an isolated task; adoption accepts the role's own profile or the task's exact one; tests; README, ARCHITECTURE; 0.4.2.
- Out: the mod's own spawn (it takes no effort, so it keeps per-settings profiles); session workers (`TASK-0201`).

## Likely files

- `mods/task-orchestrator/hooks/{register.tsx,register.test.tsx}`, `README.md`, `ARCHITECTURE.md`, `.claude-plugin/plugin.json`

## Execution plan

1. `register.tsx`: `handoffCall` on the role's profile with the isolation; the adoption check.
2. Tests, red-proved; docs; version; gates; push.
3. Live, in the next turn (the mod reloads at the turn's end): B2 at sonnet/high from its hand-off, and a second non-isolated writer refused while it runs.

## Acceptance criteria

- [x] A hand-off names `task-orchestrator:<role>`, the requested model and effort, and `isolation "worktree"` for an isolated task.
- [x] A call on the role's own profile or the task's exact profile is adopted; another role's is refused.
- [x] Live: B2 starts from its hand-off in the same turn and is observed at sonnet/high; a second writer is held while B2 runs (queued at dispatch; the direct-call bypass was not reached, see the log).

## Mandatory validations

- [x] tests/test-mods.sh --mod task-orchestrator
- [x] tests/validate.sh
- [x] the new tests red-proved against 0.4.1's source

## Risks and rollback

- The mod sees neither the call's effort nor its isolation (`AgentSpawnInput` has neither): the observed line is what proves the effort, and an isolation left off is not caught.
- Rollback: git revert the task commit.

## Outputs / handover

- `mods/task-orchestrator/` 0.4.2: `register.tsx` `handoffCall` names `<role>`, model, effort and `isolation "worktree"` when isolated; the adoption takes the role's own profile or the task's exact one. README and ARCHITECTURE say why, with the probe.
- Live (2026-10-28): B2, retried at sonnet/high, was handed off on `task-orchestrator:builder` and started from that call in the same turn: `observed claude-sonnet-5-5/high`. B3, a second non-isolated writer dispatched while B2 ran, answered `queued → waits for its turn`. Once B2 ended, B3 was handed off and adopted from the coordinator's call: `observed claude-sonnet-5-5/medium`, completed.
- Not exercised: a direct Agent call for a queued writer while another writer runs. B2 ended within seconds (its `sleep 45` was refused by the session's Bash rules, and it stopped and reported as told), so B3's call came after B2 had ended.

Next: none for this task.

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · the effort probe run; brief written before the code
- 2026-10-28 · Claude Code (Opus 5.5) · built
  - Evidence: `tests/test-mods.sh` → `5 passed, 0 failed` (task-orchestrator 33); `tests/validate.sh` → `validate.sh: OK`.
  - Evidence, live: B2 → `B2 → builder [a7…] → requested sonnet/high → observed claude-sonnet-5-5/high → blocked` (its sleep refused); B3 at dispatch → `queued → waits for its turn`; B3 after B2 → `B3 → builder [a9…] → observed claude-sonnet-5-5/medium → completed`, `.pilot-scratch/orch-test/b3.txt` written.
  - Evidence, red-proof: 0.4.1's `register.tsx` → the hand-off assertion fails (`32 pass, 1 fail`); the adoption check alone back to the exact profile → `Expected: "agent-1"`, `Received: undefined` (`32 pass, 1 fail`).
