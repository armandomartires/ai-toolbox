# TASK-0256 — Toggles draw SIGMAorbital's square switch on a desktop

## Status

- Status: in review
- Owner: agent (Claude Code)
- Created: 2026-11-08
- Updated: 2026-11-08
- Applies to: `mods/_template/` (the shared `sigma.tsx`), its copies in `agent-watch`, `task-compass`, `switchboard`, `task-orchestrator`; `mods/switchboard/`
- Source: the person's desktop screenshot of 2026-11-08 (switchboard 0.8.0): "All items should have toggle buttons as per SIGMAorbital toggle switch elements".

## Objective

On a desktop every Switchboard row read as plain words, `AGENT-WATCH ON`, with no switch; only switchboard's own row, which has no Button, showed the glyph track `[ ■]`. `kit().toggle` held the track and words in a native Button with a `label`, and a desktop draws that label as its own text over whatever the Button holds. Every toggle must draw the design's Toggle: a square track with its knob, the name, the state word.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| SIGMAorbital, the person's Design System artifact, `project/components/Toggle/README.md` and `bundle.css` `.so-toggle*` | the spec: a 28 by 14 track, a 1px line on `void`, an 8px knob 2px inside it, `text-1` on, `line-strong` off |
| `mods/_template/claude/hooks/sigma.tsx` `kit().toggle`, `kit().pressable` | the toggle and the overlay pattern of `TASK-0241` and `TASK-0252` |
| `mods/switchboard/claude/hooks/view.tsx` | the only caller of `toggle` |

## Scope

- In: `toggleSvg` and `TOGGLE_PX` in `sigma.tsx`; on a desktop the track is an `Svg` (alt: the name and state), the words are Texts in their tokens, and `pressable` lays a blank Button over the row; a disabled toggle has no Button. The terminal keeps its glyph track in a plain Button. The copies; switchboard's tests; the Versions section moved under MODS, since at the bottom it sat under every skill and was missed in the same screenshot; the version step of every mod carrying `sigma.tsx`.
- Out: the 80ms knob animation (the engine draws no transition); the `disabled` colour token, which `sigma.tsx` does not carry (a disabled toggle stays `text-3`, as before).

## Likely files

- `mods/_template/claude/hooks/sigma.tsx`, `sigma.test.tsx`, and the four copies
- `mods/switchboard/claude/hooks/view.tsx`, `register.test.tsx`, `README.md`
- the four `claude/.claude-plugin/plugin.json`, the pane `VERSION` lines, `CHANGELOG.md`

## Execution plan

1. Read the spec from the Design System artifact.
2. Red tests in the template: the track's geometry, and the desktop and terminal drawings.
3. Change the owner, copy it, update switchboard's test, run every mod's kit tests.
4. Preview; the person checks the desktop live.

## Acceptance criteria

- [x] On a desktop each toggle is an `Svg` track of 28 by 14 with the knob at 3px off and 17px on, the name and state as Texts, and a blank Button with no words over them; a disabled one has no Button
- [x] The terminal draws as before: the glyph track in a plain Button whose label is the name and state
- [x] The Versions section sits under the MODS section
- [x] Red first: the template's new tests did not load against the old `sigma.tsx`
- [ ] Live: on the desktop, in Night ops and Daylight, every Switchboard row shows the square switch, lit with the knob right when on, dim with it left when off, and a press flips it

## Mandatory validations

- [x] `cd mods && claude plugin test <mod>/claude`: `_template` 18, switchboard 40, agent-watch 174, task-compass 72, task-orchestrator 101, all pass
- [x] `python scripts/check-mods.py`: `OK (5 mods)`
- [x] `python scripts/preview-mods.py switchboard`: the square tracks drawn on the desktop scene
- [ ] `tests/validate.sh`: run by the pre-commit hook at the commit

## Risks and rollback

- The kit draws no native button, so only the desktop shows that the blank overlay paints nothing and that a press lands through it (the pattern is `TASK-0241`'s, seen working live for Compass's rows).
- The blank is sized as three figure spaces for the track plus the words; a very long name is clipped by the overlay, not cut by the desktop.
- The preview's light-theme switch recolours token colours in props, not inside Svg markup, so it shows the Night ops track; a real Daylight session draws the track with the light tokens.
- Rollback: git revert the task commit.

## Outputs / handover

- Next: the live check above.

## Execution log

- 2026-11-08 · Claude Code (Opus 5.5) · spec read from the Design System artifact; red tests, `toggleSvg`, the desktop branch of `toggle` on `pressable`, copies, switchboard test and section order, preview in both themes, version step (agent-watch 0.13.3, task-compass 0.12.4, switchboard 0.8.1, task-orchestrator 0.5.11).
