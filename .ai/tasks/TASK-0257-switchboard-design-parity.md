# TASK-0257 — The Switchboard pane follows the design of Compass and Agents

## Status

- Status: in review
- Owner: agent (Claude Code)
- Created: 2026-11-08
- Updated: 2026-11-08
- Applies to: `mods/switchboard/`; `mods/_template/` (the shared `sigma.tsx` `kit().toggle`) and its copies in `agent-watch`, `task-compass`, `switchboard`, `task-orchestrator`
- Source: the person on 2026-11-08, looking at switchboard 0.8.1 on the desktop beside Compass and Agents: "Still not following the same design system as compass and agent-watch".

## Objective

Switchboard's pane must read as one family with Compass (`mods/task-compass`) and Agents (`mods/agent-watch`): the same SIGMAorbital region frame, the same opening readout, the same pressable headers in the design's colours, the same brightness hierarchy, and the same label, value and legend treatment (`ADR-0043`, the rules in the header of `sigma.tsx`).

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-compass/claude/hooks/view.tsx` | bracketed Sprints panel, fold toggles through `kit().pressable` with `controlToken()` words, legend with the version at its right |
| `mods/agent-watch/claude/hooks/panel.tsx` | bracketed Sessions panel opening on `kit().stats`, `label`/`value` fields, rows text-2 |
| `mods/_template/claude/hooks/sigma.tsx` | the rules, `kit()` |
| `mods/switchboard/claude/hooks/view.tsx` at 0.8.2 (`3d32c4d`) | the pane, with the row budget of `TASK-0256` |

## Scope

The deltas found, and how each was resolved:

- (a) Plain panel: the pane is now `kit().panel` with `bracketed: true` (surface fill, square `line` border, text-1 corner brackets; `┌┐└┘` on the terminal). The group rule is sized to the frame's inner width.
- (b) No KPI row: `kit().stats` opens the panel, MODS, SKILLS, CONNECTORS (each its count, captioned with when a switch takes effect) and OFF (captioned `of N`); no value is coloured, none is out of limits.
- (c) Headers were raw `<Button plain>` holding Texts, which a desktop draws as a native button in its own colour (`TASK-0241`): every section and topic header is `kit().pressable`, its fold glyph (`▾`/`▸`) in `controlToken()` (line-strong in Night ops, text-3 in Daylight), the title a Text, the counts beside it in text-3 tabular.
- (d) Hierarchy: section titles text-1 semibold, topic titles an uppercase text-3 caption, and row names text-2 at the body weight (text-3 when off or disabled), as Compass's and Agents' rows are. The row name is drawn by the shared `kit().toggle`, so its label token changed in the owner (`sigma.tsx`) and was copied to the four mods; `toggle`'s only caller is switchboard.
- (e) Versions and footer: the Versions header is the others' (glyph, title, counts) and folds like a topic (`closedGroups` key `versions`); each version is a `label` and a `value` (`VERSION 1.0.0`, `LOADED 0.12.1  MANIFEST 0.13.1`), the `▲` in amber beside the name rather than an amber name. The footer is a legend (`○ OFF`, `▲ CAUTION`, glyph in its token, word in text-3) with `SWITCHBOARD <version>` at its right, as Compass closes its board.
- Found on the way: with one header per topic the tree was unbounded in topics; at 0.8.2, 400 skills under 400 plugins drew 506,092 characters. Topic headers are now paid from `ROW_BUDGET` (`headCost`), and topics past it are named in one caption.
- Kept: the square desktop toggle of `TASK-0256` (`kit().toggle`), the row budget, the resize handle (`ADR-0053`).
- Out: `/switchboard list`'s output panels (unchanged), the terminal's lack of the legend's version in Compass (switchboard keeps its version line on every surface).

## Likely files

- `mods/switchboard/claude/hooks/view.tsx`, `register.test.tsx`, `types/index.d.ts`, `preview/pane.scene.tsx`, `README.md`, `DEVELOPING.md`, `claude/.claude-plugin/plugin.json`
- `mods/_template/claude/hooks/sigma.tsx`, `sigma.test.tsx`, and the four copies
- the version lines of agent-watch, task-compass, task-orchestrator

## Execution plan

1. Compare the three panes and the rules; list the deltas.
2. Red tests: switchboard (frame and KPI row, pressable headers in both themes, SKILLS and a topic opening on a press, hierarchy, Versions, legend, many topics within the bound) and the template's toggle name.
3. Change the owner's toggle, copy it; rewrite the pane; preview scene with SKILLS and a topic open.
4. Version step; the person checks the desktop live.

## Acceptance criteria

- [x] The pane is one bracketed panel opening on a KPI row (MODS, SKILLS, CONNECTORS, OFF)
- [x] Every section and topic header is a `kit().pressable` with its glyph in `controlToken()`; on a desktop its Button is blank and a press on SKILLS and on a topic opens them (`register.test.tsx`)
- [x] Section titles text-1 semibold, topic titles text-3 caption, row names text-2 (text-3 off), no `bold` without `weight`
- [x] Versions as label and value with the caution glyph beside the name; the footer a legend with the version line
- [x] The tree stays within 100,000 characters with 128, 728 skills and 400 topics, and with Versions open over 80 checkout mods beside 728 skills
- [x] Red first: 11 switchboard tests and 1 template test failed against 0.8.2
- [ ] Live: on the desktop in Night ops and Daylight, the Switchboard pane reads as one family with Compass and Agents, and SKILLS, CONNECTORS and topic groups open on a press

## Mandatory validations

- [x] `cd mods && claude plugin test <mod>/claude`: switchboard 47 (46 at `8d92c44`), `_template` 18, agent-watch 174, task-compass 72, task-orchestrator 101, all pass
- [x] `python scripts/check-mods.py`: `OK (5 mods)`
- [x] `python scripts/preview-mods.py switchboard`: 6 drawings, the new scene `Switchboard pane, SKILLS open` with LEGAL open and SALES folded
- [x] `tests/validate.sh`: run by the pre-commit hook, `validate.sh: OK` at `8d92c44`

## Risks and rollback

- The kit draws no native button, so only the desktop shows that a header's blank overlay paints nothing and that a press lands through it (the pattern is `TASK-0241`'s, seen working live for Compass's rows). A topic title is caption size, so its figure-space blank is wider than its words; the overlay's clip holds it to them.
- `headCost` and `versionCost` are estimates from the kit's serialization, as `rowCost` is; the desktop's own count is not observable here.
- Left as they are (low findings of the review of `8d92c44`): the KPI row's values may truncate at narrow widths (four blocks in what is left of a 20-column frame), and the terminal's `headCost` ignores the width of the topic's rule, whose glyphs grow with the pane.
- Changing `kit().toggle`'s label token touches every mod's copy of `sigma.tsx`; no other mod calls `toggle`, so only switchboard draws differently. agent-watch 0.13.4, task-compass 0.12.5 and task-orchestrator 0.5.12 are patch steps for the copy.
- Rollback: git revert the task commit.

## Outputs / handover

- Next: the live check above.

## Execution log

- 2026-11-08 · Claude Code (Opus 5.5) · built on `3d32c4d` (switchboard 0.8.2); compared the three panes against the `sigma.tsx` rules and `ADR-0043`; red tests; `kit().toggle` name token in the owner and the four copies; the pane rewritten (bracketed panel, KPI row, pressable headers, hierarchy, Versions and legend, topic headers on the budget); preview scene; version step (switchboard 0.9.0, agent-watch 0.13.4, task-compass 0.12.5, task-orchestrator 0.5.12).
- 2026-11-08 · Claude Code (Opus 5.5) · review of `8d92c44`, medium finding: the Versions header and rows were not paid from `ROW_BUDGET`; red test (80 checkout mods, Versions open, 728 long-named skills open: 154,274 characters on a desktop), then `versionCost`, the section built in drawing order after MODS, and a `+ N more not drawn` caption; switchboard 47 tests pass.
