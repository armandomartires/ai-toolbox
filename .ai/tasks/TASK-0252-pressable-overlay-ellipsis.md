# TASK-0252 — Pressable overlays no longer paint the desktop's `…` over their words

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-07
- Updated: 2026-11-08
- Applies to: `mods/_template/`, `mods/agent-watch/`, `mods/task-compass/`, `mods/switchboard/`, `mods/task-orchestrator/` (the shared `sigma.tsx` copy)
- Source: the person's desktop screenshot of 2026-11-07, Compass's pane (task-compass 0.12.1) and the Agents pane (agent-watch 0.13.1).

## Objective

A stray `…` is painted over the words of pressable elements on the desktop: `B-057 Unexercised: secrets.p…` and `TASK-0201 — task-orchestrat…` with the mark over their last letters, `HIDE` and `SHOW 17` with a dot through the word. The mark is the desktop's own truncation of a native Button label wider than its Button, the blank Button `kit().pressable` lays over the words (`TASK-0241`). No pressable may give the desktop a label it has to cut.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/_template/claude/hooks/sigma.tsx` `kit().pressable` | the overlay Button's blank never cut by a desktop; four byte-identical copies |
| `mods/task-compass/claude/hooks/view.tsx` | every `pressable` label the words as drawn |
| `mods/agent-watch/claude/hooks/panel.tsx`, `band.tsx` | the same audit |

## Scope

- In: the two causes (a blank longer than the drawn words; a blank as long as the words that still outruns them); the `pressable` call sites; kit tests that walk `ui.drawn()` on the desktop surface; the version step of every mod carrying `sigma.tsx`.
- Out: the band's and switchboard's own plain Buttons, which hold their words and no blank overlay (`TASK-0241` review, low); `mods/task-compass/claude/hooks/register.tsx`, edited by another session.

## Likely files

- `mods/_template/claude/hooks/sigma.tsx`, `sigma.test.tsx`, and the copies in `agent-watch`, `task-compass`, `switchboard`, `task-orchestrator`
- `mods/task-compass/claude/hooks/view.tsx`, `register.test.tsx`
- `mods/agent-watch/claude/hooks/panel.test.tsx`
- the four `claude/.claude-plugin/plugin.json`, both pane `VERSION` lines, both READMEs, `CHANGELOG.md`

## Execution plan

1. Debugger: prove both causes from the code and the kit's drawn tree, red tests first, fix in the template, copy, fix the call sites, test, gate.
2. Reviewer: an independent read of the overlay change against the engine types.
3. Live: the person checks both panes on the desktop, in both themes.

## Acceptance criteria

- [x] Cause (a): Compass gave a Sprints row's overlay the whole name (`view.tsx`, `label: row.text`) while it draws the name cut by `fit`; now the label is the drawn words (`nameText`)
- [x] Cause (b): the overlay Button could be shrunk to the words' box, narrower than its figure-space blank plus padding; now it is held in a `Box` with `flexShrink` 0, so it keeps its blank's width and the overlay's clip hides what passes the words
- [x] No `pressable` call site passes a label longer than its drawn words (task-compass `view.tsx` 181, 272, 347, 354, 357; agent-watch `panel.tsx` 260, 302, 401; `band.tsx` has no `pressable`)
- [x] Template `sigma.tsx` and its four copies byte-identical
- [x] Kit tests: every desktop overlay's blank no longer than its words and its holder not shrinking, for a truncated Sprints row, HIDE and SHOW in both panes, and for `pressable` alone in the template; each fails on the code before the change
- [x] Live check on the desktop, in Daylight and Night ops: no `…` over a row name, `‹ PREV`, `NEXT ›`, `↺`, HIDE, SHOW or `OPEN TRANSCRIPT`, and a press on each still acts

## Mandatory validations

- [x] `python scripts/check-mods.py`: `OK (5 mods)`
- [x] `claude plugin test`: _template 16, task-compass 72, agent-watch 174, switchboard 29, task-orchestrator 101 pass, 0 fail
- [x] `tests/validate.sh`: run by the pre-commit gate on the close commit, 2026-11-08

## Risks and rollback

- The kit draws no native button ("The kit exercises the mod's hooks and modules, never a surface's paint", engine types), so that a non-shrinking Box keeps the desktop's Button at its blank's width is inferred from the layout props, not seen; a desktop that caps a Button's width by its own style would still cut it. The live check settles it.
- The Button may now be wider than the words; the clip keeps the press to the words' box, as before. That a press still lands through the overlay is unchanged and was seen live under `TASK-0241`.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| agent-watch 0.13.2, task-compass 0.12.2, switchboard 0.7.1, task-orchestrator 0.5.10 | in the tree, kit-tested, uncommitted, not yet seen live |

## Execution log

- 2026-11-07 · Claude Code (coordinator) · opened from the person's screenshot; debugger dispatched with the mechanism and both suspected causes.
- 2026-11-07 · debugger D1 (Opus 5.5, high) · cause (a): `view.tsx` passed `label: row.text` to `pressable` while the Text drew `fit(row.text, …)`; the kit's drawn tree showed Button `st1.1` with a blank of 78 figure spaces over the 41 characters `▸B-057 Unexercised: secrets.py redaction…`. Cause (b): agent-watch's labels already equal their words (`▾ HIDE`, 6 over 6) yet the screenshot shows the mark, so the blank plus the native button's padding outruns the words' proportional glyphs, and the Button, a shrinkable child of the clipped overlay, is cut to the box. Fix: the label is the drawn words; the overlay Button sits in a `Box flexShrink={0}`, chosen over a shorter blank (no column count is safe against proportional glyphs and unknown padding, and a short blank shrinks the press area) and over ordinary spaces (a desktop may collapse them; U+2007 is kept). The kit cannot draw the native rendering.
  - Evidence: on the code before the change, task-compass `st1.1: blank of 78 over "▸B-057 Unexercised: secrets.py redaction…"`, agent-watch `transcript: the Button's holder does not shrink`, _template `Expected: 0`; after, every suite passes and `check-mods.py` → `OK (5 mods)`.
- 2026-11-08 · the person · live check on the desktop after a reload: "Looks good now", no `…` over the pressables; closed
