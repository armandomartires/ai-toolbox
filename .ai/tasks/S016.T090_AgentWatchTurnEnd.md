# TASK-0195 — agent-watch 0.4.1: a subagent ends on its own turn (B-066)

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-28
- Updated: 2026-10-28
- Applies to: `mods/agent-watch/` (0.4.0 → 0.4.1)
- Source: `B-066`, raised by `TASK-0193`'s live check; the human's "fix B-066 as TASK-0195: end a subagent on its own turn.complete, with a test that fails today" of 2026-10-28

## Objective

A subagent's row ends when its own `turn.complete` arrives, and a list that still names it as active, or no longer names it, does not keep or reopen it as running.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/agent-watch/` 0.4.0 | 21 tests pass |
| `TASK-0193` execution log | an Explore child of a subagent drawn running at `5m34s` after it ended |

## Scope

- In: `turnEnded` for every subagent (it replaces `workflowEnded`); `mergeListed` keeping a turn's end over a list that still says active; a new `turn.start` in the same loop reopening the row (a resumed subagent); teammates left to the list, since a teammate's turn ends in `idle`, not an end.
- Out: task-orchestrator's `collect` (`B-065`); the auto-mode spawn refusal.

## Likely files

- `mods/agent-watch/hooks/{model.ts,register.tsx,model.test.ts,register.test.tsx}`, `types/index.d.ts`, `.claude-plugin/plugin.json`, `DEVELOPING.md`

## Execution plan

1. A register test: a nested subagent whose list keeps saying `running`, then stops naming it, must end on its `turn.complete` and stay ended; red today.
2. `turnEnded`, the list guard, the reopen on `turn.start`; model tests.
3. Docs, 0.4.1, close `B-066`.

## Acceptance criteria

- [x] A subagent's row ends on its `turn.complete`, whatever the list says after.
- [x] A new turn in the same loop reopens it; a teammate's turn does not end it.
- [x] The new test fails on 0.4.0 and passes after.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod agent-watch
- [x] the new register test red-proved against 0.4.0's source

## Risks and rollback

- A subagent's loop that ran several turns before ending would be drawn ended between them; the next `turn.start` reopens it.
- Rollback: git revert the task commit.

## Outputs / handover

- `mods/agent-watch/` 0.4.1: `turnEnded` ends any subagent on its own `turn.complete` (replacing `workflowEnded`), `isTurnEnded` keeps that end over a list still saying active, `turnStarted` runs it again on a new turn; `isTeammate` from the list's `teammateId` leaves teammates to the list.
- Deviation: an ended row keeps its calls and tokens in its caption. A subagent's one `turn.complete` is the first to report its tokens, so with the end now drawn at once, a caption shown only while running would never show them; 0.4.0's test of mid-run tokens relied on a second turn the engine does not send.
- Next: `B-065`. Not seen live yet: `TASK-0193`'s step 2 shows it.

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · planned and done in worktree `agent-watch-turn-end`
  - Evidence: `tests/test-mods.sh --mod agent-watch` → `PASS agent-watch: 22 pass`; `tests/validate.sh` → `validate.sh: OK`.
  - Evidence, red-proofs: 0.4.0's source with the new tests → the B-066 register test fails, `Expected: "1/1" Received: "0/1"` (and the model test file does not load: it imports `turnEnded`); the lagging-list guard alone removed → 2 fail, the model test and the B-066 test.
