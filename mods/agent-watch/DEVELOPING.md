# Developing agent-watch

`README.md` is the user-facing spec. Rules every mod follows, and the engine and desktop traps found while building `task-compass`: authoring guide, *Mods*. Loading and testing: runbook, *Loading a mod in development*, and `tests/test-mods.sh --mod agent-watch`.

## Modules

- `hooks/sigma.tsx`: the SIGMAorbital design module, a byte-identical copy of `mods/_template/hooks/sigma.tsx` (`ADR-0043`); never edit it here. Its `IDENTITY`, `agentState`, `fit`, `elapsed`, `kit` and the command-output cache are used below.
- `hooks/sessions.ts`: the session tree (`sessionTree`, `iconOf`, `SESSION_TONES`, `toneToken`, `outcomeOf`, `memberTone`, `memberCaption`, `ledgerBadge`, `progressOf`, `activityLine`), pure, importing only `./sigma` and declaring the row shapes it reads itself. This is its one owner: `mods/task-compass/hooks/sessions.ts` is a byte-identical copy that `scripts/check-mods.py` (rule 7) holds equal (`ADR-0045`); change it here, then `cp` it.
- `hooks/model.ts`: pure logic (`mergeListed`, `spawnedRow`; `elapsed` and `fit` re-exported from `sigma.tsx`, everything `sessions.ts` exports re-exported from it), the sessions' tracking (`nextTone`, `assignTones`, `turnEnded`, `turnStarted`, `recordRun`), the task list (`taskChange`, `applyPlan`), the activity (`summarizeCall`, `callStarted`, `callEnded`, `tokensOf`, `turnCounted`) and the alerts (`endedBadly`, `markAlerted`, `alertText`, `runningText`, `watchText`). Tested directly in `model.test.ts`.
- `hooks/view.tsx`: the `ui.render` pane, and `renderOutput`, `/agent-watch`'s `CommandOutput` row as a panel.
- `hooks/band.tsx`: the `AbovePrompt` band (`registerBand`), which passes to the engine while there is nothing to show or a survey holds the band.
- `hooks/register.tsx`: the hooks: the theme (`syncTheme` at the start, `watchTheme`), `/agent-watch` (its result kept by `remember`), a subagent's activity from its loop's `tool.call` (recorded before `next`, counted in a `finally`, so a deny or a throw still clears it) and its tokens and model from its `turn.complete`, `classic.SubagentStop` refreshing at once, the toasts and the status line from `refresh`, every loop's task list from `tool.call` (`taskChange`: the main loop's into `tasks`, a subagent's onto its row), a Workflow call's result naming its run, agent tracking from `agent.spawn` (a Workflow agent opens its run), a subagent's `turn.start` and `turn.complete` (which ends a Workflow agent), each change through `changeAgents` (toasts, then `syncTones`), a one-second tick that re-reads `$.agent.list()` while an agent is active or ended less than a minute ago or the orchestrator holds an open task, else every ten seconds, and a 400 ms tick that moves `frame` only while an agent is `running`, so a still pane is not redrawn. Tested through the engine stub in `register.test.tsx`.
- `types/index.d.ts`: the `$.state` contract, and the mirror of the part of task-orchestrator's it reads.

## How agents are tracked

