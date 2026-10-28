# TASK-0202 — task-orchestrator 0.4.1: adopt a hand-off by its assignment

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-28
- Updated: 2026-10-28
- Applies to: `mods/task-orchestrator/` (0.4.0 → 0.4.1)
- Source: the live test of 2026-10-28 the human asked for ("Run a test so I can see if all orchestrate features work fine with compass"), then "Yes, fix it"

## Objective

A task handed off under auto mode is adopted from the coordinator's Agent call by the assignment it carries, so the worker runs under its task's id, limits and write fence, and Compass draws it under that task.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-orchestrator/` 0.4.0 | adoption matches `e.name` against the task id; the hand-off line asks for `name "<id>"` |
| the live test | the desktop app's Agent tool has no `name` parameter: the coordinator's call for T1 was recorded as an untracked `agent-2`, and T1 stayed blocked |

## Scope

- In: the `agent.spawn` hook finds the held task by the prompt's first line, `# Assignment <id> — role …`, else by `name`; the hand-off line no longer asks for `name`; an untracked spawn whose prompt names a ledger task is not given that id; tests; README, ARCHITECTURE; 0.4.1.
- Out: session workers (`TASK-0201`).

## Likely files

- `mods/task-orchestrator/hooks/{register.tsx,contract.ts,register.test.tsx,contract.test.ts}`, `README.md`, `ARCHITECTURE.md`, `.claude-plugin/plugin.json`

## Execution plan

1. `contract.ts`: `assignmentId(prompt)` reads the id from the contract's header.
2. `register.tsx`: the held task is `assignmentId(e.prompt) ?? e.name`; `handoffCall` drops `name`.
3. Tests, red-proved; docs; version; gates; the live test again in this session.

## Acceptance criteria

- [x] An Agent call with no `name` whose prompt is a held task's assignment is adopted into that task, fenced and limited as it.
- [x] The hand-off line names type, model, effort and description, not `name`.
- [ ] Live: the coordinator's Agent calls for T1 and B1 are adopted; Compass draws them under their tasks.

## Mandatory validations

- [x] tests/test-mods.sh --mod task-orchestrator
- [x] tests/validate.sh
- [x] the new test red-proved against 0.4.0's source

## Risks and rollback

- A prompt edited before the call no longer starts with the header and is not adopted: it runs untracked, as in 0.4.0.
- Rollback: git revert the task commit.

## Outputs / handover

- `mods/task-orchestrator/` 0.4.1: `contract.ts` `assignmentId`; the protocol says the assignment goes unchanged as the prompt; `register.tsx`: the held task is `assignmentId(e.prompt) ?? e.name`, the hand-off line no longer asks for `name`; README, ARCHITECTURE record the live finding.
- Not verified: the live adoption (third criterion). The session that found the fault loads mods from this checkout and reloads them at the end of its turn, so it is checked on the human's next message against the test tasks left in its ledger.

Next: the live rerun; record it in this log.

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · the live test found the adoption broken; brief written before the code
- 2026-10-28 · Claude Code (Opus 5.5) · built
  - Evidence: `tests/test-mods.sh` → `5 passed, 0 failed` (task-orchestrator 33); `tests/validate.sh` → `validate.sh: OK`.
  - Evidence, red-proof: with the held-task lookup back to `e.name`, the no-name adoption test fails (`Expected: "H1 waits for a hand-off as task-orchestrator:reviewer--sonnet-medium, not task-orchestrator:reviewer"`, `Received: undefined`): `32 pass, 1 fail`; 0.4.0's `contract.ts` and `register.tsx` → `27 pass, 3 fail`.
