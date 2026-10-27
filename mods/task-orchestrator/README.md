# task-orchestrator

Turns the session into a lead coordinator. While it is on, the main conversation plans and divides the work and delegates the substantive parts to **real, isolated subagents** through a `dispatch` tool: each worker runs under a registered profile whose **model and effort come from a routing table** keyed by task class, inside limits the mod enforces in code (three concurrent workers, no nesting, one non-isolated writer at a time, writes only inside allowed files, two retries and one escalation per task). The worker's report comes back through `collect`; `status` shows every task with its **requested** model and effort beside what the runtime **observed**, and the host's overrides that may alter them. Claude Code only, 2.1.308 or later; terminal and desktop.

Workers are subagents, not sessions: each gets its own context and tools, runs in the background and answers once. You can open a worker's transcript from the tasks list, but it is not a conversation of its own.

## Install

Once published to the organization plugin library:

```
/plugin install task-orchestrator@claudeai-organization-library
```

From this checkout, add the folder to `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` (runbook, *Loading a mod in development*).

## Activation

While it is on, the status line reads `ORCH BALANCED · 2 RUNNING · 1 QUEUED`, and a finished worker is toasted as `T1 · SCOUT · COMPLETED · next step`.

Orchestration starts **off**. `/orchestrate on` turns it on for this project's sessions (the choice is stored) and hands the model the coordinator protocol; `/orchestrate off` stops new dispatches, leaves the ledger and every running worker alone, and changes nothing of yours.

## Usage

- `/orchestrate status`: on or off, policy, the coordinator's model, every task as `id → worker [agent id] → requested model/effort → observed … → status → next`, blockers, and the overrides in force. In the transcript it draws as SIGMAorbital panels (`ADR-0043`): ORCHESTRATOR with the run and a row per task, its state as glyph and word (queued grey, running cyan, done bright, failed red, blocked or partial amber), and OVERRIDES IN FORCE; the model reads the same text as before.
- `/orchestrate policy economy|balanced|quality`: picks the policy; the worker profiles are registered again under it. `balanced` is the brief's table (haiku/low for extraction and lookup, sonnet/medium for exploration, implementation and tests, sonnet/high for review, opus/high for architecture, debugging and risk review); `economy` lowers exploration, documentation, review, architecture and debugging one step, never risk review; `quality` raises lookup, exploration, documentation, implementation, tests and review.
- `/orchestrate routing`: the table under the current policy, with the model ids spawns resolved the aliases to so far, drawn as a ROUTING panel.
- `/orchestrate models`: the alias resolutions seen this session and the models a spawn refused.
- `/orchestrate opt-in high-effort|frontier [off]`: `xhigh`, `max` and the `fable` alias are refused until opted in.
- `/orchestrate providers [enable|disable <id>]`: the external-provider adapters. None is implemented in this version; enabling one is refused and the data-sharing disclosure is shown.
- `/orchestrate cancel [<task>|all]`: cancels queued work and stops running workers through `TaskStop`.

The model drives the rest through four tools: `dispatch` (a task with id, class, objective, inputs, allowed files, prohibited areas, deliverables, acceptance, dependencies, and optional role, model, effort and isolation), `collect` (waits for tasks to end and returns their reports), `status` and `cancel`.

### Worker roles

| Class | Role | Reads only | Model/effort (balanced) |
|---|---|---|---|
| extraction | utility | yes | haiku/low |
| lookup | scout | yes | haiku/low |
| exploration | investigator | yes | sonnet/medium |
| documentation | documentation | no | haiku/medium |
| implementation | builder | no | sonnet/medium |
| testing | tester | no | sonnet/medium |
| review | reviewer | yes | sonnet/high |
| architecture | planner | yes | opus/high |
| debugging | debugger | no | opus/high |
| risk-review | risk-reviewer | yes | opus/high |
| frontier | frontier-specialist | no | fable/high (opt-in) |

A read-only role gets `Read`, `Grep`, `Glob` and `LS` and nothing else, so it has no shell. Every role is denied `Agent`, `Workflow`, `SendMessage`, `TaskStop` and the worktree tools. Each worker ends with a fixed report (Status, Findings, Files, Checks actually run, Evidence, Risks, Next) and is told to list checks it did not run under Next, never under Checks.

### Configuring the routing

Without editing the mod, put a JSON file at `~/.claude/task-orchestrator.json` (every project) or `<project>/.claude/task-orchestrator.json` (one project; it wins). Any part may be left out; refused values are logged and ignored:

```json
{
  "policy": "balanced",
  "routes": { "review": { "model": "opus", "effort": "high" }, "lookup": { "effort": "medium" } },
  "limits": { "maxConcurrent": 3, "maxNesting": 1, "maxRetries": 2, "maxEscalations": 1, "collectTimeoutMs": 600000 },
  "optIn": { "highEffort": false, "frontier": false },
  "providers": { "openai": { "enabled": false }, "grok": { "enabled": false } }
}
```

The choices made with `/orchestrate` (on, policy, opt-ins, providers) are stored and win over the files.

## What is enforced and what is observed

`ARCHITECTURE.md` has the full split. In short: limits, nesting, the write fence and the opt-in gates are code; the model and effort of a worker are set on its registered profile and are **requested** until the worker's first model request shows them, when `status` reports them as **observed**; a host setting such as `modelSettings.<model>.effortLevel` or `CLAUDE_CODE_SUBAGENT_MODEL` can change what a worker runs on, and the mod discloses it rather than overriding it. Token and cost totals are not reported: the mod has no telemetry to read.

## Removal

`/orchestrate off` stops it. To remove the mod: `/plugin uninstall task-orchestrator`, or take the folder out of `CLAUDE_CODE_PLUGIN_DIRS`. Its stored choices and audit rows live in the plugin store under `task-orchestrator:settings` and `task-orchestrator:audit`; nothing is written to the project.
