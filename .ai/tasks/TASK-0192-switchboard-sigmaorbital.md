# TASK-0192 — switchboard 0.4.0 on SIGMAorbital

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-28
- Updated: 2026-10-28
- Applies to: `mods/switchboard/` (0.3.0 → 0.4.0)
- Source: the human's request of 2026-10-27, "harmonize the design of all mods in this project with the SIGMAorbital design system", and the plan approved on 2026-10-28 with four decisions: exact hex per theme; a wireframe panel instead of the sticky note; glyph = identity, colour = state; styled `CommandOutput` rendering for the commands

## Objective

The Switchboard pane and `/switchboard` follow SIGMAorbital. switchboard landed upstream after the plan was written, so it was added to make the harmonization cover every mod.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/switchboard/` 0.3.0 | 21 tests pass |
| `sigma.tsx` | landed by TASK-0188 |

## Scope

- In: sections as `Panel`s with uppercase titles; rows ON as nominal cyan `●`, OFF as offline `text-3` `○`; the next-session note as caution; no `dimColor` or `bold`; `/switchboard list` drawn through `CommandOutput`.
- Out: the switch's press and what off means (ADR-0042, unchanged); the native `Button` switch keeps its `variant`.

## Likely files

- `mods/switchboard/hooks/{sigma.tsx,view.tsx,register.tsx,model.ts,*.test.ts*}`, `.claude-plugin/plugin.json`, `README.md`, `DEVELOPING.md`

## Execution plan

1. Copy `sigma.tsx` (already placed by TASK-0188); sync the theme and watch it.
2. Sections as panels; rows with ON/OFF badges; the note as caution.
3. `/switchboard list` through `CommandOutput`.
4. Tests, red-proofs, docs, 0.4.0.

## Acceptance criteria

- [x] No `dimColor`, `bold` or theme-key hue remains in the pane.
- [x] `/switchboard list` draws as a panel; an unknown row falls back to its text.
- [x] Tests pass, the new ones red-proved.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod switchboard
- [x] each new test red-proved against its reverted change
- [x] tsc against the 2.1.312 API types (1 error, pre-existing in `kinds/skills.ts`: none added)
- [ ] seen live in the desktop app and a terminal `claude`, dark and light theme (pending the human's session: see the execution log)

## Risks and rollback

- Rollback: git revert the task commit.

## Outputs / handover

- `mods/switchboard/` 0.4.0: the pane is one SWITCHBOARD panel (code `N off` or `all on`); section headers uppercase with `· N OFF`; each row a cyan `●` (on) or `text-3` `○` (off) and the name in `text-1` or `text-3`; `ALWAYS ON` for itself; the next-session note in amber with `▲`; the native switch `Button` unchanged. `/switchboard list` keeps its text and `remember`s `listData`, drawn as a panel per kind with ON/OFF badges.
- Deviations: added to the plan, since switchboard landed upstream after it was written.
- Next: the human's look in a live session, dark and light.

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · planned and done in worktree `agent/sigmaorbital`
  - Evidence: `claude plugin test mods/switchboard` → `22 pass 0 fail`; `tsc -p mods/switchboard` → 1 error, the baseline's (`kinds/skills.ts`, excessively deep).
  - Evidence, red-proofs: off rows dimmed → 1 fail; the note in theme-key `warning` → 1 fail; no `CommandOutput` hook → 1 fail; no `syncTheme` → 1 fail.
  - Evidence, across mods: `grep` for `dimColor`, `bold=`, theme-key hues, `STICKY`, `PALETTE` under `mods/*/hooks` (tests and `sigma.tsx` aside) → nothing.
