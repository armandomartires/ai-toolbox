# TASK-0174 — Make the session-start reading chain short and consistent

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-18
- Updated: 2026-10-18
- Applies to: `AGENTS.md` (and `CLAUDE.md`, its symlink), `.ai-layout.json`, `tests/validate.sh`, `ADR-0033`, `docs/operations/runbook.md`; the human's global rules file (untracked)
- Source: human request 2026-10-18 (correction 2 of the review against current practice); the human authorized rewriting `AGENTS.md` per this brief, 2026-10-18

## Objective

Every session loads `AGENTS.md` in full: 240 lines, 14.5 KB, with 34 task and ADR citations and dated history that the ADRs already own. The chain that leads to it is also inconsistent: `.ai-layout.json` resolves to `.ai/AGENTS.md`, a missing file, and the human's global rules contradict this repo. Make `AGENTS.md` rules and commands only, gate its size, make the declaration valid, and propose the global wording.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `AGENTS.md` | 240 lines; *Commands* 84 lines (5.8 KB) and *Git rules* 73 (4.5 KB) are 70% of it |
| Section names | cited by agents, loops and skills: *Commands*, *Git rules*, *Definition of done*, *Destructive changes*, *Security and secrets*, the task report |
| `.ai-layout.json` | `{"root": ".ai/", "entrypoint": "AGENTS.md"}`; `layout-declaration.md` calls an entrypoint naming a missing file malformed; no gate reads it |
| Live-file budgets | `tests/validate.sh` lines-per-file loop; a budget changes only by amending `ADR-0033` |
| Global rules | `~/.claude/CLAUDE.md` → `~/.config/opencode/AGENTS.md`, outside the repo. Conflicts: brief naming `S###_…T###_…`, `20.PLAN.md`, commit hashes in the brief (`ADR-0033` forbids) |

## Scope

- In: rewrite `AGENTS.md`; move any rationale with no other owner to its ADR or the runbook; an `AGENTS.md` budget in the live-file loop and `ADR-0033`; `.ai-layout.json` points at an existing file; a gate check of the declaration; proposed global wording.
- Out: changing any rule's meaning; renaming a section; other projects' `AGENTS.md` and the migration scaffold; editing the global file, which the human applies.

## Likely files

- `AGENTS.md`, `.ai-layout.json`, `tests/validate.sh`
- `.ai/decisions/0033-concise-artifacts.md`, `docs/operations/runbook.md`, ADRs that gain a moved sentence
- `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`

## Execution plan

1. For each paragraph in `AGENTS.md`, list the rule it states and the owner of its rationale (ADR, runbook, skill). Write the list into the execution log.
2. Move each rationale that has no other owner to the right ADR or runbook section.
3. Rewrite `AGENTS.md`: same sections and order, imperative rules and commands, one link per rule to its owner, no dates or incident narrative. Target ≤ 120 lines.
4. Add `AGENTS.md:120` to the live-file loop; amend `ADR-0033` clause 4 to name it.
5. Set `.ai-layout.json` to an existing entrypoint (`README.md`, which is the layer's index and points to `AGENTS.md`). Gate the declaration: known keys only, relative `root` that exists, entrypoint that exists.
6. Red-prove both checks: `AGENTS.md` at 121 lines, and today's `.ai-layout.json`, must fail.
7. Draft the global wording: brief naming, active-plan file and the commit record defer to the project's convention. Hand it to the human in the task report.

## Acceptance criteria

- [x] `AGENTS.md` ≤ 120 lines; every section heading unchanged; no dated narrative.
- [x] Every removed rationale is found, by `grep`, in its owner; the log lists each.
- [x] Every rule in the old file still has a sentence in the new one (log: old rule → new line).
- [x] The gate fails at 121 lines and on a declaration whose entrypoint is missing; passes at 120 and on the new one.
- [x] The proposed global wording removes all three conflicts and names no repo-specific path.

## Mandatory validations

- [x] tests/validate.sh
- [x] both new checks against `HEAD` (red proof)

## Risks and rollback

- **A rule is lost in the rewrite.** The old-rule → new-line mapping is the check; any rule with no line stops the task.
- **A component cites a sentence, not just a section.** `grep -rn "AGENTS.md" agents loops skills docs` before and after; each citation must still resolve.
- **The budget is chosen, not derived** (`ADR-0008`'s warning). `ADR-0033`'s amendment records why 120: half today's size, with every section intact.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `AGENTS.md` | 120 lines, 6.5 KB (was 240, 14.5 KB); same 12 sections; no dates, no `TASK-` ids |
| `tests/validate.sh` | `AGENTS.md:120` in the live-file loop; `.ai-layout.json` checked per `layout-declaration.md` |
| `.ai-layout.json` | `entrypoint: README.md` → `.ai/README.md` |
| `ADR-0033` | amended: `AGENTS.md` budget, clause 4 |
| `project-workflow` | 7.1.2: `references/dashboard.md` names `check-dashboard.sh` |

Next: the human applies the proposed global wording (task report).

## Execution log

- 2026-10-18 · Claude Code (Opus 5.5) · done
  - Evidence: rule map, old section → owner of the cut reasons: *Commands* → ADR-0009, 0024, 0029, 0035, 0037, runbook *Environment variables*, `references/dashboard.md`, `VENDORED.md`; *Git rules* → ADR-0007, 0023, 0028, 0033, runbook *Authenticating a push*, `check-private-names.sh`; others kept whole. Only orphan: `check-dashboard.sh`, moved to `references/dashboard.md`
  - Evidence: every old rule has a new line; force-push kept once, under *Destructive changes*; every citation naming a section or quoting a rule still resolves (*Commands*, *Git rules*, the hostname and MCP rules)
  - Evidence: `tests/validate.sh` at `HEAD`'s `.ai-layout.json` → `LAYOUT: … entrypoint 'AGENTS.md' is not a file in '.ai/'`; scratch worktree: 121 lines → `LIVE: AGENTS.md is 121 lines, over its budget of 120`; unknown key, absolute root, missing root, bad JSON each fail
  - Evidence: `check-dashboard.sh` → `OK (36 assertions, sprint-brief fixture)`; `tests/validate.sh` → `validate.sh: OK`
  - Deviation: `project-workflow` bumped to 7.1.2 to own the `check-dashboard.sh` sentence
