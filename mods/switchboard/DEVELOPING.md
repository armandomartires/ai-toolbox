# Developing switchboard

`README.md` is the user-facing spec. Rules every mod follows, and the engine and desktop traps: authoring guide, *Mods*. Loading and testing: runbook, *Loading a mod in development*, and `tests/test-mods.sh --mod switchboard`. Why one mod rather than three, and why no settings answer: `ADR-0042`.

## Modules

- `hooks/model.ts`: pure logic: `asNames`, `isOff`, `toggle`, `setOff`, `addSeen`, `refusal`, the server names (`serverOfTool`, `serverOfProvider`, `toolSpelling`, `offName`), the skill listing (`listedSkills`, `dropSkills`), and the command (`parseArgs`, `listText`). Tested in `model.test.ts`.
- `hooks/store.ts`: `loadOff`, `syncOff`, `saveOff`: `$.store` under `off:<project root>` is the truth, mirrored into `$.state` `off` for the pane. A toggle invalidates `prompt.attachment` and `tool.describe`, so the next turn reads it.
- `hooks/kinds/mods.ts` (`plugin.register`), `kinds/skills.ts` (`prompt.attachment` `skill_listing`, `tool.call` on `Skill`, `skill.prompt`), `kinds/connectors.ts` (`tool.describe`, `tool.call`): one hook set per kind, each recording what it sees into `$.state` `seen`.
- `hooks/register.tsx`: wires the kinds, `/switchboard`, the pane, and the inventory at `session.start` (`enabledPlugins`, `$.tool.list()`).
- `hooks/view.tsx`: the pane. `types/index.d.ts`: the `$.state` contract.

## Live behaviour (TASK-0185, Claude Code 2.1.310 and 2.1.312)

- **`cc-plugin-sec-default` passes `prompt.attachment` and `settings.read` on past mods** ("bypassed by cc-plugin-sec-default; beneath runs" in the debug log). It loads in the Windows CLI and the desktop app, not in this host's WSL CLI. So the listing trim works in WSL (`skill_listing: switchboard rewrote it`) and not on the desktop, where the `Skill` refusal still holds. It does not bypass `plugin.register`, `tool.call` or `tool.describe`.
- **MCP servers start connecting before any plugin loads**, so no hook of a mod keeps a server from connecting in the session that loads it. An answer to `settings.read` with `deniedMcpServers` was tried and dropped.
- **`plugin.register` is judged by the plugins admitted before the one loading.** A `--plugin-dir` mod loads first, so it judges the `CLAUDE_CODE_PLUGIN_DIRS` mods after it; the built-in and managed plugins load before it and are never refused.

## Traps

- **`$` crosses a file only into a function declaration.** `claude plugin validate` refuses `$` passed to an imported arrow function (`const loadOff = async ($) => ...`); `store.ts` uses `export async function`.
- **The test kit's `$` has no `plugin` or `settings` noun**, so `plugin.register` is not raised in a test: its rule is the pure `refusal`.
- **A skill listing entry is `- <name>: <description>`**, its description possibly running over unindented lines up to the next entry; a plugin's skill is named `plugin:skill`, so a name ends at the first colon followed by a space.
- **A server has two spellings**: `claude.ai Gmail` in `/mcp` and `tool.describe`'s provider (`mcp:claude.ai Gmail`), `claude_ai_Gmail` in its tools' names. `isOff` compares the tool-name spelling; `offName` gives back the one it was turned off by.
- **Gating hooks have no `.catch`** on purpose: a judge that fails lets the call or plugin through, the safe way for a convenience switch to fail.
- **Headless checks**: `claude -p "/switchboard ..." --plugin-dir mods/switchboard --output-format stream-json --verbose` runs the command with no model call; its `system/init` line lists the servers, plugins and skills, and `--debug-file` shows each hook's verdict.
