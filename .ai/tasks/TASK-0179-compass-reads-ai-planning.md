# TASK-0179 — Compass reads a project's .ai/ planning

## Status

- Status: done
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

- [x] The brief's success criterion holds in a sigma-infrastructure session: `S087`–`S089` centred, dots matching the briefs, no false `late` (the human's check). An edited status showing within seconds is proven by `layer.test.tsx`, not in that session.
- [x] Existing tests pass unchanged; new tests on redacted fixtures cover items 1–11, and each fails with its change reverted.
- [x] In `.ai/` mode no test sees an `fs.write`, and `/goals init` refuses.
- [x] The gate passes, and fails on a fixture line with an unredacted host name.
- [x] README and `DEVELOPING.md` describe the `.ai/` board; `plugin.json` is 0.2.0.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh
- [x] each new test red-proved against its reverted change
- [x] the pane checked in a sigma-infrastructure session

## Risks and rollback

- **The first load is slow** (1.78 MB in 231 reads). The human saw the pane fill promptly; no tool measured it.
- **sigma-infrastructure's layout changes later.** The fixtures pin `90f9a4d`; a change the brief cannot absorb is a new design run.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mods/task-compass/` 0.2.0 | `hooks/plan.ts` reads the `.ai/` layer; `register.tsx` alone knows the source and writes only for GOALS.md; 27 tests |
| `hooks/fixtures/sigma.ts` | structure-only, names replaced; refreshed by hand (`DEVELOPING.md`) |
| `.git/info/private-patterns` (this host, untracked) | 17 patterns: the estate's host names, the LDAP DN, a person's name |
| `TASK-0169`, `TASK-0170` | the workstation name replaced |

Next: publish 0.2.0 to the organization plugin library (a human step), so teammates get the `.ai/` board.

## Execution log

- 2026-10-27 · Claude Code (Opus 5.5) · done
  - Plan: `plan.ts` reads roadmap and briefs (items 2–5); `rails.ts` centres the open group in `focusOf`, `sprintEnd`, label, caption, unknown count (6–7); `register.tsx` detects, caches, gates writes and the tool by `source` (1, 8–10); `view.tsx` marks open sprints current
  - Evidence: `tests/test-mods.sh` → `PASS task-compass: 27 pass` (15 existing, unchanged), `PASS _template: 1 pass`; `tsc -p mods/task-compass` → exit 0; `tests/validate.sh` → `validate.sh: OK`
  - Evidence: 19 mutations, one per item and fix, each turned a named test red (the first run left "the open group is centred" green; a test now separates it); the gate with a fixture line unredacted → `PRIVATE NAME`, exit 1
  - Evidence: review (read-only subagent, brief and diff only) → pass; its two should-fix items and five notes fixed. Notes left: Windows paths and a cwd move untested; an edit keeping mtime and size waits for the next change; `canceled` and loose task ids accepted; the `/goals` description names `.ai/`
  - Evidence: the human's check in a sigma-infrastructure session at `90f9a4d`: open sprints centred, dots match, no false `late`, the pane filled promptly
  - Deviation (human): the fixtures keep structure only, not rule B's verbatim copies, which would publish 33 internal briefs (372 KB); the workstation name is replaced in `TASK-0169` and `TASK-0170` so it can join the patterns
