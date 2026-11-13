# 0047 — agent-watch draws the Sessions panel itself, in state colours

**Status**: accepted
**Date**: 2026-10-31
**Sprint / task**: `Post-S10`, `TASK-0206`

## Context

On 2026-10-29 the human asked that agent-watch's pane be exactly Compass's Sessions panel, that agent-watch stay independent, and that Compass follow agent-watch with no change of its own; they then said agent-watch is being redesigned, so its earlier rules are not enforced. `TASK-0205` did both halves in one commit (`a273657`, on no remote); in the live desktop app on 2026-10-31 Compass's Sprints board vanished. The human then asked for two stages: agent-watch alone first, validated, and only then Compass.

## Decision

1. **agent-watch draws the Sessions panel itself**: the KPI row, sunburst, selected panel and hierarchy table, their layout, trimming and state colours, in `panel.tsx` and `sunburst.ts`, as the whole of its Agents pane. Its `selected` and `listCollapsed` atoms hold a press.
2. **Colour is state in that panel**, as `ADR-0046` clause 1 has it: colour by session and the pulsing per-session icon are retired from the pane. The band above the prompt keeps them.
3. **Compass is untouched.** It keeps its own panel, its `sessions.ts` copy and its mirror of agent-watch's state, so gate rules 7 and 8 stand. Compass showing agent-watch's panel instead is stage 2: a separate task and decision, taken once the human has seen this panel live.

## Alternatives considered

- **Both halves in one change** (`TASK-0205`). Rejected by the human after the board vanished: a failure could not be put down to one mod.
- **Keep the pane coloured by session.** Rejected: the human asked that it look exactly like Compass's panel, and one colour meaning per pane is the point of `ADR-0046`.

## Consequences

- The panel's logic exists twice until stage 2: in agent-watch, and in Compass's `view.tsx` and `sunburst.ts`. A fix to one is not made to the other by the gate; `sessions.ts` alone is held equal.
- agent-watch's state contract gains two atoms; Compass's mirror names only the fields it reads, so rule 8 still passes.
- Whether a press in the panel redraws as the mod test kit says is unverified until the human runs it in the desktop app.

- `ADR-0048` (2026-11-02) supersedes clause 3: Compass now slots the panel (stage 2).
