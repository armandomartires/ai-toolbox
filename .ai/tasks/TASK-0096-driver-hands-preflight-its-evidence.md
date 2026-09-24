# TASK-0096 — The driver hands preflight the evidence of its own step-1 checks

## Objective

Fix the S10.7 second dry run's halt: pass the results of the driver's
structural step-1 checks — the explicit model, and each role's mode as
`opencode agent list` reports it — to the `preflight` role verbatim, so the
role judges evidence instead of being asked to infer it.

## Minimal context

The second dry run (`s10-7-dry2`, after `TASK-0095`) found both task files,
their criteria and agreeing sources — and halted anyway, correctly by its own
rules: *"the two silent-failure checks the driver must run and hand to
preflight per ADR-0022 clauses 5.1/5.3 … were not supplied as output in this
turn. An absent check is not a passed check."* The driver **does** run both
checks (`Driver.step1_preflight_repo()`: the `provider/model` form, and
`opencode agent list` requiring `(primary)` for every role), but hands the
role neither result. `agents/preflight/` forbids inferring either "from the
run starting successfully".

**The human's decision, 2026-09-24 (multiple choice; the agent chose none):**
*"Driver passes its evidence"* — include the step-1 results verbatim in
preflight's inputs. The role is not relaxed.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/unattended-ops/templates/bindings/opencode/driver.py` | `TASK-0086`, `TASK-0095` | step 1 checks model and modes; results kept nowhere |

## Scope

### Included

- `driver.py`: keep the model and each role's verbatim `agent list` line from
  step 1, and pass them to preflight under `driver_checks`.
- A stub test, shown failing when reverted.

### Not included

- `agents/preflight/` — unchanged by decision.
- The skill-access finding (roles denied reading the skill) — recorded in
  `TASK-0092`, to be decided after the pilot.

## Likely files

`skills/unattended-ops/templates/bindings/opencode/driver.py`,
`skills/unattended-ops/templates/bindings/opencode/tests/test_driver.py`.

## Execution plan

1. Test first: preflight's inputs carry the model and each role's
   `(primary)` line; watch it fail.
2. Implement; run the suite; revert-prove.
3. Commit; push; fast-forward the pilot worktree.

## Acceptance criteria

- [x] Preflight's inputs contain the model passed as `-m`.
- [x] They contain, for each of the nine roles, its line from
      `opencode agent list`, verbatim.
- [x] The test fails when the evidence is removed.
- [x] The OpenCode suite and `tests/validate.sh` pass.

## Mandatory validations

- [x] `python3 -m unittest discover -s tests` (OpenCode binding dir)
- [x] `tests/validate.sh`

## Risks and rollback

- None beyond a longer prompt. Rollback: `git revert`.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `driver.py` | step 1 keeps each role's verbatim `agent list` line; preflight's inputs carry `driver_checks` (model, how it is passed, the nine lines, their source) |
| `tests/test_driver.py` | + one test (19 driver tests, 25 in the suite) |
| `agents/preflight/` | **Unchanged**, by decision |

**Next task starts here**: the pilot's third dry run, on a worktree
fast-forwarded to this commit.

## Status
- Status: done
- Owner: agent (decision: human)
- Created: 2026-09-24
- Updated: 2026-09-24

## Execution log
### Attempt 1
- Date: 2026-09-24
- Agent: Claude Opus 5.5 (1M context)
- Actions: test first (errored: no `driver_checks`); kept step-1 evidence and
  passed it; revert-proved by dropping the recorded lines.
- Validation: new test red → green; revert → `FAILED (failures=1)`, restored
  and `cmp`-verified; OpenCode suite OK; `tests/validate.sh` OK.
- Result: **done.**
- Commit: *(recorded in the follow-up commit)*
- Push: *(recorded in the follow-up commit)*
