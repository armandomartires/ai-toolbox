# task-compass

A Claude Code mod that keeps a **Compass** pane beside the chat: your project's sprints as a timeline, the story being worked on, Claude's live tasks under it, and the subagents running.

- **Sprints side by side**: each sprint is a vertical rail, its stories dots down the rail in file order, the current sprint marked `◉` and placed in the middle. `‹ n earlier` and `n later ›` say what doesn't fit; click them to scroll the sprints one at a time, and `↺ Sprint n of m` to go back to the current one. In the terminal, with the pane focused, `h`, `l` and `c` do the same.
- **Progress** under each sprint's dot: `▰▰▰▱▱ 3/5` stories done, red and marked `late` once a sprint that is not done has run past the last date on its `Dates:` line.
- **The story being worked on** is bold with `▸` (or `~` when the mod matched it from the wording of Claude's live task). Claude's live task list (`TodoWrite`, `TaskCreate`/`TaskUpdate`, or the desktop app's plan list) hangs under it as small dots.
- **Click a name** beside a dot for a card, a pastel sticky note in the status's color that opens under it, the rows below sliding down: a story's full title, status, sprint and details; a sprint's goal, dates, days left and progress; a task's text and status. Click it again to close it. A long column folds its leading done stories into one dot, counting the open card.
- **Subagents**: every running subagent with its type, description and elapsed time. Finished ones stay visible for a minute. Click one to open its transcript in the main view, and again to go back.

## Install

It is in the organization's plugin library: open https://claude.ai/customize/plugins/plugin_01H5UJKC94BT6JqoyJoq4KNu, or in Claude Code add the organization library under `/plugin` → Marketplaces and run:

```
/plugin install task-compass@claudeai-organization-library
```

Mods need Claude Code 2.1.308 or later. The pane reads `GOALS.md` at the project's root; `/goals init` writes a starter one.

## Statuses

| Status | In GOALS.md | Dot | Color |
| --- | --- | --- | --- |
| Backlog | plain item, `- Idea` | ◌ | grey |
| To do | `- [ ] Story` | ○ | blue |
| In progress | `- [>] Story` | ◐ | amber |
| In review | `- [?] Story` | ◑ | purple |
| Blocked | `- [!] Story` | ✖ | red |
| Done | `- [x] Story` | ● | green |

The colors are theme colors, so they follow your light or dark theme.

## GOALS.md

```markdown
# Project

## Sprint 1 — Foundations
Goal: The first outcome this project must deliver
Dates: 2026-11-02 → 2026-11-13
- [>] First story
  Indented lines are the story's details, shown in its card
- [ ] Second story
- Idea for later

## Sprint 2 — Next
Goal: The outcome after that
- [ ] A story for sprint 2
```

Each `## ` heading is a sprint; `Goal:`, `Dates:` and `Status:` lines under it are optional. A sprint without `Status:` takes its status from its stories. Stories are numbered `<sprint>.<story>` in file order (`2.3`). A file with no `## ` heading is read as one sprint.

## Claude keeps the board up to date

You do no upkeep. The mod gives Claude a `story` tool whose description carries the board and asks Claude to keep it current unprompted: it calls the tool with a story id and a status when it starts a story, sends it for review, finishes it or gets stuck, and the tool rewrites that story's checkbox in `GOALS.md`. When Claude takes on work the board has no story for, it adds one under the sprint it belongs to. A story Claude sent for review becomes done once you have seen it and moved on without asking for changes. Claude's live task list counts as finished when Claude wraps up its turn. You can still edit the file by hand; the pane re-reads it within a few seconds.

## Commands

- `/compass` opens the pane again if you closed it.
- `/goals init` writes a starter `GOALS.md`; `/goals` reloads it and says where it read it from.
