# Governance file conventions

What each scaffolded file must contain. Read this when writing or reviewing one. This skill is the retrofit path into `project-workflow`'s one planning convention (ADR-0066 in ai-toolbox): the convention, its ids and the shape of every artifact are project-workflow's (`templates/00.CONVENTIONS.md`, `schemas/`), and this file adds only what a retrofit needs on top. The principle (ADR-0033): each file is one small module with its identification first; procedures are kept separate from records, and history is kept by the version control tool.

## Target structure

```text
AGENTS.md  CLAUDE.md(@AGENTS.md import)  README.md  CHANGELOG.md  .gitignore  tracker.conf
.ai/
  00.CONVENTIONS.md  10.CURRENT_STATE.md  20.PLAN.md  40.RISK_REGISTER.md
  30.ROADMAP.md  35.AD_HOC_TASKS.md                                     [files]
  decisions/  ADR-0001-*.md
  tasks/      S###.T###_Name.md                                         [files]
  reviews/    S###-checkpoint.md  YYYY-MM-DD-slug.md                    [files]
  sessions/   SESSION-*.md                                              [files]
  reference/  on-demand detail, copied from project-workflow
  id-map.tsv  archive/          only after migrate-layout.py moved an older layout
docs/  project-map.md  glossary.md  architecture/ development/ operations/ deployment/
src/  tests/  scripts/
```

`tracker.conf` names the work tracker: `files`, `gitlab` or `github` (absent means `files`). The `[files]` entries exist only for a files tracker. On a forge they are milestones, issues and the board; `20.PLAN.md` stays as its forge variant (state, no task list), the wiki holds end-user docs, and the task schema is the body of an issue. The full mapping is project-workflow's `templates/reference/tracker.md`.

There are no `.ai/templates/`, `tasks/TODO.md`, `planning/` or `context/`: artifacts are generated from project-workflow's schemas, and the briefs and the board are the task list.

## AGENTS.md

This is the single source of shared agent instructions. It must cover:
- objective and scope
- security and secrets
- technology stack
- commands (install, run, test, validate, deploy)
- conventions
- structure
- Git rules
- documentation rules
- definition of done
- ambiguity policy
- destructive-change policy
- planning references: the files, or the forge project and its board
- the task process

Keep it under ~500 lines and link to `docs/` for depth. When it grows, the fix is to delete material, not to add more.

## Live files: state, not history

These files are read every session, so they hold the current state only. History lives in the version control tool (`git log -p <file>`). Budgets are project-workflow's `reference/size-budgets.md`.

| File | Holds | Budget |
|---|---|---|
| `10.CURRENT_STATE.md` | Where the project is, components and their state, open items, standing decisions (as ADR links), environment and how to run the gate | ≤ 200 lines |
| `20.PLAN.md` | The open sprint only: tasks in flight, blocked, recently completed, next up | ≤ 80 lines |
| `30.ROADMAP.md` | The `S###_Name` sprint table, next up, and decisions explicitly deferred | — |
| `35.AD_HOC_TASKS.md` | One `### N. Title` entry per finding that is real and out of scope now | — |
| `40.RISK_REGISTER.md` | Rated risks and a `Last reviewed` date, walked at every sprint checkpoint | — |
| `docs/project-map.md` | Modules, entry points, data flows, integrations, fragile areas: relationships, not file lists | — |

To update a live file, edit the state it describes. Never prepend a dated narrative.

On a forge tracker, `10.CURRENT_STATE.md`, `20.PLAN.md` (forge variant) and `40.RISK_REGISTER.md` exist. The roadmap is the milestones by due date, the ad-hoc list is the `type::backlog` issues, and the plan's task list is the open milestone's board. The forge holds no budget, so keep issue bodies within the brief's budget anyway.

Moving to a forge removes the old planning, task, review and session files with `git rm`, so before that commit tag the last commit that holds them: an annotated `pre-forge-migration`, pushed with the branch. `20.PLAN.md` keeps one line (*History*) naming the tag and how to read it (`git show pre-forge-migration:.ai/tasks/`). The person may also choose, in Phase 1, to file completed tasks as closed issues (schema body, `migrated` label); the tag is required either way.

