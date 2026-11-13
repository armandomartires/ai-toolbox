# TASK-0265 — task-orchestrator 0.7.0: the REVIEW-0013 fixes (path fence, one admission gate, stall advice, model families, observability)

## Status

- Status: review
- Owner: agent (Claude Code, coordinator with orchestrated workers)
- Created: 2026-11-10
- Updated: 2026-11-13
- Applies to: `mods/task-orchestrator/`
- Source: `.ai/reviews/REVIEW-0013-task-orchestrator-mod.md` (2026-11-09), eleven defects read from the code and five ranked recommendations, which the human asked to apply in full, tested and validated.

## Objective

Make the limits the README calls "enforced in code" true on every path, and remove the places where following the mod's own advice destroys work. The review found that the write fence is a string-prefix match over unresolved paths (`..` escapes, an empty allowed list is unconfined), that the start checks hold only on the `start` path while the Agent-tool spawn, both adoptions and the turn-cap resume bypass the cap or the writer lock, that `/orchestrate off` lifts the fence for running workers, that `cancel` with no id cancels everything, that a model id off the alias ladder falls to `haiku` with a note saying it costs more and that only the literal `fable` is gated, and that a dependant's stall text advises a re-dispatch even when the root was cancelled or stopped at its turn cap. The human also sees less in the panel than the model reads in the text, and the run mirror in the store is unbounded.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `.ai/reviews/REVIEW-0013-task-orchestrator-mod.md` | D1–D11, R1–R5 and the lesser fixes, each with file and line of `c752633` |
| `mods/task-orchestrator/claude/hooks/ledger.ts` `writeBlocker`, `stallText`, `escalationOf` | prefix match, one stall text, alias-only rank |
| `mods/task-orchestrator/claude/hooks/register.tsx` | four entry paths into `running`; fence keyed on `enabled`; `cancel` defaults to `all` |
| `mods/task-orchestrator/claude/hooks/router.ts`, `routing.ts` | `MODEL_LADDER.indexOf` on the alias string; `GATED_MODELS` = `['fable']` |
| `tests/test-mods.sh --mod task-orchestrator` | 105 pass at the start of this task |

## Scope

