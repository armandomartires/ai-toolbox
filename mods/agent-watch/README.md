# agent-watch

A Claude Code mod that keeps an **Agents** pane beside the chat: every subagent of the session, grouped by status, each with its own glyph, coloured by its state and animated while it works. A meter above the prompt shows how far Claude's task list has come. It draws in SIGMAorbital (`ADR-0043`): monochrome, colour for state only, uppercase labels, its Night ops or Daylight colours following your theme setting.

- **RUNNING**, in a **SUBAGENTS** panel: the subagents whose loop is not over (`pending`, `running`, `waiting`, `idle`), newest first, nested under the agent that spawned them. Each row: its icon, its type, the task it was given, and the time it has run.
- **COMPLETED**: the ones that ended (`completed`, `failed`, `killed`), with the time they took; one that did not complete carries a badge: `◆ FAILED` in red, `○ STOPPED` in grey.
- **One glyph per agent**, kept for the session: `■` `⬢` `✦` `★` `⬟` `▮` `✚`. Its colour is its state: cyan while it runs, `text-2` while it waits, `text-1` once done, red if it failed, grey if stopped. The glyph pulses (solid, hollow, solid) while the agent runs, stays hollow while it waits to run, and stays solid once it ended.
- **Under a running row**, what it is doing: the tool call in flight with its main argument (`Bash: ls -la`, with its elapsed time once it runs past five seconds), how many calls it has made, and its tokens so far (`3 CALLS · 1.2k TOK`).
- **Click a row** to open that agent's transcript in the main view; click it again to come back.
- **A toast** when a subagent fails or is stopped, once, within a second of its end: `EXPLORE · Find hooks · FAILED 00:01:12`.
- **The status line** under the prompt says `2 AGENTS RUNNING` while any does.
- `/agent-watch` opens the pane when it is closed, and answers with a panel of the counts.
- **A meter above the prompt**: `▰▰▰▱▱ 3/5 STEPS` of Claude's live task list (`TodoWrite`, `TaskCreate`/`TaskUpdate`, or the desktop app's plan list), cyan while it tracks, the step in progress beside it, `text-1` and `ALL DONE` once every step is, and the pulsing glyph of each running subagent with their count. The band stays empty while there is no task list and nothing runs. Click a glyph to open that agent's transcript, and the step text to open the Agents pane.

## Install

Mods need Claude Code 2.1.308 or later. Once published to the organization plugin library:

```
/plugin install agent-watch@claudeai-organization-library
```

## Commands

- `/agent-watch` opens the Agents pane, and draws its counts as a panel.