`agent.spawn`'s answer opens the row at once, so a spawn shows before the engine lists it. A subagent's own `turn.complete` ends it (`turnEnded`, `B-066`): its loop runs one turn, and the list is late to say it ended, or drops it without saying so, which left a nested Explore child drawn running for minutes (`TASK-0193`'s live check). `isTurnEnded` keeps that end while the list still says active; the list's own end word still wins over the turn's. A new `turn.start` in the loop (a message woke it) runs it again (`turnStarted`). A teammate is left to the list, since its turn ends in `idle`. A row the list stops naming is kept, so a finished agent stays under Completed for the session. `endedAt` is set the first time a row's status leaves the active ones, and never moved. Its calls and tokens stay in its caption once it ended, since its turn's end is the first to report its tokens.

## Sessions, glyphs and colours

`ADR-0044` has the why. A sub-session exists once `assignTones` has given it a tone in `tones` (keys `orch`, `run:<id>`, `agent:<id>`); this session's is always the first, `cyan`. `sessionTree` derives the rest on each draw: a row's owner is the orchestrator if it is a worker (its ledger names the agent, or `spawnedBy` says so), else its nearest session ancestor, else its Workflow run, else this session. A worker never becomes a session; its own steps go in its caption. Sessions draw `IDENTITY[1]`, subagents `IDENTITY[0]`, in their owner's tone. The pulse is the pane re-reading `frame` on each tick: `iconOf` returns the solid or hollow icon by its parity, so a test advances the mock clock by `FRAME_MS` and expects the other form. A function that receives `$` from another file must be a declaration (`function renderOutput($, e)`), not an arrow: `claude plugin validate` refuses the module otherwise.

## The orchestrator tie-in

task-orchestrator owns `ledger`, `policy` and `enabled`; agent-watch reads them through atoms of its plugin name and never writes. Its `types/index.d.ts` mirrors that part of the owner's contract, `Orch<Name>` for the owner's `<Name>`, fields copied verbatim; `check-mods.py` rule 8 fails the gate when the two disagree. A test loads task-orchestrator as an inline plugin (`test(name, { plugins }, body)`) that writes its ledger; the kit evaluates an inline register without its closure, so each ledger is a literal inside it.

A ledger task joins its agent row by `agentId`. The ledger's word wins: a worker that answered but reported `blocked` shows `BLOCKED`. A retried task's earlier agent rows stay under the orchestrator, by `spawnedBy`.

## Workflow runs

`agent.spawn` carries `workflow.runId` for an agent a Workflow script starts, and the Workflow tool's result carries `runId` and `workflowName`; either may come first, so `recordRun` opens the run and fills its name. No `$.agent.list()` names a Workflow agent, so its own `turn.complete` ends it, as it ends every subagent (`turnEnded`): `answer` completed, `aborted` stopped, anything else failed. Seen live in the desktop app (`TASK-0193`): both agents of a run ended with it.

In the desktop app a subagent has no TodoWrite, TaskCreate or TaskUpdate, so a subagent becomes a session there only by spawning children; its own `STEPS` bar needs a terminal session, where subagents have TodoWrite.

## The task list

`taskChange` applies every task tool to a loop's list, the main loop's and a subagent's alike; `applyPlan` repeats the desktop app's `update_plan` semantics (`items` replaces, `advance` completes the step in progress and starts the next pending, `done` and `start` are 1-based) and `wrap_up` completes every step; `task-compass` has the same code, kept in step by hand since the sandbox cannot share a module between mods. A test's engine stub answers `ui.render` with a marked `Text`, so a band that passes is told apart from one that drew nothing.

## Activity, alerts, the band's buttons

- A subagent's `tool.call` carries `e.agentId`; the main loop's does not. The hook records the activity around `next(e)` for an agent loop and tracks the task list for the main loop only, in that order.
- `classic.SubagentStop` is bypassed where the security plugin `cc-plugin-sec-default` runs above the mod (observed in a desktop session, `TASK-0182`): the engine sends the event on past the hook and says so in the transcript. The toast then comes from the agent's own `turn.complete`, which the mod also hears, or from the one-second tick; the classic hook helps only in a session without that plugin.
- `isAlerted` lives on the row, not in a module variable, so a hot reload does not toast a second time. `refresh` finds the rows that ended badly inside the updater, which `update` may run twice on a version miss, so the ids are collected in a map and toasted after.
- `$.ui.status` is written only when its text changes, from a module-level `lastStatus`, which a reload resets: the next refresh rewrites it.
- `$.ui.view` is allowed only while answering a press, so both the pane's rows and the band's icons call it from `onPress`. The band's buttons carry no `hotkey`: a bare digit in an empty composer presses a band button, which would surprise.
- A test's engine stub hooks `ui.toast`, `ui.status`, `ui.view` and `ui.open` and records what the mod said; `$.classic.SubagentStop(...)` raises the classic event.
