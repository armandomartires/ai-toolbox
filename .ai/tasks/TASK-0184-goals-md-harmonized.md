# TASK-0184 — Harmonize every task into .ai/GOALS.md, and make keeping it current a rule

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-27
- Updated: 2026-10-27
- Applies to: `.ai/GOALS.md` (new), `AGENTS.md` (Definition of done), `.ai/tasks/TODO.md`
- Source: human request 2026-10-27, after `TASK-0180`: the Compass pane shows no board here; review the history, put every task in `GOALS.md`, and tell `AGENTS.md` that `GOALS.md` must be kept current too

## Objective

Give the Compass pane a board for this repository: every task, decision and review in `TODO.md`, and the open backlog rows, as sprints and stories in `.ai/GOALS.md`; and make updating it part of the Definition of done.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `.ai/tasks/TODO.md` | 186 lines of sprint membership; the owner of what belongs to which sprint |
| Task briefs | their `**Status**` decides an open item's marker |
| `.ai/planning/BACKLOG.md` | seven `waiting` rows |
| `AGENTS.md` | exactly 120 lines, its gated budget (`ADR-0033`) |

## Scope

- In: one `## ` sprint per `TODO.md` section, in chronological order (`Post-Sn` groups kept as their own sprints); one story per line, marker from `TODO.md` (a not-done item takes its brief's status); each story's brief as its detail line; the seven open backlog rows as plain items under *Backlog*; a one-clause edit to the Definition of done.
- Out: dates and sprint goals (the sprint files own them); `TASK-0182` and `TASK-0183`, which exist only as uncommitted files in another session's checkout and join `GOALS.md` and `TODO.md` when that session commits them; a generator kept in the repository (the file is maintained by hand from here).

## Likely files

`.ai/GOALS.md`, `AGENTS.md`, `.ai/tasks/TODO.md`, `.ai/context/CURRENT_STATE.md`

## Execution plan

1. Read `TODO.md`, the briefs' statuses and `BACKLOG.md`.
2. Generate `GOALS.md` once from them with a throwaway script; check counts against `TODO.md`.
3. Add the rule to the Definition of done without passing 120 lines.
4. Validate, commit, push `origin`.

## Acceptance criteria

- [x] `GOALS.md` holds 16 sprints and one story per `TODO.md` line, plus the seven open backlog rows.
- [x] Done items are `[x]`; the only open one is `TASK-0176`, `[!]` from its brief.
- [x] `AGENTS.md` names `.ai/GOALS.md` in the Definition of done and is still 120 lines.

## Mandatory validations

- [x] tests/validate.sh

## Risks and rollback

- **A second record of the same facts.** `TODO.md` stays the owner of sprint membership and the briefs of status; `GOALS.md` mirrors them for the pane and can drift. The Definition of done is the control.
- **A starter `.ai/GOALS.md` left untracked in the main checkout** by `/goals init` will block the pull; delete it first.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `.ai/GOALS.md` | 16 sprints, 193 items: 185 done, `TASK-0176` blocked, this task, seven backlog |
| `AGENTS.md` | Definition of done requires `.ai/GOALS.md` current; 120 lines |

Next: add `TASK-0182` and `TASK-0183` to `TODO.md` and `GOALS.md` when their session commits them.

## Execution log

- 2026-10-27 · Claude Code (Sonnet 5.5) · done
  - Evidence: the throwaway generator counted `{'x': 185, '!': 1}` from 186 `TODO.md` items
  - Deviation: `TODO.md` marks `TASK-0176` `[ ]`; its brief is `in_progress`/paused at a token, shown here as blocked
