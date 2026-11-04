# TASK-0226 — task-orchestrator 0.5.2: fewer coordinator tokens

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-04
- Updated: 2026-11-04
- Applies to: `mods/task-orchestrator/` (`hooks/register.tsx`, `hooks/contract.ts`, `hooks/routing.ts`, tests, README, ARCHITECTURE)
- Source: the human, 2026-11-04, after a token review of the mod (artifact "Task-Orchestrator Review"): "Yes, implement them"

## Objective

The coordinator spends fewer tokens on a run: it is told not to poll `collect`, `collect` does not repeat what it already printed, the mod's tools cost almost nothing while orchestration is off, and writer workers get a fixed tool list. Each worker's tokens are reported, so the savings can be seen.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `hooks/register.tsx` | four tools registered undeferred at session start; `dispatch`'s description embeds the 3,068-character protocol; `collect` with no ids reprints every report; a hand-off's assignment is printed by every `collect` |
| `hooks/routing.ts` | writer roles take every session tool minus the denied ones |

## Scope

- In: the protocol and `collect`'s wording against polling; reports and hand-off assignments printed once unless asked for by id; a `tool.describe` hook that defers the four tools while off; a short `dispatch` description, the protocol sent once per session as context; an explicit writer tool list; worker tokens from `turn.complete`'s usage on the task line and the run line; tests; docs; version 0.5.2.
- Out: the coordinator's own tokens and a session worker's; cost; publishing to the organization library; whether the end note wakes an idle coordinator, which needs a live run.

## Likely files

- `mods/task-orchestrator/hooks/{register.tsx,contract.ts,routing.ts,register.test.tsx}`, `README.md`, `ARCHITECTURE.md`, `.claude-plugin/plugin.json`

## Execution plan

1. `WRITER_TOOLS` in `routing.ts`; profiles register it.
2. The protocol's *Waiting* paragraph; `collect`'s running line and description.
3. `delivered` in `register.tsx`: reports and hand-off assignments once, again by id.
4. A `tool.describe` hook defers the four tools while off; `protocolSent`, set by `/orchestrate on` or the first prompt.
5. `tokens` on `Task`, summed from `turn.complete`'s usage; `tokenLine` in `status` and `collect`.
6. Tests, README, ARCHITECTURE, version.

## Acceptance criteria

- [x] The protocol and `collect`'s running line tell the coordinator to end its turn or do other work and to collect once per end note
- [x] A second `collect` with no ids prints an already-printed report as its task line only; `collect` naming the id prints it in full
- [x] A hand-off's assignment is printed once; a later `collect` with no ids names where it was, by id prints it again
- [x] While off, the four tools are described as deferred; while on, they are not; `dispatch`'s description holds no protocol
- [x] The protocol reaches the coordinator once per session: by `/orchestrate on`, or on the person's first prompt of a session that starts on
- [x] Builder, tester, debugger, documentation and frontier profiles register an explicit tool list
- [x] A worker's reported usage shows as its task's tokens; `status` and `collect` sum them for the run
- [x] `tests/test-mods.sh --mod task-orchestrator` passes

## Mandatory validations

- [x] tests/test-mods.sh --mod task-orchestrator
- [x] tests/validate.sh

## Risks and rollback

- A writer that needed an MCP tool loses it; the list is in `routing.ts`, one edit to widen.
- A coordinator that compacted away a report or assignment gets it back only by naming the id.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mods/task-orchestrator` | 0.5.2: no-poll protocol and `collect` wording, reports and assignments once, tools deferred while off, protocol once a session, `WRITER_TOOLS`, worker tokens |
| `register.test.tsx` | 4 new cases, 2 assertions added; 60 pass |

Next: a live run to see whether a task's end note wakes an idle coordinator, and the tokens a real worker reports; republish to the organization library.

## Execution log

- 2026-11-04 · Claude Code (Opus 5.5) · all six changes of the review; usage read as agent-watch reads it
  - Evidence: `tests/test-mods.sh --mod task-orchestrator` → `PASS task-orchestrator: 60 pass`
  - Evidence: `tests/validate.sh` → exit 1 on the same suites TASK-0222 found failing on this Windows checkout (test-check-mods 14/18, check-publish 1 of 60, test-worktree 6 of 8); this brief and `check-mods` pass
  - Deviation: worker tokens were out of scope as unmeasurable; the engine's `turn.complete` carries usage, so they were added
