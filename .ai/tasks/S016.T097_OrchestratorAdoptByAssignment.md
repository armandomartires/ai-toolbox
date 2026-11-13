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
- [x] Live: the coordinator's Agent calls for T1 and B1 are adopted; Compass draws them under their tasks.

## Mandatory validations

- [x] tests/test-mods.sh --mod task-orchestrator
- [x] tests/validate.sh
- [x] the new test red-proved against 0.4.0's source

## Risks and rollback

- A prompt edited before the call no longer starts with the header and is not adopted: it runs untracked, as in 0.4.0.
- Rollback: git revert the task commit.

## Outputs / handover

- `mods/task-orchestrator/` 0.4.1: `contract.ts` `assignmentId`; the protocol says the assignment goes unchanged as the prompt; `register.tsx`: the held task is `assignmentId(e.prompt) ?? e.name`, the hand-off line no longer asks for `name`; README, ARCHITECTURE record the live finding.
- Live (2026-10-28): T1 and B1, retried under their ids, were adopted from the coordinator's Agent calls with no `name`, ran as T1 and B1, and completed; `status` showed `observed claude-haiku-5-5/low` and `observed claude-sonnet-5-5/medium` (the host's `modelSettings.claude-sonnet-5-5.effortLevel = high` did not replace medium).
- Found live, not fixed here: a per-settings profile (`builder--sonnet-high`, `TASK-0200`) registered in a turn is not an Agent type until the next turn, and a mod reload drops it; so under auto mode a hand-off at other settings than the table's fails in the turn it is printed (`Agent type 'task-orchestrator:builder--sonnet-high' not found`). Not exercised live: the one-writer rule (B1 ended before B2 was dispatched).

Next: make a per-settings hand-off startable in its own turn (register variants ahead, or hand off on the role's profile with the effort on the Agent call).

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · the live test found the adoption broken; brief written before the code
- 2026-10-28 · Claude Code (Opus 5.5) · built
  - Evidence: `tests/test-mods.sh` → `5 passed, 0 failed` (task-orchestrator 33); `tests/validate.sh` → `validate.sh: OK`.
  - Evidence, live: after the reload, T1 and B1 retried and started by the printed Agent calls → `T1 → scout [a7…] → observed claude-haiku-5-5/low → completed`, `B1 → builder [a7…] → observed claude-sonnet-5-5/medium → completed`; `.pilot-scratch/orch-test/b1.txt` → `orchestrator test$`; B2's call → `Agent type 'task-orchestrator:builder--sonnet-high' not found`.
  - Evidence, red-proof: with the held-task lookup back to `e.name`, the no-name adoption test fails (`Expected: "H1 waits for a hand-off as task-orchestrator:reviewer--sonnet-medium, not task-orchestrator:reviewer"`, `Received: undefined`): `32 pass, 1 fail`; 0.4.0's `contract.ts` and `register.tsx` → `27 pass, 3 fail`.
