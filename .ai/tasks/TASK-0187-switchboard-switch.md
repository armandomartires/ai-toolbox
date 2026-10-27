# TASK-0187 — switchboard 0.3.0: a switch-style toggle, skills listed, app servers protected

## Status

- Status: done
- Owner: agent (Claude Code), with the human checking in the desktop app
- Created: 2026-10-27
- Updated: 2026-10-27
- Applies to: `mods/switchboard/` (0.2.0 → 0.3.0); registry; `CURRENT_STATE.md`
- Source: the human's request of 2026-10-27 ("can the toggle button be a site toggle button?"), and three defects in their `/switchboard list` output

## Objective

Each row's toggle draws as a web-style switch (a track and a knob) where the surface draws SVG, and as a text switch in the terminal. The defects the human's list showed are fixed: no skill was listed on the desktop, connectors showed only an id, and the desktop app's own `ccd_*` servers could be turned off.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/switchboard/` 0.2.0 | 16 tests pass (`TASK-0186`, `828cfab`) |
| Engine API (2.1.308 types) | `Svg` on desktop, vscode and mobile, not terminal; an `Svg` takes no press, its enclosing `Button` does; `$.session.usage({ breakdown: 'summary' })` lists skills and MCP tools with `serverName`, counted locally |
| The human's list | `skills: none seen yet` (the listing hook is bypassed by `cc-plugin-sec-default`); connectors named by uuid; `ccd_turn`, `ccd_session`, … toggleable |

## Scope

- In: the switch drawing per surface; the skill and server inventory from the context breakdown; a tool-name hint under a server named only by an id; `ccd_*` never listed, refused or toggled; tests; docs; 0.3.0.
- Out: renaming the desktop's uuid servers (the mod has no name for them); the hide/refuse mechanisms; publishing.

## Likely files

- `mods/switchboard/hooks/{model.ts,register.tsx,view.tsx,kinds/connectors.ts}`, `hooks/*.test.ts*`, `types/index.d.ts`, `.claude-plugin/plugin.json`, `README.md`, `DEVELOPING.md`
- `docs/registry.md`, `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`, `.ai/GOALS.md`

## Execution plan

1. `isProtected`: a `ccd_` server is never off; the command, the toggle and the listing skip it.
2. Inventory at `session.start` from the summary breakdown: skill names, server names, and up to three tool names per server.
3. The switch: an SVG track and knob inside a plain `Button` where `Svg` exists; a coloured text switch in the terminal.
4. Tests, red-proofs, validate, type-check, docs, commit, push `origin`.

## Acceptance criteria

- [x] Amended: a row's toggle is a `Button` labelled On or Off, filled or outlined, with a text knob (`━━●` / `●━━`); pressing it flips the item. An SVG switch cannot be pressed on any surface (Execution log).
- [x] Skills from the context breakdown are listed with no `skill_listing` attachment seen.
- [x] A server named by an id shows its first tool names under it.
- [x] `ccd_turn` is not listed, cannot be turned off by the command, and its calls are never refused, even when stored off.
- [x] The mod's tests pass and each new one fails with its change reverted; `tests/validate.sh` passes.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod switchboard
- [x] each new test red-proved against its reverted change
- [x] tsc against the 2.1.308 API types

## Risks and rollback

- The text knob's look on the desktop's native button is unchecked: the human looks in the app.
- Rollback: git revert the task commit

## Outputs / handover

- `mods/switchboard/` 0.3.0: the switch button; skills and servers from the context breakdown; tool hints under id-named servers; `ccd_*` protected; 21 tests.
- Deviation: the SVG switch was built and refused by the engine; replaced by the text-knob button.
- Next: the human's look at the pane on the desktop.

## Execution log

- 2026-10-27 · Claude Code (Opus 5.5) · started in worktree `agent/switchboard`
  - Found: `<Button> holds strings and Text, not <Box>` when an `Svg` was put inside one (the kit's `ui.render` refusal); only `Button` has `onPress`; `ClientElements` is the terminal's table less `Client`, `Raster`, `Image`, so no `Svg`. No pressable SVG exists; the switch is a `Button` with a text knob and a variant.
  - Found in the human's `/switchboard list`: no skills (the listing hook is bypassed under `cc-plugin-sec-default`), connectors named by uuid, `ccd_*` toggleable.
  - Evidence: `claude plugin test mods/switchboard` → `21 pass`; `tsc` → exit 0; `claude plugin validate` → passed.
  - Evidence, red-proofs (each on a copy): no breakdown inventory → 2 fail; no `ccd_` protection → 2 fail; no id hints → 2 fail; a plain On/Off label with no knob → 1 fail.
  - Evidence, live headless (Windows `claude.exe` 2.1.310, under `cc-plugin-sec-default`): `/switchboard list` → 220 skill rows (0 before), 0 `ccd_` rows.
