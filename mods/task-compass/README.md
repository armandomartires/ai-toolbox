# task-compass

A Claude Code mod that keeps a **Compass** pane beside the chat: your project's sprints as a timeline, the story being worked on, Claude's live tasks under it, and the sessions running. The sprints come from a `GOALS.md` kept in the project's `.ai/` folder, or from a project-workflow `.ai/` plan (below). It draws in SIGMAorbital (`ADR-0043`): monochrome, colour for state only, uppercase labels, its Night ops or Daylight colours following your theme setting.

- **Sprints side by side**: each sprint is a vertical rail, its stories dots down the rail in file order, the current sprint marked `◉` in white and placed in the middle. `‹ n EARLIER` and `n LATER ›` say what doesn't fit; click them to scroll the sprints one at a time, and `↺ SPRINT n OF m` to go back to the current one. In the terminal, with the pane focused, `h`, `l` and `c` do the same.
- **Progress** under each sprint's dot: `▰▰▰▱▱ 3/5` stories done, red and marked `LATE` once a sprint that is not done has run past the last date on its `Dates:` line.
- **The story being worked on** is bright (`text-1`) with `▸` (or `~` when the mod matched it from the wording of Claude's live task). Claude's live task list (`TodoWrite`, `TaskCreate`/`TaskUpdate`, or the desktop app's plan list) hangs under it as small dots.
- **Click a name** beside a dot for a card, a square panel on `surface` with its title uppercase and its status as glyph and word in the status's colour, that opens under it, the rows below sliding down: a story's full title, status, sprint and details; a sprint's goal, dates, days left and progress; a task's text and status. Click it again to close it. A long column folds its leading done stories into one dot, counting the open card.
- **SESSIONS**: agent-watch's session tree inside the compass (`ADR-0045`), with the same tree drawn above it as a **sunburst** when the pane has the room (an SVG on the desktop, mobile and VS Code; braille cells in the terminal): this session at the centre (always solid), each sub-session a ring arc in its colour spanning its members, each agent an equal share of the ring outside its session, in a stable order (ledger tasks by id, agents and sub-sessions by start), so a status change or an ending moves no arc. The SVG draws a running agent solid, a waiting one outlined, an ended one dimmed, and a red or amber outline for a failed or blocked one; hovering an arc names it. The braille chart shows the same state with colour and dot density: red for a failed or stopped one, amber for a blocked or partial one, the session's colour otherwise, a sparser pattern of dots once it ended, an outline while it waits. A session with very many members shows its running ones and one `+N more` arc for the rest, which counts toward the centre's running count. When the pane is short, the tree's member lines fold into `+N more` before the chart is hidden. The tree: this session, the task-orchestrator's run (`ORCH <POLICY>`, `OFF` when the mod is off), each Workflow run (`WF <name>`) and each subagent that delegates, every one with its glyph in its own colour, a bold name that opens its transcript, a meter with its `done/total` count, and its time. Each session's members are indented under it with their state as a pulse and a badge (`FAILED`, `STOPPED`, and the ledger's `BLOCKED`, `PARTIAL`, `CANCELLED`) and a caption under them (steps, the call in flight, calls and tokens, model/effort, `WAITS ON T1`). A queued task has no transcript, so its name does nothing. The panel's code is the running count. It reads agent-watch's state: the tree is drawn once agent-watch is loaded (its clock is running), and without it Compass lists the subagents it tracks itself, flat, with the ledger inline. The tree is cut to the pane's room: heads and ledger tasks stay, the other members share what is left, running ones first, and a session that lost some says `+N more`.

## Install

It is in the organization's plugin library: open https://claude.ai/customize/plugins/plugin_01H5UJKC94BT6JqoyJoq4KNu, or in Claude Code add the organization library under `/plugin` → Marketplaces and run:

```
/plugin install task-compass@claudeai-organization-library
```

Mods need Claude Code 2.1.308 or later. The pane reads `.ai/GOALS.md`; `/goals init` writes a starter one.

## Statuses

| Status | In GOALS.md | Dot | Colour (SIGMAorbital token) |
| --- | --- | --- | --- |
| Backlog | plain item, `- Idea` | ◌ | dim grey (`text-3`) |
| To do | `- [ ] Story` | ○ | grey (`text-2`) |
| In progress | `- [>] Story` | ◐ | cyan |
| In review | `- [?] Story` | ▲ | amber: it waits on a person |
| Blocked | `- [!] Story` | ◆ | red |
| Done | `- [x] Story` | ● | bright (`text-1`) |

The colours are SIGMAorbital's Night ops or Daylight values, picked by your theme setting.

## GOALS.md

The file lives at `GOALS.md` in the project's planning folder: `.ai/`, or the `root` a `.ai-layout.json` declares. Only `AGENTS.md` and `CLAUDE.md` belong at the project's root. A project that still has a `GOALS.md` at its root is moved over for you:

- Only a root `GOALS.md`: the mod copies it, unchanged, to `.ai/GOALS.md` and reads that from then on. A mod cannot delete files, so the root one stays; `/goals` and Claude tell you it is a leftover and how to delete it. If the copy cannot be written, the root file is read and written in place.
- Both exist: the one in `.ai/` is the board; the root one is never read or overwritten, and is reported as a leftover.
- Neither exists: nothing is written when the project opens. `/goals init` creates `.ai/GOALS.md`.

Older versions of the mod (0.1.x, 0.2.0) read only the root file, so a project that moved to `.ai/GOALS.md` looks empty to them until they update.

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

You do no upkeep. The mod gives Claude a `story` tool whose description carries the board and asks Claude to keep it current unprompted: it calls the tool with a story id and a status when it starts a story, sends it for review, finishes it or gets stuck, and the tool rewrites that story's checkbox in `.ai/GOALS.md`. When Claude takes on work the board has no story for, it adds one under the sprint it belongs to. A story Claude sent for review becomes done once you have seen it and moved on without asking for changes. Claude's live task list counts as finished when Claude wraps up its turn. You can still edit the file by hand; the pane re-reads it within a few seconds.

## Projects that plan in `.ai/`

A project with no `GOALS.md` (under `.ai/`, or a root one the mod has yet to copy there) whose `.ai/` layer follows the project-workflow convention gets its board from that plan, read-only. The layer is found through `.ai-layout.json`, or `.ai/` with `00.CONVENTIONS.md` by default, and must have a `30.ROADMAP.md`.

- **Sprints** are the rows of the roadmap's *Sprint history* table, named `S087`. A sprint is **open** when its Dates cell says `(open)` and at least one of its tasks is not done. Every open sprint is current: they sit together in the middle, as many as the pane's width allows, and the caption reads `S087–S089 open · 88 sprints`.
- **Stories** are the task briefs in `tasks/` (`S087_Name.T004_Name.md`, or `S087.T004_Name.md`), named `S087.T004`. A task's status is the first words of its brief's `**Status**:` line: `completed`, `complete`, `done`, `closed`, `resolved` and `cancelled` are done; `not started` is to do; `in progress`, `blocked` and `in review` are what they say. Any other status shows as to do, its own words on the card, and the sprint's card counts them. Change records and the template are not tasks.
- **The pane never writes `.ai/`.** The `story` tool there only records which task Claude is on; a status changes in the brief, under the project's own rules, and the pane picks it up within a few seconds. `/goals init` declines in such a project.
- A `GOALS.md`, if there is one, wins over `.ai/`: the mod never creates one on its own in such a project, only `/goals init` does. A malformed `.ai-layout.json` is reported in the pane and by `/goals`, not guessed past.

## Commands

- `/compass` opens the pane again if you closed it, and answers with a panel of the board's counts.
- `/goals init` writes a starter `.ai/GOALS.md`; `/goals` reloads the board and says where it read it from, drawn as a GOALS panel of the last eight sprints with their progress. In a `.ai/` project, `/goals` lists the open sprints and `init` writes nothing.
