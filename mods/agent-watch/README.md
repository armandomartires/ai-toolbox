# agent-watch

A Claude Code mod that keeps an **Agents** pane beside the chat: every subagent of the session, grouped by status, each in its own color with an icon that animates while it works. A bar above the prompt shows how far Claude's task list has come.

- **Running**: the subagents whose loop is not over (`pending`, `running`, `waiting`, `idle`), newest first, nested under the agent that spawned them. Each row: its icon, its type, the task it was given, and the time it has run.
- **Completed**: the ones that ended (`completed`, `failed`, `killed`), dim, with the time they took and a mark: `✓` completed, `✗` failed, `⏹` stopped.
- **One color and one icon per agent**, kept for the session: `●` `◆` `▲` `■` `★` `⬢` `✦` `◉`, each in its own theme color, so they follow your light or dark theme. The icon pulses (solid, hollow, solid) while the agent runs, stays hollow while it waits to run, and stays solid once it ended.
- **Click a row** to open that agent's transcript in the main view; click it again to come back.
- `/agent-watch` opens the pane when it is closed.
- **A progress bar above the prompt**: `▰▰▰▱▱ 3/5` of Claude's live task list (`TodoWrite`, `TaskCreate`/`TaskUpdate`, or the desktop app's plan list), the step in progress beside it, green and `all done` once every step is, and the pulsing icon of each running subagent with their count. The band stays empty while there is no task list and nothing runs.

## Install

Mods need Claude Code 2.1.308 or later. Once published to the organization plugin library:

```
/plugin install agent-watch@claudeai-organization-library
```

## Commands

- `/agent-watch` opens the Agents pane.
