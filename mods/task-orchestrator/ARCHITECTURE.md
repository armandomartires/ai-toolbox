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
| Retries and escalations are counted per task and refused past the limits | `mayRetry`, `mayEscalate` |
| A dependant starts only once every dependency completed; a failed dependency blocks it | `startBlocker` |
| A run reports `done` only when no task failed, was blocked or stayed open | `overall` |
| Off: `dispatch` refuses; queued tasks do not start; the ledger is kept | `answerDispatch`, `tick` |
| A guard that throws fails closed: the spawn is refused, a worker's call is refused, the main loop's passes | the `.catch` handlers |

The engine's own permission checks stay in force under every worker: the mod adds denials and never an allow, never a permission mode, never a bypass.

## Observed, not guaranteed

- **Model**: the spawn's answer carries the id core resolved the alias to (`resolvedModel`); the worker's first `turn.step` carries the model the request names (`observed`).
- **Effort**: set on the worker's registered profile (`$.agent.register` takes `effort`; `$.agent.spawn` does not), so it is **requested**. The first `turn.step` of the worker's loop carries the effort the request sends, and `status` then reports it as **observed**. Until then the line reads `effort unverified`. A model that takes no effort is reported as such.
- **Host overrides**: `settings.model`, `modelSettings.<model>.effortLevel`, `CLAUDE_CODE_SUBAGENT_MODEL`, `CLAUDE_EFFORT`, `ANTHROPIC_MODEL` and `ANTHROPIC_SMALL_FAST_MODEL` are read at session start and listed by `status`. They are disclosed, never changed.
- **Resumes**: an `agent.spawn` with `resume` is passed through unchanged; a resumed worker keeps its profile. The mod re-registers a profile only when a dispatch asks for other settings, and a profile registered mid-turn is taken by the Agent tool from the next turn; the observed line is what says which settings a worker actually ran under.
- **Audit**: one row a task in `$.store` (ids, role, class, requested and observed settings, status, times, allowed files, report status), at most 200, no prompt, no report body, no reasoning.

## Advisory

- The coordinator protocol (plan, route, dispatch, collect, integrate serially, report with evidence; a reviewer separate from the builder; stop at the limits; never commit or push unasked) reaches the model as the `dispatch` tool's description and as the context of `/orchestrate on`. A `prompt.compose` section would be the natural place, but the security plugin skips mods' `prompt.compose` hooks, so this mod does not rely on it.
- The delegation contract (objective, inputs, allowed and prohibited files, deliverables, acceptance, tools, requested settings, stop condition, report shape) is text the worker is asked to follow; the fence above is what holds it.
- `Bash` writes by a builder, tester or debugger cannot be checked by path; the one-writer rule and the allowed-files list are what bound them.
- A worker's report is parsed from labelled lines; a worker that gives no `Status:` line is recorded as `partial` with a note to read its report.

## External providers

`providers.ts` declares the adapter interface (`id`, `kind` text-only or agentic, `status`, the variable whose presence says it is configured, the disclosure). The registry holds OpenAI and Grok as `not-implemented`, disabled; `enable` is refused and shows the disclosure. No network code ships in this version: a live adapter would be capability no task here can exercise, and the repository caps such capability (ADR-0039). Native Claude workers need no provider. `ADR-0041` records the decision.
