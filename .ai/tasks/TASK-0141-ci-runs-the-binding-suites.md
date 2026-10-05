# TASK-0141 — Run both unattended-run binding suites in CI (B-037)

## Objective

Close `B-037` by the route the human chose on 2026-10-05: **a CI-only job**,
recorded in an ADR. Neither binding's test suite is run by anything, and one
was red on `master` for two days while `tests/validate.sh` said `OK`. Add a
`bindings` job to `.github/workflows/validate.yml` that runs both suites on
every push. The local gate stays fast, offline and hermetic.

## Minimal context

- **The measured cost of not running them** (`TASK-0112`, the `B-037` row):
  `98ce299` put a `must` citing a task id into the Claude Code `binding.md`,
  its suite went red, and three commits landed on top with the gate green.
- **Why not the gate**: `ADR-0007` and `ADR-0009` require it fast, offline
  and hermetic, and forbid validating runtime presence.
  - The OpenCode suite took **3m12s** here on 2026-10-05 (40 tests). The
    Claude Code suite took **0.27 s** (26 tests).
  - `node` is not guaranteed on a fresh clone, and a `command -v` guard
    would be the silently skipping gate `ADR-0009` calls worse than none.
- **Why CI is enough**: a failed job fails the `validate` run, and
  `ci-alert.yml` already opens an issue for a red `validate` on `master`
  (`TASK-0124`, `TASK-0130`). No new alerting path is needed.
- **What the suites need**: `node` with `node:test`, and `python3` ≥ 3.11
  with `git`. The Python suite sets its own git identity
  (`test_driver.py:148`), so a bare runner suffices. GitHub's
  `ubuntu-latest` image ships both; the job prints their versions, and a
  missing one fails the step rather than skipping it.
- **Not `check-binding.sh`**: it rejects the templates by design, since an
  unfilled binding is not a declaration.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.github/workflows/validate.yml` | `TASK-0015`, `TASK-0123` | one job, `validate` |
| `.github/workflows/ci-alert.yml` | `TASK-0124`, `TASK-0130` | watches the `validate` workflow by name |
| `skills/unattended-ops/SKILL.md` | ongoing | `1.3.0`; says nothing runs either suite |
| both binding suites | `TASK-0103`, `TASK-0140` | 29 node tests and 40 Python tests, all passing locally |
| `.ai/planning/BACKLOG.md` | `TASK-0140` | `B-037` `ready`; six open |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. `.ai/decisions/0032-binding-suites-run-in-ci.md`.
2. `.github/workflows/validate.yml`: a `bindings` job, with a header note.
3. The statements that say nothing runs these suites are corrected, each in
   words true in a copy too:
   - `unattended-ops/SKILL.md`'s two rows (`1.3.1`);
   - `driver.py`'s docstring;
   - `run-gate.sh`'s header;
   - `check-binding.sh`'s wiring note, which describes CI;
   - the three test headers.
4. `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md`, this brief.

### Not included

- `tests/validate.sh`, which is unchanged by design.
- `ci-alert.yml`, which already watches the workflow.
- `check-binding.sh` in CI, for the reason above.
- The MCP server template's test (`authoring-guide.md:112`), a different
  component.

## Likely files

The ADR, `validate.yml`, `skills/unattended-ops/SKILL.md`,
`check-binding.sh`, `driver.py`, `run-gate.sh`, the three test files, the
ledger, this brief.

## Execution plan

1. This brief and the ADR first.
2. The job and the wording.
3. `tests/validate.sh`; ledger; commit; push both remotes.
4. **Observe the job on GitHub** for the task commit, and record the run id
   and both suites' figures in the record commit's push line. If it is red,
   fix it forward as attempt 2.

## Acceptance criteria

- [x] ADR-0032 is accepted and records the alternatives the human weighed.
- [x] `validate.yml` runs both suites in a `bindings` job, on every push.
- [x] No tracked statement says nothing runs these suites.
- [ ] The job is observed green on GitHub for the task commit, with both
      suites' counts read from its log.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed)
- [ ] the `bindings` job's run, read from the API

## Risks and rollback

- **The runner's `node` is older than this host's 22.23.** The suite uses
  only `node:test`, `node:assert`, `node:fs` and `node:child_process`. A
  failure would show in the observed run and be fixed forward.
- **A slower CI.** The job runs in parallel with `validate`, so the
  workflow's wall time grows by the difference, not the sum.
- **Rollback:** `git revert` the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `.ai/decisions/0032-binding-suites-run-in-ci.md` | new, Accepted |
| `.github/workflows/validate.yml` | jobs `validate` and `bindings` |
| `unattended-ops` files | the wiring statements are true; `1.3.1` |
| `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md` | `B-037` done; five open |

**Next task starts here**: `master` at the record commit.

## Status

- Status: in_progress
- Owner: agent (Claude Code)
- Created: 2026-10-05
- Updated: 2026-10-05

## Execution log

### Attempt 1

- Date: 2026-10-05
- Agent: Claude Code (Opus 5.5), main checkout
- Actions: wrote the brief and `ADR-0032`, then the job and the wiring
  statements.
- Observations:
  - After the edits, `git grep -i 'nothing in this repository runs'` under
    `skills/unattended-ops/` finds only the two lines about
    `check-binding.sh`. Those stay true, since CI does not run it.
  - Locally: the Claude Code suite passed 29 of 29, `test_run_gate.py` was
    `OK`, and the full OpenCode suite was `OK` (40 tests) earlier the same
    day. The edited Python and shell files compile.
- Validation: `tests/validate.sh` printed `validate.sh: OK`, and the registry
  is unchanged.
- Result: landed; the job's first run is observed in a follow-up commit.
- Commit: `a1a8612` — *Run both binding suites in CI (TASK-0141)*, plus the record-keeping commit after it
- Push: **confirmed to both remotes** — `a8d85ff..a1a8612 master -> master` to
  `origin` and to `github`; `HEAD`, `origin/master` and `github/master` all
  read `a1a8612`, and `git remote -v` is token-free
