# TASK-0206 — agent-watch 0.5.0: it draws the Sessions panel itself

## Status

- Status: review
- Owner: agent (Claude Code)
- Created: 2026-10-31
- Updated: 2026-10-31
- Applies to: `mods/agent-watch/` (0.4.3 → 0.5.0)
- Source: the human, 2026-10-31: "just work on the agent-watch section", then Compass "only after it is completed and validated"

## Objective

agent-watch's own pane draws the Sessions panel the human sees in Compass today (KPI row, status sunburst, selected panel, hierarchy table), in state colours, so agent-watch needs nothing from Compass. Stage 1 of two; stage 2, a later task, makes Compass show agent-watch's panel instead of its own copy.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `a273657` on `agent/agent-watch-redesign` | `TASK-0205`, both stages in one commit, on no remote; its Compass half made the Sprints board vanish in the live app, cause unknown; read-only source here |
| `mods/agent-watch/` on `c3957e6` | a list coloured by session, no chart; `sessions.ts` byte-equal to Compass's (gate rule 7) |

## Scope

- In: agent-watch's part of `a273657`: `panel.tsx`, `sunburst.ts`, `view.tsx`, `model.ts`, `types`, tests, README, DEVELOPING, version; `ADR-0047`, with the notes it puts on `ADR-0044` and `ADR-0046`.
- Out: everything in `mods/task-compass/`; the `ui.render` hook on Compass's pane (`contributeSessions`) and its tests; the `sessions.ts` comment edit; gate rules 7 and 8; the band, status line and toasts.

## Likely files

- `mods/agent-watch/hooks/{panel.tsx,sunburst.ts,view.tsx,model.ts}` and their tests, `types/index.d.ts`, `README.md`, `DEVELOPING.md`, `.claude-plugin/plugin.json`
- `.ai/decisions/{0044,0046,0047}`, state, board, todo, `docs/registry.md`

## Execution plan

1. Take agent-watch's part of `a273657`; drop the Compass half.
2. ADR-0047 and the notes; version, docs, records.
3. Gates and a red-proof; an independent review.
4. The human runs the Agents pane in the desktop app.

## Acceptance criteria

- [x] agent-watch's pane draws the KPI row, sunburst, selected panel and table, by state colour (`panel.test.tsx`).
- [x] Nothing under `mods/task-compass/` or `scripts/check-mods.py` changes.
- [ ] Live: the Agents pane shows the panel in the desktop app (the human; the `Unexercised:` backlog is at its cap of 3, so the task stays in review until then).

## Mandatory validations

- [x] tests/test-mods.sh
- [x] tests/validate.sh
- [x] the panel tests red-proved against `c3957e6`'s `view.tsx`

## Risks and rollback

- Proven only in the mod test kit; the real pane's drawing, scrolling and presses are unverified.
- The panel's logic exists twice (agent-watch and Compass) until stage 2.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mods/agent-watch/` 0.5.0 | its Agents pane is the Sessions panel (`panel.tsx`, `sunburst.ts`), in state colours; no hook on Compass's pane |
| `ADR-0047` | accepted: agent-watch draws the panel itself; Compass untouched until stage 2; notes on `ADR-0044`, `ADR-0046` |
| `mods/task-compass/`, `scripts/check-mods.py` | unchanged; rules 7 and 8 still pass |

Next: the human looks at the Agents pane in the desktop app; then stage 2, Compass showing agent-watch's panel, as its own task and ADR.

## Execution log

- 2026-10-31 · Claude Code (Sonnet 5.5) · brief written before the port; agent-watch's files taken from `a273657`, the Compass hook left out
- 2026-10-31 · Claude Code (Sonnet 5.5), one sonnet reviewer · built; review answered
  - Evidence: `tests/test-mods.sh` → agent-watch `90 pass` (`a273657`'s 103 less its 13 Compass-slot tests), task-compass `130 pass`; `python3 scripts/check-mods.py` → `OK (5 mods)`; `tests/validate.sh` → `validate.sh: OK`.
  - Evidence, red-proof: `c3957e6`'s `view.tsx` in place of the new one → the panel tests fail (`the pane is the Sessions panel…`, `rows are coloured by state…`, `the tree is a sunburst…`, and more); the new one restored → `90 pass, 0 fail`.
  - Review R1: no code defect; three false doc lines (DEVELOPING.md:8 and :14, the plugin.json description and the registry line it generates) and a wrong clause number in the README, all fixed; `sessions.ts` equals Compass's copy (`cmp`).
  - Left as is: `reservedRows` stays a parameter of the panel's layout, passed 0 by the pane, for stage 2; a press on a row hidden behind a chart's `+N more` selects nothing, as in Compass.
  - Not run: the panel in the desktop app.
