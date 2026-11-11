# TASK-0288 — agent-watch 0.13.5: the band and the Sessions pane agree on steps

## Status

- Status: review
- Owner: agent (Claude Code)
- Branch: agent/steps-mismatch-20eb29
- Created: 2026-11-11
- Updated: 2026-11-11
- Applies to: `mods/agent-watch/claude/hooks/sunburst.ts`, `mods/agent-watch/claude/hooks/band.tsx`, their tests, README, `plugin.json`, `panel.tsx` `VERSION`
- Source: the person's screenshot of 2026-11-10: the band read `6/6 STEPS · ALL DONE`, the Sessions pane `19/36 STEPS · 53 % · RUNNING`

## Objective

The band and the pane counted different things. The band counted this session's task list alone. The pane's centre summed the members and sub-sessions under the session and dropped the session's own list as soon as anything was below it (`roll` in `sunburst.ts`). It also counted an ended orchestrator task by its worker's own task list, which the worker can leave unticked: S01 read 12/28 with no task open. The band's `ALL DONE` checked only running agents, so it showed while background command B08 still ran. Make the counts agree and keep `ALL DONE` until nothing runs.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| The screenshot of 2026-11-10 | band `6/6 STEPS · ALL DONE`; pane `19/36 STEPS`, B01–B07 1/1, B08 0/1 running, S01 12/28 |
| `mods/agent-watch` at `a4704ca` | 0.13.4; 174 tests pass |

## Scope

- In: the centre's roll-up adds the main node's own `STEPS`; `memberRoll` counts an ended, done member as all steps done (a failed or stopped one keeps its count); the band reads `background` and withholds `ALL DONE` while a drawn background task runs, naming it `N BACKGROUND RUNNING`.
- Out: the band's own count stays the session's list (its meaning, "this turn's plan", is unchanged); the orchestrator-run band (ledger marks) is untouched.

## Likely files

- `mods/agent-watch/claude/hooks/sunburst.ts`, `band.tsx`, `sunburst.test.ts`, `register.test.tsx`
- `mods/agent-watch/README.md`, `claude/.claude-plugin/plugin.json`, `hooks/panel.tsx` (`VERSION`), `CHANGELOG.md`

## Execution plan

1. Red tests for the roll-up and the band's `ALL DONE`.
2. `roll` adds the main node's own steps; `memberRoll` counts an ended, done member in full.
3. `drawMeter` reads `background` and withholds `ALL DONE` while a drawn background task runs.
4. README, changelog, version 0.13.5; mod tests, preview, gate.

## Acceptance criteria

- [x] A main node with 6/6 own steps and background tasks at 1/1 and 0/1 rolls up to 7/8 (`sunburst.test.ts`)
- [x] An ended `completed` ledger task whose worker's list is 1/4 rolls up 4/4; a `failed` one keeps 1/4
- [x] A finished list with a running background command does not draw `ALL DONE` and draws `1 BACKGROUND RUNNING`; after its notification it draws `ALL DONE` (`register.test.tsx`)
- [x] The three new tests fail on the previous code (red-proved, 4 failures including the restore test's changed count)
- [ ] Seen live: the band and the pane's centre tell the same story while a background command runs and after it ends

## Mandatory validations

- [x] `tests/test-mods.sh --mod agent-watch`: 177 pass
- [x] `tests/validate.sh` on the working tree before the commit: `validate.sh: OK`

## Risks and rollback

- The pane's centre now reads larger than the band (plan plus everything below). The README says which counts what.
- Rollback: revert the commit; no stored state changes shape.

## Outputs / handover

- agent-watch 0.13.5: the pane's centre and PROGRESS count the session's list plus everything below it; the band keeps the list alone and says `N BACKGROUND RUNNING` instead of `ALL DONE` while a background command runs.
- Found, not taken: the committed preview snapshots of the Agents pane already differed from the drawings at `a4704ca` (8 differences, none from this change); `preview-mods.py --check` also crashes printing `●` on a cp1252 console unless `PYTHONIOENCODING=utf-8`.
- Live check left to the person: the band and the pane's centre while a background command runs and after it ends.

## Execution log

- 2026-11-11 · Claude Code (Opus 5.5) · diagnosed from the screenshot (7+0+12 = 19, 7+1+28 = 36); fix, tests, red-proof, README, changelog, version 0.13.5.
