# switchboard

A Claude Code mod that turns installed **mods**, **skills** and **MCP servers or connectors** off and on, per project, from a **Switchboard** pane beside the chat or the `/switchboard` command. Something turned off is refused when called and, where the engine lets a mod, hidden from what the model reads, so it cannot be picked by mistake. Everything is on until you turn it off.

- **Mods** (any plugin): its hooks are refused as it loads, from the next session or reload. A plugin that loads before switchboard is not refused.
- **Skills**: the `Skill` call is refused and `/name` answered with a note instead of the skill, from the next turn. The skill is also dropped from the listing the model reads, except where a security plugin runs first and passes that listing on past mods, as `cc-plugin-sec-default` does in the desktop app and the Windows CLI: there the skill stays listed but cannot run.
- **Connectors and MCP servers**: every call is refused at once; from the next turn its tools move behind ToolSearch with a note saying they are off. The server stays connected, since servers connect before any mod loads.
- **Per project**: toggles are kept for the session's project root and come back whenever a session opens there. Another project, or another worktree, starts with everything on.
- **switchboard itself is always on**: it cannot turn itself off.
- It writes no settings file and not `install.selection`: deploying stays `scripts/install.sh`'s job; this only turns off what is installed.

The pane lists what the session has seen: the plugins in your settings and those loading after this one, the skills in the listing, and the connected servers. Press a row to turn it off or on.

## Install

Mods need Claude Code 2.1.308 or later. Once published to the organization plugin library:

```
/plugin install switchboard@claudeai-organization-library
```

## Commands

- `/switchboard` opens the pane (or lists, on a surface without panes).
- `/switchboard list` lists each kind, on or off.
- `/switchboard off skill loop`, `/switchboard on connector claude.ai Gmail`, `/switchboard off mod agent-watch`: one item. `mcp` and `server` also name a connector; `plugin` a mod.
