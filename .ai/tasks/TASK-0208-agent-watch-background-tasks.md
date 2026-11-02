# TASK-0208 — agent-watch 0.7.0: the Sessions panel shows background tasks

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-02
- Updated: 2026-11-02
- Applies to: `mods/agent-watch/` (0.6.0 → 0.7.0), `ADR-0049`
- Source: the human, 2026-11-02: a 30+ minute `python3 .unattended/driver.py …` run, started as a Bash call with `run_in_background: true`, never appeared in the Agents pane or in Compass's; the panel said `0 RUNNING` and read as agent-watch failing.

## Objective

The Sessions panel (and so Compass's pane, `ADR-0048`) draws the session's background `shell` and `monitor` tasks as rows under the session whose loop started them: description, elapsed time, state (running, done, failed, stopped) and the exit code when one is known, coloured by state (`ADR-0046`). The header's `N RUNNING` counts them.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/agent-watch/` 0.6.0 on `4da334a` | tracks agents, Workflow runs and the orchestrator's ledger; no background task |
| the engine's types (2.1.309, the skill's copy) | Bash's result carries `backgroundTaskId` (and `timedOutAfterMs`, `backgroundEndsWithFinalResponse`), Monitor's `taskId`, TaskStop's `task_id`; `classic.Stop` and `classic.SubagentStop` carry `background_tasks: BackgroundTaskSummary[]`, the in-flight list; a task's end is a `prompt.submit` with `origin.kind: 'task-notification'`; a `UserMessage` row's `task` (id, status) is readable only while drawing, when state writes are refused |

## Scope

- In: a `background` list in `$.state`, opened from the Bash and Monitor `tool.call` results (the most direct source: the engine names the task's id there), ended by its notification (`<task-id>`, `<status>`, `exit code N`), by TaskStop's result, by its owner subagent's end when the command dies with it, and reconciled with `classic.Stop`'s in-flight list (adds a task it names that is untracked; ends a tracked one it no longer names). Rows as members of the owning session, a new member kind with its own code (`B01`); the KPI row's FAILED and the header's running count include them; the AGENTS block does not. Subagent and workflow tasks are never added (already agents or runs).
- Out: the band and the status line (they count agents, which a background shell is not); reading an unattended-run driver's `journal.jsonl` to show its roles and verdicts (a possible follow-up, the human's call); changing Compass.

## Likely files

- `mods/agent-watch/types/index.d.ts`, `hooks/{model.ts,sessions.ts,sunburst.ts,panel.tsx,register.tsx}`, tests `hooks/{model.test.ts,sunburst.test.ts,register.test.tsx}`
- `README.md`, `DEVELOPING.md`, `.claude-plugin/plugin.json`; `.ai/decisions/0049-…`; state, board, todo, `docs/registry.md`

## Execution plan

1. Pure model: `bgStarted`, `bgEnded`, `bgNotified` (parse), `bgReconciled`, `bgOwnerEnded`; tests.
2. Tree and chart: background members, `B` codes, not agents in `chartAgents`; tests.
3. Hooks: `tool.call` (Bash, Monitor, TaskStop), `prompt.submit`, `classic.Stop`, the owner's `turn.complete`, the busy tick; panel header; tests through the engine stub.
4. Red-prove each new test; gates; docs, ADR, version, records; one commit on the branch, no push.

## Acceptance criteria

- [x] A background Bash call shows as a running row under THIS SESSION with its description and elapsed time; the header says `1 RUNNING` with no agent.
- [x] Its notification ends it DONE, or FAILED with `EXIT n`; TaskStop ends it STOPPED.
- [x] `classic.Stop`'s list adds an untracked shell task and ends a tracked one it no longer names; a `subagent` entry is never drawn.
- [x] A task started in a subagent's loop sits under that subagent's session or this session as its owner says, and ends with the subagent when the engine says the command dies with it.
- [x] Every new test fails with its change reverted.
- [x] Live (the human): a background command in a terminal session with the worktree's mods shows one row, running, then ended (2026-11-02).

## Mandatory validations

- [x] tests/test-mods.sh --mod agent-watch
- [x] tests/validate.sh
- [x] python3 scripts/check-mods.py

## Risks and rollback

- The notification's text format is not in the types; parsed from the `<task-id>` and `<status>` tags it carries. A notification the parse misses leaves the row to `classic.Stop`'s reconciliation, which ends it DONE without an exit code; `cc-plugin-sec-default` may bypass classic hooks (`TASK-0182`), so a missed notification there can leave a row running.
- Rollback: git revert the task commit; nothing lands on master before the human's live check.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mods/agent-watch/` 0.7.0 | background shell and monitor tasks as rows of the Sessions panel |
| `ADR-0049` | accepted: a background task is a member kind of its session |

Next: none. A follow-up, if wanted: an unattended-run driver's `journal.jsonl` (roles and verdicts) inside its row.

## Execution log

- 2026-11-02 · Claude Code (Opus 5.5) · brief written before the build
- 2026-11-02 · Claude Code (Opus 5.5) · built; tested in the kit; not landed
  - Evidence: `tests/test-mods.sh` → agent-watch `126 pass` (113 before), all five mods pass; `tests/validate.sh` → `validate.sh: OK`; `python3 scripts/check-mods.py` → `OK (5 mods)`; `claude plugin validate agent-watch` → passed (the icon warning only).
  - Evidence, red-proof: each piece reverted alone made its tests fail, then restored: the result opening a task (5 fail), the notification hook (1), the notification on any origin (1), TaskStop (1), `classic.Stop` (1), the owner's end (1), the header count (6), the members (7), the owner of a member (1), AGENTS excluding tasks (1), the exit-code caption (2), `B` codes (2), `chartAgents` (2), a non-zero exit failing (1), the in-flight filter (2), the timeout backdating (1).
  - Deviation: the owner's-end test first passed with its hook removed (another path in the kit ends the task as DONE); it now asserts STOPPED, which only that hook gives.
  - Not run: the real engine. Unseen: the notification's text, the in-flight list's ids and `type` words (a different id would draw one task twice), a Ctrl+B or timed-out command, and the cost of the one-second redraw while a long task runs.
- 2026-11-02 · the human, terminal, the worktree's mods · live check; done
  - Evidence: `--debug-file` → both `--plugin-dir …/unruffled-wescoff-c3c395/mods/{task-compass,agent-watch} is one plugin`; `sleep 90; exit 3` drew `B01 · shell · Live check sleep` RUNNING, `1 RUNNING`, `AGENTS 0`, caption `$ sleep 90; exit 3`, then FAILED, `EXIT 3`, `1m30s`, `0 RUNNING`, in the Agents pane and in Compass's. Only the notification's parse gives an exit code, so that path ended it.
  - Finding: `[agent-watch] its classic.Stop hook was skipped. "cc-plugin-sec-default" runs first` (and `classic.SubagentStop`): on this host the in-flight reconciliation never runs, as the risk above said.
  - Not seen in the pane: the TaskStop and Monitor rows (the session's own transcript reports both tools behaving); a Ctrl+B or timed-out command.
