# Changelog

## Unattended runs: hash-chained journal (issue #14)
- Every journal line carries `prev`, the SHA-256 of the previous line. Check it with `skills/unattended-ops/scripts/journal-chain.py verify <journal> [--head <sha256>]`.
- The driver records the final head as `Journal head: <sha256>` in the handover and as `journal-head:` on stdout. On resume it halts if the journal no longer chains up to the head in the handover.
- Appends hold an exclusive `flock` on the journal.
- **Migration:** a journal from before this change keeps its unchained lines. The first append after the upgrade writes `{"event": "chain-start", "prev": "000…0"}`, and `verify` checks from that marker on. You don't need to do anything, but the legacy lines before the marker are not verified.

## task-orchestrator 0.5.0
- Session workers (`TASK-0201`, `ADR-0050`): `dispatch` takes `runAs: "session"` for a task the person asks to run as a session. The mod answers with the `start_session` call to make, adopts that call into the task by its assignment header, reads the session id from the result, and collects through `get_session` and `list_events`. A session worker takes its own worktree, has no write fence, and starts only on a turn the person started.
- `ADR-0041` clause 5 is narrowed by `ADR-0050`; subagents are unchanged.
- Seen in a spike only (2026-11-03): the hook saw `start_session` and its result, and `get_session` confirmed a Sonnet 5.5 child's requested model and effort. Not yet run live: the adoption itself, two session workers side by side, auto mode.
- The effort warning follows what ran: `dispatch` no longer says a host `modelSettings` effort "may replace" the request; a worker whose observed effort differs from its requested one carries `effort mismatch: requested X, observed Y`, naming the host setting if one is set, in `status` and `collect`. Seen 2026-11-03: three workers ran at their requested effort under `modelSettings.claude-sonnet-5-5.effortLevel = xhigh`.
- A session task waiting for the person's turn holds no worker slot.

## Mod preview and dev-mods copy
- `scripts/preview-mods.py` draws each mod's `preview/*.scene.tsx` in the test kit and lays the trees out in `build/preview/index.html`; `--serve` rebuilds on save (`TASK-0217`).
- `scripts/dev-mods.py` copies mods into a session's dev-mods folder as files, since a link may not reload.
- task-compass 0.9.2 prints `COMPASS <version>` after the board's legend on the desktop.

## Mod preview 2
- Scenes on a shared kit (`TASK-0219`): sizes, surfaces and presses asked from the served page and drawn through the test kit; the terminal on a character grid with Ink's rules; the light theme from each mod's tokens; committed snapshots with `--snapshot` and `--check`, a CHANGED badge and a PNG per drawing; fixtures shared by each mod's tests and scenes.

## agent-watch 0.8.1
- On the desktop, `AGENT-WATCH <version>` under the Sessions table.
- In Compass's pane one blank row parts the Sprints board from the meter and the Sessions panel, with or without a meter (`TASK-0216`).
- On the desktop the Sessions panel keeps its KPI row and selected panel at any height; the pane scrolls.

## agent-watch 0.8.0
- The band follows task-orchestrator's run (`TASK-0215`): while a ledger task is open, one mark per task in the Sessions panel's glyphs and colours, `n/m TASKS`, the running task with its elapsed time, `N QUEUED · WAIT ON <id>`; never `ALL DONE` while anything runs or waits, with or without a run.
- A session with a running or queued member, or an open sub-session, is never `DONE` in the Sessions panel.
- Tested in the mod test kit; not yet seen live.

## 0.1.0
- Scaffolded harmonized structure (component layer + .ai governance layer).
