# TASK-0234 — task-orchestrator 0.5.5: collect always answers, and about the right tasks

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-05
- Updated: 2026-11-10
- Applies to: `mods/task-orchestrator/`
- Source: the human, 2026-11-05: "The orchestrate mod seems to have some issues" — a worker's report "never arrived" through `collect`; `status` felt off.

## Objective

`collect` answers on every call, spends its budget only on tasks that can end, parses the report shapes workers actually write, and `status` reflects the run as it is: a cancelled task does not fail the run, a cleared run is idle, the coordinator's effort is shown.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `claude/hooks/register.tsx` `answerCollect` | an aborted sleep falls to `next(e)` unanswered; `pending` counts queued tasks that cannot start; unknown ids in a mixed list are dropped |
| `claude/hooks/contract.ts` `parseReport` | needs a bare one-word label plus colon; `- Status:`, `## Status`, `Checks run:` give `unknown` |
| `claude/hooks/register.tsx` `refreshSession` | `lastMessage` may pick a tool event; `confirmSettings` stops after one failed read |
| `claude/hooks/ledger.ts` `overall` | `cancelled` counts as `failed`; nothing ever clears the ledger |

## Scope

- In: the five causes above, `/orchestrate reset`, the coordinator's effort in `status`, tests, README and ARCHITECTURE, version 0.5.5.
- Out: session workers beyond the two read fixes; panel parity for blockers and tokens; the hook budget ceiling.

## Likely files

- `mods/task-orchestrator/claude/hooks/register.tsx`, `contract.ts`, `ledger.ts`, `view.tsx`, their tests, `README.md`, `ARCHITECTURE.md`, `claude/.claude-plugin/plugin.json`

## Execution plan

1. Builder: the code and tests (one writer, the whole `claude/hooks/` folder).
2. Reviewer: independent read of the diff against the five causes.
3. Documentation: README, ARCHITECTURE, version.
4. Coordinator: the mod gate and tests; a live `collect` in this session.

## Acceptance criteria

- [x] `collect` whose sleep aborts answers with "call again"; a non-finite budget is treated as 10 s
- [x] `collect` with a queued task that cannot start returns within about 1 s and names the reason
- [x] `- Status:`, `## Status`, `**Checks actually run:**`, `Checks run:` and `Status — completed` parse
- [x] `cancel` then `status` never reads `run: failed` for the cancelled task; `/orchestrate reset` clears the ledger
- [x] `status` prints the coordinator's effort
- [x] Tests, the mod gate and `plugin.json` 0.5.5
- [x] Live on 0.5.5 (hot-reloaded here, 2026-11-05): bullet-label (L1) and heading-label (L2) reports parsed to `completed` with their fields; `status` prints the coordinator effort; a running task holds `collect` 8.8 s; a queued dependant of a running task is reported with its reason
- [x] Live, on 0.5.4 in this session: every worker's end note woke the coordinator and one `collect` printed each report; recorded in ARCHITECTURE.md *Observed, not guaranteed*

## Mandatory validations

- [x] `tests/test-mods.sh --mod task-orchestrator`: PASS 84
- [x] `scripts/check-mods.py`: clean
- [x] `claude plugin validate task-orchestrator/claude`: passed with warnings
- [ ] `tests/validate.sh`: ARTIFACTS pass; WORKTREE fails 6 of 8 on this host alone (`no such worktree: /c/Users/.../Temp/...`, a `/c/` path against `C:\` on Windows; unrelated to this task, fails identically on its own)

## Risks and rollback

- `collect` no longer waits on a queued task behind the cap or the person's turn; a coordinator that relied on that wait now gets the reason at once and must collect again later.
- The parser's wider labels could read a bullet as a label in an unfilled section; a plain label always wins.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| task-orchestrator | 0.5.5 in the tree, uncommitted; published library copy stays 0.5.4 until the human publishes |
| `ARCHITECTURE.md` *Observed, not guaranteed* | the end-note wake seen live on the desktop; the test-mock visibility limit and the cap re-check recorded |

Next: the human runs `/reload-plugins --force` (or opens a fresh session), then one `dispatch`/`collect` round on 0.5.5; then the commit `(TASK-0234)`.

## Execution log


- 2026-11-05 · Claude Code (Fable 5.1, coordinator) · opened from the plan; two read-only sweeps (code, records) found no recorded "report never arrived" defect, four code paths that produce it.
- 2026-11-05 · Claude Code (Fable 5.1, coordinator; workers sonnet/high, sonnet/high, haiku/medium) · T1 builder (sonnet/high) landed the five fixes, 80 tests; R1 reviewer (sonnet/high) found four defects (a dependant of a running task no longer waited on, a cancelled task's dependant reads running forever, reset ignores an outstanding hand-off, bullet labels inside a filled section); T1 retry closed them, 84 tests; D1 (haiku/medium) wrote README, ARCHITECTURE, DEVELOPING and bumped plugin.json to 0.5.5. `tests/test-mods.sh --mod task-orchestrator` PASS 84; `scripts/check-mods.py` clean. Found in passing: `skills/mod-dev/SKILL.md` names `scripts/mod-dev.sh`, which does not exist (the stages are `dev-mods.py`, `check-mods.py`, `check-mod-status.py`).
  - Evidence: `tests/test-mods.sh --mod task-orchestrator` → `PASS task-orchestrator:  84 pass`
  - Evidence: `python scripts/check-mods.py` → no `MOD SHAPE` line
- 2026-11-05 · Claude Code (Fable 5.1) · live on 0.5.5: five scouts (haiku/low, each handed off and adopted). Found: a worker ending during a `collect` is not seen by that collect (L5: ended at 2.3 s, collect waited 8.9 s, answered running; L4 the same). The wait inside `collect` therefore never catches a subagent; only the end note does. Pre-existing, recorded in ARCHITECTURE.md; a design change (collect returns at once unless a session is pending) is a task of its own.
  - Evidence: timestamps 23:25:31.869 → 23:25:40.673 around `collect ["L4"]` (L4 ran 7124 ms); 23:26:14.473 → 23:26:23.390 around `collect ["L5"]` (L5 ran 2322 ms); both answers `still running`
- 2026-11-10 · closed by the coordinator of TASK-0265: TODO and GOALS already marked it done; the live check stays owed as recorded
