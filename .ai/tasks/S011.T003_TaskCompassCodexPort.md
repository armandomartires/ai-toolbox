# TASK-0255 — task-compass in Codex: a plugin bundle on core/

## Status

- Status: review
- Owner: agent (Claude Code)
- Created: 2026-11-08
- Updated: 2026-11-08
- Applies to: `mods/task-compass/codex/`, `scripts/install.sh`
- Source: `B-070`. The person asked on 2026-11-08 to complete S16. Codex is not installed on this host.

## Objective

task-compass in Codex, as far as Codex goes: it draws no UI, so the session learns the current sprint's open stories at start, the model sets a story's status through an MCP `story` tool, and a `board` skill shows and edits the board. All of it reuses `core/` (`TASK-0254`).

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-compass/core/` | `board.ts`, `story.ts`: the board and the pure story tool (`TASK-0254`) |
| `docs/development/mod-workflow.md`, *Portability* | the Codex column: a bundle of `plugin.json`, `hooks/hooks.json`, `skills/`, `mcp.json`; tools only through MCP; no UI |
| Codex on this host | not installed (`~/.codex` absent) |

## Scope

- In: `codex/plugin.json`, `hooks/hooks.json` (`SessionStart`), `mcp.json` and `scripts/mcp-server.ts` (plain node, no SDK), `scripts/session-start.ts`, `scripts/main.ts` (the entry-script check both share), `skills/board/SKILL.md`, copies of `core/board.ts` and `core/story.ts`; node tests; `install.sh`'s copy to `~/.codex/plugins/`; docs.
- Out: a marketplace repository and its entry; publishing; Codex's IDE extension (it loads no plugins).

## Likely files

- `mods/task-compass/codex/` (`plugin.json`, `hooks/hooks.json`, `mcp.json`, `scripts/`, `skills/board/SKILL.md`), `README.md`, `DEVELOPING.md`
- `scripts/install.sh`, `tests/test-install.sh`, `docs/development/mod-workflow.md`

## Execution plan

1. Copy `core/board.ts` and `core/story.ts` into `codex/scripts/`; write the MCP server and the `SessionStart` hook on them, each a pure function and a stdin loop.
2. Node tests: JSON-RPC handling in process and over stdio, the hook's output in process and as a process.
3. The manifests and the skill; `install.sh`'s codex step outside the `CLIENTS` table, with tests; docs.

## Acceptance criteria

- [x] The MCP server answers `initialize`, `ping`, `tools/list` and `tools/call` of `story`, gives no reply to a notification, and errors per JSON-RPC (-32700, -32600, -32601, -32602); it also runs over stdio as a process
- [x] The `SessionStart` hook prints the current sprint's open stories as `additionalContext`, reading `cwd` from its stdin
- [x] `install.sh --client codex` copies the bundle when `~/.codex` exists, never over a folder it did not write, removes a deselected one, and `--status` reports it (X1-X5)
- [ ] Live: once Codex is installed, `scripts/install.sh --client codex`, a marketplace entry naming `task-compass`, a restart; in a folder with `.ai/GOALS.md` expect the open stories in the session's context, the `story` tool listed and changing a checkbox, and `$board` available
- [ ] Live: a marketplace entry for task-compass that the workspace admin imports

## Mandatory validations

- [x] `node --test mods/task-compass/codex/scripts/codex.test.ts`: 7 pass
- [x] `bash tests/test-install.sh`: 49 cases OK; `python3 scripts/check-mods.py`: OK (5 mods)
- [ ] `tests/validate.sh`: run by the pre-commit hook at the commit

## Risks and rollback

- Written from the Portability table (Codex CLI 0.166 docs, read 2026-11-03), never loaded: `plugin.json` at the bundle root with `hooks`, `skills`, `mcpServers` paths, the `${PLUGIN_ROOT}` variable in the commands, and `hookSpecificOutput.additionalContext` as the context Codex adds are each unverified.
- The scripts need node 22.18 or later, which strips TypeScript types without a flag.
- The MCP server reads `.ai/GOALS.md` in its working directory, or `TASK_COMPASS_DIR`; where Codex starts it is unverified.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| task-compass | `codex/` bundle 0.1.0; the Claude plugin unchanged at 0.12.3 |

Next: the live checks above, once Codex is installed and a marketplace repository exists.

## Execution log

- 2026-11-08 · Claude Code (Opus 5.5, worker of the S16 coordinator) · bundle, MCP server, hook, skill, install path, tests, docs.
- 2026-11-08 · Claude Code (Opus 5.5, S16 coordinator) · rebased onto master `86d5aa7`; independent review (approve, low findings) acted on: a `story` call that throws now answers `isError` with `story failed: …` instead of crashing the server, and both scripts start through `isMain`, which compares real paths and folds case on Windows, so a symlinked or differently cased start no longer leaves the server silent. Red first: two new tests failed, then 22/22 node tests pass.
