# TASK-0303 — Landing docs push origin only, and briefs use the schema's review status

## Status

- Status: done
- Owner: agent (Claude Code)
- Branch: agent/reload-plugins-force-5e9d29
- Created: 2026-11-13
- Updated: 2026-11-13
- Applies to: `docs/operations/runbook.md`, `scripts/worktree.sh`, `.ai/tasks/` briefs
- Source: the human's request (2026-11-13), after mapping the GitLab workflow found the drift.

## Objective

Make every landing instruction match `AGENTS.md` and ADR-0028 (push `origin` only; GitLab's push mirror carries `github`, TASK-0170). Make every brief's Status use the schema's one-word values (`skills/project-migration/schemas/task.md`): 11 briefs say `in review`, the schema says `review`.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `docs/operations/runbook.md` "Landing work" | its block ends `git push github HEAD:master` |
| `scripts/worktree.sh` | header comment and the `add` hint both say to push `github` |
| `.ai/tasks/*.md` | 11 briefs read `- Status: in review` |

## Scope

- In: drop the `github` push from the runbook's landing block and `worktree.sh` (header and `add` output), saying the mirror follows by itself and is never pushed; rewrite `Status: in review` to `Status: review` in the 11 briefs, nothing else in them; this brief, `TODO.md`, `GOALS.md` and the S11 next-free-id line.
- Out:
  - A gate check for the Status vocabulary: worth its own task.
  - Session records: none since 2026-09-30, but no rule requires one per task.
  - The `Unexercised:` cap: three rows are open (B-057, B-058, B-074), at the cap, not over.
  - GitLab project settings (protected branches, "Pipelines must succeed"): the human's, outside the repo.

## Likely files

- `docs/operations/runbook.md`, `scripts/worktree.sh`
- the 11 `.ai/tasks/TASK-*.md` with `Status: in review`
- this brief, `.ai/tasks/TODO.md`, `.ai/GOALS.md`, `.ai/planning/sprints/SPRINT-S11-claude-alignment.md`

## Execution plan

1. Allocate TASK-0303 (the first id free on origin/master) and write this brief and its board lines.
2. Edit the runbook block and `worktree.sh` header and `add` hint.
3. Rewrite the 11 Status lines.
4. Review the diff independently; run `bash -n scripts/worktree.sh` and `tests/validate.sh`.

## Acceptance criteria

- [x] `grep -rn "push github" docs/ scripts/` finds no instruction to push `github`
- [x] `grep -rln "^- Status: in review" .ai/tasks/` finds nothing
- [x] Each rewritten brief differs from before by its Status line only
- [x] `scripts/worktree.sh` still parses (`bash -n`) and its `add` hint ends at the `origin` push

## Mandatory validations

- [x] `bash -n scripts/worktree.sh`
- [x] `tests/validate.sh`

## Risks and rollback

- Another session may be editing one of the 11 briefs; its rebase would conflict on one line.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `docs/operations/runbook.md` | "Landing work" ends at the `origin` push; the mirror is said to follow by itself |
| `scripts/worktree.sh` | header and `add` hint say GitLab mirrors `github`, never pushed by hand |
| 11 briefs | `- Status: review`, nothing else changed |

Next: a gate check for the Status vocabulary, as its own task.

## Execution log

- 2026-11-13 · Claude Code (Opus 5.5, coordinator; Haiku 5.5 writer, Sonnet 5.5 reviewer) · drift fixed, independent review clean
  - Evidence: `grep -rn "push github" docs/ scripts/` → no match; `grep -rln "^- Status: in review" .ai/tasks/` → no match; `bash -n scripts/worktree.sh` → exit 0
  - Evidence: `bash tests/validate.sh` → `validate.sh: OK`, exit 0
  - Deviation: first committed as TASK-0292; master had meanwhile given 0292 to another task and closed three of the briefs, so it was renumbered to TASK-0303 and replayed on origin/master (11 briefs)
