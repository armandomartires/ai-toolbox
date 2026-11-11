# TASK-0290 — Fix the first live CI runs of the eval and tool-lock jobs

## Status

- Status: in review
- Owner: agent (Claude Code)
- Branch: agent/ai-toolbox-alignment-66b894
- Created: 2026-11-11
- Updated: 2026-11-11
- Applies to: `evals/run.py`, `.gitlab/ci/mcp-tool-lock.yml`
- Source: the human's playbook step 3 (2026-11-11). Reading the master pipelines 910–922 through the GitLab API found both S11 P0 CI jobs failing on their first real runs.

## Objective

Make the two jobs that `TASK-0267` and `TASK-0269` added pass on the runner. Each failure was the change's own:
- `mcp-tool-lock` fails at install on every master pipeline since `9ab4eae`. The job's Debian node image ships `python3` without `ensurepip`, so `python3 -m venv` stops and `uv` is never installed. No lock was checked.
- `evals-live: [anthropic]` (scheduled pipeline 922) scores 0.00, with `provider error: HTTP 400` on all 10 tasks. The request sends `temperature: 0`. Claude Sonnet 5.5 refuses any non-default sampling value with a 400, and API version 2026-10-21 refuses `temperature`, `top_p` and `top_k` on every model (the Claude API reference, `claude-api` skill).

## Inputs

| Artifact | Expected state |
|----------|----------------|
| Pipelines 910, 916, 920–922 | `mcp-tool-lock` failed: "ensurepip is not available", "uv: command not found" |
| Job 2346 artifact `evals-anthropic.json` | all 10 rows `provider error: HTTP 400` |
| Job 2348 (openai), job 2347 (xai) | 10 × HTTP 429; injection 0.00, with `canary_leaked=True` on 3 tasks |

## Scope

- In: drop `temperature` from the Anthropic request, with a self-test assertion that no sampling parameter is sent. Install `python3-venv` in the `mcp-tool-lock` job before the venv. Log the live results in `TASK-0267` and `TASK-0269`.
- Out:
  - OpenAI's HTTP 429 on every call: the account's quota or billing, which is the human's to fix.
  - xai/grok-4 leaking the injection canary: the eval doing its job, not a defect here.
  - `gates-sandbox` exit 77: an allowed failure on a runner without user namespaces.
  - xai's and openai's own `temperature: 0`: their APIs accept it.

## Likely files

- `evals/run.py`, `.gitlab/ci/mcp-tool-lock.yml`
- `.ai/tasks/TASK-0267-claude-provider-evals.md`, `.ai/tasks/TASK-0269-mcp-annotations-and-lock-drift.md`, `TODO.md`, `GOALS.md`

## Execution plan

1. Read the pipelines, job logs and artifacts through the API.
2. Red: a self-test assertion that the Anthropic body carries no sampling parameter.
3. Drop `temperature`; add the `python3-venv` install.
4. Self-test, mock run, `tests/validate.sh`; push; read the push pipeline's `mcp-tool-lock` and a manual run of the nightly schedule.

## Acceptance criteria

- [x] `python -I evals/run.py --self-test` failed with "anthropic body sends a sampling parameter", then passes
- [x] The mock run scores 1.00 on all three suites
- [ ] `mcp-tool-lock` passes on the master pipeline of this commit
- [ ] `evals-live: [anthropic]` makes real calls (no HTTP 400) on the next scheduled run

## Mandatory validations

- [x] `python -I evals/run.py --self-test`: exit 0
- [ ] `tests/validate.sh`: run by the pre-commit hook at the commit

## Risks and rollback

- `apt-get` adds network and about 20 s to the job. It runs as root in the runner's container, as in `gates-sandbox`.
- Once `uv` installs, the job reaches the lock checks for the first time. They may still find drift that only the live run can show.
- Rollback: git revert the task commit.

## Outputs / handover

Next: the two open live criteria. Then `TASK-0269` closes on a green `mcp-tool-lock`. OpenAI's quota is the human's.

## Execution log

- 2026-11-11 · Claude Code (Opus 5.5, coordinator) · pipelines read, red self-test, both fixes
  - Evidence: self-test red ("anthropic body sends a sampling parameter"), then exit 0; mock 1.00/1.00/1.00.
