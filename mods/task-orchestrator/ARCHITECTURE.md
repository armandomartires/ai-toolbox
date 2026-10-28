# task-orchestrator: enforcement and advice

Every claim this mod makes falls in one of three columns. The first is what the engine refuses on the mod's word; the second is what the mod sees after the fact; the third is text the model is asked to follow.

## Enforced in code

| Rule | Where |
|---|---|
| At most `limits.maxConcurrent` workers run; the next waits in the ledger and starts when one ends | `ledger.startBlocker`, `runnable`; `register.tsx` `tick` |
| A worker never delegates: a spawn whose parent is a ledger worker is denied; a worker's call to `Agent`, `Workflow`, `SendMessage`, `TaskStop` is denied; the profiles also list them under `disallowedTools` | `agent.spawn` hook, `tool.call` hook, `ensureProfile` |
| One non-isolated writer at a time; isolated writers (own worktree) may run beside each other only with disjoint allowed files | `startBlocker` |
| A worker writes (`Edit`, `Write`, `MultiEdit`, `NotebookEdit`) only inside its allowed files, never a file another running writer owns; a read-only role never writes and never runs `Bash` | `writeBlocker`, `tool.call` hook; read-only profiles carry `tools: [Read, Grep, Glob, LS]` |
| `xhigh`, `max` and `fable` are refused without the opt-in; an effort outside the five levels is never sent | `router.gate`, `router.route` |
| A `dispatch` under the id of a `blocked`, `failed` or `partial` task is that task's next retry, in its place; retries are counted per task and refused past the limit, as escalations are; a `completed`, `cancelled`, queued or running id is refused | `retryTask`, `mayRetry`, `mayEscalate` |
| A dependant starts only once every dependency completed. Behind one that ended without completing it stays queued, so a retry of that one can still start it, and `status` and `collect` name what it waits on; `collect` does not wait it out | `startBlocker`, `stalledBy` |
| A spawn auto mode gives no verdict is issued once more, unchanged; refused again, its task is blocked with `handoff` | `register.tsx` `start` |
| A worker runs under its role's profile only at the table's settings; any other model, effort or isolation registers and spawns a profile of its own (`<role>--<model>-<effort>[-wt]`), so concurrent tasks of one role never share a registration | `profileName`, `ensureProfile`, `start` |
| A hand-off is adopted only from an Agent call of the task's exact profile (an Agent spawn carries no effort; the profile does) named with the task's id, and only when the task could start now (concurrency, writers); nothing of the call is rewritten | `agent.spawn` hook |
| A run reports `done` only when no task failed, was blocked or stayed open | `overall` |
| Off: `dispatch` refuses; queued tasks do not start; the ledger is kept | `answerDispatch`, `tick` |
| A guard that throws fails closed: the spawn is refused, a worker's call is refused, the main loop's passes | the `.catch` handlers |

The engine's own permission checks stay in force under every worker: the mod adds denials and never an allow, never a permission mode, never a bypass. The hand-off is no exception: it moves a spawn the classifier could not judge to a call it does judge.

## Observed, not guaranteed

- **Model**: the spawn's answer carries the id core resolved the alias to (`resolvedModel`); the worker's first `turn.step` carries the model the request names (`observed`).
- **Effort**: set on the worker's registered profile (`$.agent.register` takes `effort`; `$.agent.spawn` does not), so it is **requested**. The first `turn.step` of the worker's loop carries the effort the request sends, and `status` then reports it as **observed**. Until then the line reads `effort unverified`. A model that takes no effort is reported as such.
- **Host overrides**: `settings.model`, `modelSettings.<model>.effortLevel`, `CLAUDE_CODE_SUBAGENT_MODEL`, `CLAUDE_EFFORT`, `ANTHROPIC_MODEL` and `ANTHROPIC_SMALL_FAST_MODEL` are read at session start and listed by `status`. A `modelSettings.<model>.effortLevel` that differs from a task's requested effort on that model (the resolved id, else an id naming the alias) is also a `note:` in the `dispatch` answer. They are disclosed, never changed.
- **Resumes**: an `agent.spawn` with `resume` is passed through unchanged; a resumed worker keeps its profile. The mod registers a profile per settings and re-registers one only when its settings change; a profile registered mid-turn is taken by the Agent tool from the next turn (`$.agent.register`), which is why a hand-off line also names the effort; the observed line is what says which settings a worker actually ran under.
- **Auto mode** (Claude Code 2.1.312, desktop, 2026-10-28): every spawn the mod made with `$.agent.spawn` was refused with "The server-side auto mode classifier gave no verdict for Agent: the request that produced this action did not ask for one. Issue the action again once, as-is …", while the model's own Agent calls and a Workflow run started. The classifier judges an action against the model request that produced it, and a plugin's spawn has none: `$.agent.spawn` takes `prompt`, `description`, `subagentType`, `model`, `name` and `cwd` (`AgentSpawnArgs`), and its `tool_use_id` is the engine's, pinned, so nothing can name the coordinator's `dispatch` call or carry a consent. `$.tool.call({ tool: 'Agent' })` runs the permission check under a `tool_use_id` of its own, so it is expected to be refused the same way; not tried. What auto mode does allow is the coordinator's own Agent call, so the mod re-issues the spawn once, as the deny asks, then hands the task to that call (the role's type, the task's id as `name`, the requested model, the assignment as prompt) and adopts the spawn into the task's row. The adoption is tested against a stub, not yet seen live. The deny is matched on its wording: reworded, it leaves an ordinary `blocked`, which a re-dispatch retries. `cancel` stops a worker with `$.tool.call({ tool: 'TaskStop' })`, also a plugin's call; if auto mode refuses it, `cancel` says so and the worker keeps running.
- **Audit**: one row a task in `$.store` (ids, role, class, requested and observed settings, status, times, allowed files, report status, hand-off), at most 200, no prompt, no report body, no reasoning.

## Advisory

- The coordinator protocol (plan, route, dispatch, collect, integrate serially, report with evidence; a model or effort the person names goes on every dispatch, over the table; a reviewer separate from the builder; stop at the limits; the coordinator, not a worker, keeps the person's task board; never commit or push unasked) reaches the model as the `dispatch` tool's description and as the context of `/orchestrate on`. A `prompt.compose` section would be the natural place, but the security plugin skips mods' `prompt.compose` hooks, so this mod does not rely on it.
- The delegation contract (objective, inputs, allowed and prohibited files, deliverables, acceptance, tools, requested settings, stop condition, report shape) is text the worker is asked to follow; the fence above is what holds it.
- `Bash` writes by a builder, tester or debugger cannot be checked by path; the one-writer rule and the allowed-files list are what bound them.
- A worker's report is parsed from labelled lines; a worker that gives no `Status:` line is recorded as `partial` with a note to read its report.

## External providers

`providers.ts` declares the adapter interface (`id`, `kind` text-only or agentic, `status`, the variable whose presence says it is configured, the disclosure). The registry holds OpenAI and Grok as `not-implemented`, disabled; `enable` is refused and shows the disclosure. No network code ships in this version: a live adapter would be capability no task here can exercise, and the repository caps such capability (ADR-0039). Native Claude workers need no provider. `ADR-0041` records the decision.
