# TASK-0198 — task-compass 0.7.0: a sunburst of the Sessions tree

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-28
- Updated: 2026-10-28
- Applies to: `mods/task-compass/` (0.6.0 → 0.7.0)
- Source: the human's "could we have a polar chart as visualization? maybe a sunburst graph makes more sense" of 2026-10-28; asked: an SVG sunburst above the list, a braille one in the terminal too, one equal share per agent

## Objective

Above the Sessions tree, Compass draws the same tree as a sunburst: this session at the centre, each sub-session a ring arc in its tone spanning its members, each member an equal share of the outer ring, its fill saying its state; as an SVG on the desktop, mobile and VS Code surfaces, and in braille cells in the terminal.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-compass/` 0.6.0 | the Sessions tree from `sessions.ts` (`TASK-0197`) |
| the engine's `Svg` and `Raster` elements | `Svg` on desktop, mobile and VS Code; `Raster` on the terminal only |

## Scope

- In: a pure `sunburst.ts` (arcs from the tree, SVG markup, braille cells); the panel drawing it by surface; tests; docs; 0.7.0.
- Out: pressing an arc (no surface presses an SVG; the list below stays the clickable part); animation; agent-watch's pane.

## Likely files

- `mods/task-compass/hooks/{sunburst.ts,sunburst.test.ts,view.tsx,register.test.tsx}`, `.claude-plugin/plugin.json`, `README.md`, `DEVELOPING.md`

## Execution plan

1. `arcs(tree)`: the centre disc is this session; ring *d* the sessions at depth *d*, each spanning its descendant leaves; members on the ring outside their session; one equal share per leaf, in the tree's order.
2. `sunburstSvg`: annular-sector paths in the tone's hex; running full, pending outlined, ended dimmed; failed red and blocked or partial amber strokes; a `<title>` per arc.
3. `sunburstCells`: 2×4 dots per braille cell, each cell in the tone covering most of its dots, encoded as a `Raster`'s cells.
4. The panel draws `Svg` or `Raster` by surface, above the tree, within the height budget; tests; docs; 0.7.0.

## Acceptance criteria

- [x] On a remote surface the panel holds an `Svg` sunburst whose arcs match the tree; on the terminal a `Raster` of braille cells.
- [x] Shares sum to a full turn; a session's arc spans exactly its members'; arcs keep their places while work runs.
- [x] Colours are the sessions' tones; state shows as fill and stroke.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod task-compass
- [x] the new tests red-proved against 0.6.0's source

## Risks and rollback

- A braille cell takes one colour, so small arcs blur in the terminal; the list below stays exact.
- Rollback: git revert the task commit.

## Outputs / handover

- `mods/task-compass/` 0.7.0: `hooks/sunburst.ts`, pure: `arcs` lays the untrimmed tree out with one equal share per leaf, sessions and members in a stable order (members by ledger id then start, child sessions by start), a `+N more` arc past 160 members that keeps running ones first; `sunburstSvg` draws annular sectors in the sessions' tones, running solid, waiting outlined (still hoverable), ended dimmed, red or amber strokes for failed or blocked, a `<title>` each, labels stripped of XML-illegal characters, a summary SVG past 131072 characters; `sunburstCells` draws braille for the terminal's `Raster`, red or amber for failed or blocked, a sparse pattern for ended, an outline for waiting.
- The view draws the `Svg` (180 px, 9 rows) or the `Raster` (18 × 9) above the tree; at the default 40 rows the tree yields member lines to `+N more` before the chart hides.
- Deviation: review R4 found the SVG chart hidden at 40 rows, braille showing no state, and session arcs moving as sessions ended; all fixed before landing, with tests.
- Not seen live yet: a sample from the real module was rendered offline (SVG, both themes, and braille).

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · built in worktree `compass-orchestrator` by an orchestrated builder, reviewed by a separate reviewer, fixed by a second builder
  - Evidence: `tests/test-mods.sh` → `5 passed, 0 failed` (task-compass 79); `python3 scripts/check-mods.py` → `OK (5 mods)`; `tests/validate.sh` → `validate.sh: OK`.
  - Evidence, red-proof: 0.6.0's `view.tsx` with the new tests → `(fail) the Sessions panel draws the tree as a sunburst: an Svg on the desktop, a Raster of braille on the terminal`, `Expected: defined Received: undefined`, 78 pass 1 fail.
