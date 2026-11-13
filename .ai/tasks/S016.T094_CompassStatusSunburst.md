# TASK-0199 — task-compass 0.8.0: the Sessions panel as a status sunburst

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-28
- Updated: 2026-10-28
- Applies to: `mods/task-compass/` (0.7.0 → 0.8.0)
- Source: the human's "relate token usage with the radius of the agent element" of 2026-10-28, then their rejection of that preview and their reference `agent-session-sunburst-csv.html`, "use SIGMAorbital design system"; the approved plan and chat preview

## Objective

Compass's Sessions panel becomes the reference dashboard in SIGMAorbital: a KPI row; a sunburst coloured by state with equal allocation within each parent, progress arcs outside each sector and the session at the centre; a selected-element panel; a hierarchy table whose row press selects (`ADR-0046`).

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-compass/` 0.7.0 | `sunburst.ts` with equal share per leaf, tones by session (`TASK-0198`) |
| `ADR-0043`, `ADR-0044`, `ADR-0046` | state colours; colour by session; this task's supersession for Compass |
| the engine's `Svg` | no script under `isInteractive`: hover and `<title>` only |

## Scope

- In: `sunburst.ts` (equal-parent allocation, roll-up, state tones, progress arcs, centre, labels, selection outline; braille the same); `view.tsx` (KPI row, legend, selected panel, hierarchy table, `selected` atom); `types/index.d.ts`; tests; docs; 0.8.0.
- In, added by the human during the build: a title bar on the Sprints/Stories board; short codes in the graph (`T1`, `A01`, `S01`) with full names kept in the table, panel and hover; the chart at about 80% of the pane's width, raised after review to 85% and never shrunk for height on the desktop; the Sessions and Sprints panels as SIGMAorbital bracketed frames with the legends inside, and the KPIs as a Readout row, from the shared kit (`sigma.tsx`: `bracketed` panel, `stat`, `stats`; `ADR-0043` amended); collapse/expand toggles, moved on the human's review to under THIS SESSION's row and under each sprint's progress bar; the sprint rail centred on its circles.
- Out: token-sized geometry; pressing an arc; `sessions.ts` and `sigma.tsx` (shared, gated copies); agent-watch's pane.

## Likely files

- `mods/task-compass/hooks/{sunburst.ts,sunburst.test.ts,view.tsx,register.test.tsx}`, `types/index.d.ts`, `.claude-plugin/plugin.json`, `README.md`, `DEVELOPING.md`

## Execution plan

1. `sunburst.ts`: `stateTone`; `arcs` with recursive equal-parent allocation and stable order, `+N` cap kept; roll-up of steps, tokens and duration (a member without steps is 0/1 or 1/1); `sunburstSvg` with the centre, state fills, outer progress arcs, labels when they fit, a pulsing glyph for failed or blocked, a selected outline, titles; `sunburstCells` the same in braille.
2. `view.tsx`: KPI row, legend, selected-element panel with OPEN TRANSCRIPT, the hierarchy table in state tones whose row press sets or clears `selected`; the height budget.
3. Separate review of the whole diff; fixes.
4. Docs, 0.8.0, registry, state; gates; red-proof; live run.

## Acceptance criteria

- [x] Three sub-sessions take a third of the turn each whatever their agent counts; an agent takes its parent's span over its siblings; no arc moves on a status or token change.
- [x] Fills and table rows are in the state tones of `ADR-0046`; ownership shows by containment and indentation.
- [x] Each sector has a progress arc of done/total; the centre shows the session's state, steps and duration.
- [x] A row press selects (outline on the arc, panel filled) and a second press clears; the panel shows path, state, progress, duration, tokens, children and OPEN TRANSCRIPT for an agent.
- [x] The KPI row shows progress %, agents, tokens and failed.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod task-compass
- [x] the new tests red-proved against 0.7.0's source

## Risks and rollback

- More rows in a fixed pane height: the KPI row and the panel fold before the chart, the chart before the table heads.
- Rollback: git revert the task commit.

## Outputs / handover

- `mods/task-compass/` 0.8.0: `hooks/sunburst.ts`: equal allocation within each parent, a roll-up per arc (steps, tokens, duration), `stateTone`/`stateGlyph`/`stateWord`, short codes (`T1`, `A01`, `S01`), the SVG scaled by `size / 300` with 7 px floors, a pulse only while running, a progress arc outside each sector, a selected outline; braille the same. `hooks/view.tsx`: a KPI row, the chart at about 80% of the pane's width, a legend, a SELECTED panel or a one-line strip with OPEN TRANSCRIPT, the hierarchy table whose row press selects, `sessionsLayout` with a normal and a tight fit, the `selected`, `listCollapsed` and `foldedSprints` atoms; the Sprints board in a `panel()` with a fold under each sprint's progress bar and the rail through the circles' centre. `types/index.d.ts`: the new atoms. `ADR-0046`; `ADR-0045` points to it.
- Deviations: the human rejected token-sized radius and gave a reference dashboard; during the build they added the board title bar, short codes, the 80% width, collapse and expand, and then moved the toggles under THIS SESSION and under each progress bar. Three reviews found a transcript unreachable on short panes, a pulse on failures, ~4 px text, a chart stuck at 600 px and an unbudgeted strip; all fixed with tests.
- Not verified: pixel rendering of the rail centring and the chart's size on a real desktop; at the default 40 rows the chart fits only in its tight tier.

Next: watch the pane through a real multi-agent run and tune `CELL_PX`/`ROW_PX` if the chart misses 80%.

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · coordinator; builders B1, B2b, B3–B7 (Sonnet), reviewers R1–R3 (Sonnet)
  - Evidence: `tests/test-mods.sh --mod task-compass` → `PASS task-compass:  128 pass`; `python3 scripts/check-mods.py` → `OK (5 mods)`; `tests/validate.sh` → `validate.sh: OK`.
  - Evidence, red-proof: each new test failed with its hunk reverted (B1: 16 tests against 0.7.0's `sunburst.ts`; B2b: 5 against 0.7.0's `view.tsx`; B3–B7 per hunk); the stroke-floor test failed with `2 * k` (`test-mods.sh: 0 passed, 1 failed`).
  - The human checked the pane live and approved it.
- 2026-10-28 · Claude Code (Opus 5.5) · follow-up after the live look; builders B8, B9 (Sonnet), coordinator fixes
  - Changed: the chart drawn at 85% of the pane in explicit pixels (an interactive `Svg`'s frame kept a 150 px default height); the kit's `bracketed` panel, `stat` and `stats` (`sigma.tsx`, five copies; `ADR-0043` amended); the Sessions and Sprints panels bracketed with their legends inside; the KPIs a Readout row with TOK under its value.
  - Evidence: `tests/test-mods.sh` → `5 passed, 0 failed` (task-compass 130); `python3 scripts/check-mods.py` → `OK (5 mods)`; `tests/validate.sh` → `validate.sh: OK`.
  - Evidence, red-proof: dropping the Svg's width/height, sharing 0.8, hiding the desktop chart for height, the old KPI card, an unbracketed panel, the legend outside its frame and TOK beside its value each fail their test.
  - Not verified: the terminal's corner glyphs; only the desktop corners were seen live.

- 2026-10-28 · Claude Code (Opus 5.5) · plan approved after two chat previews; brief and `ADR-0046` written before the code
