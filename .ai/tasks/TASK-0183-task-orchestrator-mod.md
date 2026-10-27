# TASK-0183 — task-orchestrator: a mod that routes delegated work by model and effort

## Status

- Status: done
- Owner: agent (Claude Code), with the human answering the hot-load question and checking the live smoke
- Created: 2026-10-27
- Updated: 2026-10-27
- Applies to: `mods/task-orchestrator/` (new, 0.1.0); registry; `CURRENT_STATE.md`; `ADR-0041`
- Source: the human's brief of 2026-10-27 ("Create a working Claude Code mod named task-orchestrator"); plan approved 2026-10-27

## Objective

A mod that makes the current session a lead coordinator: it registers worker profiles with an explicit model and effort per task class, dispatches bounded assignments to real isolated subagents through `$.agent.spawn`, enforces concurrency, nesting, retry, escalation and writer-overlap limits in code, observes the effective model and effort through `turn.step`, and reports requested versus observed settings without inventing either.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| Claude Code | 2.1.310 on this host; mods supported |
| Engine API (laid types, `mods/agent-watch/.claude-plugin/types/claude-code/index.d.ts`) | `$.agent.register` takes `model`, `effort`, `tools`, `disallowedTools`, `maxTurns`, `isolation`; `$.agent.spawn` takes `model` but no `effort`; `agent.spawn` hooks see `parentAgentId` and may deny; `turn.step` carries a subagent's effective `model` and `effort`; `$.settings.read`, `$.env.get`, `$.store`, `$.session.append` |
| Host overrides | `~/.claude/settings.json`: `model: fable`, `modelSettings` effortLevel `high` for opus-5, opus-5-5, sonnet-5-5; `CLAUDE_EFFORT` set in this session; no `CLAUDE_CODE_SUBAGENT_MODEL` |
| `mods/_template/`, `mods/agent-watch/`, `mods/task-compass/` | the shape, the engine stub test style, the tool-serving pattern |
| `.ai/planning/BACKLOG.md` | three `Unexercised:` rows open: the cap (`ADR-0039`), so this task adds no capability it cannot exercise |
| Another session | holds `TASK-0182` (agent-watch 0.2.0) in this checkout; this task touches nothing under `mods/agent-watch/` |

## Scope

- In: the mod (routing table and policies, router, ledger, delegation contract, override disclosure, provider adapter interface with no enabled provider, hooks, `/orchestrate`, four tools, tests), README, ARCHITECTURE.md, DEVELOPING.md, `ADR-0041`, the registry row, `CURRENT_STATE.md`, a live haiku/low smoke in this session.
- Out: a live external-provider adapter (OpenAI, Grok): designed as an interface only, because it would be unexercisable capability at the cap; publishing to the organization library (human); editing `~/.claude/settings.json` (human); interactive sub-sessions (the engine spawns subagents, not sessions); any change to `mods/agent-watch/`.

## Likely files

- `mods/task-orchestrator/.claude-plugin/plugin.json`, `hooks/hooks.json`, `hooks/routing.ts`, `hooks/router.ts`, `hooks/ledger.ts`, `hooks/contract.ts`, `hooks/overrides.ts`, `hooks/providers.ts`, `hooks/register.tsx`, `hooks/*.test.ts*`, `types/index.d.ts`, `tsconfig.json`, `README.md`, `ARCHITECTURE.md`, `DEVELOPING.md`, `LICENSE`
- `.ai/decisions/0041-delegation-routing-mod.md`, `docs/registry.md` (generated), `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`
- Untracked: `~/.claude/dev-mods/<this session>/task-orchestrator` → `mods/task-orchestrator` (link)

## Execution plan

1. Pure modules with tests: `routing` (the 11 classes, three policies, limits), `router` (route, validate effort, fallback, escalate, opt-in gating), `ledger` (dependencies, concurrency, writer overlap, retries, escalations, completion rules), `contract` (worker prompt, report parser), `overrides` (settings and env disclosure), `providers` (interface, disabled registry).
2. `register.tsx`: `session.start` registers `/orchestrate`, the tools `dispatch`, `collect`, `status`, `cancel`, and the worker profiles; `agent.spawn` denies nesting and applies limits; `tool.call` fences workers (no Agent/Workflow/SendMessage, writes only inside allowed files, no Bash for read-only roles); `turn.step` records observed model and effort; `turn.complete` closes tasks and starts queued ones. `types/index.d.ts` declares the state.
3. `tests/test-mods.sh --mod task-orchestrator`; each new test red-proved against its reverted change.
4. Link the mod into this session's mods folder; the human answers *Turn them on*. Live smoke: `/orchestrate on`, one `scout` dispatch (haiku, low) on a read-only lookup, `status` to compare requested and observed settings. Record what was observed and what stays unverified.
5. README, ARCHITECTURE.md, DEVELOPING.md, `ADR-0041`, registry, `CURRENT_STATE.md`, TODO line; `tests/validate.sh`; review the diff; commit; push `origin`; confirm both remotes.

## Acceptance criteria

