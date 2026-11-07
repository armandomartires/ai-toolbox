# TASK-0250 — agent-watch 0.12.1: each session keeps its rows under its own store key

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-07
- Updated: 2026-11-07
- Applies to: `mods/agent-watch/`
- Source: live, 2026-11-07, during `TASK-0249`'s demo. The store file `agent-watch_inline-….json` held another session's rows (`f79c78c4…`) where this session's had been a step earlier. The store is the plugin's, shared by every session that loads it, and `TASK-0238` kept every session's rows under the one key `agent-watch:rows`.

## Objective

A session's kept rows are its own. With two sessions loading agent-watch, the last one to write no longer overwrites the other's, so a `/reload-plugins --force` in either brings back its own rows. task-orchestrator already keys its run per session (`task-orchestrator:run:<session id>`).

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/agent-watch/claude/hooks/keep.ts` | `keep` writes `agent-watch:rows` for every session; `restore` reads it and takes it only when its `sessionId` matches |
| `$.store` (engine types) | `get`, `set`, `delete`, `keys`; shared by the plugin's sessions |

## Scope

- In: `rowsKey(sessionId)`, `savedAt`, reading the shared key once more for this session's own rows (then moved and removed), deleting kept-rows keys not written for a week, tests, DEVELOPING, the patch version.
- Out: task-orchestrator's per-session keys, which are never deleted either (a follow-up if the store grows); the engine's store itself.

## Likely files

- `mods/agent-watch/claude/hooks/keep.ts`, `register.test.tsx`, `DEVELOPING.md`, `claude/.claude-plugin/plugin.json`, `claude/hooks/panel.tsx` (the version line)
- `CHANGELOG.md`

## Execution plan

1. `keep` writes `rowsKey(sessionId)` with `savedAt`; the write is skipped while the rows, their time left out, equal the last write.
2. `restore` reads the session's own key, else the shared key when it holds this session's rows (moved to the own key, the shared key removed); then `prune` deletes every kept-rows key older than `KEEP_MS`, the shared one dated by its rows' latest start or end.
3. Tests through the test's own store (`keys` and `delete` added); red-proof against 0.12.0's `keep.ts`.

## Acceptance criteria

- [x] Each change writes `agent-watch:rows:<session id>` with `savedAt`; another session's key is left as it was
- [x] A `session.start` on empty atoms restores this session's rows from its own key, numbered as before
- [x] Rows the shared key holds for this session are restored, moved to its own key, and the shared key removed; another session's rows under it are neither restored nor removed while recent
- [x] Kept-rows keys not written for a week are deleted at `session.start`; any other key is left alone
- [x] DEVELOPING *Kept rows*, CHANGELOG, plugin.json and the pane's version line 0.12.1
- [ ] Live: two sessions loading the mod, a background command in each, `/reload-plugins --force` in one; expect its own rows back and the other session's untouched

## Mandatory validations

- [x] `cd mods && claude plugin test agent-watch/claude`: 169 pass, 0 fail (with 0.12.0's `keep.ts`, five of the store tests fail)
- [ ] `tests/validate.sh`: run by the pre-commit hook at the commit

## Risks and rollback

- A session idle for over a week whose rows are deleted, then force-reloaded, starts with an empty pane, as it did before `TASK-0238`.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| agent-watch | 0.12.1, committed |

Next: the live check above.

## Execution log

- 2026-11-07 · Claude Code (Opus 5.5, side session of the sigma-infrastructure coordinator) · found during `TASK-0249`'s demo; per-session key, migration of the shared key, pruning, tests, docs, version.
  - Evidence: `claude plugin test agent-watch/claude` → `169 pass`; with 0.12.0's `keep.ts`: five `(fail)` (the three `TASK-0238` store tests, rekeyed, and two of the three new ones)
