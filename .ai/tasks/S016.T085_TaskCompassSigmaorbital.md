# TASK-0190 — task-compass 0.4.0 on SIGMAorbital

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-28
- Updated: 2026-10-28
- Applies to: `mods/task-compass/` (0.3.0 → 0.4.0)
- Source: the human's request of 2026-10-27, "harmonize the design of all mods in this project with the SIGMAorbital design system", and the plan approved on 2026-10-28 with four decisions: exact hex per theme; a wireframe panel instead of the sticky note; glyph = identity, colour = state; styled `CommandOutput` rendering for the commands

## Objective

The Compass pane follows SIGMAorbital: statuses on the design's glyphs and colours, the sticky note replaced by a wireframe panel, and `/compass` and `/goals` drawn as panels.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-compass/` 0.3.0 | 33 tests pass |
| `sigma.tsx` | landed by TASK-0188 |

## Scope

- In: `STATUS` remapped (backlog `◌` text-3, todo `○` text-2, in progress `◐` cyan, review `▲` amber, blocked `◆` red, done `●` text-1); `STICKY*` removed; the card a `Panel` with a `Badge`; rails in `line`; the current-sprint and focus marks in `white`; `Meter`; uppercase carousel buttons; agent rows sharing agent-watch's identity glyphs and state colours; `/compass` and `/goals` through `CommandOutput`.
- Out: the `isActive` drift between the two mods (agent-watch counts `idle` as active, task-compass does not): noted, not changed. GOALS.md markers are unchanged (`?` still means review).

## Likely files

- `mods/task-compass/hooks/{sigma.tsx,model.ts,view.tsx,rails.ts,register.tsx,*.test.ts*}`, `.claude-plugin/plugin.json`, `README.md`, `DEVELOPING.md`

## Execution plan

1. Copy `sigma.tsx`; sync the theme at start and watch it.
2. Remap `STATUS`; drop `STICKY*`; rails and marks on tokens.
3. The card as a `panel` with a `badge`; the meter; uppercase carousel.
4. Agent rows on `IDENTITY` and `agentState`.
5. `/compass` and `/goals` through `CommandOutput`; tests, red-proofs, docs, 0.4.0.

## Acceptance criteria

- [x] No pastel hex, `STICKY`, theme-key hue or `dimColor` remains.
- [x] The card is a square-framed panel on terminal and desktop.
- [x] `/compass` and `/goals` draw as panels; an unknown row falls back to its text.
- [x] Tests pass, the new ones red-proved.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod task-compass
- [x] each new test red-proved against its reverted change
- [x] tsc against the 2.1.312 API types (0 errors)
- [ ] seen live in the desktop app and a terminal `claude`, dark and light theme (pending the human's session: see the execution log)

## Risks and rollback

- Rollback: git revert the task commit.

## Outputs / handover

- `mods/task-compass/` 0.4.0: `STATUS` on tokens (backlog `◌` text-3, todo `○` text-2, in progress `◐` cyan, review `▲` amber, blocked `◆` red, done `●` text-1); `STICKY*` removed; rows and cards carry token names, which `view.tsx` turns into hex; the card is a square panel on `surface` with a `line` frame (`frame` from `sigma.tsx` on a desktop), its bold and status lines uppercase; rails in `line`; the current sprint's `◉` in white; `‹ n EARLIER`, `↺ SPRINT n OF m`, `n LATER ›`; legend in text-3 uppercase; a `SUBAGENTS` panel with agent-watch's identity glyphs coloured by `agentState`; `/compass` answers `Compass pane opened: 3 sprints, 8 stories.` and `/goals` keeps its text; both draw as panels.
- `sigma.tsx` (owner and every copy): `meter` draws no empty `Text` for a side with no segments.
- Deviations: the focus mark `▸` stays inside the name, in text-1, not white: a desktop draws a `Button` natively and drops a separate `Text`'s colour inside it. The card fills `surface` on the terminal too, where the plan had none: the design's panels are filled. The `isActive` drift with agent-watch (`idle`) is unchanged, as planned. An agent's identity here is its order of first sight, which matches agent-watch's least-used choice while no row is removed.
- Next: TASK-0191.

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · planned and done in worktree `agent/sigmaorbital`
  - Evidence: `claude plugin test mods/task-compass` → `34 pass 0 fail`; `tsc -p mods/task-compass` → 0 errors; `_template` 9 pass and `agent-watch` 14 pass after the `meter` change.
  - Evidence, red-proofs: review back to `◑` violet → 1 fail; no card fill → 1 fail; current mark not white → 1 fail; no `/goals` output hook → 1 fail; no `syncTheme` → 1 fail.
