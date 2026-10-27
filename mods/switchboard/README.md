# switchboard

A Claude Code mod that turns installed **mods**, **skills** and **MCP servers or connectors** off and on, per project, from a **Switchboard** pane beside the chat or the `/switchboard` command. Something turned off is refused when called and, where the engine lets a mod, hidden from what the model reads, so it cannot be picked by mistake. Everything is on until you turn it off.

- **Mods** (any plugin): its hooks are refused as it loads, from the next session or reload. A plugin that loads before switchboard is not refused.
- **Skills**: the `Skill` call is refused and `/name` answered with a note instead of the skill, from the next turn. The skill is also dropped from the listing the model reads, except where a security plugin runs first and passes that listing on past mods, as `cc-plugin-sec-default` does in the desktop app and the Windows CLI: there the skill stays listed but cannot run.
- **Connectors and MCP servers**: every call is refused at once; from the next turn its tools move behind ToolSearch with a note saying they are off. The server stays connected, since servers connect before any mod loads.
- **Per project**: toggles are kept for the session's project root and come back whenever a session opens there. Another project, or another worktree, starts with everything on.
- **switchboard itself is always on**: it cannot turn itself off.
- It writes no settings file and not `install.selection`: deploying stays `scripts/install.sh`'s job; this only turns off what is installed.

## The pane

`/switchboard` opens it, a SIGMAorbital panel (`ADR-0043`) whose colours follow your theme setting. Three sections: **Mods** open, **Skills** and **Connectors** behind their header (press it to open or close), each header with its count and how many are off. Every row starts with its state, a cyan `●` when on and a grey `○` when off, and ends in a **switch**: a filled button with its knob at the right (`━━●`) when on, an outlined one with its knob at the left (`●━━`) when off. Press it to flip that item.

- **Mods** lists every mod (a plugin with a hooks module) in the folders `CLAUDE_CODE_PLUGIN_DIRS` names, and any of your own that loads after switchboard. A plugin that only ships skills or servers is not listed: it has nothing to refuse. Managed and built-in plugins are not listed or touched. switchboard's own row says *ALWAYS ON*.
- A mod whose toggle this session cannot apply says so in its row, in amber with `▲`: *off from the next session* (it is running) or *on from the next session* (switchboard refused it at load).
- **Skills** lists the skills the session's context lists; **Connectors** the connected servers. A connector the desktop names only by an id shows its first tool names beside it, so you can tell which it is.
- The desktop app's own servers (`ccd_session`, `ccd_turn`, ...) are not listed and cannot be turned off: the app's task list, panes and session controls run through them.

## Install

Mods need Claude Code 2.1.308 or later. Once published to the organization plugin library:

```
/plugin install switchboard@claudeai-organization-library
```

## Commands

- `/switchboard` opens the pane (or lists, on a surface without panes); so does a command missing its kind or name, such as `/switchboard on`.
- `/switchboard list` lists each kind, on or off, drawn as a panel per kind.
- `/switchboard off skill loop`, `/switchboard on connector claude.ai Gmail`, `/switchboard off mod agent-watch`: one item. `mcp` and `server` also name a connector; `plugin` a mod.
