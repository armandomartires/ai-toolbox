# TASK-0200 — task-orchestrator 0.4.0: honour a model and effort the person names

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-28
- Updated: 2026-10-28
- Applies to: `mods/task-orchestrator/` (0.3.0 → 0.4.0)
- Source: the human's review request of 2026-10-28 ("Work on all this tasks by defining a plan and then orchestrate and assigning the tasks to sub sessions running sonnet 5.5 in medium or high effort according to your judgement" behaved differently with the mod on); the approved plan

## Objective

When the person names a model or an effort range for a run, every dispatch carries it; the routing table fills only what they left open. The effort a task asks for reaches its worker: a hand-off names it, two tasks of one role at different efforts do not share one profile, and a host setting that may replace it is said at dispatch.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-orchestrator/` 0.3.0 | `COORDINATOR_PROTOCOL` says "pass model or effort yourself only with a reason"; one profile per role (`ensureProfile`); `handoffCall` names no effort; host overrides only in `status` |
| `ARCHITECTURE.md` | a profile registered mid-turn is taken by the Agent tool from the next turn |

## Scope

- In: the protocol's person-first rule; added on the human's mid-task request ("make sure it aligns with compass mod and vice-versa"): workers are told the coordinator keeps the person's task board (Compass), and the protocol says so; effort in the hand-off line; a `note:` at dispatch when `modelSettings.<model>.effortLevel` differs from the requested effort; a profile per role and settings (`builder` for the table's, `builder--<model>-<effort>[-wt]` otherwise), accepted by the `agent.spawn` guard and the hand-off adoption; tests; README, ARCHITECTURE; 0.4.0.
- Out: session workers (`start_session`) — TASK-0201; the routing table's values; the person's own settings.

## Likely files

- `mods/task-orchestrator/hooks/{contract.ts,register.tsx,overrides.ts}`, their tests, `README.md`, `ARCHITECTURE.md`, `.claude-plugin/plugin.json`

## Execution plan

1. `contract.ts`: the person-first rule in `COORDINATOR_PROTOCOL`.
2. `overrides.ts`: `effortOverridesFor(overrides, model, effort, resolvedId)`; `register.tsx` `answerDispatch` adds the note.
3. `register.tsx`: `handoffCall` names the effort; `profileName(config, role, model, effort, isolated)`; `ensureProfile` and `start` register and spawn by it; the spawn guard and adoption map a variant back to its role.
4. Tests, each red-proved; docs; version; gates.

## Acceptance criteria

- [x] The protocol says a model or effort the person names goes on every dispatch, and "with a reason" is the coordinator's own deviation only.
- [x] A handed-off task's line names `effort "<requested>"`.
- [x] A dispatch on sonnet at medium, under `modelSettings.claude-sonnet-5-5.effortLevel = high`, answers with a note naming that setting.
- [x] Two builder dispatches at medium and high register two profiles and spawn each by its own name; the table's settings keep the plain role name.
- [x] A coordinator Agent call of a variant profile is adopted and fenced like the plain one.

## Mandatory validations

- [x] tests/test-mods.sh --mod task-orchestrator
- [x] tests/validate.sh
- [x] the new tests red-proved against 0.3.0's source

## Risks and rollback

- A variant profile name is a new `subagent_type` the coordinator must copy exactly from the hand-off line.
- Rollback: git revert the task commit.

## Outputs / handover

- `mods/task-orchestrator/` 0.4.0: `contract.ts`: the person-first settings rule, "workers are subagents, not sessions", the coordinator keeps the board, a worker is prohibited from updating it. `routing.ts`: `profileName`, `roleOfProfile`. `overrides.ts`: `effortOverridesFor`. `register.tsx`: profiles keyed by name; `start` spawns by the task's profile; `handoffCall` names profile and effort; adoption requires the exact profile; `answerDispatch` adds the host-override note.
- Compass and agent-watch: the ledger's shape is unchanged (`role`, `requested`, `observed`), so their mirrors (`check-mods.py` rule 8) hold; an unclaimed worker's raw agent type now reads `task-orchestrator:builder--sonnet-high` in their labels and toast.
- Deviations: the Compass alignment, added mid-task by the human.
- Not verified: a variant profile spawned live, and whether `$.agent.spawn` takes a profile registered in the same turn (the engine says the Agent tool does from the next turn); a policy change between a hand-off and its adoption renames the expected profile to one not yet registered.

Next: TASK-0201, session workers, starting with its spike in a desktop session that offers `start_session`.

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · plan approved; brief written before the code
- 2026-10-28 · Claude Code (Opus 5.5) · built and closed
  - Evidence: `tests/test-mods.sh` → `5 passed, 0 failed` (task-orchestrator 32, task-compass 130, agent-watch 22); `python3 scripts/check-mods.py` → `OK (5 mods)`; `tests/validate.sh` → `validate.sh: OK`.
  - Evidence, red-proof: with 0.3.0's `contract.ts`, `register.tsx`, `routing.ts`, `overrides.ts` restored, the protocol test, the hand-off test, both new engine tests fail on their assertions, and `router.test.ts` and `overrides.test.ts` fail to load (the helpers do not exist): `18 pass, 6 fail`.
