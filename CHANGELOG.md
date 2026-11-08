# Changelog

## vault-secrets 2.4.0
- Opt-in vault_role selects session-issued scoped tokens, native OS keychain storage, LDAP/TOTP and fail-closed pre-exec revocation (TASK-0259, ADR-0057). Agent tokens use inherited pipes only; launcher/native live checks are pending in B-074. Legacy repositories and ai-toolbox push authentication remain unchanged; provision is retained but superseded for aligned development.

## agent-watch 0.13.1, task-compass 0.12.1
- Daylight reads on a desktop (`TASK-0241`). A desktop draws a `Button` natively, its label in the desktop's own colour whatever the `Text`s in it say, so the Compass Sprints rows, `‹ PREV`, `NEXT ›`, `↺`, the fold toggles and agent-watch's table rows and `OPEN TRANSCRIPT` drew near-white on Daylight's light panel. The shared `sigma.tsx` gains `kit().pressable`: on a desktop the words are a `Text` in their token and the Button is laid over them with a blank label; the terminal keeps its Buttons. A control's words take `controlToken()`: `text-3` in Daylight (its `line-strong` is 3.7:1, a line), `line-strong` in Night ops as before. The Daylight sunburst follows SIGMAorbital: opaque slices in their state's colour stepped by depth (100%, 62%, 36%) on 1.5px `surface` gaps, a label on a fill in `on-ink` where it holds 4.5:1 and otherwise on a `surface` plate in text-1 and text-3; Night ops draws as before. Tested in the mod test kit (contrast of every Text in both panes); not yet seen live: that a press lands through the overlay and the blank Button paints nothing.

## agent-watch 0.13.0, task-compass 0.12.0, switchboard 0.7.0, task-orchestrator 0.5.9
- Every mod's command takes `theme dark|light|auto` (`/agent-watch`, `/compass`, `/switchboard`, `/orchestrate`) to set its SIGMAorbital colours by hand, because the desktop app's light/dark switch does not reach the `theme` setting the mods follow (`TASK-0240`, `B-072`). The pin is kept in the mod's `$.store`, wins over the setting and survives a change of it; `auto` follows the setting again. The shared `sigma.tsx` gains `themeArg`, `setTheme` and `THEME_USAGE`. Tested in the mod test kit.

## agent-watch 0.12.1
- Each session keeps its rows under its own store key, `agent-watch:rows:<session id>` (`TASK-0250`). Under the one shared key of 0.11.2 to 0.12.0 the last session to write won, so with two sessions loading the mod a `/reload-plugins --force` could restore nothing of its own (seen live 2026-11-07). Rows under the shared key are still restored for their own session and moved; kept rows not written for a week are deleted at `session.start`. Tested in the mod test kit (169).

## agent-watch 0.12.0, 0.11.3
- A background run that prints `step <n>/<m> <label> <ok|FAIL>` per finished step, relayed by a Monitor tailing its output file, fills its Sessions row step by step: `n/m` in the STEPS cell and arc, `n/m STEPS · <last>` or `· FAIL <label>` in the caption, FAILED from the first `FAIL` on (`TASK-0249`). The Monitor is tied to the run by the task id its command names and draws no row of its own. A Monitor's event is no longer taken for its end, which drew every monitor done at its first event. 0.11.3: a PowerShell command run in the background, or moved there at its timeout, is a shell row like a Bash one. Tested in the mod test kit (166) and live from the store's rows; not yet seen in the pane.

## Mods layout
- A mod keeps its Claude Code plugin under `mods/<name>/claude/` (`TASK-0233`, `ADR-0054`); `core/` and other harness folders are added when a second harness needs them. `check-mods.py` requires `claude/.claude-plugin/plugin.json`. Mod versions are unchanged.

## task-orchestrator 0.5.8
- From the 0.5.7 review (`TASK-0239`), four verified high findings closed. Ledger writes are race-free: `dispatch` adds its row inside the atom's updater, `queued → running` is a compare-and-set, the settles after a spawn, an end, a session read, a cancel or an adoption apply only while the row still has the status they expect, ticks run one after the other, `cancel` of a row still starting says so, and a cancel starts what queued behind it. Trust boundary: the hidden note and the toast carry id, role and status only; a worker's `Next:` is one bounded line; a dependency's findings enter the next assignment as quoted data; a project's `.claude/task-orchestrator.json` may only narrow the limits, its `optIn` is refused and nothing from it is persisted (`status` lists what was refused). State scoped: settings are stored per project (`task-orchestrator:settings:<path>`; `/orchestrate on` is needed once more per project), the run per session (`task-orchestrator:run:<session id>`), and a session whose first prompt is an `# Assignment` header never becomes a coordinator. The hand-off is a first-class state: it holds its slot and the writer lock, the run is `running`, dependants wait for the Agent call instead of being told to re-dispatch, and the no-verdict is remembered so later starts hand off at once. Reviewed before the commit: the review found that `/orchestrate opt-in` and `providers` were no longer persisted and that a `__proto__` key could raise a limit; both fixed. 99 tests.

