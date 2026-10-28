# TASK-0197 — task-compass 0.6.0: the Sessions tree, from agent-watch

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-28
- Updated: 2026-10-28
- Applies to: `mods/task-compass/` (0.5.0 → 0.6.0), `mods/agent-watch/` (0.4.1 → 0.4.2), `scripts/check-mods.py`
- Source: the human's "give the compass the same hierarchy as the agents-watch mod, and change SUBAGENTS to Sessions; essentially agent-watch inside the compass" of 2026-10-28; asked: read agent-watch's state rather than duplicate its tracking

## Objective

Compass's panel is **Sessions** and draws agent-watch's session tree: this session, the orchestrator's run, Workflow runs and delegating subagents, each with its members, tone, meter and caption, from one shared tree module and a mirror of agent-watch's state.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-compass/` 0.5.0 | 48 tests pass; a flat Subagents list with the ledger inline (`TASK-0196`) |
| `mods/agent-watch/` 0.4.1 | 22 tests pass; `sessionTree` in `hooks/model.ts` (`ADR-0044`) |
| `scripts/check-mods.py` | rule 7 holds one shared module, `sigma.tsx` |

## Scope

- In: `sessions.ts` extracted from agent-watch's model, byte-identical in task-compass, gated by rule 7 as a table of shared modules; a mirror of agent-watch's state in task-compass; the Sessions panel; a flat-list fallback when agent-watch is not loaded; tests; ADR; docs; versions.
- Out: the sunburst (`TASK-0198`); any change to agent-watch's behaviour; any write to another mod's state.

## Likely files

- `mods/agent-watch/hooks/{sessions.ts,model.ts}`, `.claude-plugin/plugin.json`, `DEVELOPING.md`
- `mods/task-compass/hooks/{sessions.ts,view.tsx,register.test.tsx,sessions.test.ts}`, `types/index.d.ts`, `.claude-plugin/plugin.json`, `README.md`, `DEVELOPING.md`
- `scripts/check-mods.py`, `tests/test-check-mods.sh`, `.ai/decisions/`

## Execution plan

1. Extract `sessions.ts` in agent-watch with self-declared structural types; `model.ts` re-exports; agent-watch's tests unchanged and green.
2. Rule 7 as a table: `sigma.tsx` owned by `_template`, `sessions.ts` by `agent-watch`; a gate test.
3. Mirror agent-watch's state in task-compass; copy `sessions.ts`; draw the tree as agent-watch's pane does, titled Sessions; fall back to the 0.5.0 list when agent-watch tracks nothing Compass does.
4. Tests, red-proved against 0.5.0; ADR; docs; versions.

## Acceptance criteria

- [x] Compass's panel is titled Sessions and draws this session, the ORCH run, Workflow runs and delegating subagents with agent-watch's tones, meters and captions.
- [x] `sessions.ts` is one module, byte-identical in both mods, and the gate fails on a drifted copy.
- [x] agent-watch's behaviour and tests are unchanged.
- [x] Without agent-watch's state, Compass draws its 0.5.0 list.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh
- [x] tests/test-check-mods.sh
- [x] the new tests red-proved against 0.5.0's source; rule 7 red-proved on a drifted copy

## Risks and rollback

- Compass's tree depends on agent-watch being loaded; the fallback keeps the panel useful without it.
- Rollback: git revert the task commit.

## Outputs / handover

- `mods/agent-watch/` 0.4.2: the pure session tree moved to `hooks/sessions.ts` (its own structural types, importing only `./sigma`); `model.ts` re-exports it; no behaviour change; `Member.taskId` marks a ledger task.
- `mods/task-compass/` 0.6.0: a byte-identical `sessions.ts`; a `Watch<Name>` mirror of agent-watch's state (rule 8); the panel is **Sessions** and draws agent-watch's tree (this session, the ORCH run, Workflow runs, delegating subagents) with its tones, meters, badges and captions; `trimTree` (in `model.ts`) fits it to 16 lines, running members first across sessions, each `+N more` paid for, heads and ledger tasks never cut; agent-watch's clock (`now > 0`) says it is loaded, else the 0.5.0 flat list is drawn.
- `scripts/check-mods.py` rule 7 is a table of shared modules: `sigma.tsx` owned by `_template`, `sessions.ts` by `agent-watch`; `tests/test-check-mods.sh` S7-S9. `ADR-0045` records the decision.
- Deviation: review R3 found the loaded signal inferred from Compass's own rows, and the budget spent in tree order; both fixed before landing, with red-proofs.
- Not seen live yet.

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · planned in worktree `compass-orchestrator`; built by an orchestrated builder, reviewed by a separate reviewer
  - Evidence: `tests/test-mods.sh` → `5 passed, 0 failed` (task-compass 60, agent-watch 22 unchanged); `python3 scripts/check-mods.py` → `OK (5 mods)`; `tests/test-check-mods.sh` → `15/15 passed`; `cmp` of the two `sessions.ts` → identical; `tests/validate.sh` → `validate.sh: OK`.
  - Evidence, red-proofs: 0.5.0's `view.tsx` → the Sessions tree test fails `Expected: defined Received: undefined`; a drifted `sessions.ts` copy → `hooks/sessions.ts differs from its owner`; the old loaded condition → the queued-ledger fallback test fails on `ORCH BALANCED · 0 RUNNING`.
