# TASK-0292 — task-orchestrator: a writer is spawned, not handed off, so the fence never sees it

## Status

- Status: todo
- Owner: agent
- Branch: agent/TASK-0292
- Created: 2026-11-13
- Updated: 2026-11-13
- Applies to: `mods/task-orchestrator/`
- Source: the live check of TASK-0291 on 2026-11-12/13 (desktop, 0.7.2 loaded from the main checkout), opened at the human's request

## Objective

Find why a writer `dispatch` was started by the mod's own spawn instead of handed to the coordinator's Agent call, and make the write fence hold live. Since 0.7.2 `start()` hands every writer off (`register.tsx:589`, `if (task.isWriter) return handOff('writer')`), and `dispatch` sets `isWriter` from the input or the role (line 720). Yet L7, L1 and L5, all isolated documentation writers dispatched with `isWriter: true`, each came back `running` with their own agent id, and L7's Write outside its allowed files succeeded.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| The run's ledger (`/orchestrate status`) | L7 `[a4f5fb00e68002192]`, L1 `[a6b1d86aebfd16374]`, L5 `[a73048ad181f10d3a]`, each with an agent id from dispatch, no hand-off line |
| `claude plugin list` | `task-orchestrator@inline` 0.7.2 from the main checkout, loaded; a synced copy from claude.ai not loaded |
| The agent type list after the run | a new `task-orchestrator:documentation--haiku-medium-wt` profile |
| `mods/task-orchestrator/claude/hooks/register.tsx` | line 589 hands writers off; line 720 sets `isWriter` |

## Scope

- In: the cause, with evidence (which code ran: the engine's cached bundle, another start path such as the queued tick, or adoption); a fix and red tests; a live re-run of the L7 probe that sees the root Write refused.
- Out: other mods; the turn-cap live check (TASK-0260); an engine change.

## Likely files

`mods/task-orchestrator/claude/hooks/register.tsx`, `ledger.ts`, `register.test.tsx`, `.claude-plugin/plugin.json`, `CHANGELOG.md`.

## Execution plan

1. Rule out a stale bundle: compare the loaded hooks' behaviour with the source (a probe that prints the mod's version from the running hook).
2. Trace every path from `dispatch` to `$.agent.spawn` for a writer: `start()`, the tick after a slot frees, the adoption of a coordinator call.
3. Red test reproducing the spawn; fix; kit green.
4. Live: dispatch an isolated writer; it must come back as a hand-off; after the Agent call, its root Write must be denied.

## Acceptance criteria

- [ ] The cause is named with evidence
- [ ] A red test fails before the fix and passes after; the kit is green
- [ ] Live: a writer dispatch is a hand-off, and the adopted writer's out-of-bounds Write is refused

## Mandatory validations

- [ ] `cd mods/task-orchestrator && claude plugin test claude`
- [ ] tests/validate.sh

## Risks and rollback

- Until fixed, the write fence does not hold for dispatched writers: their allowed files are advice, not enforcement.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next: step 1.

## Execution log

- 2026-11-13 · Claude Code (Opus 5.5, coordinator) · opened from the failed live check; no work done yet
  - Evidence: TASK-0291's 2026-11-13 entry
  - Deviation: none
