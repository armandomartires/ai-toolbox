# agent-watch

A Claude Code mod that keeps an **Agents** pane beside the chat: this session and its sub-sessions as a status dashboard, with the subagents each owns, animated while they work. A meter above the prompt shows how far Claude's task list has come. It draws in SIGMAorbital (`ADR-0043`): monochrome, uppercase labels, its Night ops or Daylight colours following your theme setting. Colour says **state**, never which session owns a row (`ADR-0046` clause 1, which `ADR-0047` clause 2 extends to this mod).

- **A SESSIONS panel** (`ADR-0047`), the whole of the Agents pane, in a bracketed frame headed `N RUNNING`:
  - A **KPI row**: PROGRESS with its steps, AGENTS and how many run, TOKENS, and FAILED, red only above 0.
  - A **status sunburst**: an `Svg` on the desktop, braille cells in a terminal. This session is the centre with its state, `done/total` steps and duration, its sub-sessions the first ring, their agents the next. Each parent splits its span **equally** among its children, so nothing moves while work runs and tokens never size an arc. A legend sits under it.
  - A **SELECTED panel** (a one-line strip when the pane is short): the element's name, path, state, progress, duration, tokens and children, with OPEN TRANSCRIPT for an agent.
  - A **hierarchy table** (`SESSION STATE STEPS TIME TOK`): every session and member, indented. Pressing a row selects it, its arc outlined in white; pressing it again clears it.
  - A fold under THIS SESSION's row: `▾ HIDE` folds the table to `▸ SHOW n SESSIONS · m AGENTS` (terminal hotkey `s`).
- **Sessions**: **THIS SESSION** first, then each sub-session under the one that started it, active ones before ended ones, newest first:
  - **ORCH BALANCED** (the policy in force; `· OFF` once `/orchestrate off`): the [task-orchestrator](../task-orchestrator/README.md) run, while its ledger holds a task. Its rows are the ledger's tasks in order, `T1 · builder · <objective>`, with the worker's model/effort (observed, else requested). A queued task waits and says `WAITS ON T1`. The ledger's words are badges: `▲ BLOCKED` and `▲ PARTIAL` amber, `◆ FAILED` red, `○ CANCELLED` grey.
  - **WF review-changes**: a Workflow run (multi-agent orchestration), its rows the agents its script started.
  - **general-purpose · Build it**: a subagent that keeps its own task list (TodoWrite, in a terminal session; the desktop app gives subagents none) or spawned subagents of its own, its rows its children.
- **Steps**: this session's task list (`3/5 STEPS`), or its agents when it keeps none; the orchestrator's tasks ended over all, queued ones counted; a Workflow run's agents; a delegating subagent's own steps, else its children. An agent without a task list counts as one step, `0/1` while it runs and `1/1` once ended.
- **Colour is state**: running cyan, done `text-1`, failed red `◆`, blocked or partial amber `▲`, queued `text-3` outlined, stopped or cancelled `text-3` `○`. Ownership is shown by containment. The pane has no colour per session and no pulsing session icon.
- **Under a running row**, what it is doing: its own steps if it keeps a list (`1/2 STEPS`), the tool call in flight with its main argument (`Bash: ls -la`, with its elapsed time once it runs past five seconds), how many calls it has made, and its tokens so far (`3 CALLS · 1.2k TOK`). An ended row keeps its calls and tokens.
- **A pane too short** folds the KPI row and the SELECTED panel before the chart, and member rows into `+N more`.
- **In Compass's pane**: when [task-compass](../task-compass/README.md) is loaded too, this mod adds its contribution below Compass's Sprints board (`ADR-0048`): the progress meter (the band's own, drawn only while a task list exists or an agent runs), then the Sessions panel. No row is reserved, so Compass's pane scrolls. Nothing here turns that off alone: turn the whole mod off (for example with the [switchboard](../switchboard/README.md) mod) or do not install it; Compass then shows its board alone.
- Not drawn: desktop sessions started from this one with `start_session`; no engine call lists sessions.
- **A toast** when a subagent fails or is stopped, once, within a second of its end: `EXPLORE · Find hooks · FAILED 00:01:12`.
- **The status line** under the prompt says `2 AGENTS RUNNING` while any does.
- `/agent-watch` opens the pane when it is closed, and answers with a panel of the counts.
- **A meter above the prompt**: `▰▰▰▱▱ 3/5 STEPS` of Claude's live task list (`TodoWrite`, `TaskCreate`/`TaskUpdate`, or the desktop app's plan list), cyan while it tracks, the step in progress beside it, `text-1` and `ALL DONE` once every step is, and the pulsing glyph of each running subagent, in its session's colour, with their count (the band is unchanged by `ADR-0047`: its glyphs keep the session's tone and the pulse). The band stays empty while there is no task list and nothing runs. Click a glyph to open that agent's transcript, and the step text to open the Agents pane.

## Not yet verified

Version 0.6.0 (`TASK-0207`) is tested in the mod test kit and was seen in a live terminal session with both mods loaded: the contribution draws in Compass's pane (the meter's glyph and count, then the Sessions panel, following a running agent), the engine answers `engine` at the bottom of a Pane's chain, which both mods drop, and the pane scrolls. Not yet seen: a press on a row of the contributed panel; the meter's progress bar in Compass (it needs a task list); the load order with agent-watch first; and the panel in the desktop app.

## Install

Mods need Claude Code 2.1.308 or later. Once published to the organization plugin library:

```
/plugin install agent-watch@claudeai-organization-library
```

## Commands

- `/agent-watch` opens the Agents pane, and draws its counts as a panel.
