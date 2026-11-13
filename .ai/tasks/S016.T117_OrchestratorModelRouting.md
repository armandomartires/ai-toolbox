# TASK-0224 — task-orchestrator 0.5.3: model routing fixes

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-04
- Updated: 2026-11-04
- Applies to: `mods/task-orchestrator/` (`hooks/register.tsx`, `hooks/router.ts`, `hooks/ledger.ts`, tests, README, ARCHITECTURE)
- Source: the human, 2026-11-04, after the review "Orchestrator Model Routing": "Yes, fix them"

## Objective

A task reaches the model and effort its work needs, under the limits the mod states: sessions are told the report shape, escalations are counted, the coordinator classifies with each class's meaning in view, and a role, a fallback or a session gate never changes settings in silence.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `register.tsx` | a session's assignment has no role prompt or report shape; `class` lists names only; any refusal matching `/model/i` marks a model unavailable; an unknown model family skips the session gate; an Agent-tool worker is requested at `profile` |
| `router.ts` | a role override keeps the class's model and effort |
| `ledger.ts` | `mayEscalate` is never called; `escalations` stays 0 |

## Scope

- In: the seven findings of the review, tests, README, ARCHITECTURE, version 0.5.3.
- Out: a classifier that checks the class against the objective; a fallback down the ladder; live runs.

## Likely files

- `mods/task-orchestrator/hooks/{register.tsx,router.ts,ledger.ts}`, their tests, `README.md`, `ARCHITECTURE.md`, `.claude-plugin/plugin.json`

## Execution plan

1. `escalationOf` in `retryTask`: a retry above the last settings counts and is refused past `maxEscalations`.
2. `route`: a named role takes its own row's settings unless model or effort are named.
3. `contractOf`: a session's assignment ends with its role's prompt and the report shape.
4. `classGuide` in `dispatch`'s `class` description.
5. `isModelUnavailable` for the unavailable list; the fallback note says it costs more.
6. `sessionGate` refuses an incomparable model family; `profileSettings` for an Agent-tool worker.
7. Tests, docs, version.

## Acceptance criteria

- [x] A session's assignment carries its role's prompt and the report shape; a subagent's does not repeat them
- [x] A retry on a bigger model or effort counts as an escalation and the second is refused
- [x] `class` lists each class's job and settings
- [x] A role named over the class brings its own row's settings, unless model or effort are named
- [x] A model is marked unavailable only on a not-available wording; the fallback note says it costs more
- [x] A session model of unknown family is refused
- [x] An Agent-tool worker's requested settings are its profile's
- [x] `tests/test-mods.sh --mod task-orchestrator` passes

## Mandatory validations

- [x] tests/test-mods.sh --mod task-orchestrator
- [x] tests/validate.sh

## Risks and rollback

- A coordinator that relied on a role override keeping cheap settings now gets the role's own; it can still name model and effort.
- A refusal worded otherwise than the patterns no longer marks a model unavailable; the task is still blocked with the refusal.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mods/task-orchestrator` | 0.5.3 |
| tests | 5 new cases, 4 assertions changed; 65 pass |

Next: a live run with a session worker, to see its report parsed and `get_session`'s settings matched.

## Execution log

- 2026-11-04 · Claude Code (Opus 5.5) · the review's seven findings
  - Evidence: `tests/test-mods.sh --mod task-orchestrator` → `PASS task-orchestrator: 65 pass`
  - Deviation: the session gate's unseen coordinator effort is left as it was (skipped until a request is seen); refusing every session before the first request would block the first turn
