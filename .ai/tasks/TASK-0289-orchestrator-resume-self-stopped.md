# TASK-0289 — task-orchestrator 0.7.1: a worker that stopped itself is reopened when resumed

## Status

- Status: in review
- Owner: agent (Claude Code)
- Branch: agent/ai-toolbox-alignment-66b894
- Created: 2026-11-11
- Updated: 2026-11-11
- Applies to: `mods/task-orchestrator/`
- Source: the live check of `TASK-0260` and `TASK-0265`, run 2026-11-11 for the human's request to complete the Backlog sprint's tasks autonomously

## Objective

The assignment tells a worker to stop before its turn cap with a `partial` report and says the coordinator can resume it; a worker that reports `blocked` asks the same. Only a worker the engine cut off at its cap (`TURN_CAP_NOTE`) was reopened on resume. In the live check, L1, an isolated documentation worker, stopped itself at turn 27 of 30 as told. Resumed by `SendMessage` while three scouts ran, it ran as a fourth worker outside the write fence, no note was written, and `collect` kept its first report. Its `completed` report was lost. A self-stopped `partial` or `blocked` worker should be resumed as a capped one is.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `register.tsx` `isResumable` | `partial` with `TURN_CAP_NOTE` only |
| `ledger.ts` `admit` | a `blocked` row admitted only while a hand-off |
| The live run (L1-cap, L2–L4-fill, 2026-11-11) | L1 `partial` · 827.7k tok after the resume, first report kept |

## Scope

- In: `isResumable` covers a non-session task with an agent id that is `partial`, or `blocked` and not a hand-off. `admit` and `admitRow` take `resume`, which admits a `blocked` row only while it is not a hand-off. The `turn.start` hook reopens from the row's own status and notes how. One protocol clause. Tests, version step, README, ARCHITECTURE, DEVELOPING, CHANGELOG, the records.
- In, from the review: the reopen drops the spent report; the refused-resume note names `TaskStop` (cancel does not stop an ended row's agent); the note's label reads the last end's reason.
- Out: `failed` and `completed` rows (a resumed failed worker still runs unfenced); `stallText` still names a resume only for a capped root; the live check of this fix, which needs the mod reloaded from a checkout holding it.

## Likely files

- `mods/task-orchestrator/claude/hooks/register.tsx`, `ledger.ts`, `contract.ts` and their tests
- `mods/task-orchestrator/claude/.claude-plugin/plugin.json`, `README.md`, `ARCHITECTURE.md`, `DEVELOPING.md`, `CHANGELOG.md`
- `.ai/tasks/TODO.md`, `.ai/GOALS.md`, `.ai/context/CURRENT_STATE.md`, `TASK-0260`, `TASK-0265`

## Execution plan

1. Live: a documentation worker past its cap, three scouts, a resume while they run; read `status` and `collect`.
2. Red tests in `register.test.tsx`: a self-stopped `partial` worker resumed (reopened, fenced, closed by its report), the same with the cap full (stays, told), a `blocked` worker resumed.
3. Widen `isResumable`; add `resume` to `admit`; a unit test of the gate.
4. Kit tests, `validate`, `check`; version step and docs.

## Acceptance criteria

- [x] A worker that ended on its own `partial` report and is resumed is `running` again, a write outside its allowed files is refused, and its next report closes the task
- [x] Resumed while the cap is full, it stays `partial` and the coordinator is told once, with the cap named
- [x] A worker that reported `blocked` and is resumed is reopened and closed by its report; a hand-off is never admitted by a resume
- [x] Red first: the three `register.test.tsx` tests failed against 0.7.0 (147 pass, 3 fail)
- [ ] Live: after a reload of the mod holding 0.7.1, a self-stopped worker resumed is shown `running`, and resumed with the cap full is refused with a note

## Mandatory validations

- [x] `cd mods/task-orchestrator && claude plugin test claude`: 151 pass, 0 fail
- [x] `skills/mod-dev/scripts/mod-dev.sh validate task-orchestrator`: passed with warnings
- [x] `skills/mod-dev/scripts/mod-dev.sh check task-orchestrator`: `OK (5 mods)`
- [ ] `tests/validate.sh`: run by the pre-commit hook at the commit

## Risks and rollback

- A `blocked` worker resumed before its block is cleared reopens and takes a slot; it is still fenced and capped.
- The loaded mod is the main checkout's (`claude plugin list`), so this session ran 0.7.0 throughout; the fix is unverified live.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| task-orchestrator | 0.7.1 |
| `TASK-0260`, `TASK-0265` | live results logged; their live criteria stay open for the parts not seen |

Next: the live check above, once the main checkout holds 0.7.1 and the mod is reloaded.

## Execution log

- 2026-11-11 · Claude Code (Opus 5.5, coordinator) · live run on 0.7.0, red tests, fix, docs, version step; independent review (approve, no blocker) acted on: the spent report dropped on reopen, `TaskStop` named in the refused-resume note, the label read from the last reason, README wording
  - Evidence: L1-cap (documentation, haiku, cap 30, isolated): 26 files written in `agent-a45247a76d409915c`, then `partial` at turn 27 naming its worktree; resumed with L2–L4 running: `status` kept it `partial`, no note, its 19 later writes landed, `collect` kept the first report. Kit: 147 pass, 3 fail → 151 pass, 0 fail.
