# ADR-0042 — One mod turns mods, skills and connectors off, as a runtime layer

**Status**: accepted
**Date**: 2026-10-27
**Task**: `TASK-0185`

## Context

The human asked for a mod to enable and disable mods, skills and connectors, and whether one mod should hold all three. Every session loads each installed component; turning one off meant uninstalling it or editing settings by hand. `install.selection` already decides what `scripts/install.sh` deploys, per host.

The engine offers a seam per kind: `plugin.register` (refuse a plugin as it loads); `prompt.attachment` of type `skill_listing`, `tool.call` on `Skill` and `skill.prompt` (hide and refuse a skill); `tool.describe` and `tool.call` (defer and refuse an MCP tool); and `settings.read`, whose merged answer the engine reads for `enabledPlugins` and `deniedMcpServers`.

Live checks on 2.1.310 and 2.1.312 (`TASK-0185`) found that MCP servers connect before any plugin loads, and that the security plugin `cc-plugin-sec-default`, loaded by the desktop app and the Windows CLI, passes `settings.read` and `prompt.attachment` on past mods.

## Decision

1. **One mod, `mods/switchboard/`**, with one module per kind. The on/off list is one fact, shown in one pane and kept in one store.
2. **Off means refused, and hidden where the engine allows it.** Every call to an off skill or server is refused and an off plugin's hooks are refused at load. A skill is also dropped from the listing, and a server's tools are deferred behind ToolSearch with a note.
3. **No `settings.read` answer.** It cannot stop a server that connects first, a plugin that loaded first, or anything under the security plugin. Keeping it would claim what it does not do.
4. **Per project**: the toggles live in the mod's `$.store` keyed by the session's project root. Nothing is off until turned off.
5. **A runtime layer, never a file writer.** `install.selection` still owns what is deployed, and no settings file is written. Removing the mod restores everything.
6. **The switch cannot turn itself off.** The security plugin is never bypassed or worked around.

## Alternatives considered

- **Three mods, one per kind.** Three partial views of one list, and three stores to keep consistent.
- **Editing `install.selection` or `settings.json`.** Per host rather than per project, needs a reinstall or a restart, and writes files the human owns.
- **Block only, without hiding.** Simpler, but an off component would still cost context where hiding works.

## Consequences

- Under `cc-plugin-sec-default` an off skill stays listed but cannot run; an off server stays connected, its tools deferred and refused.
- A plugin that loads before `switchboard` is not refused: the built-in and managed ones, and any mod ahead of it in load order.
- Toggles keyed by project root differ between a checkout and its worktrees.
