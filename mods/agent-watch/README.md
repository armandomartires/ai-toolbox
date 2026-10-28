# agent-watch

A Claude Code mod that keeps an **Agents** pane beside the chat: this session and its sub-sessions as a tree, each with a progress bar, and under each the subagents it owns, animated while they work. A meter above the prompt shows how far Claude's task list has come. It draws in SIGMAorbital (`ADR-0043`): monochrome, uppercase labels, its Night ops or Daylight colours following your theme setting; colour says which session owns a row (`ADR-0044`).

- **A SESSIONS panel**: **THIS SESSION** first, then each sub-session under the one that started it, active ones before ended ones, newest first:
  - **ORCH BALANCED** (the policy in force; `· OFF` once `/orchestrate off`): the [task-orchestrator](../task-orchestrator/README.md) run, while its ledger holds a task. Its rows are the ledger's tasks in order, `T1 · builder · <objective>`, with the worker's model/effort (observed, else requested). A queued task waits hollow and says `WAITS ON T1`. The ledger's words are badges: `▲ BLOCKED` and `▲ PARTIAL` amber, `◆ FAILED` red, `○ CANCELLED` grey.
  - **WF review-changes**: a Workflow run (multi-agent orchestration), its rows the agents its script started.
  - **general-purpose · Build it**: a subagent that keeps its own task list (TodoWrite, in a terminal session; the desktop app gives subagents none) or spawned subagents of its own, its rows its children.
- **A bar per session**: this session's task list (`3/5 STEPS`), or its agents when it keeps none (`1/2 AGENTS`); the orchestrator's tasks ended over all, queued ones counted (`1/3 TASKS`); a Workflow run's agents (`2/6 AGENTS`); a delegating subagent's own steps, else its children.
- **Two glyphs**: every session `⬢`, every subagent `■`. **Colour is the owning session's**: this session cyan, each sub-session the least-used of violet, green, `text-1`, `text-2`, kept for the session; a subagent takes its session's. The glyph pulses (solid, hollow, solid) while it runs, stays hollow while it waits, and solid once it ended. A subagent that did not complete carries a badge: `◆ FAILED` in red, `○ STOPPED` in grey.
- **Under a running row**, what it is doing: its own steps if it keeps a list (`1/2 STEPS`), the tool call in flight with its main argument (`Bash: ls -la`, with its elapsed time once it runs past five seconds), how many calls it has made, and its tokens so far (`3 CALLS · 1.2k TOK`).
- **Click a row** or a delegating subagent's session to open that agent's transcript in the main view; click it again, or THIS SESSION, to come back.
- Not drawn: desktop sessions started from this one with `start_session`; no engine call lists sessions.
- **A toast** when a subagent fails or is stopped, once, within a second of its end: `EXPLORE · Find hooks · FAILED 00:01:12`.
- **The status line** under the prompt says `2 AGENTS RUNNING` while any does.
- `/agent-watch` opens the pane when it is closed, and answers with a panel of the counts.
- **A meter above the prompt**: `▰▰▰▱▱ 3/5 STEPS` of Claude's live task list (`TodoWrite`, `TaskCreate`/`TaskUpdate`, or the desktop app's plan list), cyan while it tracks, the step in progress beside it, `text-1` and `ALL DONE` once every step is, and the pulsing glyph of each running subagent, in its session's colour, with their count. The band stays empty while there is no task list and nothing runs. Click a glyph to open that agent's transcript, and the step text to open the Agents pane.

## Install

Mods need Claude Code 2.1.308 or later. Once published to the organization plugin library:

```
/plugin install agent-watch@claudeai-organization-library
```

## Commands

- `/agent-watch` opens the Agents pane, and draws its counts as a panel.
