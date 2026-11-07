# agent-watch

> **Status: experimental.** Every feature of this mod is experimental while ai-toolbox is in its development stage (decided 2026-11-04, issue #5). A feature leaves experimental only through the live-verification gate (#9). Status is recorded in `claude/status.json`.

A Claude Code mod that keeps an **Agents** pane beside the chat: this session and its sub-sessions as a status dashboard, with the subagents each owns, animated while they work. A meter above the prompt shows how far Claude's task list has come. It draws in SIGMAorbital (`ADR-0043`): monochrome, uppercase labels, its Night ops or Daylight colours following your theme setting, or pinned by hand with `/agent-watch theme dark|light|auto`. Colour says **state**, never which session owns a row (`ADR-0046` clause 1, which `ADR-0047` clause 2 extends to this mod).

- **A SESSIONS panel** (`ADR-0047`), the whole of the Agents pane, in a bracketed frame headed `N RUNNING`:
  - A **KPI row**: PROGRESS with its steps, AGENTS and how many run, TOKENS, and FAILED (agents and background tasks), red only above 0.
  - A **status sunburst**: an `Svg` on the desktop, braille cells in a terminal. This session is the centre with its state, `done/total` steps and duration, its sub-sessions the first ring, their agents the next. Each parent splits its span **equally** among its children, so nothing moves while work runs and tokens never size an arc. A legend sits under it.
  - A **SELECTED panel** (a one-line strip when the pane is short): the element's name, path, state, progress, duration, tokens and children, with OPEN TRANSCRIPT for an agent.
  - A **hierarchy table** (`SESSION STATE STEPS TIME TOK`): every session and member, indented. Pressing a row selects it, its arc outlined in white; pressing it again clears it.
  - A fold under THIS SESSION's row: `▾ HIDE` folds the table to `▸ SHOW n SESSIONS · m AGENTS` (terminal hotkey `s`).
- **Sessions**: **THIS SESSION** first, then each sub-session under the one that started it, active ones before ended ones, newest first:
  - **ORCH BALANCED** (the policy in force; `· OFF` once `/orchestrate off`): the [task-orchestrator](../task-orchestrator/README.md) run, while its ledger holds a task. Its rows are the ledger's tasks in order, `T1 · builder · <objective>`, with the worker's model/effort (observed, else requested). A queued task waits and says `WAITS ON T1`. The ledger's words are badges: `▲ BLOCKED` and `▲ PARTIAL` amber, `◆ FAILED` red, `○ CANCELLED` grey.
  - **WF review-changes**: a Workflow run (multi-agent orchestration), its rows the agents its script started.
- **Background tasks** (`ADR-0049`): a shell command run in the background by Bash or, since 0.11.3, PowerShell (`run_in_background`, Ctrl+B, or moved at its timeout) or a Monitor is a row of the session whose loop started it, `B01 · shell · Run the driver`, with its elapsed time, its state (running, done, failed, stopped) and a caption with its command and `EXIT n` once known. It ends by its notification, a TaskStop, or the end of the subagent it dies with; the engine's in-flight list at each turn's end adds one that was missed and ends one no longer in it. `N RUNNING` and FAILED count them; AGENTS, the band and the status line do not. A background subagent is an agent row, never a task row.
  - **Step progress of a background run** (0.12.0): a run that prints its known steps fills its row step by step instead of `0/1` until it ends. The run prints one line per finished step, and a Monitor turns each of those lines into an event that reaches the mod. See *How a run reports its steps* below. The row's STEPS cell and arc show `n/m`, its caption says `n/m STEPS · <last step>`, and a step reported `FAIL` turns the row FAILED (`FAIL <label>` in the caption) from that step on, though it still counts as running until it ends. A Monitor whose command names the run's task id (for example by tailing its output file) is tied to that run and draws no row of its own. A Monitor that names no running shell is the row itself.
  - **general-purpose · Build it**: a subagent that keeps its own task list (TodoWrite, in a terminal session; the desktop app gives subagents none) or spawned subagents of its own, its rows its children.
- **Steps**: this session's task list (`3/5 STEPS`), or its agents when it keeps none; the orchestrator's tasks ended over all, queued ones counted; a Workflow run's agents; a delegating subagent's own steps, else its children. An agent without a task list counts as one step, `0/1` while it runs and `1/1` once ended.
- **Colour is state**: running cyan, done `text-1`, failed red `◆`, blocked or partial amber `▲`, queued `text-3` outlined, stopped or cancelled `text-3` `○`. Ownership is shown by containment. The pane has no colour per session and no pulsing session icon.
- **Under a running row**, what it is doing: its own steps if it keeps a list (`1/2 STEPS`), the tool call in flight with its main argument (`Bash: ls -la`, with its elapsed time once it runs past five seconds), how many calls it has made, and its tokens so far (`3 CALLS · 1.2k TOK`). An ended row keeps its calls and tokens.
- **A pane too short** folds the KPI row and the SELECTED panel before the chart, and member rows into `+N more`, in a terminal. A desktop folds none of them for height (0.8.1): its pane scrolls.
- **In Compass's pane**: when [task-compass](../task-compass/README.md) is loaded too, this mod adds its contribution below Compass's Sprints board (`ADR-0048`): the progress meter (the band's own, drawn only while a task list exists or an agent runs), then the Sessions panel. No row is reserved, so Compass's pane scrolls. Nothing here turns that off alone: turn the whole mod off (for example with the [switchboard](../switchboard/README.md) mod) or do not install it; Compass then shows its board alone.
- Not drawn: desktop sessions started from this one with `start_session`; no engine call lists sessions.
- **Resize the Sessions panel** (0.9.0, `ADR-0052`; in the Agents pane too since 0.10.0, `ADR-0053`), in Compass's pane and in the Agents pane, each pane's height its own: drag the grip on the panel's bottom edge (`━━━━━━━━` in a terminal, a thick bar on the desktop) up or down and the panel takes that many rows, never under 12; the chart, KPI row and member rows fold for a small panel as for a short pane. Double-click the grip to go back to automatic. Once a click has given the grip the focus, `↑` and `↓` move it a row and `r` resets it. The height holds for this session, on the terminal and the desktop separately. On mobile and in VS Code there is none and the panel sizes itself.
- **A toast** when a subagent fails or is stopped, once, within a second of its end: `EXPLORE · Find hooks · FAILED 00:01:12`.
- **The status line** under the prompt says `2 AGENTS RUNNING` while any does.
- `/agent-watch` opens the pane when it is closed, and answers with a panel of the counts.
- **A meter above the prompt**: `▰▰▰▱▱ 3/5 STEPS` of Claude's live task list (`TodoWrite`, `TaskCreate`/`TaskUpdate`, or the desktop app's plan list), cyan while it tracks, the step in progress beside it, `text-1` and `ALL DONE` once every step is, and the pulsing glyph of each running subagent, in its session's colour, with their count (the band is unchanged by `ADR-0047`: its glyphs keep the session's tone and the pulse). The band is empty only while there is no task list, no run, no running agent and orchestration is off; with orchestration on and nothing else to show it says `ORCH <POLICY> · IDLE`, and an `ORCH <POLICY>` label sits on the run and meter lines, dropped first when the band is narrow. Click a glyph to open that agent's transcript, and the step text to open the Agents pane. `ALL DONE` appears only when nothing runs or waits: a finished task list with an agent still running is not done. With no orchestrator run the band is as before, except that it no longer says `ALL DONE` while an agent runs.
- **The band follows the orchestrator's run** (0.8.0, `TASK-0215`): while [task-orchestrator](../task-orchestrator/README.md)'s ledger has a task that is not in a final state, the meter is one mark per ledger task in the Sessions panel's own glyphs and colours (`■` done, cyan `●` running, hollow `□` queued, red `◆` failed, amber `▲` blocked or partial, `○` cancelled), then `4/7 TASKS` (ended of all), the running task as `T3 · builder · Draw the band` with its elapsed time, then `2 QUEUED` and, when they all wait on one task, `· WAIT ON T3`. The app's task list, which `wrap_up` ticks off at every turn end, is not read while a run is open. A narrow band cuts the objective first, then `WAIT ON`, then the queued text, and never wraps. A press on the running `●` opens that agent's transcript; the task text opens the Agents pane. With no open run the band is the task list's, as above. A session with a running or queued member is never `DONE` in the Sessions panel.
- **The band shows the orchestrator's state while it is idle** (0.11.0, `TASK-0230`): with `/orchestrate on` the band says `ORCH BALANCED · IDLE` (the policy upper-cased) in text-3 when there is no task list, no running agent and no open task; a press opens the Agents pane. With a run open `ORCH <POLICY>` leads the line, and after a task list's meter it closes the line; it is the first part dropped when the line does not fit, before the objective or the step is cut. With orchestration off nothing changes. The same line is contributed to [task-compass](../task-compass/README.md)'s pane, so the idle line `ORCH <POLICY> · IDLE` appears there too. On a finished task list the label is dropped, not `ALL DONE`, when the band is narrow.

