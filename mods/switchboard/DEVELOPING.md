# Developing switchboard

`README.md` is the user-facing spec. Rules every mod follows, and the engine and desktop traps: authoring guide, *Mods*. Loading and testing: runbook, *Loading a mod in development*, and `tests/test-mods.sh --mod switchboard`. Why one mod rather than three, and why no settings answer: `ADR-0042`.

## Modules

- `hooks/model.ts`: pure logic: `asNames`, `isOff`, `toggle`, `setOff`, `addSeen`, `refusal`, `pendingNote`, `pluginDirs`, `isProtected`, `isIdName`, `toolHints`, `shownName`, `switchText`, the server names (`serverOfTool`, `serverOfProvider`, `toolSpelling`, `offName`), the skill listing (`listedSkills`, `dropSkills`), and the command (`parseArgs`, `listText`, `listData`). Tested in `model.test.ts`.
- `hooks/sigma.tsx`: the SIGMAorbital design module, a byte-identical copy of `mods/_template/hooks/sigma.tsx` (`ADR-0043`); never edit it here.
- `hooks/store.ts`: `loadOff`, `syncOff`, `saveOff`: `$.store` under `off:<project root>` is the truth, mirrored into `$.state` `off` for the pane. A toggle invalidates `prompt.attachment` and `tool.describe`, so the next turn reads it.
- `hooks/kinds/mods.ts` (`plugin.register`), `kinds/skills.ts` (`prompt.attachment` `skill_listing`, `tool.call` on `Skill`, `skill.prompt`), `kinds/connectors.ts` (`tool.describe`, `tool.call`): one hook set per kind, each recording what it sees into `$.state` `seen`.
- `hooks/inventory.ts`: `modsFromPluginDirs`: the mods `CLAUDE_CODE_PLUGIN_DIRS` names, by each folder's `plugin.json`, only where `hooks/hooks.json` exists; `refreshInventory`: those, plus the skills and MCP servers of `$.session.usage({ breakdown: 'summary' })` with up to three tool names per server (`$.state` `hints`), and `$.tool.list()`. Run at `session.start` and on `/switchboard` and `list`.
- `hooks/register.tsx`: wires the kinds, `/switchboard`, the pane, and `refreshInventory`.
- `hooks/view.tsx`: the pane: sections behind a header `Button` (`$.state` `open`), a row per item with a switch: a `Button` labelled On or Off, `variant` primary or secondary, its knob drawn in text by `switchText`, and a mod's `pendingNote` from `$.state` `refused`, all in one SIGMAorbital panel; and `renderOutput`, `/switchboard list` drawn as a panel per kind from the `listData` the command keeps with `remember`. `types/index.d.ts`: the `$.state` contract.

## Live behaviour (TASK-0185, Claude Code 2.1.310 and 2.1.312)

- **`cc-plugin-sec-default` passes `prompt.attachment` and `settings.read` on past mods** ("bypassed by cc-plugin-sec-default; beneath runs" in the debug log). It loads in the Windows CLI and the desktop app, not in this host's WSL CLI. So the listing trim works in WSL (`skill_listing: switchboard rewrote it`) and not on the desktop, where the `Skill` refusal still holds. It does not bypass `plugin.register`, `tool.call` or `tool.describe`.
- **MCP servers start connecting before any plugin loads**, so no hook of a mod keeps a server from connecting in the session that loads it. An answer to `settings.read` with `deniedMcpServers` was tried and dropped.
- **`plugin.register` is judged by the plugins admitted before the one loading.** A `--plugin-dir` mod loads first, so it judges the `CLAUDE_CODE_PLUGIN_DIRS` mods after it; the built-in and managed plugins load before it and are never refused.

## Traps

- **The mod inventory is not `enabledPlugins`.** `plugin.register` fires once per hooks module, so a plugin without one (most marketplace plugins ship only skills or servers) is never judged: a toggle for it would do nothing. A mod that loads before switchboard is judged before switchboard's hook exists, so the pane finds it by reading `CLAUDE_CODE_PLUGIN_DIRS` (`TASK-0186`).
- **Only tier `user` is judged.** A managed plugin is the administrator's.
- **No pressable SVG switch exists** (`TASK-0187`). Only a `Button` takes a press (`onPress`), a `Button` holds only strings and `Text` (`<Button> holds strings and Text, not <Svg>`), and a `Client`'s elements are the terminal's, with no `Svg`. The switch is a filled or outlined `Button` with a text knob.
- **The skill inventory is the context breakdown, not the listing.** `cc-plugin-sec-default` sends `prompt.attachment` on past mods, so on the desktop the listing hook never saw a skill. `$.session.usage({ breakdown: 'summary' })` counts locally and sends nothing.
- **`ccd_*` servers are the desktop app's own** (`ccd_turn`, `ccd_session`, ...). `isProtected` keeps them out of the list and the store's effect: a stored `ccd_` entry is never off.
- **Desktop connectors are named by an id** (`1a59c906-…`) in tool names and the breakdown alike; `shownName` adds the server's first tool names.
- **`$` crosses a file only into a function declaration.** `claude plugin validate` refuses `$` passed to an imported arrow function (`const loadOff = async ($) => ...`); `store.ts` uses `export async function`.
- **The test kit's `$` has no `plugin` or `settings` noun**, so `plugin.register` is not raised in a test: its rule is the pure `refusal`.
- **A skill listing entry is `- <name>: <description>`**, its description possibly running over unindented lines up to the next entry; a plugin's skill is named `plugin:skill`, so a name ends at the first colon followed by a space.
- **A server has two spellings**: `claude.ai Gmail` in `/mcp` and `tool.describe`'s provider (`mcp:claude.ai Gmail`), `claude_ai_Gmail` in its tools' names. `isOff` compares the tool-name spelling; `offName` gives back the one it was turned off by.
- **Gating hooks have no `.catch`** on purpose: a judge that fails lets the call or plugin through, the safe way for a convenience switch to fail.
- **Headless checks**: `claude -p "/switchboard ..." --plugin-dir mods/switchboard --output-format stream-json --verbose` runs the command with no model call; its `system/init` line lists the servers, plugins and skills, and `--debug-file` shows each hook's verdict.
