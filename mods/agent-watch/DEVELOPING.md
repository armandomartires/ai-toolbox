# Developing agent-watch

`README.md` is the user-facing spec. Rules every mod follows, and the engine and desktop traps found while building `task-compass`: authoring guide, *Mods*. Loading and testing: runbook, *Loading a mod in development*, and `tests/test-mods.sh --mod agent-watch`.

## Modules

- `hooks/model.ts`: pure logic (`groupAgents`, `mergeListed`, `spawnedRow`, `nextHue`, `nested`, `elapsed`, `fit`) the `PALETTE` with `colorOf`, `iconOf`, `outcomeOf`, and the task list (`applyPlan`, `progressOf`, `bar`). Tested directly in `model.test.ts`.
- `hooks/view.tsx`: the `ui.render` pane.
- `hooks/band.tsx`: the `AbovePrompt` band (`registerBand`), which passes to the engine while there is nothing to show or a survey holds the band.
- `hooks/register.tsx`: the hooks: `/agent-watch`, the task list from `tool.call` (`TodoWrite`, `TaskCreate`/`TaskUpdate`, `update_plan` and `wrap_up` under any MCP prefix, main loop only), agent tracking from `agent.spawn`, a subagent's `turn.start` and `turn.complete`, a one-second tick that re-reads `$.agent.list()` while an agent is active or ended less than a minute ago, else every ten seconds, and a 400 ms tick that moves `frame` only while an agent is `running`, so a still pane is not redrawn. Tested through the engine stub in `register.test.tsx`.
- `types/index.d.ts`: the `$.state` contract.

## How agents are tracked

`agent.spawn`'s answer opens the row at once, so a spawn shows before the engine lists it; `$.agent.list()` is the truth afterwards. A row the list stops naming is kept, so a finished agent stays under Completed for the session. `endedAt` is set the first time a row's status leaves the active ones, and never moved.

## Colors and icons

A row's `hue` is the least-used palette index when the row was first seen, and never changes. The palette is eight theme keys (`suggestion`, `success`, `warning`, `merged`, `error`, `claude`, `planMode`, `autoAccept`): the surfaces draw those in both themes, which a raw color name does not promise. The pulse is the pane re-reading `frame` on each tick: `iconOf` returns the solid or hollow icon by its parity, so a test advances the mock clock by `FRAME_MS` and expects the other form.

## The task list

`applyPlan` repeats the desktop app's `update_plan` semantics (`items` replaces, `advance` completes the step in progress and starts the next pending, `done` and `start` are 1-based) and `wrap_up` completes every step; `task-compass` has the same code, kept in step by hand since the sandbox cannot share a module between mods. A test's engine stub answers `ui.render` with a marked `Text`, so a band that passes is told apart from one that drew nothing.
