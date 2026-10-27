# ADR-0041 — Delegation is routed and fenced by a mod; external providers stay a design

**Status**: accepted
**Date**: 2026-10-27
**Task**: `TASK-0183`

## Context

The human asked for a Claude Code mod that makes the session a lead coordinator: substantive work goes to real subagents whose model and effort follow a routing table, under limits on concurrency, nesting, retries, escalation and concurrent writers, with honest reporting of what was requested against what ran. The brief also asked for an adapter design for OpenAI and Grok workers, disabled by default.

The installed API (2.1.310) sets a subagent's effort on a registered agent profile, not per spawn; a worker's effective model and effort are visible only on its own model requests (`turn.step`). The repository caps unexercised capability at three open rows, and the cap is reached (`ADR-0039`).

## Decision

1. **Routing and limits are code in `mods/task-orchestrator/`**, not instructions: the ledger refuses a fourth concurrent worker, a worker's spawn, a second non-isolated writer, a write outside a task's allowed files, a gated effort or model without opt-in, and a retry or escalation past its count. Instructions carry only what code cannot: the coordinator's procedure and the worker's report shape (`ARCHITECTURE.md`).
2. **Model and effort are requested on the profile and observed on the loop.** A task line says `requested`, then `resolved` (the spawn's answer) and `observed` (the first `turn.step`), or `unverified`. The mod never claims an effort it did not see.
3. **Host overrides are disclosed, never changed.** The session's model, `modelSettings`, and the model and effort variables are read and listed; the coordinator's own settings are reported with a recommendation, not switched.
4. **External providers are an interface with no implementation.** `providers.ts` declares the adapter contract and lists OpenAI and Grok as not implemented and disabled; enabling one is refused with the disclosure. A live adapter is not added until a task can exercise it, which the cap forbids today. The Claude-only mod needs no external credential.
5. **Workers are subagents.** The engine spawns isolated subagent loops, not sessions a person converses with; the docs say so.

## Alternatives considered

- **A skill of instructions.** Nothing would enforce the limits; the brief asked for code where the runtime permits it.
- **Per-dispatch `effort` on the spawn.** `$.agent.spawn` has no such field; re-registering the role's profile with the dispatch's settings is the supported route, and observation covers the gap.
- **A stub HTTP adapter for OpenAI.** It would be a fourth unexercised capability.

## Consequences

- `tests/test-mods.sh --mod task-orchestrator` runs its unit tests against the engine stub; the live smoke of one worker is recorded in `TASK-0183`.
- A worker's `Bash` writes are not path-checked; the one-writer rule bounds them. A later task may add a worktree-per-writer default.
- Routing changes need no code: an override file or `/orchestrate policy`.
