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
- [ ] seen live in a desktop session (Explore agents, a Workflow, a delegating subagent, an orchestrated run): pending the human's session, see the execution log

## Risks and rollback

- A workflow agent's end is heard only from its `turn.complete`; if none fires its row stays running. Checked in the live run.
- Rollback: git revert the task commit.

## Outputs / handover

- `mods/agent-watch/` 0.4.0: a `SESSIONS` panel; `THIS SESSION`, then `ORCH <POLICY>` (the ledger, read-only: tasks in order, queued ones waiting with `WAITS ON`, `BLOCKED`/`PARTIAL`/`FAILED`/`CANCELLED` badges, a `TASKS` bar), `WF <name>` runs (an `AGENTS` bar) and delegating subagents (a `STEPS` or `AGENTS` bar), each `⬢` in a tone of its own; subagents `■` in their owner's tone; the band's icons too. New state `runs`, `tones`; `AgentRow` loses `hue`, gains `name`, `spawnedBy`, `runId`, `tasks`.
- `scripts/check-mods.py` rule 8 and six cases in `tests/test-check-mods.sh`; `ADR-0044`, with a pointer in `ADR-0043` clause 3; a comment in task-orchestrator's contract and a line in its README, no behaviour change.
- Deviations: tones live in one `tones` map keyed by session, not on rows, so the orchestrator's run (no row) keeps its tone too; the mirror also carries `objective`, since a dispatched task's `description` is only `T1 builder`.
- Next: the live check below; if a Workflow agent's `turn.complete` never arrives its row stays running (ADR-0044, Consequences).

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · planned and done in worktree `agent-watch-sessions`
  - Spike: a read of `task-orchestrator`'s atom passes `claude plugin validate`; a test reads a ledger an inline `task-orchestrator` plugin wrote (`SPIKE 2`). An inline register runs without its closure.
  - Evidence: `tests/test-mods.sh --mod agent-watch` → `PASS agent-watch: 21 pass`; `--mod task-orchestrator` → `21 pass`; `tests/validate.sh` → `validate.sh: OK`; `tests/test-check-mods.sh` → `12/12 passed`; `tsc` (typescript 5.6.3) → 6 errors, all in the band test's mount props and present before; the earlier `register.tsx` overload error is gone.
  - Evidence, red-proofs: source reverted with the new tests kept → 6 fail (the model file does not load; all 5 new register tests fail); the ledger word's badge removed → 2 fail (the tree test, the orchestrator pane test); rule 8 against task-orchestrator's contract with a field renamed, a status added, the ledger's type changed, `agentId` made required, a role added → each fails naming the field.
  - Not done: the live check in a desktop session; it needs the human (a Workflow run needs their opt-in, and only they see the pane).
