# TASK-0258 — The mod preview's sidebar hides and shows from a button

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-08
- Updated: 2026-11-08
- Applies to: `scripts/preview/` (the mod preview page)
- Source: the person's request of 2026-11-08, with a sidebar-icon image: "in the mod preview, can we add a button to toggle the left side panel or drawer?"

## Objective

The preview's scene list takes 260px on the left at all times, which crowds a pane drawn at its real width. A button hides and shows it.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `scripts/preview/index.html`, `style.css`, `app.js` | the page: a fixed `nav` and the `main` scenes |

## Scope

- In: a fixed sidebar-icon button at the top left; Ctrl+B (or Cmd+B) as its shortcut; the choice kept in `localStorage`, read and written in `try`, so it outlives the reload the served page makes after each rebuild; `aria-expanded` and a Hide/Show tooltip.
- Out: the scenes' own drawing, `render.js`, `preview-mods.py`.

## Likely files

- `scripts/preview/index.html`, `scripts/preview/style.css`, `scripts/preview/app.js`

## Execution plan

1. Add the button and its icon to the page, its style for both page themes, and the toggle in `app.js`.
2. Check it in the browser pane against the served preview.

## Acceptance criteria

- [x] The button hides the sidebar and the scenes take the width; it shows it again
- [x] Ctrl+B does the same
- [x] A closed sidebar stays closed across a reload
- [x] No console errors

## Mandatory validations

- [x] Served with `python scripts/preview-mods.py --serve 8765`, checked in the desktop app's browser pane: a click hid it (`nav` display `none`, `aria-expanded` false), a reload kept it hidden, Ctrl+B showed it; no console errors
- [x] `tests/validate.sh`: run by the pre-commit hook at the commit

## Risks and rollback

- The page has no test of its own; the check above is by hand.
- Rollback: git revert the task commit.

## Outputs / handover

- Delivered: the button, its style in both page themes and the toggle with its shortcut, in `scripts/preview/`.
- Seen working in the browser pane against the served preview; a local preview picks it up on its next restart.
- Nothing left open.

## Execution log

- 2026-11-08 · Claude Code (Opus 5.5) · button, style, toggle and shortcut; checked in the browser pane; the person approved the commit.
