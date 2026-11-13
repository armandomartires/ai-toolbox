# TASK-0189 — agent-watch 0.3.0 on SIGMAorbital

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-28
- Updated: 2026-10-28
- Applies to: `mods/agent-watch/` (0.2.0 → 0.3.0)
- Source: the human's request of 2026-10-27, "harmonize the design of all mods in this project with the SIGMAorbital design system", and the plan approved on 2026-10-28 with four decisions: exact hex per theme; a wireframe panel instead of the sticky note; glyph = identity, colour = state; styled `CommandOutput` rendering for the commands

## Objective

The Agents pane, the band, the status line, the toast and `/agent-watch` follow SIGMAorbital: an agent's glyph says which agent it is, its colour says its state.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/agent-watch/` 0.2.0 | 14 tests pass |
| `sigma.tsx` | landed by TASK-0188 |

## Scope

- In: monochrome identity glyph pairs replacing the eight-hue `PALETTE`; state colours (running cyan with the pulse, done `text-1`, failed red `◆ FAILED`, stopped `text-3` `○ STOPPED`); `RUNNING`/`COMPLETED` labels in a `SUBAGENTS` panel; the band's `Meter` and `3/5 STEPS`; uppercase status-line and toast text; `/agent-watch` drawn through `CommandOutput`.
- Out: what the mod tracks and when (unchanged).

## Likely files

- `mods/agent-watch/hooks/{sigma.tsx,model.ts,view.tsx,band.tsx,register.tsx,*.test.ts*}`, `types/index.d.ts`, `.claude-plugin/plugin.json`, `README.md`, `DEVELOPING.md`

## Execution plan

1. Copy `sigma.tsx`; sync the theme at start and watch it.
2. Replace `PALETTE` with `IDENTITY`; colour from `agentState`.
3. Pane in a `SUBAGENTS` panel with `RUNNING`/`COMPLETED` labels; band on `meter`.
4. Status line, toast and `/agent-watch` text; its `CommandOutput` hook.
5. Tests, red-proofs, docs, 0.3.0.

## Acceptance criteria

- [x] No theme-key hue, `dimColor` or `bold` remains; colours come from `sigma.tsx`.
- [x] Identity glyphs are one cell wide and avoid the status glyphs.
- [x] `/agent-watch` draws as a panel; an unknown row falls back to its text.
- [x] Tests pass, the new ones red-proved.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod agent-watch
- [x] each new test red-proved against its reverted change
- [x] tsc against the 2.1.312 API types (7 errors, all pre-existing: none added)
- [ ] seen live in the desktop app and a terminal `claude`, dark and light theme (pending the human's session: see the execution log)

## Risks and rollback

- Rollback: git revert the task commit.

## Outputs / handover

- `mods/agent-watch/` 0.3.0: `PALETTE` and `colorOf` gone; `iconOf` draws `IDENTITY` glyphs, coloured by `agentState`; ended rows carry `◆ FAILED` / `○ STOPPED` badges instead of `✓ ✗ ⏹`; pane in a `SUBAGENTS` panel with `RUNNING`/`COMPLETED` labels; band on `meter` (cyan, `text-1` when done) with `3/5 STEPS`; `1 CALL · 1.2k TOK`; status line `2 AGENTS RUNNING`; toast `EXPLORE · Find hooks · FAILED 00:01:12`; `/agent-watch` answers `Agents pane opened: 1 running, 0 completed, 0 failed or stopped.` and draws it as a panel.
- Deviations: the old `bar` was removed for `sigma.tsx`'s `meter`; `elapsed` now prints hours as `1h04m`. Seven identity glyphs, not eight.
- Next: TASK-0190.

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · planned and done in worktree `agent/sigmaorbital`
  - Evidence: `claude plugin test mods/agent-watch` → `14 pass 0 fail`; `tsc -p mods/agent-watch` → 7 errors, the same 7 as before the change (test props and one `update` overload against 2.1.312 types).
  - Evidence, red-proofs: a theme-key hue for the glyph → 1 fail; a green done meter → 1 fail; no `CommandOutput` hook → 1 fail; no `syncTheme` → 1 fail (light expected, dark drawn); the old toast text → 2 fail.
  - Found: `claude plugin validate` refuses `$` passed across an import into an arrow function, so `renderOutput` is a declaration.
