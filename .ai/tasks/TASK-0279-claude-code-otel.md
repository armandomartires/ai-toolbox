# TASK-0279 — Claude Code OpenTelemetry (P1.9)

## Status

- Status: review
- Owner: agent
- Branch: agent/TASK-0279
- Created: 2026-11-10
- Updated: 2026-11-12
- Applies to: `configs/claude-code/`, `.gitlab/ci/otel.yml`
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P1.9 (N9), no decision applies; related: R-10

## Objective

Close R-10 on the harness side by enabling Claude Code's own telemetry and pointing it at the collector gates already uses.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `configs/claude-code/README.md` and settings env | no telemetry settings |
| .gitlab/ci/otel.yml | a collector job exists |
| risk register R-10 | open for the harness side |

## Scope

- In: `tests/otel/collector.yaml` (test collector gains metrics and logs pipelines); `CLAUDE_CODE_ENABLE_TELEMETRY=1` and OTLP exporter settings in the shipped settings env and the README; a CI assertion that the collector received `claude_code` metrics during a run; a check that prompts are not logged by default.
- Out: exporting prompt text; new dashboards; the Agent SDK runner's telemetry (TASK-0284); changing the collector.

## Likely files

- `configs/claude-code/README.md`
- `configs/claude-code/settings.*.json` env block
- `.gitlab/ci/otel.yml`
- `.ai/context/risk-register.md`

## Execution plan

1. Extend the otel CI job to assert `claude_code` metrics arrive; run it and see it fail.
2. Add the env settings and README text.
3. Run the job green; unset `CLAUDE_CODE_ENABLE_TELEMETRY` and see it fail.
4. Verify that prompt content is absent from the received data and write down how.
5. Update R-10.

## Acceptance criteria

- [x] The collector receives `claude_code` metrics in the CI job
- [x] Unsetting the flag fails the job
- [x] No prompt text appears in the received data
- [x] R-10 states what is closed: wired and asserted by replay; the live client is unverified, so R-10 stays Open

## Mandatory validations

- [x] tests/validate.sh: passed in the pre-commit hook at the task commit
- [x] the otel CI job (`tests/otel/`): run locally in WSL Ubuntu, then green on the GitLab runner (`otel-collector`, pipelines 997, 998 and 1002; job 2658 printed `claude_code.session.count` and `claude_code.token.usage`)

## Risks and rollback

- Privacy: prompts are not logged by default, but verify with the received data rather than the docs.
- The CI job may need a Claude Code binary or a replay; if neither works offline, say so and keep the job scheduled.
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
- 2026-11-11 · agent/Sonnet 5.5 · W2-0279 implementation
  - Red first: `tests/otel/claude-code-check.sh` + `claude_code_replay.py` written before `configs/claude-code/settings.otel.json`; run in WSL it failed (settings file absent, JOB-FAIL).
  - Change: `settings.otel.json` (flag, metrics exporter otlp, http/json, placeholder endpoint `http://localhost:4318`), README "Telemetry" section, metrics+logs pipelines added to the TEST collector config `tests/otel/collector.yaml`, `claude-code-check.sh` added to the `otel-collector` job, offline `tests/test-claude-otel.sh` wired into `tests/validate.sh`.
  - Green: the check printed `claude_code.session.count` and `claude_code.token.usage` visible in the collector, and "no prompt text under the shipped settings (prompt field was <REDACTED>)".
  - Flag unset: `CLAUDE_OTEL_DROP=CLAUDE_CODE_ENABLE_TELEMETRY` printed "replay: telemetry flag not set" then "the collector did not receive claude_code telemetry", DROP-FAIL. Offline test with the flag deleted printed `FAIL CLAUDE_CODE_ENABLE_TELEMETRY is 1`.
  - Prompt check: the canary prompt appears in the collector output only when `OTEL_LOG_USER_PROMPTS=1` is forced (detector proven); under the shipped settings plus the logs exporter it does not.
  - Deviation 1: no live Claude Code (no binary/login in a job, and a session would use the person's credentials), so a replay stands in; the replay's reading of the env follows the vendor docs, unobserved on a live client. The job is not yet run on the GitLab runner.
  - Deviation 2: `tests/otel/collector.yaml` (test config, not the production collector) gained metrics and logs pipelines.
  - Deviation 3: R-10 not updated (file outside the allowed set). Proposed edit: Status `Open` -> `Open (harness side: Claude Code metrics export wired and asserted in CI by replay, TASK-0279; run history editability and live-session proof remain)`.
  - Deviation 4: `install.sh` does not merge `settings.otel.json`; the README says to copy it.
- 2026-11-11 · agent/Sonnet 5.5 · review fixes: collector cleanup (guarded kill, wait, readiness failure) in both scripts, no pipe under pipefail in the prompt check, hostname compare in the offline test, README identity-attribute note (vendor docs), R-10 row updated (Open, replay-asserted), Scope names collector.yaml. Deviation 3 above is superseded: R-10 edited.
- 2026-11-12 · Claude Code (Opus 5.5) · the job read on the runner through the GitLab API: `otel-collector` green on pipelines 997, 998 and 1002; `tests/otel/claude-code-check.sh` printed the two `claude_code` metric names. What stays open is R-10's live client, which no job can show
  - Evidence: job 2658 log, "OTEL: claude_code metrics visible in the collector"
  - Deviation: none
