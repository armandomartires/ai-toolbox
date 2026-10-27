# task-compass

A Claude Code mod that keeps a **Compass** pane beside the chat: your project's sprints as a timeline, the story being worked on, Claude's live tasks under it, and the subagents running. The sprints come from a `GOALS.md` at the project's root, or from a project-workflow `.ai/` plan (below).

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

## Projects that plan in `.ai/`

A project with no `GOALS.md` whose `.ai/` layer follows the project-workflow convention gets its board from that plan, read-only. The layer is found through `.ai-layout.json`, or `.ai/` with `00.CONVENTIONS.md` by default, and must have a `30.ROADMAP.md`.

- **Sprints** are the rows of the roadmap's *Sprint history* table, named `S087`. A sprint is **open** when its Dates cell says `(open)` and at least one of its tasks is not done. Every open sprint is current: they sit together in the middle, as many as the pane's width allows, and the caption reads `S087–S089 open · 88 sprints`.
- **Stories** are the task briefs in `tasks/` (`S087_Name.T004_Name.md`, or `S087.T004_Name.md`), named `S087.T004`. A task's status is the first words of its brief's `**Status**:` line: `completed`, `complete`, `done`, `closed`, `resolved` and `cancelled` are done; `not started` is to do; `in progress`, `blocked` and `in review` are what they say. Any other status shows as to do, its own words on the card, and the sprint's card counts them. Change records and the template are not tasks.
- **The pane never writes `.ai/`.** The `story` tool there only records which task Claude is on; a status changes in the brief, under the project's own rules, and the pane picks it up within a few seconds. `/goals init` declines in such a project.
- A `GOALS.md`, if there is one, wins over `.ai/`. A malformed `.ai-layout.json` is reported in the pane and by `/goals`, not guessed past.

## Commands

- `/compass` opens the pane again if you closed it.
- `/goals init` writes a starter `GOALS.md`; `/goals` reloads the board and says where it read it from. In a `.ai/` project, `/goals` lists the open sprints and `init` writes nothing.
