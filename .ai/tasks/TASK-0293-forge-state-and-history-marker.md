# TASK-0293 — Planning skills on a forge: a state file stays, and a tag marks the removed history

## Status

- Status: review
- Owner: agent (Claude Code)
- Branch: agent/compass-3556f4
- Created: 2026-11-13
- Updated: 2026-11-13
- Applies to: `skills/project-workflow/`, `skills/project-migration/`, `plugins/ai-toolbox-skills/`
- Source: the human's review of the planning-skills explainer, 2026-11-13 ("apply all fixes"), gaps 1 and 2 of 3; gap 3 (one convention) is a separate ADR

## Objective

Close two gaps in how the planning skills behave on a GitLab or GitHub tracker. First, project-workflow kept no file saying where the project stands, so a cold session had only the board; it now keeps `.ai/20.PLAN.md` from a forge variant with no task list. Second, moving a repository to a forge `git rm`-ed the old planning, task and session files with nothing pointing at them; both skills now tag the last commit that holds them, name the tag in the kept state file, and offer to file completed tasks as closed issues.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `skills/project-workflow/SKILL.md`, `templates/reference/tracker.md` | a forge copies only conventions, decisions and reference |
| `skills/project-migration/SKILL.md` phase 3 | `git rm` right after filing the open work |

## Scope

- In: the forge `20.PLAN.md` template and the scaffold step that copies it; the `pre-forge-migration` annotated tag and the state-file line, before `git rm`; the phase-1 choice to file completed tasks as closed issues with a `migrated` label; tracker.md's "Changing the tracker" section; versions 7.2.0 and 5.2.0; the plugin copy.
- Out: one convention for both skills (the ADR superseding ADR-0013); a gate check of the forge plan's content.

## Likely files

The two skills' `SKILL.md`, `tracker.md`, `size-budgets.md`, `00.CONVENTIONS.md`, `governance-spec.md`, the new `templates/forge/20.PLAN.md`, and their copies under `plugins/ai-toolbox-skills/`.

## Execution plan

1. Builder worker in an isolated worktree writes both changes and regenerates the plugin copy.
2. Coordinator reviews the diff, brings it here, runs the skills' checks and the gate.

## Acceptance criteria

- [x] On a forge, project-workflow's scaffold step copies `templates/forge/20.PLAN.md` as `.ai/20.PLAN.md`: state, open milestone and board by name, blocked, next action, no task list
- [x] Both skills require the annotated `pre-forge-migration` tag, pushed, and a state-file line naming it, before the `git rm` commit
- [x] project-migration phase 1 asks whether to also file completed tasks as closed issues; tracker.md does the same for a tracker change
- [x] The plugin copy matches a fresh build

## Mandatory validations

- [x] `python3 scripts/build-plugin.py --check` → matches; `bash scripts/sync-templates.sh --check` → exit 0; `bash skills/project-workflow/scripts/check-tracker.sh` → OK (49 cases)
- [x] tests/validate.sh: in the pre-commit hook

## Risks and rollback

- The forge plan's content and the tag step are instructions an agent follows; no gate checks them.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `skills/project-workflow/` 7.2.0 | forge `20.PLAN.md` template; scaffold, tracker.md and size budgets say a forge keeps it; "Changing the tracker" section with the tag |
| `skills/project-migration/` 5.2.0 | phase-1 closed-issue question; phase-3 tag and `CURRENT_STATE.md` line before `git rm` |

Next: the human's read; the one-convention ADR follows separately.

## Execution log

- 2026-11-13 · Claude Code (Opus 5.5, coordinator; builder worker F1, Sonnet 5.5) · both gaps written in an isolated worktree, moved here as one task because both edit the same paragraphs
  - Evidence: the three checks above; diff reviewed by the coordinator
  - Deviation: the human's fixes 1 and 2 land as one task, not two, since their hunks interleave in the same files
