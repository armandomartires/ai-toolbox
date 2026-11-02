# TASK-0207 — task-compass 0.9.0, agent-watch 0.6.0: Compass's pane carries agent-watch's panel and meter

## Status

- Status: review
- Owner: agent (Claude Code)
- Created: 2026-11-02
- Updated: 2026-11-02
- Applies to: `mods/task-compass/` (0.8.1 → 0.9.0), `mods/agent-watch/` (0.5.0 → 0.6.0), `scripts/check-mods.py`, `ADR-0045`, `ADR-0047`, `ADR-0048`
- Source: the human, 2026-10-31: Compass "only after" agent-watch is "completed and validated", to "avoid code and functionality duplication"; 2026-11-02: "Start stage 2", and "the compass should also include the progress bar over this text box", answered as "Compass shows agent-watch's bar"

## Objective

Stage 2 of two. Compass's pane draws its Sprints board and then what agent-watch contributes: the Sessions panel and agent-watch's progress meter (the `▰▰▱ n/m STEPS` bar above the prompt), with no Sessions code, `sessions.ts` copy, `sunburst.ts` or mirror of agent-watch's state left in Compass. The board must never be lost: the first attempt (`a273657`, `TASK-0205`) made it vanish in the live desktop app, cause unknown.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/agent-watch/` 0.5.0 on `40451ee` | draws the Sessions panel in its own pane; no hook on Compass's pane |
| `a273657` on `agent/agent-watch-redesign` | the Compass half (slot, deletions, gate rule 7 and its test) and agent-watch's `contributeSessions`; `Pane` hooks by `requestId`; read-only source |
| the engine's types | a `ui.render` hook's tree must validate as a whole; an invalid hook is skipped and what `next(e)` returned stands, so a Compass tree that fails with the contribution embedded would leave the contribution alone on screen |
| keys and hotkeys | the real trees share none (Compass `h`, `c`, `l`, `k`; the panel `s`); read from source, 2026-11-02 |

## Scope

- In: Compass's pane hook calls `next(e)` and places the result after its board; Compass's Sessions code, `sessions.ts`, `sunburst.ts`, the `Watch` mirror and the flat fallback go; agent-watch hooks Compass's pane (`COMPASS_PANE`, `contributeSessions`) and adds the meter before the panel; gate rule 7 loses the `sessions.ts` entry; a debug-log line on each side naming what `next(e)` resolved to, so a live failure is diagnosable; `ADR-0048`, notes on `ADR-0045` and `ADR-0047`; docs and versions.
- Out: the band above the prompt (unchanged, still agent-watch's); Compass's board; task-orchestrator; switchboard.

## Likely files

- `mods/task-compass/` (the `a273657` state), `scripts/check-mods.py`, `tests/test-check-mods.sh`
- `mods/agent-watch/hooks/{view.tsx,register.tsx,band.tsx,contribution.test.tsx}`, `README.md`, `DEVELOPING.md`, `.claude-plugin/plugin.json`
- `.ai/decisions/{0045,0047,0048}`, state, board, todo, `docs/registry.md`

## Execution plan

1. Port the Compass half and the gate from `a273657`; the Compass tests pass.
2. agent-watch: `contributeSessions` and a meter shared with the band; tests with a Compass stand-in, both load orders.
3. `ADR-0048`, docs, versions, records; gates; an independent review.
4. Live, off master first: the human runs both mods from this worktree in a terminal session and looks at `/compass`; only then master.

## Acceptance criteria

- [x] Compass holds no Sessions code, `sessions.ts`, `sunburst.ts`, agent-watch mirror or flat list (`grep`).
- [x] With both mods in either load order, Compass's pane shows its board, then agent-watch's meter and Sessions panel (kit tests with stand-ins; removing Compass's `next(e)` fails one).
- [x] Compass without agent-watch draws its board alone; agent-watch without Compass draws its own pane.
- [x] Live: the board survives with both mods loaded (the human, terminal, 2026-11-02).
- [ ] Live: a press on a row of the contributed panel selects it; the meter's progress bar draws in Compass (needs a task list). Not seen; both stay open to the first desktop session.

## Mandatory validations

- [x] tests/test-mods.sh
- [x] tests/validate.sh
- [x] the slot, contribution and engine-element tests red-proved

## Risks and rollback

- Seen live: the engine answers `engine` at the bottom of a `Pane` chain and the two real mods compose (agent-watch innermost). Unseen: presses in the contributed panel, the meter's bar, the reverse load order.
- Compass's board fills the pane's height, so the contribution sits below it and the pane scrolls.
- Rollback: git revert the task commit; before landing, nothing on master changes.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mods/task-compass/` 0.9.0 | the board, then what `next(e)` returns, minus core's own drawing; no Sessions code, `sessions.ts`, `sunburst.ts` or mirror; a debug line per change |
| `mods/agent-watch/` 0.6.0 | hooks Compass's pane (`COMPASS_PANE`) and adds the meter (`drawMeter`, the band's own) then the Sessions panel; leaves out core's drawing; a debug line per change |
| `scripts/check-mods.py`, `tests/test-check-mods.sh` | rule 7's table holds `sigma.tsx` only |
| `ADR-0048` | accepted; supersedes `ADR-0045` and `ADR-0047` clause 3 |

Next: land on master locally (no push yet); the first desktop session checks a press in the panel and the meter's bar.

## Execution log

- 2026-11-02 · Claude Code (Sonnet 5.5) · brief written before the port

- 2026-11-02 · Claude Code (Sonnet 5.5), one sonnet builder, one sonnet reviewer · built; review answered
  - Evidence: `tests/test-mods.sh` → agent-watch `113 pass`, task-compass `54 pass`; `tests/validate.sh` → `validate.sh: OK`; `python3 scripts/check-mods.py` → `OK (5 mods)`.
  - Review R2: no key or hotkey collision (Compass `h c l k`, the panel `s`; prefixes disjoint); one likely cause of `a273657`'s vanished board, inferred from the engine's types: core is the last hook and answers `{ type: 'engine', ref }`, which both hooks embedded.
  - Evidence, red-proof: the guard off in Compass → `Expected: defined`, `Received: undefined` for the board's text (the kit drops the tree), 2 fail; off in agent-watch → `Expected: length 0`, `Received: length 1`, 1 fail; restored → 54 and 113 pass. The earlier stand-in bases (`<Box/>`, `<Text>`) never exercised this.
  - Deviation: Compass's debug line logged `resolved nothing` after a rejection, hiding the cause; fixed as agent-watch's was.
  - Not run in the kit: the pair in a real app; see the live entry below.

- 2026-11-02 · the human, terminal · live run off master
  - Method: from the worktree with `CLAUDE_CODE_PLUGIN_DIRS` unset in the shell and passed as `--settings '{"env":{…}}'`, since `~/.claude/settings.json`'s own value beats a shell variable (a first run loaded the main checkout's 0.8.1 and 0.5.0 and proved nothing; the debug file's `is one plugin` lines name which checkout loaded).
  - Evidence: `--debug-file` → `agent-watch: next(e) resolved object (type engine)` and `task-compass: next(e) resolved object (type Box)`; board intact; `■ 1 RUNNING` and the Sessions panel below it, `A02` RUNNING beside `A01` DONE while an Explore agent ran; the pane scrolled; no render error or skipped tree in the log.
  - Evidence, cost: a steady 60 s with an agent running → 255 pane renders, 27.6 ms average, 77.5 ms maximum (about 12% of one worker); idle about 3 per 10 s.
  - Not seen: a press on the contributed panel's rows (the log records none); the meter's bar (the session had no task-list tool); the reverse load order.
