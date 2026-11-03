# TASK-0215 — agent-watch 0.8.0: the band follows the run

## Status

- Status: in progress
- Owner: agent (Claude Code)
- Created: 2026-11-03
- Updated: 2026-11-03
- Applies to: `mods/agent-watch/` (0.7.0 → 0.8.0)
- Source: the human's screenshots of 2026-11-03 (band `7/7 STEPS · ALL DONE · 1 RUNNING` beside a Sessions panel at `S01 · ORCH BALANCED 4/7`, T3 running, T4 and R3 queued) and "the bar is not as clear as the Sessions panel, what can we improve?"; the proposal; "Yes, do it here"

## Objective

The band above the prompt says what the Sessions panel says: while a task-orchestrator run is open it shows the run's progress and what is running and waiting, and it never says ALL DONE while anything runs or waits.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/agent-watch/` 0.7.0 | `band.tsx` `drawMeter` reads the app's task list (`progressOf(tasks)`): `n/n STEPS`, `ALL DONE` when every step is checked, the running agents' identity glyphs, `N RUNNING` |
| the app's task list | ticked off by the coordinator's `wrap_up` at each turn's end, while the orchestrator's run goes on |

## Findings (2026-11-03)

- **The band counts the wrong thing during a run.** `7/7 STEPS · ALL DONE` came from the task list, which `wrap_up` completes every turn; the ledger was at 4/7.
- **The panel's top row has the same fault.** `THIS SESSION · DONE 4/7` with a running member.
- **Two different counts share the word STEPS.**
- **The band's running glyph is the agent's identity glyph**, a hollow square that reads as the panel legend's QUEUED; the legend's running mark is a cyan `●`.
- **The band does not say what runs or waits**: no task, role, elapsed time, or queued count.

## Scope

- In: with an open orchestrator run, the band's meter is one mark per ledger task in the panel's state colours and glyphs, its count `n/m TASKS`; the running task named (`T3 · builder · <objective>`, elapsed), the queued count and what they wait on; `ALL DONE` only when nothing runs or is queued; with no run, the band as today, except that it no longer says `ALL DONE` while an agent runs (the coordinator's decision, 2026-11-03: that is the fault the human reported). A session whose member runs or waits is never DONE in the panel's top row. The running mark is the legend's `●`. Presses as today (task name → Agents pane, `●` → that agent's transcript). Tests; README; 0.8.0.
- Out: task-orchestrator's code; Compass's own board; the sunburst.

## Likely files

- `mods/agent-watch/hooks/{band.tsx,sessions.ts,sigma.tsx}`, their tests, `README.md`, `DEVELOPING.md`, `.claude-plugin/plugin.json`

## Acceptance criteria

- [x] With a run of 7 tasks, 4 done, 1 running, 2 queued: the band reads `4/7 TASKS`, names the running task, says `2 QUEUED`, and not `ALL DONE`, whatever the task list says
- [x] With no run, the band is unchanged, except it no longer says `ALL DONE` while an agent runs
- [x] The panel's top row is not DONE while a member runs or is queued
- [x] The band's running mark is the legend's `●`
- [ ] Seen live in the desktop app's band during an orchestrator run

## Mandatory validations

- [x] tests/test-mods.sh --mod agent-watch
- [x] python3 scripts/check-mods.py
- [x] the new tests red-proved against 0.7.0's source

## Risks and rollback

- The band has one row; on a narrow window the objective is cut first, then the queued text.
- Rollback: git revert the task commit.

## Outputs / handover

(filled at close)

## Execution log

- 2026-11-03 · Claude Code (Opus 5.5) · opened from the human's screenshots; dispatched to an isolated builder beside TASK-0201
- 2026-11-03 · Claude Code (Opus 5.5) · A1 built it in its own worktree (130 pass; 5 tests failed at 0.7.0's `band.tsx` and `sessions.ts`); its diff copied into the checkout; RA1 not ready (no-run ALL DONE rule, a member-less open sub-session, a final-state test gap); A2 fixed the last two and the scope records the first, each new test red-proved; RA2 ready; `tests/test-mods.sh --mod agent-watch` 131 pass, `check-mods.py` OK (5 mods), run by the coordinator; the live check is the human's
