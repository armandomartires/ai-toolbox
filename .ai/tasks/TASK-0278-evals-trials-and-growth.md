# TASK-0278 — Grow evals to 20-50 tasks with trials (P1.8)

## Status

- Status: planned
- Owner: agent
- Branch: agent/TASK-0278
- Created: 2026-11-10
- Updated: 2026-11-10
- Applies to: `evals/`, `.gitlab/ci/evals.yml`, `tests/validate.sh`
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P1.8 (N8), decisions Q9=C (k=5 trials, nightly, all three providers); related: #10 (extends #10)

## Objective

Turn the 10-task single-trial suite into a capability and regression suite built from real failures. Q9=C fixes the budget: `--trials 5`, run nightly on anthropic, xAI and OpenAI, reporting pass@k and pass^k.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `evals/golden` | 10 tasks |
| `evals/run.py` | one trial per task; no pass@k |
| TASK-0267 | provides the anthropic provider and the nightly jobs |
| .ai/tasks incidents and refuter misses | the source of new tasks |
| the 8 skill descriptions | no trigger evals |

## Scope

- In: at least 20 golden tasks from `.ai/tasks` incidents and refuter misses; `run.py --trials k` with pass@k and pass^k; k=5 in the `evals-live` matrix (anthropic, xai, openai) and a job timeout sized for it (the current `.evals-base` `timeout: 30m` was set for one trial per task; estimate k=5 x 20 or more tasks x three providers, and raise it if the estimate exceeds 30m); transcripts kept as CI artifacts; trigger evals for the 8 skill descriptions; a validate check requiring at least 20 tasks.
- Out: more than 50 tasks; a new provider; changing thresholds beyond what the new metrics need; a dashboard.

## Likely files

- `evals/golden/*`
- `evals/run.py`
- `evals/thresholds.json`
- `.gitlab/ci/evals.yml`
- `tests/validate.sh`

## Execution plan

1. Add the validate check (at least 20 golden tasks) and a self-test for `--trials` metrics; run and see both fail.
2. Select incidents and refuter misses and write the new golden tasks.
3. Implement `--trials k`, pass@k and pass^k in `run.py`.
4. Store transcripts as CI artifacts; pass `--trials 5` in the `evals-live` job and size its timeout from the measured per-trial time.
5. Write the skill-trigger evals for the 8 descriptions.
6. Run the checks green; remove tasks to below 20 and see the check fail.
7. Run `tests/validate.sh`.

## Acceptance criteria

- [ ] At least 20 golden tasks; dropping below 20 fails the check
- [ ] `run.py --trials k` reports pass@k and pass^k, covered by the self-test
- [ ] The `evals-live` matrix covers three providers, runs `--trials 5` within a stated timeout, and publishes transcripts as artifacts. The nightly cadence is a GitLab pipeline schedule the human sets, so it is not claimed from the YAML
- [ ] Trigger evals exist for all 8 skill descriptions

## Mandatory validations

- [ ] tests/validate.sh
- [ ] the evals self-test

## Risks and rollback

- Spend scales with tasks x 5 trials x 3 providers per night; estimate before the first run and set a cap.
- Tasks written from incidents may carry the incident's wording; review them for leaked answers.
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
