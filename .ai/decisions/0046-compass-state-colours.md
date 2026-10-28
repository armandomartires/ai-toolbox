# ADR-0046 — Compass colours by state, shows ownership by containment, allocates equally within each parent

**Status**: accepted
**Date**: 2026-10-28
**Task**: `TASK-0199`

## Context

On 2026-10-28, after testing Compass 0.7.0 with three sub-sessions of three agents each, the human asked for token use in the sunburst, tried a preview with token-sized radius and rejected it. They then gave a reference dashboard (an animated SVG sunburst with a KPI row, a selected-element panel and a hierarchy table), to be built in SIGMAorbital. It colours sectors by status, sizes each agent by equal allocation within its parent, draws progress as an arc outside each sector, and leaves tokens and duration to the panel. That conflicts with `ADR-0044` clause 3, under which colour says which session owns a row; the reference shows ownership by containment instead.

## Decision

1. **Colour is state in Compass's Sessions panel**, as `ADR-0043` clause 3 has it for every mod: running `cyan` (pulsing), done `text-1`, failed `red`, blocked or partial `amber`, queued `text-3` outlined, stopped or cancelled `text-3`. Each sits beside its glyph or word. This supersedes `ADR-0044` clause 3 for Compass only; agent-watch's pane keeps colour by session.
2. **Ownership is containment**: in the sunburst a member lies inside its session's angular span; in the table it is indented under it.
3. **Equal allocation within each parent**: a node splits its span equally among its children, recursively. Sector size never follows a live metric, so an arc does not move while work runs. Tokens and duration are shown in the hover title, the selected-element panel and the table, never as size.
4. **Selection is a table row press**, which outlines the arc and fills the panel; a second press clears it. The engine's `Svg` runs no script, so an arc itself cannot be pressed.

## Alternatives considered

- **Size an agent's radius by its tokens.** Rejected by the human after a preview: radius read as importance, and agent-watch's token count is mostly cache, so the largest arcs were the agents that carried the biggest context.
- **A token-proportional sector-width mode.** Not built: the reference has none, and a size that follows a live metric moves arcs while the human tracks them.
- **Keep colour by session and add status as a stroke** (`ADR-0044` as it stands). Rejected: two colour meanings on one pane, and the sunburst already shows ownership by position.
- **Equal share per leaf across the whole turn** (0.7.0). Rejected: a session's span then depends on how many agents it has, not on being one of the parent's children.

## Consequences

- One meaning per colour in Compass: `cyan` always means running.
- Compass and agent-watch now colour the same session tree differently; `sessions.ts`, the shared module, is untouched, and the state tones live in Compass's `sunburst.ts`.
- A member without its own task list counts as one step (0/1 running, 1/1 ended), so a session's roll-up is its agent count until agents keep steps.
- Where a session spends its tokens is readable from the table and panel, not the chart.
