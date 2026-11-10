# TASK-0279 — Claude Code OpenTelemetry (P1.9)

## Status

- Status: planned
- Owner: agent
- Branch: agent/TASK-0279
- Created: 2026-11-10
- Updated: 2026-11-10
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

- In: `CLAUDE_CODE_ENABLE_TELEMETRY=1` and OTLP exporter settings in the shipped settings env and the README; a CI assertion that the collector received `claude_code` metrics during a run; a check that prompts are not logged by default.
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

- [ ] The collector receives `claude_code` metrics in the CI job
- [ ] Unsetting the flag fails the job
- [ ] No prompt text appears in the received data
- [ ] R-10 states what is closed

## Mandatory validations

- [ ] tests/validate.sh
- [ ] the otel CI job (`tests/otel/`)

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
