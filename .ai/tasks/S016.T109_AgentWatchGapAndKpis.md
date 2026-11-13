# TASK-0216 — agent-watch 0.8.1: a gap under the board, the KPI row kept on the desktop

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-03
- Updated: 2026-11-04
- Applies to: `mods/agent-watch/` (0.8.0 → 0.8.1)
- Source: the human, 2026-11-03: "sometimes the margin between panes becomes 0, so they connect" and "We lost the KPIs section on the top of the SESSIONS graph"; "Yes, fix both"

## Objective

In Compass's pane the Sessions frame never touches the Sprints frame, and on the desktop the Sessions panel always shows its KPI row and selected panel.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/agent-watch/` 0.8.0 | `view.tsx` `contributeSessions` draws board, meter, panel with no margin; `panel.tsx` `sessionsLayout` folds the KPI row and selected panel for height on every surface |

## Findings (2026-11-03)

- **The gap was the meter's.** `contributeSessions` drew the board, the meter, then the Sessions frame with no margin; the meter row was the only separation, and it is absent while there is no task list and nothing runs.
- **The KPI row folded for height on the desktop.** `sessionsLayout` gets the whole pane's `bodyRows`, though Compass's board took some, and a desktop's chart is 85% of the pane wide and never shrinks for height, so on a wide pane the chart took the rows and the KPI row and the SELECTED panel, which fold first, went.

## Scope

- In: one blank row above agent-watch's part of Compass's pane, whichever mod drew first; a desktop never folds the KPI row or the selected panel for height (its pane scrolls, as for the chart). On the desktop, `AGENT-WATCH 0.8.1` under the Sessions table, so the person sees which copy draws. Tests, README, 0.8.1.
- Out: the terminal's layout (it still folds to fit); resizing panels (proposed separately).

## Likely files

- `mods/agent-watch/hooks/{view.tsx,panel.tsx}`, their tests, `README.md`, `.claude-plugin/plugin.json`

## Execution plan

1. A margin above the contribution; a desktop never folds the KPI row or the selected panel; a version line under the table.
2. Tests, red-proved against 0.8.0; `tests/test-mods.sh --mod agent-watch`; `check-mods.py`; 0.8.1.
3. The human looks at Compass's pane live.

## Acceptance criteria

- [x] A blank row above the meter and the Sessions panel in Compass's pane, with or without a meter, either load order, both surfaces
- [x] The desktop draws the KPI row and the SELECTED panel at 24, 40 and 60 rows and 100 to 160 columns
- [x] The desktop prints `AGENT-WATCH <version>` under the table; a terminal does not
- [x] Seen live in the desktop app's Compass pane (since seen in TASK-0221 and TASK-0223; first blocked: the desktop app drew the library's task-compass 0.8.0, which hides agent-watch's panel; seen in the preview, `TASK-0217`)

## Mandatory validations

- [x] tests/test-mods.sh --mod agent-watch
- [x] python3 scripts/check-mods.py
- [x] the new tests red-proved against 0.8.0's `view.tsx` and `panel.tsx`

## Risks and rollback

- A short desktop pane scrolls further, since nothing folds for height there.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mods/agent-watch/` | 0.8.0 → 0.8.1: one blank row above its part of Compass's pane; the desktop keeps the KPI row and selected panel; `AGENT-WATCH <version>` under the table |

Next: remove the library's duplicate task-compass 0.8.0, restart the app, look at Compass's pane.

## Execution log

- 2026-11-03 · Claude Code (Opus 5.5) · both causes read from the code; fixed; 136 pass; 6 tests fail at 0.8.0's two files (4 gap cases, the layout invariant, the desktop KPI test)
- 2026-11-03 · Claude Code (Opus 5.5) · the human saw no change live; the version line added to tell which copy draws, and it was absent: the desktop app drew the organization library's task-compass 0.8.0 (its own Sessions panel), not agent-watch's; task-compass 0.9.1 republished to the library; 137 pass
- 2026-11-04 · Claude Code (Opus 5.5) · board review: the Sessions panel in Compass's pane was seen live on the desktop in TASK-0221 ("Looks right") and TASK-0223; closed
