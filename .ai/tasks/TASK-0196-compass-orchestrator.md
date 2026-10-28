# TASK-0196 — task-compass 0.5.0: the Subagents panel follows the orchestrator

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-28
- Updated: 2026-10-28
- Applies to: `mods/task-compass/` (0.4.0 → 0.5.0)
- Source: the human's "the compass mod, in the subagent section, should be aligned with the orchestrate mod also" of 2026-10-28; shape chosen when asked: ledger rows inline in the panel

## Objective

While task-orchestrator's ledger holds a task, Compass's Subagents panel draws each worker as its task, the way agent-watch does: `T1 · role · objective`, its model/effort, the ledger's word, and queued tasks that wait on others.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-compass/` 0.4.0 | its tests pass; the panel lists `type · description` only |
| `mods/agent-watch/` 0.4.1 | reads the ledger through a mirror (`ADR-0044`, `check-mods.py` rule 8) |

## Scope

- In: a mirror of task-orchestrator's `enabled`, `policy`, `ledger` in task-compass's types; a pure merge of agent rows and ledger tasks; the panel's rows and its `ORCH <POLICY>` code; a faster refresh while a task is open; tests, README, DEVELOPING, 0.5.0.
- Out: any write to task-orchestrator's state; agent-watch; session grouping (the human chose inline rows).

## Likely files

- `mods/task-compass/hooks/{model.ts,view.tsx,register.tsx,register.test.tsx}`, a model test, `types/index.d.ts`, `.claude-plugin/plugin.json`, `README.md`, `DEVELOPING.md`

## Execution plan

1. Mirror the orchestrator's contract in `types/index.d.ts`.
2. `subagentRows` in `model.ts`: ledger tasks first in ledger order, joined to their agent by `agentId`, then the agents no task claims; ended tasks linger as ended agents do.
3. The view draws them, with model/effort or `WAITS ON`, ledger badges, and `ORCH <POLICY>` in the panel's code while the ledger holds a task.
4. Tests, red-proved against 0.4.0; docs; 0.5.0.

## Acceptance criteria

- [x] With a ledger, each task draws `T<n> · role · objective` with model/effort (observed, else requested), a queued one hollow with `WAITS ON`, and `BLOCKED`/`PARTIAL`/`FAILED`/`CANCELLED` badges.
- [x] A worker's agent is not drawn twice; other subagents still draw as before.
- [x] With an empty ledger the panel is as in 0.4.0.
- [x] `check-mods.py` rule 8 accepts the mirror.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod task-compass
- [x] the new tests red-proved against 0.4.0's source

## Risks and rollback

- The mirror ties task-compass to task-orchestrator's contract; rule 8 fails the gate when they drift.
- Rollback: git revert the task commit.

## Outputs / handover

- `mods/task-compass/` 0.5.0: a mirror of task-orchestrator's `enabled`, `policy`, `ledger` (rule 8); `subagentRows` draws ledger tasks first as `T<n> · role · objective` with observed-else-requested model/effort, a queued one hollow with `WAITS ON`, the ledger's word as a badge (else the agent's own failed or stopped outcome), and the worker's agent not drawn again; `shownRows` never cuts a ledger row and caps only the other subagents; the panel's code reads `ORCH <POLICY>[ · OFF] · N RUNNING` while the ledger holds a task; the agents tick runs each second while a task is open.
- Deviation: review R1 found the six-row cap cut the earliest ledger tasks; fixed by `shownRows` before landing, with its own red-proof.
- Not seen live yet: a session with `/orchestrate on` and the pane open shows it.

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · planned in worktree `compass-orchestrator`; built by an orchestrated builder, reviewed by a separate reviewer
  - Evidence: `tests/test-mods.sh --mod task-compass` → `PASS task-compass: 48 pass` (34 before); `python3 scripts/check-mods.py` → `OK (5 mods)`; `tests/validate.sh` → `validate.sh: OK`.
  - Evidence, red-proofs: 0.4.0's model.ts, view.tsx and register.tsx with the new tests → the ledger pane test fails `Expected: defined Received: undefined` (and model.test.ts does not load: no `LINGER_MS` export); `shownRows` as the old `slice(-cap)` → the cap test fails, receiving `["task-T4","task-T5","task-T6","task-T7","x","y"]`.
