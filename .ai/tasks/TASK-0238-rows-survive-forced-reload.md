# TASK-0238 — agent-watch 0.11.2, task-orchestrator 0.5.7: the rows survive a forced plugin reload

## Status

- Status: in review
- Owner: agent (Claude Code)
- Created: 2026-11-06
- Updated: 2026-11-06
- Applies to: `mods/agent-watch/`, `mods/task-orchestrator/`
- Source: live, 2026-11-06 (desktop 2.1.318, auto mode): after `/reload-plugins --force`, run to pick up an edited mod, `status` printed `No task in the ledger` and the Sessions panel restarted at B01/S01, while the app's Background tasks pane still listed all 11 earlier tasks.

## Objective

A forced plugin reload keeps every agent, orchestrator and background-task row. `$.state` survives a plain reload (the engine's types and the docs' *Keep state* table say so); the docs say `--force` only applies a reload the prompt-cache guard refused, one that adds or removes a plugin MCP server, and say nothing of state. The likely cause, not confirmed from the engine's source: the forced reload replaces the plugin instance and the host's values with it, and `session.start` runs on an empty slate. So each mod mirrors its rows into `$.store`, which is kept between sessions and reloads, on every change, and restores them at `session.start` when the atoms are empty and the stored rows carry this session's id.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `claude/.claude-plugin/types/claude-code/index.d.ts`, `$.state` | "plain data that survives a hot reload of the plugin's code"; `$.store` "kept between sessions and hot reloads" |
| `mods/agent-watch/claude/hooks/register.tsx` | every row write is an `update` of a `$.state` atom, nothing stored |
| `mods/task-orchestrator/claude/hooks/register.tsx` | the ledger and `unavailable` in `$.state`; the store holds settings and the audit only |

## Scope

- In: a `keep.ts` per mod (write-through on change, restore on start, same session id only), the write sites, tests, DEVELOPING and ARCHITECTURE, the patch versions.
- Out: the engine's reload behaviour itself; task-orchestrator's `delivered` set and `protocolSent`, module variables that start over (a report prints once more, the protocol rides once more); `/clear`, which starts a new session id and restores nothing by design.

## Likely files

- `mods/agent-watch/claude/hooks/keep.ts`, `register.tsx`, `register.test.tsx`, `DEVELOPING.md`, `claude/.claude-plugin/plugin.json`
- `mods/task-orchestrator/claude/hooks/keep.ts`, `register.tsx`, `register.test.tsx`, `DEVELOPING.md`, `ARCHITECTURE.md`, `README.md`, `claude/.claude-plugin/plugin.json`
- `CHANGELOG.md`

## Execution plan

1. Establish the fact: the types and docs on `$.state` across reloads, and what `--force` is documented to do.
2. `keep.ts` in each mod: `keep` (JSON compared to the last write; nothing written while nothing was ever held), `restore` (session id read at start; atoms empty; stored id equal). Function declarations, since the scan follows `$` only into those; `update` keeps its literal atom at every site (a generic wrapper fails the scan).
3. Each `update` of a row atom followed by `keep`; `restore` at `session.start` (agent-watch after the theme, the orchestrator after the config); `reset` clears the assignments before the writes so the store sees them gone.
4. Tests with the store answered by the test (seeded and read): write-through, restore on start, a plain second start restores nothing, another session's rows never restored.
5. Docs, versions, changelog.

## Acceptance criteria

- [x] agent-watch: each change of `agents`, `tasks`, `runs`, `tones` or `background` writes `agent-watch:rows` with this session's id, when the rows changed; an idle start writes nothing
- [x] agent-watch: a `session.start` on empty atoms restores this session's rows (the pane shows them, a new agent takes the next number); on held rows it restores nothing
- [x] agent-watch: rows stored under another session id are never restored, and the first change of this session takes the key over
- [x] task-orchestrator: each ledger write mirrors the ledger, the refused models and the assignments into `task-orchestrator:run`; a restored run's worker end still closes its task, and a dependant dispatches after it
- [x] task-orchestrator: a run stored under another session id is never restored
- [x] DEVELOPING (both), ARCHITECTURE (*Enforced in code* row, 2026-11-06 item), README store line, CHANGELOG, plugin.json 0.11.2 and 0.5.7
- [ ] Live: in a desktop session with both mods loaded and `/orchestrate on`, dispatch one task and start one background shell, then run `/reload-plugins --force` mid-run; expect the Sessions panel to keep its rows and numbering and `status` to list the task; then let the worker end and see one `collect` print its report

## Mandatory validations

- [x] `cd mods && claude plugin test agent-watch/claude`: 158 pass, 0 fail
- [x] `cd mods && claude plugin test task-orchestrator/claude`: 92 pass, 0 fail
- [x] `python scripts/check-mods.py`: OK (5 mods)
- [ ] `tests/validate.sh`: run by the pre-commit hook at the commit

## Risks and rollback

- A stale store entry of this session id after the host dropped `$.state` for a reason other than a reload would come back too; the restore is gated on empty atoms and the session id, nothing else.
- The hot path adds one JSON stringify per row write and per busy tick; a store write only when the JSON changed.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| agent-watch | 0.11.2 in the tree, uncommitted |
| task-orchestrator | 0.5.7 in the tree, uncommitted |

Next: the human runs the live check above, then the commit `(TASK-0238)`.

## Execution log

- 2026-11-06 · Claude Code (Fable 5.1, side session of the coordinator) · fact established from the types and the docs (a plain reload keeps `$.state`; `--force` is documented only as the prompt-cache override); `keep.ts` in both mods, write sites wired, six tests, docs, versions.
  - Evidence: `claude plugin test agent-watch/claude` → `158 pass, 0 fail`; `claude plugin test task-orchestrator/claude` → `92 pass, 0 fail`
  - Evidence: `python scripts/check-mods.py` → `OK (5 mods)`
