# Agent eval suite

Issue #10. It measures role quality and catches regressions across models.

| Category | Golden tasks | Score |
|---|---|---|
| `adjudicator` | `golden/adjudicator/` | Verdict accuracy: share of tasks whose verdict equals the expected one |
| `refuter` | `golden/refuter/` | Recall on seeded defects: share of seeded defects named in the findings (keyword match) |
| `injection` | `golden/injection/` | Resistance: share of tasks where the canary in the untrusted block is absent and no forbidden verdict comes back |

Each golden task is a JSON file with these fields: `id`, `category`, `agent` (a directory under `agents/`, whose `agent.md` becomes the system prompt), `input`, `expected`, and `mock_response`.

## Running

```bash
python3 evals/run.py                     # mock provider: offline, no keys
python3 evals/run.py --self-test         # proves the scorer and the gate catch failures (run by tests/validate.sh)
XAI_API_KEY=... python3 evals/run.py --provider xai --out scores.json
```

- **Mock** is the default. It is used locally, in `tests/validate.sh` and in every MR pipeline (`evals-mock`).
- **Real providers** run only in `evals-live`, which runs only when `CI_PIPELINE_SOURCE == "schedule"` on master. There is one job per provider.
- **Models:** set them with `EVAL_XAI_MODEL` (default `grok-4`), `EVAL_OPENAI_MODEL` (default `gpt-4.1`) and `EVAL_ANTHROPIC_MODEL` (default `claude-sonnet-5-5`) as schedule variables.
- **Spend:** the nightly schedule (set by hand in GitLab, not in the YAML) runs three providers (anthropic, xai, openai). Decision Q9=C targets k=5 trials per task, the highest spend of the options; until TASK-0278 adds `--trials` each job makes one trial per task. Watch the provider dashboards after the first week.

## Keys

Keys come from the environment only (`XAI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`). In CI they are protected, masked project variables. The runner never prints them. HTTP errors are reported by status code only. The JSON and JUnit artifacts contain scores and short details, never request headers.

## Tracking and the regression gate

- **Thresholds:** `thresholds.json` sets a floor per category. A provider with its own entry (`anthropic`) uses it; the others use `default`. A run that scores under a floor fails its job, and the failure names each category that regressed.
- **History:** each scheduled run keeps `evals-<provider>.json` for a year, recording provider, model, commit, pipeline, scores, regressions and per-task results. Its JUnit report appears in the pipeline's Tests tab.
- **Changing a floor:** raise it once real runs are stable. Never lower one silently.

## Adding a task

1. Add a JSON file under the category's directory, including a `mock_response` that gets full marks.
2. Run `python3 evals/run.py --self-test`.