## agent-watch 0.11.2, task-orchestrator 0.5.7
- A `/reload-plugins --force` emptied both mods' `$.state` mid-run (seen live 2026-11-06: the Sessions panel restarted at B01/S01, `status` said `No task in the ledger`). agent-watch's rows and the orchestrator's run are now mirrored into the plugin store on each change (`agent-watch:rows`, `task-orchestrator:run`) and restored at `session.start` when the atoms are empty and the stored rows carry this session's id; another session's rows are never restored (`TASK-0238`). Tested in the mod test kit; the forced reload itself is the task's live check.

## agent-watch 0.11.1
- The Sessions table's STATE cell draws its glyph and word on one line on the desktop (`TASK-0232`), as the SESSION column does.

## task-compass 0.11.1
- agent-watch's meter and Sessions panel sit under the board in either load order (`TASK-0231`): the board's box no longer holds the pane's full rows (`minHeight`), which pushed them below the visible pane when agent-watch loaded first. Tested in the mod test kit; not yet seen live.

## agent-watch 0.11.0
- The band shows task-orchestrator's state while it is idle (`TASK-0230`): `ORCH <POLICY> · IDLE` with nothing else to show, and an `ORCH <POLICY>` label in the run and meter lines, dropped first when narrow. Tested in the mod test kit; not yet seen live.

## Gates MCP server: hardened execution (issue #6)
- Each gate runs in `bwrap`: read-only root, private `/tmp`, `$HOME` hidden, no network, cleared environment (`PATH`, `HOME=/tmp`, `LANG` only), all capabilities dropped. The command allowlist alone is not the security boundary.
- `argv[0]` is resolved on absolute `PATH` entries and refused if it lives inside the repository. `env`, `xargs`, `sudo` and similar are never allowed; shells and interpreters (`sh`, `bash`, `python`, `node`, `npx`, `uv`, `make`, `git`, …) also need `GATES_ALLOWED_LAUNCHERS`. A `cwd` outside the repository is refused. The spec reaches the watchdog over stdin, not a file.
- **Upgrade:** set `GATES_MAP_SHA256` to `sha256sum gates.json | cut -d' ' -f1` (the map is hashed and parsed from the same bytes), set a command allowlist (starter: `GATES_ALLOWED_EXECUTABLES=pytest,ruff,npm,cargo`), list any launcher you need in `GATES_ALLOWED_LAUNCHERS`, and install `bubblewrap`. `GATES_SANDBOX=none` is for tests only.
- CI: `gates-sandbox` exits 77, an allowed failure shown as a warning, when the runner cannot create user namespaces. The sandbox is then not tested in CI; any other failure still fails the pipeline.

## Unattended runs: hash-chained journal (issue #14)
- Every journal line carries `prev`, the SHA-256 of the previous line. Check it with `skills/unattended-ops/scripts/journal-chain.py verify <journal> [--head <sha256>]`.
- The driver records the final head as `Journal head: <sha256>` in the handover and as `journal-head:` on stdout. On resume it halts if the journal no longer chains up to the head in the handover.
- Appends hold an exclusive `flock` on the journal.
- **Migration:** a journal from before this change keeps its unchained lines. The first append after the upgrade writes `{"event": "chain-start", "prev": "000…0"}`, and `verify` checks from that marker on. You don't need to do anything, but the legacy lines before the marker are not verified.

## Agent eval suite (#10)
- `evals/`: golden tasks for adjudicator verdict accuracy, refuter recall on seeded defects and injection resistance; `evals/run.py` scores them against `evals/thresholds.json`. Mock provider by default and in MR pipelines; real providers (xAI, OpenAI) only in a scheduled master pipeline (`.gitlab/ci/evals.yml`).

## Live-verification gate (#9)
- A mod leaves `experimental` only with a recorded live session per feature: `status.json`'s `live_verification` records for the current `plugin.json` version, each pointing at an `.ai/sessions/` record, all `pass`, and a README with nothing "not yet seen live". `scripts/check-mod-status.py` enforces it from `tests/validate.sh` (with a self-test). `loops/release-check` gains step 3a.

## Mod status: experimental (#5)
- Every mod feature is experimental during the development stage (Armando, 2026-11-04). Each mod carries `status.json` (`status`, `reason`, `live_verification`), its README says so, and `docs/registry.md`'s Mods table has a Status column. `tests/validate.sh` fails a mod without a status, or with any status but `experimental`, until the live-verification gate (#9) exists.
- `scripts/install.sh` still deploys every mod by default; labelling them experimental in its output is a separate MR.

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
