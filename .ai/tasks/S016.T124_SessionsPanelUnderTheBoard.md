# TASK-0231 — task-compass: the Sessions panel shows under the board in either load order

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-05
- Updated: 2026-11-07
- Applies to: `mods/task-compass/`
- Source: the human, 2026-11-04: "Why is it that the Agents `Sessions` panel isn't showing in the Compass tab?"

## Objective

agent-watch's meter and Sessions panel (ADR-0048) sit directly under the Compass board, whichever mod loads first.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-compass/hooks/view.tsx:373` | the board's box carries `minHeight={e.props.scroll.bodyRows}` |
| `mods/agent-watch/hooks/view.tsx` `contributeSessions` | puts its contribution after Compass's element when it is the outer hook |

## Scope

- In: drop the pane-tall `minHeight`; tests in both hook orders; version 0.11.1.
- Out: agent-watch; the shared panel and handle; `hooks/layer.test.tsx`'s earlier uncommitted Windows path fix (a separate change).

## Likely files

- `mods/task-compass/hooks/view.tsx`, `hooks/slot.test.tsx`, `hooks/register.test.tsx`, `.claude-plugin/plugin.json`, `README.md`

## Execution plan

1. Root cause by debugging task D1: with agent-watch outer (load order `agent-watch;…;task-compass`), the contribution starts at about row `bodyRows + 1`, under the visible pane.
2. Replace the `minHeight` with `flexGrow={1}` (T5); review R3.

## Acceptance criteria

- [x] No ancestor of the contribution has a `minHeight` of the pane's rows, in either order, on either surface (`slot.test.tsx`, 4 cases)
- [x] `plugin.json` and `VERSION` read 0.11.1
- [x] Seen live: the Sessions panel under the board on the desktop (the person, 2026-11-07: Sprints, then the meter line, then SESSIONS with its KPI row and sunburst, no empty space between)

## Mandatory validations

- [x] `tests/test-mods.sh --mod task-compass`: 68 pass
- [x] `scripts/check-mods.py`: OK (5 mods)

## Risks and rollback

- A pane taller than the board may show empty space below it; only a live look tells.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| task-compass | 0.11.1 |

Done 2026-11-07.

## Execution log

- 2026-11-05 · Claude Code (Opus 5.5, orchestrated) · D1 traced the missing panel to the board's `minHeight`; T5 replaced it with `flexGrow={1}`; R3 found the slot test missed the sibling case; T6 extended it and proved it red on the old code
  - Evidence: with `minHeight` restored, 4 slot tests fail; with the fix, `PASS task-compass:  68 pass`
  - Evidence: `python scripts/check-mods.py` → `OK (5 mods)`
- 2026-11-07 · the person · live check on the desktop after `/reload-plugins --force`: the Sessions panel sits directly under the Compass board (COMPASS 0.12.1, agent-watch 0.13.1); closed
