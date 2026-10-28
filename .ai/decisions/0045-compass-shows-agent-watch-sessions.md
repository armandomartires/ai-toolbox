# ADR-0045 — Compass draws agent-watch's sessions, from a mirror of its state and one shared tree module

**Status**: accepted
**Date**: 2026-10-28
**Task**: `TASK-0197`

## Context

The human asked that Compass's subagents panel have the same hierarchy as agent-watch's: this session, the orchestrator's run, Workflow runs and delegating subagents, each with its members, tone, meter and caption. `ADR-0044` built that tree in agent-watch, and each mod is self-contained, so Compass can neither import it nor read another mod's source.

## Decision

1. **Compass's panel is Sessions** and draws the tree agent-watch tracks: its `view.tsx` reads agent-watch's `agents`, `now`, `frame`, `tasks`, `runs` and `tones`, and task-orchestrator's ledger, and never writes them.
2. **The state is a mirror** (`ADR-0044` clause 5): a `// MIRROR of mods/agent-watch/types/index.d.ts` block in Compass's `types/index.d.ts`, aliases prefixed `Watch`, fields copied verbatim, held equal to the owner's by `scripts/check-mods.py` rule 8.
3. **The tree logic is one module**, `hooks/sessions.ts`, owned by `mods/agent-watch/hooks/sessions.ts` and carried byte for byte by Compass. It imports only `./sigma` and declares the row shapes it reads, so each mod's own types satisfy it. Rule 7 becomes a table of shared modules, `sigma.tsx` owned by `_template` and `sessions.ts` by agent-watch, and fails a drifted copy. agent-watch's tone assignment and tracking stay in its `model.ts`.
4. **The tree needs agent-watch.** While agent-watch is not loaded, which Compass reads from agent-watch's `now` clock still being 0 (agent-watch writes it on its first refresh), the panel draws the flat list of `TASK-0196`, titled Sessions as well.
5. **The panel keeps its height budget**: session heads and ledger tasks are never cut; other members fill what a fixed line budget leaves, and a session that lost some says `+N more`.

## Alternatives considered

- **Port agent-watch's tracking into Compass.** Rejected: about 600 lines of tracking, ledger and tone logic duplicated in two mods, which drift.
- **Import agent-watch's module across mods.** Not possible: a mod is self-contained and portable, and the engine loads each plugin's files alone.
- **Share only the types, not the tree.** Rejected: the tree is the part that must not differ between the two panels.

## Consequences

- A change to `sessions.ts` is made in agent-watch, then copied; the gate fails until Compass's copy agrees.
- A change to agent-watch's state contract fails the gate until Compass's mirror agrees.
- Without agent-watch loaded (its clock is 0), Compass shows what it tracks itself, as a flat list and without tones or sub-sessions.
- Compass's own agent tracking stays: it powers the fallback and the tick.