## Moving an older layout

A repository on the layout this skill used to scaffold (`.ai/context/`, `.ai/planning/`, `.ai/templates/`, `tasks/TODO.md`, `TASK-####-*.md` briefs) moves with project-workflow's `scripts/migrate-layout.py`: a dry run prints the old-to-new map, `--write` performs it with `git mv`, writes `.ai/id-map.tsv`, and rewrites path references but never an id in prose. Old ids stay in history and resolve through the map (ADR-0066, clause 5). The tool leaves the live files' content (roadmap table, ad-hoc entries, `GOALS.md` ids) to a follow-up commit. `SKILL.md`, Phase 3, is the procedure.

## Tasks, ADRs, reviews, sessions

Do not write these from an outline. Generate each one from project-workflow's schema with `skills/project-workflow/scripts/new-artifact.sh --kind task|adr|review|session`, and check it with `check-artifact.sh`. This skill holds no schema of them.

**A task brief**: sprint-prefixed id `S###.T###_Name`, the bold header fields, then Goal, Inputs, Plan, Verification and Outputs, plus a required `## Acceptance criteria` where the repository's gate asks for one (ADR-0066, clause 4). The statuses and their meaning on a forge are project-workflow's `reference/task-lifecycle.md` and `tracker.md`. A task is not `done` while a validation is missing, a criterion is unmet, or the change is not committed and pushed. Briefs written before a migration keep their old shape: they are history.

**An ADR** records a lasting decision: a framework, data model, auth, deployment, an environment, an integration, a compatibility trade-off. It does not record small changes. It is `decisions/ADR-NNNN-short-title.md`, opens with `**Status**:` and `**Date**:`, and the next number is the next free one.

**A session record** is a short field list, not a transcript.

## Work cycle

Every task goes through seven steps:
1. **Gather context:** `AGENTS.md`, `10.CURRENT_STATE.md`, `20.PLAN.md`, the task, git status.
2. **Perceive:** separate knowns from gaps and assumptions. Invent nothing.
3. **Plan:** scope, files, criteria, validation commands, stop conditions. Ask the human when an ambiguity is material.
4. **Act:** make small, reversible changes in scope.
5. **Observe:** capture outputs, errors, test results.
6. **Evaluate:** compare against the criteria, and diagnose before retrying.
7. **Repeat or stop.** Never "improve" outside the scope.

## Git rules

**Before editing:** check `git status`, the branch, the remote and recent commits. Never delete or overwrite human changes without authorization.

**On completion:**
1. Validate and review `git diff`.
2. Commit only this task's changes, with a subject `<Imperative summary> (S###.T###)`. On a forge the id is the issue: `(#123)`, with no closing keyword.
3. Push, and confirm the remote holds the same hash.

Git is the record: the brief does not carry its own hash, and no follow-up commit adds one. Leave unrelated pre-existing changes alone: separate them from the commit, or stop and ask.

## Task report

Every task ends with this report in chat, one line per field. On a forge, also post it as the issue's closing comment, then close the issue:

```
Result:   done | blocked | partial — one line
Changed:  file or component — what
Verified: command → observed output
Pushed:   origin ✓ @<short hash>   (or: not pushed — why)
Next:     one line
```

## Definition of done

A task is done when all of these hold:
- the implementation is finished
- the acceptance criteria are met
- the relevant tests pass
- known failures are documented
- the documentation is updated
- no secrets are included
- the diff has been reviewed
- the task is marked `done`
- the commit subject names the task
- the push is confirmed
- the next action is clear

## Planning vs implementation sessions

**Planning sessions:**
- They produce the roadmap, the ad-hoc list, the plan and executable tasks.
- They write no code unless asked.
- They mark which tasks a weaker executor can take.

**Implementation sessions:**
1. Read `AGENTS.md`, then `10.CURRENT_STATE.md`, then `20.PLAN.md`, then the task. On a forge, the sprint is the open milestone and the task is its issue.
2. Present a short plan.
3. Implement the smallest change that suffices, and validate as you go.
4. Close out per the definition of done.

If a task turns out too large, split it and re-plan it; never leave it half-executed without saying so.
