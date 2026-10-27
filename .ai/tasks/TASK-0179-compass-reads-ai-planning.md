# TASK-0179 — Compass reads a project's .ai/ planning

## Status

- Status: planned
- Owner: agent (Claude Code), with the human for the closing check in a sigma-infrastructure session
- Created: 2026-10-27
- Updated: 2026-10-27
- Applies to: `mods/task-compass/` (0.1.0 → 0.2.0); its README and `DEVELOPING.md`; `CURRENT_STATE.md`
- Source: the locked brief `docs/design/task-compass-ai-planning-brief.md` (`TASK-0178`, accepted 2026-10-27)

## Objective

Implement the locked brief through `loops/project-build/`. In a project-workflow project such as sigma-infrastructure, the Compass pane shows the roadmap's sprints with their task briefs, centres the open ones, and never writes `.ai/`. `GOALS.md` projects stay as they are.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| The brief | `status: accepted`, committed in `72d1271`. **Read, never edited** (`ADR-0019` clause 1.4); a change to it is a new design run. |
| `mods/task-compass/` | 0.1.0; `tests/test-mods.sh` → 15 + 1 pass |
| sigma-infrastructure | the brief read `90f9a4d`. Re-read the live copy first: the local clone's `origin/master`, or a fresh fetch by the human. |
| Test sandbox | `claude plugin test` has no `fs`: fixtures load as `.ts` modules exporting strings, answered by the engine stub |

## Scope

- In: the brief's *Chosen approach*, items 1–11, with rules A and B; the redacted fixtures; README (the `.ai/` board, read-only) and `DEVELOPING.md` (the Python dashboard as a second owner of the status words); version 0.2.0.
- Out: anything the brief puts out of scope; editing the brief; publishing 0.2.0 to the organization library (a human step); sigma-infrastructure's own files.

## Likely files

- `mods/task-compass/hooks/{model,rails,register,view}.ts*`, `types/index.d.ts`, `.claude-plugin/plugin.json`
- `mods/task-compass/hooks/*.test.ts*`, `mods/task-compass/hooks/fixtures/` (new), `README.md`, `DEVELOPING.md`
- `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`; untracked: `.git/info/private-patterns`

## Execution plan

The loop's roles map onto Claude Code as follows: plan, build, qa-test and the document step are done by the main agent. Review is done by a read-only subagent given the brief and the diff, not the main agent's conclusions. The commit is made directly (`qa-test`, `review` and `git-ops` are emitted for OpenCode only), with `loops/release-check/` as the close-out.

1. Plan: map items 1–11 to files and tests in this brief's log; nothing beyond the brief.
2. Redact the fixtures (rule B): copy the brief's fixture list verbatim, replace host names by placeholders, add their patterns to `.git/info/private-patterns`, and see the gate fail on one unredacted line.
3. Build items 1–11.
4. Test: positive and negative cases per item, including no `fs.write` in `.ai/` mode, rule A on the real roadmap, change-records excluded, an unknown status shown, and no `late` without an end date. Red-prove each new test against the reverted change. Fix cycle bounded at 3.
5. Review against the brief: pass, or back to step 3.
6. Document, bump to 0.2.0, close with `loops/release-check/`.
7. Measure the first load in a sigma-infrastructure session; the human confirms the pane.

## Acceptance criteria

- [ ] The brief's success criterion holds in a sigma-infrastructure session: `S087`–`S089` (or the open set then current) centred, dots matching the briefs, no false `late`, an edited status shown within a few seconds.
- [ ] Existing tests pass unchanged; new tests on redacted fixtures cover items 1–11, and each fails with its change reverted.
- [ ] In `.ai/` mode no test sees an `fs.write`, and `/goals init` refuses.
- [ ] The gate passes, and fails on a fixture line with an unredacted host name.
- [ ] README and `DEVELOPING.md` describe the `.ai/` board; `plugin.json` is 0.2.0.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] tests/test-mods.sh
- [ ] each new test red-proved against its reverted change
- [ ] the pane checked in a sigma-infrastructure session

## Risks and rollback

- **The first load is slow** (1.78 MB in 235 reads inside `session.start`). Measured in step 7; the brief's fallback is to load the open sprints first.
- **sigma-infrastructure's layout changed after `90f9a4d`.** Step 1 re-reads it; a change the brief cannot absorb stops the task and goes back to the design loop.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next:

## Execution log

- 2026-10-27 · Claude Code (Opus 5.5) · opened, not started
