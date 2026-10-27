# TASK-0181 — agent-watch: a subagents pane and a progress band

## Status

- Status: done
- Owner: agent (Claude Code), with the human checking each iteration in the desktop app
- Created: 2026-10-27
- Updated: 2026-10-27
- Applies to: `mods/agent-watch/` (new, 0.1.0); registry; `CURRENT_STATE.md`; runbook, *Loading a mod in development*
- Source: the human's request, 2026-10-27

## Objective

A second Claude Code mod: an **Agents** pane beside the chat that lists this session's subagents grouped by status, each with its own color and an icon that animates while it runs, and a band above the prompt showing the task list's progress. Built iteratively, with this session loading the mod from the checkout as it is written.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/_template/`, `mods/task-compass/` | the shape and the traps a mod meets (authoring guide, *Mods*); `task-compass` already tracks agents and the desktop plan tool, reused as patterns, not shared code |
| `plugin-authoring` skill, 2.1.308 types | `agent.spawn`, `turn.start`/`turn.complete` with `agentId`, `$.agent.list()`, `AgentStatus`; `ui.render` on `Pane` and `AbovePrompt`; `$.clock.every` |
| This session | `CLAUDE_CODE_PLUGIN_DIRS` names `task-compass` only, read at start; the session's own mods folder `~/.claude/dev-mods/<session>/` is watched, and a link there is watched at the folder it names |

## Scope

- In: the mod (pane, band, tests, README, DEVELOPING.md), the registry row, the runbook line on loading a second mod, `CURRENT_STATE.md`.
- Out: publishing to the organization library (human step); merging the pane into `task-compass`; showing teammates' terminal panes; anything beyond the three asked-for features.

## Likely files

- `mods/agent-watch/.claude-plugin/plugin.json`, `hooks/hooks.json`, `hooks/register.tsx`, `hooks/model.ts`, `hooks/view.tsx`, `hooks/*.test.ts*`, `types/index.d.ts`, `tsconfig.json`, `README.md`, `DEVELOPING.md`, `LICENSE`
- `docs/registry.md` (generated), `docs/operations/runbook.md`, `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`
- Untracked: `~/.claude/dev-mods/<session>/agent-watch` → `mods/agent-watch` (link); `~/.claude/settings.json` env (the human's)

## Execution plan

1. Scaffold from `mods/_template/`; link it into this session's mods folder; the human answers *Turn them on*.
2. Iteration 1: the pane. Track agents from `agent.spawn`, `turn.start`/`turn.complete` and `$.agent.list()`; two groups, **Running** (`pending`, `running`, `waiting`, `idle`) and **Completed** (`completed`, `failed`, `killed`); each row: icon, type, description, elapsed; a click opens its transcript.
3. Iteration 2: one color per agent from a palette cycle, sticky for the session; an icon that cycles frames on a `$.clock.every` tick while the agent runs, still once it ended.
4. Iteration 3: the `AbovePrompt` band: a progress bar of the task list (`TodoWrite`, `TaskCreate`/`TaskUpdate`, the desktop app's `update_plan`), `done/total`, the task in progress, and the running agent count; hidden while nothing is tracked.
5. Tests per iteration, red-proved; README and DEVELOPING.md; registry; runbook; state; commit; push `origin`.

## Acceptance criteria

- [x] In this session the Agents pane shows a spawned subagent under Running with an animated icon, and under Completed once it ends, in its own color.
- [x] The band above the prompt shows `n/m` tasks as a bar while a task list exists, and nothing otherwise.
- [x] `claude plugin validate` and `claude plugin test` pass; each new test fails with its change reverted.
- [x] Gate green; registry has the row; README has the install line.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod agent-watch
- [x] each new test red-proved against its reverted change

## Risks and rollback

- An animation tick redraws the pane every few hundred milliseconds; it runs only while an agent is active, else the pane is still.
- A link in the session's mods folder loads the mod in this session only; other sessions take it from `CLAUDE_CODE_PLUGIN_DIRS` (runbook).
- Rollback: git revert the task commit; remove the link.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mods/agent-watch/` 0.1.0 | pane (`view.tsx`), band (`band.tsx`), model with palette and task list, 9 tests, README, DEVELOPING.md |
| runbook, registry, `CURRENT_STATE.md` | the link route for hot-loading; the mod's row; the state |

Next: publish 0.1.0 to the organization plugin library and add the folder to `CLAUDE_CODE_PLUGIN_DIRS` on each host (human steps).

## Execution log

- 2026-10-27 · Claude Code (Fable 5.1) · started
  - Iteration 1 written: pane with Running and Completed groups, click opens the transcript, `/agents`.
  - Evidence: `tests/test-mods.sh --mod agent-watch` → `PASS agent-watch:  6 pass`; `tests/validate.sh` → `OK`
  - Evidence: `mergeListed`'s end-time rule broken → 2 of 6 fail (`a spawn opens a running row...`, `the pane shows a spawned agent...`); restored → 6 pass
  - Loaded here through a link in this session's mods folder (plan step 1). Adding the folder to `~/.claude/settings.json` was refused to the agent (self-modification): a human step, the command given in chat.
  - Found in the session: `/agents` is a name Claude Code ships; `$.command.register` refused it and the whole `session.start` hook was skipped, the pane's open with it. `claude plugin validate` says so as a warning. Renamed to `/agent-watch`; the pane now opens before any call that can fail.
  - Iteration 2 written: palette of 8 theme colors with an icon pair each, a 400 ms pulse while running, outcome marks.
  - Evidence: `claude plugin test mods/agent-watch` → 7 pass; the pulse tick removed → `the pane shows a spawned agent...` fails; restored → 7 pass
  - Iteration 3 written: the `AbovePrompt` band with the task list's bar, the step in progress, `all done`, and the running agents' pulsing icons; passes to the engine while idle or under a survey.
  - Evidence: `claude plugin test mods/agent-watch` → 9 pass; the band unregistered → the band test fails; restored → 9 pass
  - Closed: the human confirmed the pane, the colors and pulse, and the band in this session (iterations 1–3). Not run: `tsc -p mods/agent-watch` (no `tsc` on this host).