- [x] `claude plugin validate` and `claude plugin test` pass for the mod; tests cover: extraction → haiku/low, scoped implementation → sonnet/medium, architecture → opus/high, missing model → visible fallback, overrides disclosed, invalid effort never emitted, concurrency and escalation limits, overlapping writers refused, nested spawn denied, failed review blocks completion, `/orchestrate off` stops new dispatches without touching the ledger.
- [x] In a live session (headless, `--plugin-dir`) a `scout` dispatch runs as a real subagent on haiku; `status` shows the runtime agent id, the requested model/effort and the observed ones (or "unverified" with the reason).
- [x] Gate green; registry has the row; README has the install, activation, usage and removal sections; ARCHITECTURE.md separates enforced from advisory behaviour.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod task-orchestrator
- [x] each new test red-proved against its reverted change

## Risks and rollback

- The host's `modelSettings.effortLevel: high` may raise a routed sonnet or opus worker's effort; the mod discloses it and does not override it.
- A subagent spawned by a plugin may step past that plugin's hook frame: if `turn.step` is not seen for mod-spawned workers, observed settings stay "unverified" and the README says so.
- Rollback: git revert the task commit; remove the link.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mods/task-orchestrator/` 0.1.0 | routing table and policies, router, ledger, contract, overrides, providers, hooks (`/orchestrate`, `dispatch`, `collect`, `status`, `cancel`, worker profiles, spawn and tool fences, `turn.step` observation); 20 tests; README, ARCHITECTURE.md, DEVELOPING.md |
| `ADR-0041`, registry, `CURRENT_STATE.md`, `TODO.md`, `GOALS.md` | the decision; the mod's row; the state; the task done |

Next: add the folder to `CLAUDE_CODE_PLUGIN_DIRS` on each host and publish 0.1.0 to the organization library (human steps); a later task may default writers to a worktree each.

## Execution log

- 2026-10-27 · Claude Code (Fable 5.1) · started
  - Inspected: Claude Code 2.1.310; the laid API types; `~/.claude/settings.json` (`model: fable`, `modelSettings` effortLevel `high` for opus-5, opus-5-5, sonnet-5-5); `CLAUDE_EFFORT` set in the session environment; no `CLAUDE_CODE_SUBAGENT_MODEL`; no org model restriction in `policy-limits.json`.
  - Found: `$.agent.spawn` has no `effort`; `$.agent.register` has; `turn.step` carries a worker's effective `model` and `effort`. A plugin's own spawn reaches its own `agent.spawn` hook with `next.origin.plugin` naming it.
  - Written: the mod (6 modules, 5 test files, 20 tests), README, ARCHITECTURE.md, DEVELOPING.md, `ADR-0041`, registry row, state.
  - Evidence: `tests/test-mods.sh --mod task-orchestrator` → `PASS task-orchestrator: 20 pass`; `tests/validate.sh` → `OK`.
  - Evidence, red-proofs (each guard reverted, tests run, guard restored): nesting deny removed → 1 fail (`limits hold`); concurrency check removed → 2 fail (`at most three workers`, `limits hold`); write fence removed → 1 fail (`limits hold`); dispatch ignoring the off switch → 2 fail (`dispatch routes…`, `a failed review…`); effort/model gate removed → 2 fail (`overrides are disclosed…`, `an effort outside the five levels…`); restored → 20 pass.
  - Linked into this session's mods folder for the hot-load; the human answered *Turn them on*, but this session laid no types and registered no tools, so the live smoke ran in headless sessions that load the mod with `--plugin-dir` (coordinator `--model sonnet`, read-only tools allowed).
  - Evidence, live smoke: `claude -p "/orchestrate on" --plugin-dir mods/task-orchestrator` → `task-orchestrator on (policy balanced)`. Then one dispatch (`T1`, class `lookup`): `T1 → scout [a6cb1b8a927967f4c] → requested haiku/low → resolved claude-haiku-5-5, effort unverified → running`; after the worker's turn: `T1 → scout [a6cb1b8a927967f4c] → requested haiku/low → observed claude-haiku-5-5/low → completed`, its report quoting `#!/usr/bin/env bash` from `tests/validate.sh` with the Glob and Read it ran under Checks; `run: done`. `status` listed the host overrides (`settings model = fable`, three `modelSettings.*.effortLevel = high`, `env CLAUDE_EFFORT = medium`). A real subagent, a real id, and `turn.step` seen for a plugin-spawned worker: observed settings are not "unverified" in practice.
  - Defect found live and fixed: the first `collect` overran the hook's ten-second budget (a wait on a plain promise) and was skipped; the retry worked. `collect` now waits on `$.clock.sleep` alone; 20 tests still pass. Then `/orchestrate off` headless, so the stored switch is off.
  - Not run: `tsc -p mods/task-orchestrator` (no `tsc` on this host; the types are laid once the mod loads).
  - Landed from the worktree `agent/orchestrator` on `origin/master` (`TASK-0184` there added `.ai/GOALS.md`, so the story is in it); the hot-load question's answer did not reach this session, which is recorded above.
  - Hazard noted: another session holds `TASK-0182` with staged changes in this checkout. This task lands from its own worktree (runbook, *Landing work*) and touches nothing of `mods/agent-watch/`.
