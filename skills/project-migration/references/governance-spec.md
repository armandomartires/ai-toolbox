# Governance file conventions

Authoritative contents for each file the scaffold creates. Read when writing or reviewing one.

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

Keep `plans/`, `reviews/`, and `BACKLOG.md` as stubs until real work produces content.

## AGENTS.md

Single source of shared agent instructions. Must cover: objective and scope; security rules; technology stack; commands to install, run, test, validate, deploy; coding conventions; project structure; Git rules; documentation rules; definition of done; ambiguity policy; secrets policy; destructive-change policy; references to planning files; the mandatory task process.

Concise — not an execution diary or a plan dump. Keep it under ~500 lines and link to `docs/` for depth; bloated context files degrade every session, and the fix is deleting, not adding. A pre-commit hook that enforces the line budget is a reasonable safeguard.

## .ai/context/CURRENT_STATE.md

Lets a fresh agent orient in one read: current objective; product status; completed and incomplete features; blockers; risks; expected branch; latest relevant commit; recommended next action; known tests and validations; environment where it was validated; differences between the environment tiers that exist. Update at the end of any task that changes project status.

## .ai/context/PROJECT_MAP.md

Main modules, responsibilities, entry points, data flows, integrations, configuration, persistence, tests, scripts, and fragile or unknown areas. Document relationships, not individual files.

## .ai/planning

- `ROADMAP.md` — vision, objectives by phase, milestones, dependencies, risks, phase-advance criteria, relation between phases/sprints/tasks.
- `BACKLOG.md` — candidate work not yet executable: id, title, priority, value, dependencies, risk, status, criteria to become a task.
- `SPRINT-CURRENT.md` — active sprint only: objective, time reference, included tasks, recommended order, dependencies, success criteria, risks, completed and blocked tasks, next task.

## .ai/tasks/TASK-XXXX.md

Small enough for a weaker agent to finish without reconstructing the project. Sections, in order:

```markdown
# TASK-XXXX — Title

## Objective
## Minimal context
## Scope
### Included
### Not included
## Preconditions
## Likely files
## Execution plan
## Acceptance criteria
- [ ]
## Mandatory validations
- [ ]
## Risks and rollback
## Dependencies
## Expected result
## Status
- Status: planned
- Owner: agent/human
- Created:
- Updated:

## Execution log
### Attempt 1
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
```

Allowed statuses: `planned`, `ready`, `in_progress`, `blocked`, `review`, `done`, `cancelled`. Not `done` while validation is missing, acceptance criteria are unmet, changes are uncommitted or unpushed, or the log lacks the commit and push result.

## .ai/sessions and .ai/decisions

Sessions are short records, not transcripts: date, agent/model, objective, consulted context, tasks worked, decisions, important commands and validations, problems, commit/push, next action.

ADRs are for lasting decisions — framework choice, data model, auth strategy, deployment policy, environment architecture, third-party integration, compatibility trade-offs. Not for small changes.

## Work cycle

Every task: (1) gather context — `AGENTS.md`, subdirectory instructions, current state, roadmap, sprint, task, git status, constraints; (2) perceive — state what is known, what is ambiguous, and assumptions, invent nothing; (3) plan — next action, split if oversized, files in play, acceptance criteria, validation commands, stop conditions, ask the user on material ambiguity; (4) act — small reversible changes, no unrelated files; (5) observe — capture output, errors, tests, git changes, update status; (6) evaluate — compare against acceptance criteria, run tests/lint/types/build, check regressions and doc coherence, diagnose before retrying; (7) repeat or stop — never keep changing things to "improve" outside scope.

## Git rules

Before editing: check `git status`, branch, remote, uncommitted changes, recent commits. Never delete or overwrite human changes without authorization. On completion: validate, review `git diff`, commit only task-related changes with a clear message, push, confirm the push, record hash and branch in the task status. Pre-existing unrelated changes are neither committed nor deleted — separate them, or stop and ask. Delegating mechanical steps (status, diff review, basic test runs) to a subagent is allowed; verifying the result stays with the main agent.

## Definition of done

Implementation finished; acceptance criteria satisfied; relevant tests passed; known failures documented; documentation updated; no secrets included; diff reviewed; task marked `done`; local commit exists; commit pushed; hash recorded; push result confirmed; next action clear.

## Planning vs implementation sessions

Planning sessions produce roadmap, backlog, sprint, and executable tasks with acceptance criteria, validations, dependencies, risks, and rollback — and do not write code unless asked. They also state which tasks a weaker executor can take and which decisions need human or advanced-model review. Implementation sessions read `AGENTS.md` → `CURRENT_STATE.md` → sprint → task, confirm the task is ready, present a short plan, implement the smallest sufficient change, validate progressively, then close out per the definition of done. A task that turns out too large is split and re-planned, never silently half-executed.
