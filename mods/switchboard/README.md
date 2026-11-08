# switchboard

> **Status: experimental.** Every feature of this mod is experimental while ai-toolbox is in its development stage (decided 2026-11-04, issue #5). A feature leaves experimental only through the live-verification gate (#9). Status is recorded in `claude/status.json`.

A Claude Code mod that turns installed **mods**, **skills** and **MCP servers or connectors** off and on, per project, from a **Switchboard** pane beside the chat or the `/switchboard` command. Something turned off is refused when called and, where the engine lets a mod, hidden from what the model reads, so it cannot be picked by mistake. Everything is on until you turn it off.

- **Mods** (any plugin): its hooks are refused as it loads, from the next session or reload. A plugin that loads before switchboard is not refused.
- **Skills**: the `Skill` call is refused and `/name` answered with a note instead of the skill, from the next turn. The skill is also dropped from the listing the model reads, except where a security plugin runs first and passes that listing on past mods, as `cc-plugin-sec-default` does in the desktop app and the Windows CLI: there the skill stays listed but cannot run.
- **Connectors and MCP servers**: every call is refused at once; from the next turn its tools move behind ToolSearch with a note saying they are off. The server stays connected, since servers connect before any mod loads.
- **Per project**: toggles are kept for the session's project root and come back whenever a session opens there. Another project, or another worktree, starts with everything on.
- **switchboard itself is always on**: it cannot turn itself off.
- It writes no settings file and not `install.selection`: deploying stays `scripts/install.sh`'s job; this only turns off what is installed.

## The pane

`/switchboard` opens it, a SIGMAorbital panel (`ADR-0043`) whose colours follow your theme setting, or are pinned by hand with `/switchboard theme dark|light|auto`. Since 0.9.0 (`TASK-0257`) it is drawn as the Compass and Agents panes are: one bracketed frame (corner brackets on a surface fill), opening on a KPI row (**MODS**, **SKILLS**, **CONNECTORS** and **OFF**, each a count with when a switch takes effect under it), and closing on a legend (`○ OFF`, `▲ CAUTION`) with `SWITCHBOARD <version>` at its right. Three sections: **Mods** open, **Skills** and **Connectors** behind their header (press it to open or close), each header a fold glyph (`▾` open, `▸` closed) in the control colour, the title, its count and how many are off. Brightness carries the hierarchy: a section's title bright, a topic's grey, a row's name in body text, dimmer when it is off. Every row is SIGMAorbital's **Toggle**: a square switch, then the name in capitals and its state word. On, the track and knob are bright with the knob at the right (`[ ■]`, ON). Off, they are grey with the knob at the left (`[■ ]`, OFF). Press anywhere on the row to flip that item. switchboard's own row is a dimmed toggle that reads ALWAYS ON.

- **Topics.** Inside Mods and Skills, rows sit under topic sub-headers: an uppercase grey label, its count (with `n OFF` when some are off) and a rule. A mod's topic is the `category` of its `claude/.claude-plugin/plugin.json` (`planning`, `observability`); a mod with none is under **OTHER**. A skill's topic is the plugin before the `:` of `plugin:skill` (`legal` for `legal:brief`); a skill with no plugin is under **STANDALONE**. Topics are alphabetical with OTHER and STANDALONE last, rows alphabetical inside. Press a topic's header to collapse or expand it; topics start open. Connectors stay one flat list, and toggling stays per row.
- **Resize the panel** (0.6.0, `ADR-0053`): drag the grip on the panel's bottom edge up or down and the panel takes that many rows, never under 4; what does not fit is cut. Double-click the grip to go back to automatic; once a click has given it the focus, `↑` and `↓` move it a row and `r` resets it. The height holds for this session, on the terminal and the desktop separately. On mobile and in VS Code there is no handle.
- **Mods** lists every mod (a plugin with a hooks module) in the folders `CLAUDE_CODE_PLUGIN_DIRS` names, and any of your own that loads after switchboard. A plugin that only ships skills or servers is not listed: it has nothing to refuse. Managed and built-in plugins are not listed or touched. switchboard's own row says *ALWAYS ON*.
- **Versions** (0.8.0, `TASK-0253`): when the session's project root holds `mods/<name>/claude` (an ai-toolbox checkout), a last section lists each of those mods with the version loaded beside the one its `plugin.json` declares: `0.13.1` when they agree, `LOADED 0.12.1  MANIFEST 0.13.1` with a `▲` beside the name and a note when the loaded copy is stale (each version a label and a value since 0.9.0; the section folds from its header like a topic), and `loaded from elsewhere: <folder>` when the copy loaded is not this checkout's (a second copy: a library install, a `dev-mods` sync). A mod of the checkout that is not loaded says so. The count in the header is the rows with a `▲`. The pane's last line is `SWITCHBOARD <version>`. Without a `mods/` folder in the project root there is no section.
- A mod whose toggle this session cannot apply says so in its row, in amber with `▲`: *off from the next session* (it is running) or *on from the next session* (switchboard refused it at load).
- **Skills** lists the skills the session's context lists; **Connectors** the connected servers. A connector the desktop names only by an id shows its first tool names beside it, so you can tell which it is.
- The desktop app's own servers (`ccd_session`, `ccd_turn`, ...) are not listed and cannot be turned off: the app's task list, panes and session controls run through them.

## Not yet verified

Version 0.9.0 (`TASK-0257`): the pane follows the design of Compass and Agents: the bracketed frame, the KPI row, headers pressed through the kit's `pressable` (their words drawn as text in the design's colours, a blank button laid over them), row names in body text, and the Versions section and footer drawn as label, value and legend. Topics past the pane's drawing budget are named in one line, as rows past it are. Tested in the mod test kit and the preview; not yet seen on the desktop in Night ops and Daylight.

Version 0.8.2 (`TASK-0256`): the pane draws its toggle rows within the engine's tree bounds. With 128 skills open, 0.8.1's desktop rows made a tree of 184,790 characters, past the 100,000 the engine draws, so a desktop kept its last drawing (a header press seemed dead) and after a session switch showed none. Rows past a budget are not drawn; their group says how many, and closing a section or group above shows them.

Version 0.8.1 (`TASK-0256`): on a desktop each toggle is SIGMAorbital's square switch, an Svg track under a blank Button laid over the row, and the Versions section sits under MODS. Tested in the mod test kit; the kit draws no native button, so only the desktop shows the switch and that a press lands.

Version 0.6.0 (`TASK-0223`), the resize handle, and 0.8.0 (`TASK-0253`), the Versions section and the pane's version line, are tested in the mod test kit; not yet seen live.

## Portability

The mod's Claude Code plugin is `claude/` (`ADR-0054`).

| Harness | Status |
|---|---|
| Claude Code | Supported: `claude/`. |
| OpenCode, Codex | Not planned: the mod is a UI (the Switchboard pane) and switches off what Claude Code's engine lets a mod refuse, which no other harness has. No `core/` folder: it is added only when a second harness needs shared logic. |

## Install

Mods need Claude Code 2.1.308 or later. Once published to the organization plugin library:

```
/plugin install switchboard@claudeai-organization-library
```

## Commands

- `/switchboard` opens the pane (or lists, on a surface without panes); so does a command missing its kind or name, such as `/switchboard on`.
- `/switchboard list` lists each kind, on or off, drawn as a panel per kind, with a topic line before each group of mods and skills.
- `/switchboard off skill loop`, `/switchboard on connector claude.ai Gmail`, `/switchboard off mod agent-watch`: one item. `mcp` and `server` also name a connector; `plugin` a mod.
