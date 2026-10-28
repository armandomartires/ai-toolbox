# ADR-0044 — agent-watch draws sessions: one glyph per kind, colour by owning session

**Status**: accepted
**Date**: 2026-10-28
**Task**: `TASK-0193`

## Context

The human asked that the Agents pane map sub-sessions and their subagents: every session with the same icon in a colour of its own, every subagent with one icon in its owner session's colour, and a progress bar per session. They added that it must tie in with `task-orchestrator`. This reverses `ADR-0043` clause 3, where an agent's glyph is its identity and its colour its state, and it makes one mod read another's `$.state`.

## Decision

1. **A session** is this one; the `task-orchestrator` run while its ledger holds a task; a Workflow run (`agent.spawn`'s `workflow.runId`); or a subagent that keeps its own task list or spawned subagents. An orchestrator worker never becomes one: workers do not delegate (`ADR-0041`).
2. **Two glyphs**: sessions draw `IDENTITY[1]` (`⬢`/`⬡`), subagents `IDENTITY[0]` (`■`/`□`), both from `sigma.tsx`.
3. **Colour says which session owns a row**, for agent-watch only; `ADR-0043` clause 3 stands for every other mod. The tones are SIGMAorbital tokens: `cyan` (this session), `violet`, `green`, `text-1`, `text-2`. `amber` and `red` are left out because they mean caution and critical. A sub-session takes the least-used tone when it first becomes one, and keeps it.
4. **State is the pulse and a badge**: running pulses solid/hollow, waiting is hollow, ended is solid; `FAILED`, `STOPPED`, and the ledger's `BLOCKED`, `PARTIAL`, `CANCELLED` are badges in their status colours.
5. **Reading another mod's state**: the reader declares the part of the owner's contract it reads as a mirror in its own `types/index.d.ts`, aliases prefixed and fields copied verbatim. The gate (`check-mods.py` rule 8) fails when the mirror and the owner disagree, and fails a reader that has no mirror.

## Alternatives considered

- **Keep colour for state and mark ownership by indentation alone.** Rejected: the human asked for colour by session, and a tree deeper than two levels does not read by indentation.
- **New identity hues in `sigma.tsx`.** Rejected by the human: tokens only, no change to the shared module.
- **task-orchestrator writes a summary for agent-watch.** Rejected: a second owner of the ledger's facts, and a behaviour change in a mod that has none to make.
- **Read the ledger through the orchestrator's `status` tool.** Rejected: text, not data, and not reactive; a `$.state` read redraws the pane when the ledger changes.

## Consequences

- SIGMAorbital's "colour for state only" has one exception, scoped to this pane and its band; `cyan` there means "this session", not "running".
- A change to task-orchestrator's `Task`, `Role`, `TaskStatus`, `Settings`, `Policy` or its state keys fails the gate until agent-watch's mirror agrees.
- Desktop sessions started with `start_session` are not drawn: no engine call lists sessions.
- A Workflow agent's end is known only from its own `turn.complete`; one that never arrives leaves its row running.
