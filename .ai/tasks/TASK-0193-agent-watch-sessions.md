# TASK-0193 — agent-watch 0.4.0: sessions, sub-sessions and their subagents

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-28
- Updated: 2026-10-28
- Applies to: `mods/agent-watch/` (0.3.0 → 0.4.0), `scripts/check-mods.py`, `mods/task-orchestrator/types/index.d.ts` (a comment)
- Source: the human's request of 2026-10-28, "map sub-sessions and their subagents also; sessions all have the same icon but different colors, sub agents the same and share the same color as the owner session; sessions should have progress bars", "this must tie in with the orchestrate mod", and the plan approved the same day with these decisions: a sub-session is a task-orchestrator run, a Workflow run or a delegating subagent; state shows as pulse plus badges; colours from SIGMAorbital tokens only; a pane shows this session and its descendants

## Objective

The Agents pane draws a tree of sessions: this session, the orchestrator's run, each Workflow run and each delegating subagent, each with one session glyph in its own colour and a progress bar, and under each its subagents in the owner's colour.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/agent-watch/` 0.3.0 | its tests pass |
| `mods/task-orchestrator/` 0.2.0 | its `ledger`, `enabled`, `policy` state (owner of that contract) |
| ADR-0043 | clause 3: glyph = identity, colour = state |

## Scope

- In: session and subagent glyphs; session tones from SIGMAorbital tokens; progress per session (`STEPS`, `AGENTS`, `TASKS`); Workflow runs from `agent.spawn`'s `workflow.runId` and the Workflow tool's result; delegating subagents from their own task tools or children; the orchestrator's ledger read read-only, its queued tasks as waiting rows, its words as badges; a gate rule holding agent-watch's mirror of the orchestrator's contract to the owner; ADR-0044.
- Out: desktop sessions started with `start_session` (no engine call lists sessions); any behaviour change in task-orchestrator; `sigma.tsx`.

## Likely files

- `mods/agent-watch/hooks/{model.ts,register.tsx,view.tsx,band.tsx,*.test.ts*}`, `types/index.d.ts`, `.claude-plugin/plugin.json`, `README.md`, `DEVELOPING.md`
- `mods/task-orchestrator/types/index.d.ts`, `scripts/check-mods.py`, `docs/development/authoring-guide.md`
- `.ai/decisions/0044-agent-watch-session-colours.md`, `.ai/decisions/0043-mods-follow-sigmaorbital.md`

## Execution plan

1. Spike: a read of another plugin's atom passes `claude plugin validate` and the test stub; else stop and report.
2. Types and the model (sessions, tones, progress, orchestrator join, Workflow runs), tests red then green.
3. Hooks: Workflow spawns and results, agent-loop task tools, a workflow agent's end.
4. Pane as a session tree; band icons in owner tones.
5. Gate rule, ADR-0044, docs, 0.4.0, registry.

## Acceptance criteria

- [x] Every session draws `⬢`/`⬡` in its own tone with a progress bar; every subagent draws `■`/`□` in its owner's tone.
- [x] An orchestrator run draws `ORCH <POLICY>` with `n/m TASKS`, queued tasks as waiting rows naming their deps, ledger words as badges.
- [x] A Workflow run and a delegating subagent each draw as a sub-session.
- [x] The gate fails when the mirror and task-orchestrator's contract disagree.
- [x] Tests pass, the new ones red-proved.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod agent-watch and --mod task-orchestrator
- [x] each new test red-proved against its reverted change; the gate rule against a renamed field
- [x] claude plugin validate mods/agent-watch
- [x] seen live in a desktop session (Explore agents, a Workflow, a delegating subagent, an orchestrated run): matched, with one defect and one path not reachable there; see the execution log

## Risks and rollback

- A workflow agent's end is heard only from its `turn.complete`; if none fires its row stays running. Checked in the live run.
- Rollback: git revert the task commit.

## Outputs / handover

- `mods/agent-watch/` 0.4.0: a `SESSIONS` panel; `THIS SESSION`, then `ORCH <POLICY>` (the ledger, read-only: tasks in order, queued ones waiting with `WAITS ON`, `BLOCKED`/`PARTIAL`/`FAILED`/`CANCELLED` badges, a `TASKS` bar), `WF <name>` runs (an `AGENTS` bar) and delegating subagents (a `STEPS` or `AGENTS` bar), each `⬢` in a tone of its own; subagents `■` in their owner's tone; the band's icons too. New state `runs`, `tones`; `AgentRow` loses `hue`, gains `name`, `spawnedBy`, `runId`, `tasks`.
- `scripts/check-mods.py` rule 8 and six cases in `tests/test-check-mods.sh`; `ADR-0044`, with a pointer in `ADR-0043` clause 3; a comment in task-orchestrator's contract and a line in its README, no behaviour change.
- Deviations: tones live in one `tones` map keyed by session, not on rows, so the orchestrator's run (no row) keeps its tone too; the mirror also carries `objective`, since a dispatched task's `description` is only `T1 builder`.
- Next: `B-066`, a nested subagent's row left running; `B-065`, task-orchestrator's `collect` failing while tasks ran; the auto-mode spawn refusal is a task of its own.

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · planned and done in worktree `agent-watch-sessions`
  - Spike: a read of `task-orchestrator`'s atom passes `claude plugin validate`; a test reads a ledger an inline `task-orchestrator` plugin wrote (`SPIKE 2`). An inline register runs without its closure.
  - Evidence: `tests/test-mods.sh --mod agent-watch` → `PASS agent-watch: 21 pass`; `--mod task-orchestrator` → `21 pass`; `tests/validate.sh` → `validate.sh: OK`; `tests/test-check-mods.sh` → `12/12 passed`; `tsc` (typescript 5.6.3) → 6 errors, all in the band test's mount props and present before; the earlier `register.tsx` overload error is gone.
  - Evidence, red-proofs: source reverted with the new tests kept → 6 fail (the model file does not load; all 5 new register tests fail); the ledger word's badge removed → 2 fail (the tree test, the orchestrator pane test); rule 8 against task-orchestrator's contract with a field renamed, a status added, the ledger's type changed, `agentId` made required, a role added → each fails naming the field.
  - Not done: the live check in a desktop session; it needs the human (a Workflow run needs their opt-in, and only they see the pane).
- 2026-10-28 · Claude Code (Opus 5.5) · live check in the desktop app, the human watching the pane and confirming each step against a screenshot
  - Step 1, two Explore agents: two cyan `■` rows under `THIS SESSION`, which itself showed `7/7 STEPS` from the session's plan list.
  - Step 2, a delegating subagent: in the desktop app a subagent has no TodoWrite, TaskCreate or TaskUpdate, so it kept no list and the `STEPS` path for a subagent could not run there. It spawned an Explore child, so it became a violet `⬢ general-purpose · …` session by the children path, with an `AGENTS` bar.
  - Step 3, a Workflow (`agent-watch-live-check`, two agents): a green `⬢ WF agen…` session with `2/2 AGENTS`; both rows ended when the run did, so a Workflow agent's `turn.complete` does arrive.
  - Step 4, task-orchestrator: auto mode's classifier gave no verdict on the orchestrator's own `$.agent.spawn`, twice (T1, then its retry T3), while the model's Agent calls passed; T2 and T4 were cancelled. Out of auto mode, T5 (scout, observed `claude-haiku-5-5/low`) and T6 (reviewer, `claude-sonnet-5-5/high`, waiting on T5) ran and completed. The pane drew a white `⬢ ORCH BA…` session, `6/6 TASKS`, `▲ BLOCKED` on T1 and T3, `○ CANCELLED` on T2 and T4.
  - Defect (`B-066`): the violet session's Explore child stayed drawn as running at `5m34s` with its caption, long after it ended within its parent's 20s, so the session read `0/1 AGENTS` and the panel `1 RUNNING`. Its tokens were counted, so its `turn.complete` was heard; `$.agent.list()` never reported it ended, and a row the list stops naming keeps its last status.
  - task-orchestrator (`B-065`): `collect` answered `no tool.call hook answered this call` twice while T5 and T6 ran, then returned both reports once they had ended. The auto-mode refusal went to a separate session.
  - At a narrow pane the meter, count, unit and time leave a session's name a few characters (`ORCH BA…`, `WF agen…`).
