# TASK-0191 — task-orchestrator 0.2.0 on SIGMAorbital

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-28
- Updated: 2026-10-28
- Applies to: `mods/task-orchestrator/` (0.1.0 → 0.2.0)
- Source: the human's request of 2026-10-27, "harmonize the design of all mods in this project with the SIGMAorbital design system", and the plan approved on 2026-10-28 with four decisions: exact hex per theme; a wireframe panel instead of the sticky note; glyph = identity, colour = state; styled `CommandOutput` rendering for the commands

## Objective

`/orchestrate` draws as SIGMAorbital panels (routing table, tasks with state badges, overrides, providers), and the status line, toasts and log lines follow its content rules. The text the model reads keeps every fact it has now.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/task-orchestrator/` 0.1.0 | 20 tests pass |
| `sigma.tsx` | landed by TASK-0188 |

## Scope

- In: a structured `/orchestrate` result drawn through `CommandOutput`; task states queued `text-2`, running cyan, done `text-1`, failed red, blocked amber; `ORCH BALANCED · 2 RUNNING · 1 QUEUED`.
- Out: routing, ledger and dispatch behaviour (unchanged).

## Likely files

- `mods/task-orchestrator/hooks/{sigma.tsx,register.tsx,ledger.ts,*.test.ts*}`, `.claude-plugin/plugin.json`, `README.md`, `DEVELOPING.md`, `ARCHITECTURE.md`

## Execution plan

1. Copy `sigma.tsx`; sync the theme at start and watch it.
2. Build `/orchestrate`'s structured result beside its text; `remember` it.
3. Its `CommandOutput` hook: routing, tasks, overrides, providers as panels.
4. Status line, toasts, log lines on the content rules.
5. Tests, red-proofs, docs, 0.2.0.

## Acceptance criteria

- [x] `/orchestrate` draws as panels; an unknown row falls back to its text.
- [x] Every fact of the old text is still in the text the model reads.
- [x] Tests pass, the new ones red-proved.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod task-orchestrator
- [x] each new test red-proved against its reverted change
- [x] tsc against the 2.1.312 API types (31 errors, all pre-existing in `register.test.tsx`: none added)
- [ ] seen live in the desktop app and a terminal `claude`, dark and light theme (pending the human's session: see the execution log)

## Risks and rollback

- Rollback: git revert the task commit.

## Outputs / handover

- `mods/task-orchestrator/` 0.2.0: `hooks/view.tsx` (`renderOutput`, `statusLineText`, `STATE`); `/orchestrate status`, `policy` and `routing` keep their text and `remember` an `OrchestrateOutput`, drawn as ORCHESTRATOR, ROUTING and OVERRIDES IN FORCE panels through the `CommandOutput` site; task states queued text-2, running cyan, done text-1, failed red, blocked and partial amber, cancelled text-3; status line `ORCH BALANCED · 1 RUNNING · 0 QUEUED`; toast `T1 · SCOUT · COMPLETED · next`. `sigma.tsx` copied in.
- Deviations: the text the model reads is unchanged, casing included, so the coordinator protocol and its tests read the same facts; only the drawing, the status line and the toast follow the content rules. `$.ui.log` lines keep their `task-orchestrator:` prefix (transcript log, not a design surface). The other subcommands (`on`, `off`, `models`, `opt-in`, `providers`, `cancel`) stay text.
- Next: TASK-0192.

## Execution log

- 2026-10-28 · Claude Code (Opus 5.5) · planned and done in worktree `agent/sigmaorbital`
  - Evidence: `claude plugin test mods/task-orchestrator` → `21 pass 0 fail`; `tsc -p mods/task-orchestrator` → 31 errors, the baseline's 31 (test inputs against 2.1.312 types).
  - Evidence, red-proofs: the old status line → 1 fail; no `CommandOutput` hook → 1 fail; running not cyan → 1 fail; no `syncTheme` → 1 fail.