- In (code, each with red-first tests): R1 a path resolver in `ledger.ts` (`..`, `.`, case and drive letter on Windows roots, confinement to the worker's root, segment matching, an empty list meaning the whole root). R4 `familyOf` moved into `routing.ts`, the ladder, the gate and `escalationOf` ranked by family, an unplaceable model blocked rather than downgraded. R2 one `admit()` in `ledger.ts` used by `start`, the Agent-tool spawn, both adoptions and the resume, the fence keyed on the row rather than on `enabled`, a collision-free id for an untracked spawn, `cancel` with no id refused (D6). R3 `stallText` by the root's state. R5 a `summary()` for the status line that counts hand-offs and is refreshed on dispatch, panel rows carrying reason, hand-off glyph, retry count and tokens, the run mirror's report body capped and the entry deleted on reset, the branch recorded on a session task's row. D11 the first strong `Status:` wins. Config: `USERPROFILE` when `HOME` is unset, a malformed file listed under `config refused`, the project file's `providers` narrowed, `saveSettings` no longer pinning the home file's values. Dead knobs: `maxNesting` enforced or removed, `collectTimeoutMs` documented as it is, `telemetry.ts` removed from the shipped hooks or wired.
- In (docs and governance): README, ARCHITECTURE and DEVELOPING corrected where the review found them stale; `TASK-0196` marked superseded by `TASK-0207`; `TASK-0234` and `TASK-0238` closed; a new ADR recording the ledger, the hand-off, the per-project settings scope and the store layout; version step to 0.7.0; CHANGELOG, TODO, GOALS, CURRENT_STATE.
- Out: the live checks (a worker in a worktree writing through the resolved fence; a resume refused by the cap), which need a real run; `ADR-0050`'s acceptance, which is the human's; a `core/` folder (`ADR-0054` clause 4 still holds); wiring telemetry to an exporter; fencing Bash writes.

## Likely files

- `mods/task-orchestrator/claude/hooks/ledger.ts`, `router.ts`, `routing.ts`, `register.tsx`, `contract.ts`, `view.tsx`, `keep.ts`, `types/index.d.ts` and their tests
- `mods/task-orchestrator/claude/.claude-plugin/plugin.json`, `README.md`, `ARCHITECTURE.md`, `DEVELOPING.md`
- `.ai/decisions/0058-*.md`, `.ai/tasks/TASK-0196`, `TASK-0234`, `TASK-0238`, `CHANGELOG.md`, `.ai/tasks/TODO.md`, `.ai/GOALS.md`, `.ai/context/CURRENT_STATE.md`

## Execution plan

1. Wave 1, one builder: R1 and R4 in the pure modules, red tests first, kit green.
2. Wave 2, one builder: R2, D6 and R3 in `ledger.ts` and `register.tsx`, red tests first, kit green.
3. Wave 3, one builder: R5, D11, the config fixes and the dead knobs, red tests first, kit green.
4. Wave 4: docs, ADR, brief statuses, version step, CHANGELOG, board.
5. An independent reviewer over the whole diff against REVIEW-0013; `tests/test-mods.sh`, `mod-dev.sh validate` and `check`, `tests/validate.sh`.

## Acceptance criteria

- [x] A write to `src/../x` by a worker allowed `src` is refused; an absolute path outside the checkout is refused with or without an allowed list; a drive-letter or case difference does not defeat the fence (tests in `ledger.test.ts`)
- [x] Every path into `running` (start, Agent-tool spawn, Agent and session adoption, turn-cap resume) runs the same admission check; a resumed worker that would exceed the cap or share the checkout with another non-isolated writer is not reopened silently; `/orchestrate off` keeps running workers fenced; `cancel` with no id refuses
- [x] A dependant's stall text names the right way out for a cancelled root, a turn-capped root, a retryable root and a hand-off
- [x] A full model id or a cased alias is ranked and gated by its family; an unplaceable model blocks; `escalationOf` counts a family step
- [x] The status line counts hand-offs as held slots and refreshes on dispatch; the panel rows carry reason, hand-off, retries and tokens; the run mirror is capped and cleared on reset; a session task's row records its branch
- [x] The first strong `Status:` line wins in `parseReport`; the config reads `USERPROFILE`, lists a malformed file, narrows `providers`, and does not pin the home file; `maxNesting` is enforced or gone; `telemetry.ts` is out of the shipped hooks or wired
- [x] The full 11×3 routing table has a test
- [x] README, ARCHITECTURE and DEVELOPING say what the code does after this task; `TASK-0196`, `TASK-0234`, `TASK-0238` statuses corrected; the ADR exists
- [x] Red first: every new test failed against the 0.6.0 code
- [ ] Live: a worker in a worktree writes through the resolved fence (seen 2026-11-11); a resume refused by the cap is reported (not seen: see `TASK-0289`)

## Mandatory validations

- [x] `bash tests/test-mods.sh --mod task-orchestrator`: PASS, 147 (105 before this task; 117 after wave 1, 126 after wave 2, 140 after wave 3 with the 3 telemetry tests removed, 147 after the review fixes)
- [x] `skills/mod-dev/scripts/mod-dev.sh validate task-orchestrator`: passed with the pre-existing warnings; `check task-orchestrator`: `OK (5 mods)`
- [x] `tests/validate.sh`: OK (second run, after the review file took the schema's section names; the first run failed on that alone)
- [x] An independent review of the diff against REVIEW-0013 (sonnet/high): all eleven defects closed; two blocking items (an unchecked TaskStop result reported as "stopped"; the fence failing open on an empty cwd) and three lesser ones (legacy store pinning, `branchIn` over-matching, an unused import and two shadowed names) fixed in a follow-up wave with 7 tests; the stale document lines it listed were corrected

## Risks and rollback

- A resolver written in the mod (no Node `path`) may differ from the engine's own path handling; the tests pin the cases the review named, and the live check in a worktree is owed.
- Keying the fence on the row rather than on `enabled` changes `/orchestrate off`: running workers stay fenced until they end. This is what the README already implies.
- Refusing a resume at `turn.start` happens while the resumed agent's turn is already running; the design is to stop it and tell the coordinator why, so a resume can be lost to the cap where before it ran unchecked.
- Rollback: git revert the task commit.

## Outputs / handover

- Code: `mods/task-orchestrator/claude/hooks/{ledger,router,routing,contract,view,keep}.ts(x)`, `register.tsx`, `types/index.d.ts` and their tests; `telemetry.ts` and its test deleted; `plugin.json` 0.7.0. Docs: README, ARCHITECTURE, DEVELOPING, CHANGELOG, `.ai/context/CURRENT_STATE.md`, `.ai/context/risk-register.md` (R-10). Governance: `ADR-0058` (new), `TASK-0196` superseded, `TASK-0234` and `TASK-0238` closed, this brief, TODO and GOALS.
- Design choices worth knowing: a post-spawn admission refusal cannot deny (the engine refuses a deny after `next()` answered), so the worker is stopped with TaskStop and the coordinator told by note, with the refusal reported when the stop itself is refused; a refused resume at `turn.start` leaves the row `partial` and the resumed turn unfenced until it ends, with a note; `maxNesting` was removed rather than enforced, since the hook sees only depth 1; the store entry carries `v: 2` and an older entry yields `enabled` alone; `branchIn` records a branch only when the word stands alone before a name with `/`, `-` or a digit, or one introduced by named/called/`:`/`=`.
- Not done here: the live checks (resolved fence inside a real worktree; a resume refused by the cap; a branch read from a real `start_session` answer); `tsc` was not run (no `tsc` on this host, as in every earlier task); the human's decision on `ADR-0050`; publishing 0.7.0 to the organization library (it holds 0.5.4). Nothing is committed: the human decides on the commit.

## Execution log

- 2026-11-10 · Claude Code (Fable 5.1, coordinator) · brief opened from REVIEW-0013 as TASK-0263; baseline kit 105 pass; wave 1 dispatched.
- 2026-11-10 · coordinator · renumbered to TASK-0265: `agent/TASK-0263*` and `agent/TASK-0264` branches already exist from the human's worktree-hook test, so the id would have collided with `scripts/worktree.sh add`. Wave 1 (R1, R4) landed: kit 117 pass, validate passed. Wave 2 and the ADR writer were refused once by the host ("the host has ended its input") and re-dispatched as retry 1.
- 2026-11-10 · coordinator · wave 2 (R2 admission gate, R3 stall text, D6): 126 pass. ADR-0058 written. Wave 3 (R5 status line and panel, mirror cap and `forget`, `Task.branch`, D11, config fixes, `maxNesting` and telemetry removed): 140 pass. Docs wave: README, ARCHITECTURE, DEVELOPING, CHANGELOG, CURRENT_STATE, TASK-0196/0234/0238. Independent review of the whole diff: all defects closed, two blocking items; fixed with 7 tests: 147 pass. Docs corrected for the review's stale-line list. A first `tests/validate.sh` run failed only on REVIEW-0013's section names (the review schema wants Findings, Validation results, Verdict, Follow-up tasks); renamed. Second gate run: see Mandatory validations.

- 2026-11-11 · Claude Code (Opus 5.5, coordinator) · live check on 0.7.0 (desktop 2.1.318): L1, an isolated documentation worker at cap 30, wrote 26 files in its own worktree and stopped itself at turn 27 with a `partial` report naming the worktree; the engine's cut-off was not reached, so `collect`'s turn-cap report is still unseen live. Its resume by `SendMessage` with three workers running was not reopened (it was not turn-capped) and ran unfenced: fixed by `TASK-0289`.
- 2026-11-13 · Claude Code (Opus 5.5, coordinator) · live run 2026-11-12/13, desktop, task-orchestrator 0.7.2 loaded from the main checkout (`claude plugin list`), after `/reload-plugins --force` and `/orchestrate on`: the resolved fence was not exercised, because the writer was spawned rather than handed off (TASK-0291's entry of the same day); a resume refused by the cap was not run (it needs three long workers at once)
  - Evidence: L7 wrote outside its allowed files with a success result; see TASK-0291 and TASK-0292
  - Deviation: the cap refusal left unrun to save tokens: L1 alone used 515k