## How a run reports its steps

1. The script prints one line per **finished** step, on stdout, flushed at once:

   ```
   step <n>/<m> <label> <ok|FAIL>
   ```

   `n` counts from 1 and never passes `m`, the number of steps the run will take. `label` is free text and may be left out. The outcome, `ok` or `FAIL` in any case, is the line's last word. For example `step 3/7 mypy ok` or `step 4/7 pytest unit FAIL`. Any other line is ignored, and so is a line with `n` under 1, `n` above `m`, or `m` above 999. Done is the highest `n` reported, the total the latest `m`, and the first `FAIL` is kept. Print the step after it has run, not when it starts.
2. Start the script in the background (Bash or PowerShell with `run_in_background`).
3. Start a Monitor that tails that run's output file and keeps only the step lines. The file's name carries the run's task id, which ties the monitor to the run:

   ```
   tail -n +1 -f <the run's output file> | grep --line-buffered -E '^step [0-9]+/[0-9]+ '
   ```

   Give the Monitor a `timeout_ms` longer than the run; when the run ends its notification ends the row, and the monitor's expiry, later, changes nothing that shows. A Monitor that runs the script itself (`./gates.sh | grep --line-buffered -E '^step '`) also works; it is then the row.

Lines printed within 200 ms reach the mod as one event, and each of its lines is read.

