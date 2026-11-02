# TASK-0210 — The OpenCode driver records what changed, and parks by namespace

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-02
- Updated: 2026-11-02
- Applies to: `skills/unattended-ops/templates/bindings/opencode/` (`driver.py`, its tests, `decision-standard.md`), `skills/unattended-ops/references/evidence.md`, `ADR-0025`
- Source: `TASK-0176`'s runs `pilot-20261022` and `pilot-20261102`; the human, 2026-11-02: "Fix driver, rerun"

## Objective

Both pilot runs parked a correct change on "no file outside these two changes": no role can evidence it, since the adjudicator has no shell and rightly treats the implementer's porcelain as a claim, while the driver, which runs `git status` itself, hands over only the gates. Both then halted, because the park check looks for the whole reason in `git stash list`, which shows one line of a message a shell may also have reflowed.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `driver.py` step 6 → 8 | no record of the working tree after the implementer |
| `step11_park` | `message not in git stash list` |
| `evidence.md` | admits only a gate's own line and the log it names |

## Scope

- In: after step 6, the driver writes the verbatim `git status --porcelain --untracked-files=all` to a file beside the evidence file and appends one `CHANGES <handle> PATHS=<n> LOG=<path>` line to the evidence file; the refuter and the adjudicator are handed that line; `evidence.md` admits it for which paths changed, never for a figure; `ADR-0025` gains the clause; the park check requires a new stash whose subject carries the namespace; tests; the pilot's copy.
- Out: the `tool-denied` label, the stale forge path in the handover (`TASK-0176` findings); the Claude Code binding, whose driver has no shell (`ADR-0025` decision 1).

## Likely files

- the four above, `tests/test_driver.py`, `scripts/sync-decision-standard.sh` output

## Execution plan

1. Driver: `record_changes`, its line in both prompts, the namespace park check.
2. Tests: the line is in the evidence file and both prompts, its log lists the changed path; a multi-line park reason parks without a halt. Red-prove both.
3. `evidence.md`, `ADR-0025`, regenerated `decision-standard.md`.
4. Suites; commit; copy driver and standard into the pilot; rerun (`TASK-0176`).

## Acceptance criteria

- [x] The evidence file carries one `CHANGES` line per attempt, and the refuter and adjudicator receive it verbatim.
- [x] A park whose reason has several lines ends in a `park` event, not a halt.
- [x] Each new test fails against the previous driver.
- [x] `decision-standard.md` matches its sources (the gate).

## Mandatory validations

- [x] tests/validate.sh
- [x] `python3 -m unittest discover -s skills/unattended-ops/templates/bindings/opencode/tests`

## Risks and rollback

- A path the driver's own run directory adds would show in the list where `.run/` is not ignored; the pilot ignores it, and the evidence file already lives there.
- Rollback: git revert the task commit; re-copy the driver into the pilot.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `driver.py` | `record_changes` after step 6: a `CHANGES` evidence line and its porcelain log, handed to the refuter and adjudicator; the park check matches a new stash by namespace |
| `evidence.md`, `decision-standard.md`, `ADR-0025` | the `CHANGES` line is admissible for which paths changed, never for a figure (decision 3) |
| `unattended-ops` | 1.4.1 → 1.5.0 |

Next: `TASK-0176` copies the driver and standard into the pilot and reruns.

## Execution log

- 2026-11-02 · Claude Code (Opus 5.5) · brief written before the change
- 2026-11-02 · Claude Code (Opus 5.5) · done
  - Evidence: `python3 -m unittest discover -s tests` (in the binding) → `Ran 50 tests … OK`; against the previous driver `TestChangesAndPark` → `FAILED (failures=2)` (`0 != 1 : []` for the line, `1 != 0` halts for the park); `tests/validate.sh` → `OK`.
