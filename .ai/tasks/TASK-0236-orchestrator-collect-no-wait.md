# TASK-0236 — task-orchestrator 0.5.6: collect waits for sessions only

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-06
- Updated: 2026-11-06
- Applies to: `mods/task-orchestrator/`
- Source: TASK-0234's live finding, 2026-11-05: a subagent's end is never seen inside a `collect`; the design change was named a task of its own.

## Objective

`collect` returns at once when no session task is pending. A subagent's `turn.complete` reaches the mod only after the coordinator's `collect` hook has answered, so the wait could never catch one and only spent the hook's budget; the end note is what wakes the coordinator. The wait, with its ~8.5 s ceiling, stays for session tasks read through the app.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `claude/hooks/register.tsx` `isPending` | a running subagent counts as pending; a queued task that can start now too |
| `claude/hooks/register.tsx` `answerCollect` | only the named tasks' sessions are refreshed, so a session a named task waits on is never read during the wait |
| `ARCHITECTURE.md` *Observed, not guaranteed*, 2026-11-05 | records the finding; no rule in *Enforced in code* |

## Scope

- In: `isPending` and the refresh loop, the tests that assumed a mid-wait end, README and ARCHITECTURE, version 0.5.6.
- Out: the end note itself, the hook budget, the cap re-check after a dependency ends (ARCHITECTURE *Observed*, "Cap after a dependency ends").

## Likely files

- `mods/task-orchestrator/claude/hooks/register.tsx`, `register.test.tsx`, `README.md`, `ARCHITECTURE.md`, `claude/.claude-plugin/plugin.json`

## Execution plan

1. `isPending`: pending is a running session with a session id (not refused), or a task queued behind dependencies that are all pending; `startable` dropped.
2. The refresh loop reads the named tasks and their transitive dependencies, so a `collect ["R"]` sees R's session dependency end.
3. Tests: the 0.5.5 mid-wait test replaced by a subagent one (answers at once, names what it waits on) and a session one (waits until the session's third read ends it, then R shows started); a collect on a running subagent answers within one clock tick; the abort test moved onto a session.
4. README `collect` paragraph, ARCHITECTURE row and 2026-11-05 item, `plugin.json` 0.5.6.

## Acceptance criteria

- [x] `collect` on a running subagent answers within one clock tick, with `still running: do not poll …` unchanged
- [x] `collect` on a task queued behind a running subagent answers at once with `queued, not started: waiting on <id>`
- [x] `collect` on a task queued behind a running session waits, reads that session each pass though it was not named, and shows the task started once the session ends
- [x] An aborted wait still answers `collect stopped after N ms (<reason>): call again`
- [x] README, ARCHITECTURE (*Enforced in code*, the 2026-11-05 item), `plugin.json` 0.5.6
- [x] Live, 2026-11-06 after `/reload-plugins --force`: `collect` on running L6 answered in 0.24 s (17:19:09.174 → .411) with `still running: do not poll`; the end note arrived and one `collect` printed the full report (on 0.5.5 the same call took 8.9 s)

## Mandatory validations

- [x] `cd mods && claude plugin test task-orchestrator/claude`: 86 pass, 0 fail
- [x] `python scripts/check-mods.py`: clean
- [x] `tests/validate.sh`: run by the pre-commit hook on this host, passing since TASK-0235

## Risks and rollback

- A coordinator that relied on `collect` to hold about eight seconds while a subagent worked now gets its answer at once and must end its turn (or do other work) until the end note arrives, as the protocol already says.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| task-orchestrator | 0.5.6 in the tree, uncommitted; the published library copy stays behind until the human publishes |
| `ARCHITECTURE.md` | the sessions-only wait is a rule in *Enforced in code*; the 2026-11-05 item names what is still unseen live |

Next: the human runs the live check above, then the commit `(TASK-0236)`.

## Execution log

- 2026-11-06 · Claude Code (Fable 5.1, side session of the 0.5.5 coordinator) · `isPending` reduced to sessions; the refresh loop widened to the named tasks' dependencies (found while writing the session counterpart test: `collect ["R"]` never read R's session dependency); three tests replaced or added, one moved onto a session. The brief named TASK-0235 for this file; that id was already taken by the Windows gate task, so TASK-0236.
  - Evidence: `claude plugin test task-orchestrator/claude` → `86 pass, 0 fail`
  - Evidence: `python scripts/check-mods.py` → no `MOD SHAPE` line
- 2026-11-06 · Claude Code (Fable 5.1, coordinator session) · live check as the box describes; committed through the pre-commit gate.
  - Evidence: timestamps around `collect ["L6"]`: 17:19:09.174 → 17:19:09.411, answer `still running`; after the note, `collect` printed findings, files, checks, evidence, risks
