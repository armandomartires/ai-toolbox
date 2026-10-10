# Governance file conventions

What each scaffolded file must contain. Read this when writing or reviewing one. The principle (ADR-0033 in ai-toolbox): each file is one small module with its identification first; procedures are kept separate from records, and git is the record.

## Target structure

```text
AGENTS.md  CLAUDE.md(symlink)  README.md  CHANGELOG.md  .gitignore
.ai/
  README.md
  context/    CURRENT_STATE.md  PROJECT_MAP.md  GLOSSARY.md
  decisions/  ADR-0001-*.md
  planning/   ROADMAP.md  BACKLOG.md  SPRINT-CURRENT.md  plans/PLAN-*.md
  tasks/      TODO.md  TASK-*.md  completed/
  sessions/   INDEX.md  SESSION-*.md
  reviews/    REVIEW-*.md
  templates/  PLAN.md  TASK.md  SESSION.md  ADR.md  REVIEW.md
docs/  architecture/ development/ operations/ deployment/
src/  tests/  scripts/
```

Keep `plans/`, `reviews/` and `BACKLOG.md` as stubs until real work produces content.

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
- planning references
- the task process

Keep it under ~500 lines and link to `docs/` for depth. When it grows, the fix is to delete material, not to add more.

## Live files: state, not history

These files are read every session, so they hold the current state only. History lives in git (`git log -p <file>`).

| File | Holds | Budget |
|---|---|---|
| `context/CURRENT_STATE.md` | Objective, status, components and versions, open gaps, standing decisions (as ADR links), environment notes, last few changes as one line each, next action | ≤ 200 lines |
| `context/PROJECT_MAP.md` | Modules, entry points, data flows, integrations, fragile areas: relationships, not file lists | — |
| `planning/ROADMAP.md` | One `## Phase N — Title` per phase, with exit criteria; a finished phase collapses to 2–3 lines | — |
| `planning/BACKLOG.md` | One table row per item (`schemas/backlog.md` owns the columns); "Ready when" is one sentence | — |
| `planning/SPRINT-CURRENT.md` | The active sprint only: objective, tasks in order, success criteria, next task | ≤ 80 lines |
| `tasks/TODO.md` | `## Sprint S#` headings; one `- [ ] TASK-NNNN — title` line per task | ≤ 400 lines |

To update a live file, edit the state it describes. Never prepend a dated narrative.

## Tasks, ADRs, reviews, sessions, plans

Do not write these from an outline. Generate each one from its schema with `scripts/new-artifact.sh --kind task|adr|review|session|plan`, and check it with `scripts/check-artifact.sh`.

**A task brief** (`schemas/task.md`, at most 90 lines):
- It opens with `## Status`: status, owner, dates, `Applies to:`, `Source:`.
- Then the procedure: Objective, Inputs, Scope (In / Out), Likely files, Execution plan, Acceptance criteria, Mandatory validations, Risks and rollback.
- Then the record: Outputs / handover, and an Execution log of one line per attempt plus its evidence.
- Allowed statuses: `planned`, `ready`, `in_progress`, `blocked`, `review`, `done`, `cancelled`.
- A task is not `done` while a validation is missing, a criterion is unmet, or the change is not committed and pushed.

**An ADR** (`schemas/adr.md`, at most 80 lines) records a lasting decision: a framework, data model, auth, deployment, an environment, an integration, a compatibility trade-off. It does not record small changes. It opens with `**Status**:` and `**Date**:`.

**A session record** is a short field list, not a transcript.

## Work cycle

Every task goes through seven steps:
1. **Gather context:** `AGENTS.md`, current state, sprint, task, git status.
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
2. Commit only this task's changes, with a subject `<Imperative summary> (TASK-NNNN)`.
3. Push, and confirm the remote holds the same hash.

Git is the record: the brief does not carry its own hash, and no follow-up commit adds one. Leave unrelated pre-existing changes alone: separate them from the commit, or stop and ask.

## Task report

Every task ends with this report in chat, one line per field:

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
- They produce the roadmap, the backlog, the sprint and executable tasks.
- They write no code unless asked.
- They mark which tasks a weaker executor can take.

**Implementation sessions:**
1. Read `AGENTS.md`, then `CURRENT_STATE.md`, then the sprint, then the task.
2. Present a short plan.
3. Implement the smallest change that suffices, and validate as you go.
4. Close out per the definition of done.

If a task turns out too large, split it and re-plan it; never leave it half-executed without saying so.
