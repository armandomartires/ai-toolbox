# TASK-0219 — Mod preview 2: real surfaces, presses and sizes, snapshots, shared fixtures

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-03
- Updated: 2026-11-04
- Applies to: `scripts/preview-mods.py`, `scripts/preview/`, `scripts/preview_snapshots.py`, `mods/agent-watch/preview/`, `mods/task-compass/preview/`, their tests
- Source: the human, 2026-11-03: "We need to refine and improve the Mod preview tool", then all four of: closer to the real surfaces, presses and resizing, screenshots and regression, fit the workflow

## Objective

A pane under development is previewed as each surface would draw it, resized and pressed from the page, kept as a snapshot that shows what a change changed, and exported as a picture; its scenes draw the state its tests assert on.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `TASK-0217` | `scripts/preview-mods.py` builds hand-listed scenes into `build/preview/index.html`; the page is one file; the terminal is drawn with the desktop's flexbox; no presses, no resize, no snapshots |
| the test kit | `ui.mount` at any size and surface, `ui.press({ key })`, `ui.drawn()`; one test per `$` |

## Scope

- In: a scene kit (`scripts/preview/scene-kit.ts`, copied into each mod's `preview/`) with a request protocol (sizes, surfaces, presses); the server's `POST /run` drawing one scene as asked and the page's controls for it; the page split into `index.html`, `style.css`, `render.js`, `app.js`, `snapshot.js`; the terminal drawn on a character grid with Ink's rules; the light theme from the mod's tokens; committed snapshots per drawing with `--snapshot` and `--check`, a CHANGED badge and a PNG button; fixtures shared by tests and scenes; the runbook.
- Out: pixel parity with the app; a `/preview` command (the browser pane is the app's, opened from a session by its launch config); the mod-dev skill (`TASK-0218`, another session's, uncommitted in this checkout).

## Likely files

- `scripts/preview-mods.py`, `scripts/preview_snapshots.py`, `scripts/preview/*`, `mods/*/preview/*`, `mods/agent-watch/hooks/{panel,contribution}.test.tsx`, `mods/task-compass/hooks/register.test.tsx`, `docs/operations/runbook.md`

## Execution plan

1. The scene kit and request protocol; the server's `/run`; the page split and its controls (the coordinator).
2. P1: the renderer on a character grid, Ink rules, light theme. P2: fixtures shared by tests and scenes. P3: snapshots, `--check`, PNG. PR: review.
3. Tests, runbook, board.

## Acceptance criteria

- [x] A terminal scene draws on a character grid: the STATE column holds its glyph and word on one line; the braille chart's rows align
- [x] From the served page: another size, the other surface, and a press by clicking a Button redraw the scene through the kit
- [x] `--snapshot` writes one JSON per drawing; `--check` passes twice and fails on a changed size; the page marks a changed drawing and saves a PNG
- [x] Each mod's scenes and tests import one `preview/fixtures.ts`; test counts unchanged
- [x] The runbook's preview section says how

## Mandatory validations

- [x] tests/test-mods.sh --mod agent-watch
- [x] python3 scripts/check-mods.py
- [x] python3 scripts/preview-mods.py --check

## Risks and rollback

- The page approximates each surface; a difference it shows may not be the app's.
- Snapshots carry whole trees: a legitimate change touches many files; `--snapshot` rewrites them.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `scripts/preview/scene-kit.ts` | the scene protocol: sizes, surfaces, presses (with the drawing plugin), `snapshot: false` for live data; copied into each mod's `preview/` |
| `scripts/preview-mods.py` | scratch copies with `request.ts`; `POST /run` validated and JSON-only; atomic output; `--snapshot` (refuses a failed build), `--check` |
| `scripts/preview/{index.html,style.css,render.js,app.js,snapshot.js}` | the page: Ink-rule terminal grid, desktop metrics, light theme from the mod's tokens, size/surface/press controls, PNG, CHANGED |
| `scripts/preview_snapshots.py` | normalised snapshots (press handles stripped), compare, write, check |
| `mods/*/preview/` | `fixtures.ts` shared with the tests, scenes, `snapshots/` (13); task-compass's pinned board and a live-board scene |

Next: a PNG looked at once for fidelity; the kit's fragment quirk (a `<>…</>` drawn as a prop-less column) reported upstream or worked around in `drawn()`.

## Execution log

- 2026-11-03 · Claude Code (Fable 5.1) · P1 renderer, P2 fixtures, P3 snapshots done; PR not ready (a press lost its plugin, snapshots followed the live board, `--snapshot` on a failed build) and fixed by the coordinator with the low items (validation, JSON-only POST, in-flight guard, code-point clamp, `min-height`); agent-watch 137 pass, task-compass 46/9 as at HEAD, `check-mods` OK, `--check` stable twice
- 2026-11-03 · Claude Code (Fable 5.1) · the protocol, server and page split written; a press (`toggle-list`) and a resize (100 columns) drawn through `POST /run`; P1, P2, P3 and PR dispatched in series; P1 started by the coordinator's own Agent call (auto mode gave the spawn no verdict)
- 2026-11-04 · Claude Code (Opus 5.5) · board review: every criterion and validation is met; the PNG fidelity look and the fragment quirk are follow-ups, not criteria; closed
