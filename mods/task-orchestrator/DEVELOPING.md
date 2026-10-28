# Developing task-orchestrator

`README.md` is the user-facing spec; `ARCHITECTURE.md` says what is enforced and what is advisory. Rules every mod follows: authoring guide, *Mods*. Loading and testing: runbook, *Loading a mod in development*, and `tests/test-mods.sh --mod task-orchestrator`.

## Modules

- `hooks/routing.ts`: data. The task classes, roles and their profiles (description, read-only, max turns, system prompt), the `balanced` table, the policy deltas, the limits, the default config, `mergeConfig` (an override file laid over a config, refusals named) and `routesUnder` (a policy applied).
- `hooks/router.ts`: pure. `route` (class and the coordinator's overrides → role, model, effort, notes, or `blocked`), `gate` (opt-ins), `fallback` (the next model up the ladder), `escalate` (one step).
- `hooks/ledger.ts`: pure. The task rows, `startBlocker` and `runnable` (dependencies, concurrency, writers), `retryTask` (a re-dispatch under a retryable id), `stalledBy` (what a queued task is stuck behind), `isNoVerdict` (auto mode's refusal), `writeBlocker` (the per-call fence), `overall`, `line` and `summary`, `auditRow`.
- `hooks/contract.ts`: pure. `buildContract` (the worker's assignment), `parseReport` (its labelled report), `COORDINATOR_PROTOCOL`.
- `hooks/overrides.ts`, `hooks/providers.ts`: pure. Disclosure of host overrides; the provider adapter interface and its disabled registry.
- `hooks/register.tsx`: the hooks. `session.start` loads the config (defaults ← `~/.claude/task-orchestrator.json` ← `<cwd>/.claude/task-orchestrator.json` ← the store), reads the overrides, registers `/orchestrate`, the four tools and the worker profiles. `command.run` answers `/orchestrate`. `agent.spawn` denies a worker's spawn, adopts the coordinator's hand-off of a task auto mode refused, and tracks a worker profile the model took through the Agent tool. `tool.call` answers the mod's tools and fences a worker's calls. `turn.step` records a worker's observed model and effort. `turn.complete` closes the task, parses the report, appends a hidden note for the coordinator and starts queued work.
- `hooks/view.tsx`: `renderOutput`, `/orchestrate status` and `routing` drawn as SIGMAorbital panels from the data `register.tsx` keeps with `remember` beside the unchanged text; `statusLineText`; the task-state colours.
- `hooks/sigma.tsx`: the SIGMAorbital design module, a byte-identical copy of `mods/_template/hooks/sigma.tsx` (`ADR-0043`); never edit it here.
- `types/index.d.ts`: the `$.state` contract and the unions the modules import.

## Traps found while building it

- **A plugin's `$.agent.spawn` reaches the plugin's own `agent.spawn` hook** with `next.origin.plugin` naming the plugin, in the Agent tool's input shape (`subagent_type`, `run_in_background`). The hook passes its own spawns through; the limits were applied by `dispatch` before the spawn.
- **In `claude plugin test`, the engine stub for `agent.spawn` must answer a plugin's spawn with `{ model, agentId, result: { agentId, resolvedModel } }`**: the kit validates the answer as an `AgentSpawnResult` and hands the plugin the record under `result`. `{ model, agentId }` alone reaches the plugin as `{ model }` with no id; `{ result }` alone is "no implementation".
- **A `turn.step` hook is an async generator** (`async function*`, `return yield* next(e)`); a plain function does not type.
- **The test's `session.append` stub must call `next(e)`**: an answer without `next` is refused ("the row is kept").
- **A hook's budget counts a wait on a plain promise.** The first live `collect` overran the ten-second budget and was skipped ("no tool.call hook answered this call") because it waited on `new Promise` around a timer; a wait on `$.clock.sleep` is free, so `collect` polls with it.
- **`$.store` is not on the test's `$`**: assert through the mod's own commands, or give `mock.store(on, entries)` its starting rows.
- **Auto mode refuses a plugin's spawn with no verdict** ("the request that produced this action did not ask for one"): its classifier judges an action against the model request behind it, and `$.agent.spawn` can name none. The model's own Agent call passes. In `claude plugin test` a plugin's spawn reaches the engine stub as `subagent_type`, the model's as `subagentType`, which is how `engine({ noVerdict })` refuses only the former.
- `tsc -p mods/task-orchestrator` against the 2.1.312 types reports 31 errors, all in `register.test.tsx`: its command and tool inputs predate fields 2.1.312 requires (`origin`, `presentation`). The tests still run; new calls cast `as never`.
