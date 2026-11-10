# TASK-0282 — Long-running harness alignment (P2.3)

## Status

- Status: planned
- Owner: agent
- Branch: agent/TASK-0282
- Created: 2026-11-10
- Updated: 2026-11-10
- Applies to: `loops/unattended-run/`, `scripts/emit-agents.py`, the unattended fixture
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P2.3 (S3), no decision applies directly; related: #14, R-05, ADR-0022

## Objective

Apply Anthropic's long-run patterns to unattended-run: a progress file, a commit per feature, planner, generator and evaluator roles mapped, per-role `maxTurns` and `autoCompactWindow` in emitted agents, and defined context-reset points.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `loops/unattended-run/` | has a journal (#14); no progress file or per-task commit rule |
| `scripts/emit-agents.py` | emits no `maxTurns` or `autoCompactWindow` |
| TASK-0271 | role coverage the mapping rests on |

## Scope

- In: the loop text for the progress file, one commit per task and context-reset points; the role mapping (confirm against the loop which roles are planner, generator and evaluator); `maxTurns` and `autoCompactWindow` in emitted agents; a 3-task fixture run.
- Out: the Agent SDK runner (TASK-0284); changing the journal format; new roles.

## Likely files

- `loops/unattended-run/loop.md`
- `scripts/emit-agents.py`
- a fixture under `tests/` wired into `tests/validate.sh`
- a per-role turn table under `.ai/context/`

## Execution plan

1. Write the fixture: a 3-task unattended run ends with a progress file, one commit per task and an evaluator verdict each, and emitted agents carry `maxTurns`. See it fail.
2. Edit the loop for the progress file, commits and reset points.
3. Add the per-role `maxTurns` and `autoCompactWindow` table and emit it.
4. Run the fixture green; revert the emitter change and see it fail.
5. Run `tests/validate.sh`.

## Acceptance criteria

- [ ] The 3-task fixture ends with a progress file, one commit per task and a verdict each
- [ ] Emitted agents carry `maxTurns`
- [ ] Reverting fails the fixture

## Mandatory validations

- [ ] tests/validate.sh
- [ ] the new long-run fixture

## Risks and rollback

- Turn limits that are too low abort legitimate runs; start generous and tighten from journal data.
- The fixture runs against stubs, not a live run; a live run is owed.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next:

## Execution log

- 2026-11-10 · agent/Sonnet 5.5 · brief written from the alignment plan; no work done yet
  - Evidence: none yet
  - Deviation: none
