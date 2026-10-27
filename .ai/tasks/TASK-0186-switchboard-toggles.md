# TASK-0186 — switchboard 0.2.0: every mod in the pane, with On/Off toggle buttons

## Status

- Status: done
- Owner: agent (Claude Code), with the human checking in the desktop app
- Created: 2026-10-27
- Updated: 2026-10-27
- Applies to: `mods/switchboard/` (0.1.0 → 0.2.0); registry; `CURRENT_STATE.md`
- Source: the human's request of 2026-10-27, after trying `/switchboard on`: "a panel with all mods and toggle buttons to turn them on or off"

## Objective

The Switchboard pane lists every installed mod, each with an On/Off toggle button, and says when a mod's change waits for the next session. `/switchboard` with a kind or name missing opens the pane instead of a usage error.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/switchboard/` 0.1.0 | `tests/test-mods.sh --mod switchboard` → 12 pass (`TASK-0185`, `d3d3548`) |
| Engine API (2.1.308 types) | no switch element; `Button` has `variant: 'primary' \| 'secondary'`; `$.env.get`, `$.fs.read`, `$.fs.list` |
| This session | switchboard hot-loaded after the `CLAUDE_CODE_PLUGIN_DIRS` mods, so their `plugin.register` was never seen |

## Scope

- In: the mod inventory from `CLAUDE_CODE_PLUGIN_DIRS`; toggle buttons; a per-mod "next session" note; Skills and Connectors collapsible, Mods open; the command's fallback to the pane; tests; docs; 0.2.0.
- Out: built-in and managed plugins (they load first and cannot be refused, so no toggle is offered); the hide/refuse mechanisms (unchanged); publishing (human step).

## Likely files

- `mods/switchboard/hooks/{model.ts,register.tsx,view.tsx,inventory.ts,kinds/mods.ts}`, `hooks/*.test.ts*`, `types/index.d.ts`, `.claude-plugin/plugin.json`, `README.md`, `DEVELOPING.md`
- `docs/registry.md`, `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`, `.ai/GOALS.md`

## Execution plan

1. Inventory: read `CLAUDE_CODE_PLUGIN_DIRS` (either separator), take each folder's `plugin.json` name, or its children's for a folder of plugins.
2. Record the mods switchboard refused this session, so a row can say whether its toggle waits for the next session.
3. Pane: a row per item with an On/Off button; Mods open, Skills and Connectors collapsed behind a header button.
4. `parseArgs`: a missing kind or name opens the pane.
5. Tests, red-proofs, validate, type-check, docs, commit, push `origin`.

## Acceptance criteria

- [x] A mod named only in `CLAUDE_CODE_PLUGIN_DIRS` is listed in the pane (test; live headless: `agent-watch`, `task-compass`, `task-orchestrator`).
- [x] Each row's button reads On or Off, and pressing it flips the item; switchboard's own row has no button.
- [x] A mod turned off while loaded, or on while refused, says it applies from the next session.
- [x] `/switchboard on` and `/switchboard on mod` open the pane.
- [x] The mod's tests pass and each new one fails with its change reverted; `tests/validate.sh` passes.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod switchboard
- [x] each new test red-proved against its reverted change
- [x] tsc against the 2.1.308 API types

## Risks and rollback

- A long skill list makes the pane long: Skills starts collapsed.
- Rollback: git revert the task commit

## Outputs / handover

- `mods/switchboard/` 0.2.0: the pane lists every mod with a hooks module from `CLAUDE_CODE_PLUGIN_DIRS` and those loading after it, each row with an On/Off button and, for a mod, its next-session note; Skills and Connectors collapsible; the command opens the pane when a kind or name is missing; 16 tests.
- Deviations: `enabledPlugins` dropped as a mod source (a plugin without hooks is never judged); `plugin.register` now judges tier `user` only.
- Next: the human's look at the pane in a desktop session.

## Execution log

- 2026-10-27 · Claude Code (Opus 5.5) · started in worktree `agent/switchboard`
  - Found: no switch element on any surface; `Button` has `variant`. `plugin.register` fires per hooks module, so skills-only plugins cannot be refused and are not listed.
  - Evidence: `tests/test-mods.sh --mod switchboard` → `PASS switchboard: 16 pass`; `tsc` → exit 0 (after it caught two missing `FsEntry` fields in the test stub); `claude plugin validate` → passed.
  - Evidence, red-proofs (each on a copy): no plugin-dirs inventory, no hooks.json filter, no button variant, no pending note → 1 fail each; sections always open → 1 fail; the old usage errors → 2 fail.
  - Evidence, live headless (WSL `claude` 2.1.312, `--plugin-dir`): `/switchboard list` → `on agent-watch`, `on task-compass`, `on task-orchestrator`.
  - Not run: the pane drawn in a desktop session; this session loads the mod from this worktree and reloads it when the turn ends.
