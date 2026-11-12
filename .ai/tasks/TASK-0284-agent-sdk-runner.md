# TASK-0284 — Agent SDK runner for unattended runs, compared on the golden run (P2.5)

## Status

- Status: blocked
- Owner: agent
- Branch: agent/TASK-0284
- Created: 2026-11-10
- Updated: 2026-11-12
- Applies to: `skills/unattended-ops/` bindings, the golden unattended run
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P2.5 (S5), decisions D5=B (add an SDK runner next to the current binding, compare on the golden run, then pick); related: R-05, ADR-0022, ADR-0038

## Objective

Add a Claude Agent SDK runner (Python), with hooks as callbacks, OTel and the sandbox, next to the current Claude Code binding, then run both on the golden unattended run and record which to keep. D5=B was not the assessment's recommendation (it recommended deferring), so the side-by-side comparison is the deliverable and the pick is a later decision.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `skills/unattended-ops` bindings (ADR-0022, ADR-0038) | OpenCode driver plus a Claude Code workflow binding |
| TASK-0271 | role guard exists |
| TASK-0282 | long-run alignment exists |
| the golden unattended run | passes on the current binding |

## Scope

- In: an SDK runner implementing the binding contract (`skills/unattended-ops/scripts/check-binding.sh` must pass); the guard as hook callbacks; OTel and sandbox settings; the golden run on both runners in CI; a comparison note (result, cost, time, interventions); a recommendation to the human.
- Out: removing the current binding; making the SDK dependency mandatory; the final pick (a human decision after the note); the OpenCode driver, which stays.

## Likely files

- `skills/unattended-ops/templates/bindings/` (a new runner beside `claude-code` and `opencode`)
- `skills/unattended-ops/scripts/check-binding.sh` and `skills/unattended-ops/fixtures/`
- a `.gitlab/ci/` job for the golden run
- the comparison note under `.ai/reviews/` or `docs/`

## Execution plan

1. Write the CI check: the golden unattended run passes on both runners and a guard fixture fails when the runner's hook callbacks are removed. See it fail with no runner.
2. Write the runner against the binding contract.
3. Wire the hook callbacks, OTel and sandbox.
4. Run both runners on the golden run; record the numbers.
5. Write the comparison note and put the pick to the human.
6. Run `tests/validate.sh`.

## Acceptance criteria

- [ ] The golden run passes on the SDK runner and the current binding in CI
- [ ] Removing the hook callbacks fails the guard fixture
- [ ] The comparison note holds result, cost, duration and interventions for both runners

## Mandatory validations

- [ ] tests/validate.sh
- [ ] the golden-run CI job and `skills/unattended-ops/scripts/check-binding.sh`

## Risks and rollback

- Two runners to maintain during the trial; the note sets a date to pick or drop one.
- The Python SDK adds a dependency for this runner only; keep it optional.
- A live run needs the human's authorization under AGENTS.md; this task covers stubs and CI unless that is granted.
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
- 2026-11-12 · Claude Code (Opus 5.5) · blocked on TASK-0271, parked by the human on 2026-11-12: the runner's guard is TASK-0271's guard as hook callbacks, and its acceptance fixture fails only when those callbacks are removed. TASK-0282, its other dependency, is in review. A live golden run also needs the human's authorization
  - Evidence: `.ai/tasks/TASK-0271-role-guard.md` (Status: blocked, parked by the human)
  - Deviation: none