## Not yet verified

Version 0.13.1: Daylight reads on a desktop (`TASK-0241`): pressable words are drawn as text outside a blank native button, and the sunburst follows SIGMAorbital in Daylight. Version 0.13.0: `/agent-watch theme dark|light|auto` (`TASK-0240`).

Version 0.12.0: step progress of a background run (above). Tested in the mod test kit. Proved live in a desktop session before it was built (2.1.318): a Monitor's per-line event reaches the mod's `prompt.submit` hook with origin `task-notification`, as `<event>step 1/3 lint ok</event>` with no `<status>`, and its expiry arrives the same way as `<event>[Monitor expired after 3m …]</event>`. Until 0.12.0 the mod took a Monitor's first event for its end and drew the monitor done.

Version 0.11.3: a PowerShell command run in the background, or moved there at its timeout, is a shell row like a Bash one (the tool's result has the same `backgroundTaskId` and `timedOutAfterMs`). Tested in the mod test kit only. Not yet seen live.

Why the turn-end reconciliation never runs on this organization's machines: Claude Code's built-in `cc-plugin-sec-default@builtin` takes the outermost seat on a machine with managed settings and for Team and Enterprise organizations. It hooks `classic.*` and answers every classic event with `next.to(e, "append")`, which skips the whole `user` tier: every mod a person installs, `@inline` and dev-mods copies included. So `classic.Stop` and `classic.SubagentStop` never reach agent-watch. The chain is not broken: managed hooks and the settings hooks still run. Only an organization administrator can change this, through managed `prependPlugins`. The notification (`prompt.submit`, which sec-default does not pass over) and TaskStop are what end a background task there.

The handle drawn by the shared panel (`TASK-0223`) was seen live in Compass's pane on the desktop (2026-11-04); not yet in the Agents pane.

Version 0.9.0 (`TASK-0221`), the Sessions handle, is tested in the mod test kit and was seen live on the desktop and in a terminal (2026-11-04): the handle on the frame's bottom edge, a drag resizes the panel, a double press goes back to automatic, the framed hint on hover. Not yet seen: the `↑`, `↓` and `r` keys.

Version 0.8.0 (`TASK-0215`), the band following the run, is tested in the mod test kit; not yet seen live.

Version 0.7.0 (`TASK-0208`), background tasks, was seen live in a terminal session (2026-11-02): a background `sleep 90; exit 3` drew `B01 · shell · Live check sleep` RUNNING with `1 RUNNING` and no agent, in the Agents pane and in Compass's, then FAILED with `EXIT 3` at `1m30s` from its notification. Under `cc-plugin-sec-default` the `classic.Stop` and `classic.SubagentStop` hooks are skipped, so the in-flight reconciliation does not run there. Not yet seen: a stopped task's or a monitor's row in the pane, and a command backgrounded with Ctrl+B or at its timeout.

Version 0.6.0 (`TASK-0207`) is tested in the mod test kit and was seen in a live terminal session with both mods loaded: the contribution draws in Compass's pane (the meter's glyph and count, then the Sessions panel, following a running agent), the engine answers `engine` at the bottom of a Pane's chain, which both mods drop, and the pane scrolls. In the desktop app (2026-11-02) the Agents pane draws the panel, a press on a row of the contributed panel selects it and the meter's progress bar draws in Compass. Not yet seen: the load order with agent-watch first.

## Portability

The mod's Claude Code plugin is `claude/` (`ADR-0054`).

| Harness | Status |
|---|---|
| Claude Code | Supported: `claude/`. |
| OpenCode, Codex | Not planned: the mod is a UI (the Agents pane, the band above the prompt, toasts), drawn with Claude Code's mod engine, which no other harness has. No `core/` folder: it is added only when a second harness needs shared logic. |

## Install

Mods need Claude Code 2.1.308 or later. Once published to the organization plugin library:

```
/plugin install agent-watch@claudeai-organization-library
```

## Commands

- `/agent-watch` opens the Agents pane, and draws its counts as a panel.
