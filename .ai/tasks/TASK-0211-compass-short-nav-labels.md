# TASK-0211 — task-compass 0.9.1: shorter carousel labels

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-02
- Updated: 2026-11-02
- Applies to: `mods/task-compass/` (0.9.0 → 0.9.1)
- Source: the human, 2026-11-02, from a screenshot of the Compass pane: "Change `Earlier` for `PREV` and `Later` for `NEXT`; `SPRINT 15 OF 16` can become `S15/16`"

## Objective

The Sprints carousel's controls read `‹ n PREV`, `n NEXT ›` and `S15/16` (`↺ S15/16` off the current sprint), so the header row is shorter in a narrow pane.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-compass/` 0.9.0 | `‹ n EARLIER`, `n LATER ›`, `Sprint n of m` (`boardTitle`, upper-cased in `view.tsx`) |

## Scope

- In: the three labels, the tests that assert them, README, version.
- Out: a `.ai/` board's title (`S087–S089 open · 88 sprints`), unchanged; hotkeys `h`, `c`, `l`, unchanged.

## Likely files

- `mods/task-compass/hooks/{view.tsx,rails.ts,register.test.tsx,layer.test.tsx}`, `README.md`, `.claude-plugin/plugin.json`; board, todo, state

## Execution plan

1. Change the labels and their tests; red-prove.
2. Gates; docs; one commit on this branch, after TASK-0208's.

## Acceptance criteria

- [x] The carousel shows `‹ n PREV`, `n NEXT ›` and `S2/3` for a GOALS.md board (kit tests).
- [x] The tests fail with the change reverted.

## Mandatory validations

- [x] tests/test-mods.sh --mod task-compass
- [x] tests/validate.sh

## Risks and rollback

- Labels only. Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mods/task-compass/` 0.9.1 | `PREV`, `NEXT`, `S15/16` |

## Execution log

- 2026-11-02 · Claude Code (Opus 5.5) · brief written before the change
- 2026-11-02 · Claude Code (Opus 5.5) · changed; tested in the kit; not landed
  - Evidence: `claude plugin test task-compass` → `54 pass`; with `view.tsx` and `rails.ts` reverted and the new tests kept → `3 fail` (the carousel, the timeline, the project-workflow title), then restored → `54 pass`.
  - Not seen live: the header in the pane; the human checks it with TASK-0208's live run.
- 2026-11-02 · Claude Code (Opus 5.5) · renumbered from `TASK-0209`, a number master had given another task; landed
  - Evidence, live (the human, terminal, the worktree's mods): Compass's header read `h: ‹ 14 PREV` and `S15/16`; no `NEXT` with the last sprint in view.
