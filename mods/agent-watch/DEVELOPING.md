# Developing agent-watch

`README.md` is the user-facing spec. Rules every mod follows, and the engine and desktop traps found while building `task-compass`: authoring guide, *Mods*. Loading and testing: runbook, *Loading a mod in development*, and `tests/test-mods.sh --mod agent-watch`.

## Modules

- `hooks/sigma.tsx`: the SIGMAorbital design module, a byte-identical copy of `mods/_template/hooks/sigma.tsx` (`ADR-0043`); never edit it here. Its `IDENTITY`, `agentState`, `fit`, `elapsed`, `kit` and the command-output cache are used below.
- `hooks/model.ts`: pure logic (`groupAgents`, `mergeListed`, `spawnedRow`, `nextHue`, `nested`; `elapsed` and `fit` re-exported from `sigma.tsx`), `iconOf` and `outcomeOf`, the task list (`applyPlan`, `progressOf`), the activity (`summarizeCall`, `callStarted`, `callEnded`, `tokensOf`, `turnCounted`, `activityLine`) and the alerts (`endedBadly`, `markAlerted`, `alertText`, `runningText`, `watchText`). Tested directly in `model.test.ts`.
- `hooks/view.tsx`: the `ui.render` pane, and `renderOutput`, `/agent-watch`'s `CommandOutput` row as a panel.
- `hooks/band.tsx`: the `AbovePrompt` band (`registerBand`), which passes to the engine while there is nothing to show or a survey holds the band.
- `hooks/register.tsx`: the hooks: the theme (`syncTheme` at the start, `watchTheme`), `/agent-watch` (its result kept by `remember`), a subagent's activity from its loop's `tool.call` (recorded before `next`, counted in a `finally`, so a deny or a throw still clears it) and its tokens and model from its `turn.complete`, `classic.SubagentStop` refreshing at once, the toasts and the status line from `refresh`, the task list from `tool.call` (`TodoWrite`, `TaskCreate`/`TaskUpdate`, `update_plan` and `wrap_up` under any MCP prefix, main loop only), agent tracking from `agent.spawn`, a subagent's `turn.start` and `turn.complete`, a one-second tick that re-reads `$.agent.list()` while an agent is active or ended less than a minute ago, else every ten seconds, and a 400 ms tick that moves `frame` only while an agent is `running`, so a still pane is not redrawn. Tested through the engine stub in `register.test.tsx`.
- `types/index.d.ts`: the `$.state` contract.

## How agents are tracked

`agent.spawn`'s answer opens the row at once, so a spawn shows before the engine lists it; `$.agent.list()` is the truth afterwards. A row the list stops naming is kept, so a finished agent stays under Completed for the session. `endedAt` is set the first time a row's status leaves the active ones, and never moved.

## Glyphs and colours

A row's `hue` is the least-used index into `IDENTITY` when the row was first seen, and never changes: the glyph says which agent it is. Its colour is its state, from `agentState`, in SIGMAorbital's exact hex for the theme the host is set to (`ADR-0043`). The pulse is the pane re-reading `frame` on each tick: `iconOf` returns the solid or hollow icon by its parity, so a test advances the mock clock by `FRAME_MS` and expects the other form. A function that receives `$` from another file must be a declaration (`function renderOutput($, e)`), not an arrow: `claude plugin validate` refuses the module otherwise.

## The task list

`applyPlan` repeats the desktop app's `update_plan` semantics (`items` replaces, `advance` completes the step in progress and starts the next pending, `done` and `start` are 1-based) and `wrap_up` completes every step; `task-compass` has the same code, kept in step by hand since the sandbox cannot share a module between mods. A test's engine stub answers `ui.render` with a marked `Text`, so a band that passes is told apart from one that drew nothing.

## Activity, alerts, the band's buttons

- A subagent's `tool.call` carries `e.agentId`; the main loop's does not. The hook records the activity around `next(e)` for an agent loop and tracks the task list for the main loop only, in that order.
- `classic.SubagentStop` is bypassed where the security plugin `cc-plugin-sec-default` runs above the mod (observed in a desktop session, `TASK-0182`): the engine sends the event on past the hook and says so in the transcript. The toast then comes from the agent's own `turn.complete`, which the mod also hears, or from the one-second tick; the classic hook helps only in a session without that plugin.
- `isAlerted` lives on the row, not in a module variable, so a hot reload does not toast a second time. `refresh` finds the rows that ended badly inside the updater, which `update` may run twice on a version miss, so the ids are collected in a map and toasted after.
- `$.ui.status` is written only when its text changes, from a module-level `lastStatus`, which a reload resets: the next refresh rewrites it.
- `$.ui.view` is allowed only while answering a press, so both the pane's rows and the band's icons call it from `onPress`. The band's buttons carry no `hotkey`: a bare digit in an empty composer presses a band button, which would surprise.
- A test's engine stub hooks `ui.toast`, `ui.status`, `ui.view` and `ui.open` and records what the mod said; `$.classic.SubagentStop(...)` raises the classic event.
