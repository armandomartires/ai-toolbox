# TASK-0241 — agent-watch and task-compass read cleanly in Daylight, as SIGMAorbital specifies

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-07
- Updated: 2026-11-07
- Applies to: `mods/_template/`, `mods/agent-watch/`, `mods/task-compass/`
- Source: the person's desktop screenshots of 2026-11-07, after `TASK-0240` pinned both panes to Daylight.

## Objective

With Daylight pinned, the Compass Sprints rows draw near-white names on the light panel, and the Agents sunburst puts dark labels on dark fills. Every text and mark must follow the SIGMAorbital Design System artifact (tokens v3, its README and component READMEs): text tokens at 4.5:1 or more on `bg`, `surface` and `raised`, text on a fill in `on-ink`, sunburst slices on `surface` gaps with depth stepped by brightness.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/_template/claude/hooks/sigma.tsx` | Daylight hex equal to tokens v3 for every token it names |
| `mods/task-compass/claude/hooks/view.tsx`, `rails.ts` | Sprints rows named by token |
| `mods/agent-watch/claude/hooks/sunburst.ts`, `panel.tsx` | sunburst drawn from `TOKENS[theme]` |

## Scope

- In: the cause of the near-white rows; the sunburst's label and fill colours; any other text below 4.5:1 in Daylight in either pane; tests that pin each.
- Out: following the desktop appearance automatically (`B-072`); fonts, radius and the grid, which the host cannot draw (`ADR-0043`).

## Likely files

- `mods/task-compass/claude/hooks/view.tsx`, `rails.ts`, `register.test.tsx`
- `mods/agent-watch/claude/hooks/sunburst.ts`, `panel.tsx`, `sunburst.test.ts`
- `mods/_template/claude/hooks/sigma.tsx` and its copies, if the cause is shared

## Execution plan

1. Debugger: reproduce in the kit on the desktop surface with Daylight pinned, find the cause, fix, test.
2. Reviewer: an independent read against the spec.
3. Gate and previews in both themes.
4. Live: the person checks both panes in Daylight.

## Acceptance criteria

- [x] Every Sprints row name in Daylight is drawn in a Daylight text token (desktop: words outside a blank native Button, `kit().pressable`)
- [x] Sunburst labels on a fill use `on-ink`; slices sit on `surface` gaps; depth steps down by brightness
- [x] No text in either pane below 4.5:1 on its ground in Daylight (a test computes it)
- [x] Night ops unchanged (colours unchanged; the desktop overlay applies in both themes, so the live check covers Night ops too)
- [x] Independent review passed (R2: no confirmed defect; findings fixed or recorded); `tests/validate.sh` passes
- [x] Live check on the desktop, in Daylight and Night ops: rows readable, and a click on a row name, PREV and HIDE still acts

## Mandatory validations

- [x] `mod-dev.sh check`: OK (5 mods); tests agent-watch 173, task-compass 71, switchboard 29, task-orchestrator 100 pass
- [x] `tests/validate.sh`: OK

## Risks and rollback

- A desktop-only effect the kit cannot draw would leave the cause unproven; the live check settles it.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| agent-watch 0.13.1, task-compass 0.12.1 | in the tree, live-checked, uncommitted |

## Execution log

- 2026-11-07 · Claude Code (coordinator) · opened from the person's screenshots; spec read from the SIGMAorbital artifact (tokens v3 Daylight values match `sigma.tsx`); debugger dispatched.
- 2026-11-07 · debugger D1 (Opus 5.5, high) · cause: a desktop draws a `Button` natively and paints its label in the desktop's colour, dropping the `Text` colours inside it (engine types, authoring guide 405-407; a kit dump showed the Texts already in Daylight hex). Fix: `kit().pressable` and `controlToken` in `sigma.tsx`; view.tsx and panel.tsx route through them; a Daylight sunburst path; Daylight contrast tests. Stopped at its turn limit once, resumed to report.
- 2026-11-07 · reviewer R2 (Sonnet 5.5, high) · request changes, no confirmed defect. Medium: the overlay is not gated to Daylight, so the Night ops desktop rides the same unproven mechanism; medium: `register.test.tsx:144` might be red (settled: the suite passes, 71). Low: label width estimate, focus ring clipped, CHANGELOG order (fixed), stale README version (fixed), no template test for `pressable`, the band and switchboard Buttons keep the defect (out of scope). Coordinator kept the overlay ungated: a pinned theme can differ from the desktop's appearance either way, and the live check in both themes is the blocker.
  - Evidence: `tests/validate.sh` → `validate.sh: OK`
- 2026-11-07 · the person · live check on the desktop: colours readable, but every pressable's words drawn twice, offset (ghosting), in both panes.
- 2026-11-07 · coordinator · cause: a desktop draws a native Button's `label` prop as visible text over the overlaid words; the overlay Button no longer takes `label` on the desktop (`key` addresses it). Three tests that found the Button by its label fail; D1 resumed to adapt them and pin "no label on the overlay".
- 2026-11-07 · debugger D1 · the overlay lookups find the Button by the words Text before it; both Daylight tests guard that every desktop Button holds blanks only (the engine fills `label` from the blank child, so the guard takes absent or blank).
  - Evidence: `mod-dev.sh check` → `OK (5 mods)`; tests agent-watch 173, task-compass 71, switchboard 29, task-orchestrator 100 pass
- 2026-11-07 · the person · live check on the desktop after the label fix: both themes work, labels drawn once, clicks act.
  - Evidence: `tests/validate.sh` → `validate.sh: OK`
