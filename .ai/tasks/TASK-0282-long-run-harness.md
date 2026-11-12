# TASK-0282 — Long-running harness alignment (P2.3)

## Status

- Status: review
- Owner: agent
- Branch: agent/TASK-0282
- Created: 2026-11-10
- Updated: 2026-11-12
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

- [x] The 3-task fixture ends with a progress file, one commit per task and a verdict each (`TestLongRun` in the OpenCode driver's suite; the same run in the Claude Code binding's suite)
- [x] Emitted agents carry `maxTurns`
- [x] Reverting fails the fixture

## Mandatory validations

- [x] tests/validate.sh
- [x] the new long-run fixture

## Risks and rollback

- Turn limits that are too low abort legitimate runs; start generous and tighten from journal data.
- The fixture runs against stubs, not a live run; a live run is owed.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `loops/unattended-run/loop.md` | planner (`task-planner`), generator (`implementer`) and evaluator (`gate-runner`, `refuter`, `adjudicator`) mapped; one commit per task restated; the progress file; context-reset points between tasks and before step 13 |
| `.ai/context/turn-limits.md`, `scripts/emit-agents.py` | per-role `maxTurns` (40 to 250) and `autoCompactWindow` (400000 for the three long writers); emitted for Claude Code; a bad cell refuses |
| both unattended-run bindings | `progress.md` beside the journal, rewritten after step 3, after each task and at run end; the OpenCode driver writes it, the Claude Code workflow hands it to `run-scribe` |
| `tests/test-emit-turns.sh` (in `tests/validate.sh`), `TestLongRun` (4 tests), 2 workflow tests | the fixtures |
| `agents/run-scribe/agent.md`, `templates/binding.md`, authoring guide | the progress file and the turn table documented; `unattended-ops` 1.7.0 |

Next: a live 3-task run on either binding, owed by the brief's own risk note; tighten the turn limits from its journal.

## Execution log

- 2026-11-10 · agent/Sonnet 5.5 · brief written from the alignment plan; no work done yet
  - Evidence: none yet
  - Deviation: none
- 2026-11-12 · Claude Code (Opus 5.5) · built red-first; TASK-0271 is parked, so the mapping rests on the nine roles the loop names, not on the guard
  - Evidence: `bash tests/test-emit-turns.sh` → OK (its last case removes the table and sees every agent lose `maxTurns`); `python3 -m unittest discover` in the OpenCode tests under WSL → 57 OK, and with the driver's `write_progress()` calls removed `TestLongRun` → 3 failures, 1 error; `node --test …/unattended-run.test.mjs` → 39 pass, and with the `progress()` calls removed → 2 fail; `python3 scripts/build-plugin.py --check` → matches
  - Deviation: the 3-task fixture lives in the two binding suites, which CI's `bindings` job runs (ADR-0032 keeps them out of `tests/validate.sh`); validate runs the emitter half. No turn table for OpenCode `steps`: TASK-0280's reference profile owns cross-client keys
