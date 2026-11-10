# TASK-0267 — Anthropic provider in the eval suite (P0.2)

## Status

- Status: planned
- Owner: agent
- Branch: agent/TASK-0267
- Created: 2026-11-10
- Updated: 2026-11-10
- Applies to: `evals/`, `.gitlab/ci/evals.yml`
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P0.2 (Q2), decisions Q9=C (k=5 trials, nightly, all three providers: Anthropic, xAI, OpenAI); related: #10 (extends #10, does not replace xai/openai)

## Objective

Add an `anthropic` provider to `evals/run.py` so the roles are measured on the model they mostly run on. Q9=C sets the budget: k=5 trials, run nightly, for anthropic, xAI and OpenAI. This task adds the provider and the nightly jobs; the trial count itself lands in TASK-0278.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `evals/run.py` PROVIDERS | xai and openai only; one trial per task over 10 golden tasks |
| `evals/thresholds.json` | floors for xai and openai only |
| .gitlab/ci/evals.yml | `evals-mock` per MR; one `evals-live` job with a `parallel.matrix` over `EVAL_PROVIDER: [xai, openai]`, keys protected, masked and scoped to the `evals-live` environment; `timeout: 30m` in `.evals-base`; scheduled-pipeline rule only (#10) |
| Vault entry for `ANTHROPIC_API_KEY` (ADR-0030) | stored by the human; this task does not create it |
| TASK-0278 | adds `--trials k`; until it lands the nightly jobs run one trial |

## Scope

- In: the anthropic provider (Messages API, `ANTHROPIC_API_KEY` from Vault, model from `EVAL_ANTHROPIC_MODEL`); a clean `provider error` when the key is missing; anthropic floors in `thresholds.json`; `anthropic` added to the `evals-live` `parallel.matrix` (so the matrix covers anthropic, xai and openai, each publishing junit), with `ANTHROPIC_API_KEY` a protected, masked project variable scoped to the `evals-live` environment like the other two keys, and the header comment updated. The nightly cadence is a GitLab pipeline schedule the human sets, not YAML; this task does not create or verify it.
- Out: more golden tasks, `--trials`, pass@k and transcripts (TASK-0278); storing the key in Vault; choosing a model id beyond the env default; changes to evals-mock.

## Likely files

- `evals/run.py`
- `evals/thresholds.json`
- `.gitlab/ci/evals.yml`
- the evals self-test

## Execution plan

1. Extend the `evals/run.py` self-test: anthropic with no `ANTHROPIC_API_KEY` returns `provider error`; run it and see it fail.
2. Add the anthropic provider to PROVIDERS with the Messages API call and the env model.
3. Run the self-test green; remove the provider and see it fail; restore it.
4. Add anthropic floors to `evals/thresholds.json`.
5. Add `anthropic` to the `evals-live` matrix in `.gitlab/ci/evals.yml`, and ask the human to scope `ANTHROPIC_API_KEY` to the `evals-live` environment and to set the nightly pipeline schedule.
6. Run `tests/validate.sh`.

## Acceptance criteria

- [ ] The self-test covers the anthropic provider, including the missing-key case, and fails when the provider is removed
- [ ] `thresholds.json` carries anthropic floors
- [ ] `.gitlab/ci/evals.yml`'s `evals-live` matrix lists `anthropic`, `xai` and `openai` and publishes junit for each. The nightly cadence is a pipeline schedule the human sets in GitLab and is not verifiable from the file; a first scheduled run is the human's, not asserted here

## Mandatory validations

- [ ] tests/validate.sh
- [ ] the evals self-test (`python evals/run.py --self-test`, or the form `evals/` documents)

## Risks and rollback

- Nightly runs on three providers at k=5 are the highest API spend of the options (Q9=C); the existing 30m job timeout is enough for one trial per task (this task); whether k=5 across three providers needs a larger one is sized in TASK-0278. Add a spend note in the evals README.
- Floors set before a first real run may be wrong; start them low and raise them after the first week.
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
