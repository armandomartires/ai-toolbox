# 0052 — Each mod draws the resize handle for its own panel, from one shared surface module

**Status**: proposed (clause 1, the drawing, superseded by ADR-0053 clause 2)
**Date**: 2026-11-03
**Sprint / task**: `Post-S10`, `TASK-0221`

## Context

On 2026-11-03 the human asked for a handle on the bottom edge of each panel in Compass's pane, dragged up and down to resize it. Compass draws the Sprints panel; agent-watch contributes the Sessions panel below it (`ADR-0048`). In this build's mod API only a `Client` can be dragged: its surface module's `surface.onPointer` gets `down`, `move` and `up`, and holds the pointer from `down` to `up`. A `Client`'s posts (`surface.post`) reach only the plugin that drew it, and a plugin draws only its own surface modules. `Client` is in the terminal's and the desktop's element tables, not mobile's or vscode's.

A spike (`TASK-0221`, 2026-11-03) dragged a one-row `Client` live on both surfaces. It found that the two measure a drag differently: a terminal reports rows from the region where it is now, moved with the panel it sizes; the desktop reports them from where the region was at the press. It also found that the desktop does not call the module again between pointer events unless a `ui.message` hook answers `{ props }`.

## Decision

1. **Each mod draws the handle for its own panel and keeps that panel's height in its own `$.state`.** Compass draws `sprints-handle` under the Sprints panel and stores `sprintsRows`; agent-watch draws `sessions-handle` under the Sessions panel in Compass's pane and stores `sessionsRows`. Neither reads the other's state, and nothing is added to the slot `ADR-0048` defines.
2. **One surface module, one owner.** `mods/_template/hooks/handle.tsx` draws the grip, turns a drag, a double press and the keys into posts (`{ kind: 'move' | 'nudge', rows }`, `{ kind: 'reset' }`), and exports `heldRows`, which a mod's `ui.message` hook uses to read a post. Each mod that sizes a panel carries a byte-identical copy, gated by `scripts/check-mods.py` rule 7 as `sigma.tsx` is.
3. **A held height is a row budget the panel already has.** Compass's is the board's `room` and its columns' height; agent-watch's is `sessionsLayout`'s `rows` and its panel body's minimum height. A panel dragged small folds exactly as it does on a short pane. Each mod clamps to its own floor: 6 rows for the board's columns, 12 for the Sessions panel.
4. **Per session and per surface, never in `$.store`.** The value is keyed by `terminal` or `desktop`, since a desktop row is not a terminal cell. A new session starts automatic. A double press, or `r` once the handle has the focus, goes back to automatic.
5. **No handle where there is no `Client`.** Mobile and vscode draw no handle, ignore a held height and keep the automatic layout.
6. **A `ui.message` hook answers `{ props }` with the held rows,** so the handle's next move starts from the height now drawn and does not wait on a redraw.

## Alternatives considered

- **Compass draws both handles and passes agent-watch a height.** Rejected: a post reaches only the plugin that drew the `Client`, so Compass would own the Sessions panel's height and agent-watch would have to read Compass's state, a dependency `ADR-0048` avoided.
- **Persist the heights in `$.store`.** Deferred: a height that suits one window is wrong in another, and a session that starts automatic loses nothing. A person who wants it kept can ask, and the value moves to `$.store` under the same per-surface key.
- **`+`/`−` Buttons instead of a drag.** Rejected as the main control: the human asked for a drag. The keys `↑` and `↓` give the same step once the handle has the focus.

## Consequences

- A third shared hooks module joins `sigma.tsx` in rule 7; changing the handle means changing the owner, then copying it.
- The terminal's and the desktop's measuring rules are written into `handle.tsx`. If a later build changes either, the handle drifts from the pointer, and the test that pins the two rules (`a terminal measures a drag from where the handle now is, a desktop from where it was at the press`) still passes, since the kit takes the rows it is given.
- The preview page (`scripts/preview/render.js`) draws a `Client` as a grip, since a scene's tree does not carry a surface module's drawing.
