# TASK-0103 — The Claude Code binding checks a closed commit's files against the declared paths

## Objective

Close `B-032`: port `TASK-0097`'s check to the Claude Code Workflow binding.
After the `closer` commits, the files in the commit must all be paths the
task declared; anything else **halts the run**.

## Minimal context

`TASK-0092` finding 18: the closer's permissions admit `git add -- .`, quoted
or not, so the glob layer cannot stop a bulk stage. `TASK-0097` closed that
at the OpenCode driver by reading `git show --name-only HEAD`.
`REVIEW-0012` raised `B-032` because the Claude Code template's
`verifyHead()` reads HEAD, parent, porcelain and message only.

The Workflow script cannot run git, so — like the rest of `verifyHead()` —
the file list is **reported by a second agent** (the `preflight` role) and
checked by the script. A witness, not a gate; the binding already says so of
the other three facts.

**Halt, not park**, for `TASK-0097`'s reason: the commit exists, and undoing
it is a history rewrite (`loop.md`, "Escalate without retrying"). A report
with **no** file list also halts — an absent check is not a passed one.

Found while scoping: the test file's header gave `node --test <dir>/tests/`
as the run command, which fails on node 22.23 with `MODULE_NOT_FOUND`
(resolving the directory as a module); passing the file works. Corrected in
the same header, since this task edits that file.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `…/bindings/claude-code/unattended-run.js` | `TASK-0087` | `verifyHead()` without files; 23 tests green (run by file) |
| `…/bindings/opencode/driver.py` | `TASK-0097` | the reference check |

## Scope

### Included

- `VERIFY_SCHEMA` gains `files`; `verifyHead()` asks for
  `git show --name-only --format= HEAD`; `step10Close()` halts on any file
  outside the declared set, or on no list.
- Two tests: a stray file halts with its name and no `close`; the
  verification prompt and schema ask for the list.
- `binding.md`: the cross-check paragraph names the file list.

### Not included

- `TASK-0099`'s log-line check: there is no `closer` agent file for Claude
  Code (the role is OpenCode-only), so the Workflow's closer prompt is its
  own; recorded, not ported.

## Likely files

`…/claude-code/unattended-run.js`, `…/claude-code/tests/unattended-run.test.mjs`,
`…/claude-code/binding.md`, `.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`,
`.ai/planning/SPRINT-CURRENT.md`, `.ai/context/CURRENT_STATE.md`.

## Execution plan

1. Tests first; watch them fail.
2. Implement; run the suite; revert-prove.
3. `binding.md`; state; commit; push.

## Acceptance criteria

- [x] A commit holding a file outside the declared paths halts the run,
      naming the file; no `close` is journalled.
- [x] The verification asks for the file list, and its schema requires it.
- [x] Both tests fail with the change reverted.
- [x] The Claude Code suite and `tests/validate.sh` pass.

## Mandatory validations

- [x] `node --test …/claude-code/tests/unattended-run.test.mjs`
- [x] `tests/validate.sh`

## Risks and rollback

- A legitimate file the implementer changed but did not report now halts a
  run — the intended direction, as in `TASK-0097`. Rollback: `git revert`.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `unattended-run.js` | `VERIFY_SCHEMA.files`; `verifyHead()` asks for the commit's file list; `step10Close()` halts on undeclared paths or a missing list |
| `tests/unattended-run.test.mjs` | + 2 tests (25); header's run command corrected to name the file |
| `binding.md` (Claude Code) | The cross-check paragraph names the file list |
| Not ported | `TASK-0099`'s log-line check — no Claude Code `closer` definition exists |

**Next task starts here**: `B-029`…`B-034` closed; `B-025`, `B-035` open.

## Status
- Status: done
- Owner: agent (instruction: human, 2026-09-25)
- Created: 2026-09-25
- Updated: 2026-09-25

## Execution log
### Attempt 1
- Date: 2026-09-25
- Agent: Claude Opus 5.5 (1M context)
- Actions: tests first; the check; binding paragraph; header fix.
- Validation: the documented directory form `node --test …/tests/` →
  `tests 1, fail 1` (`MODULE_NOT_FOUND`) **before any change**; by file →
  23 pass. New tests red (`not ok 16`, `not ok 17`), then 25 pass. Script at
  `HEAD` → the same two red; restored and `cmp`-verified.
  `tests/validate.sh` OK.
- **Deviation — process:** this brief was written *after* the tests and
  the fix, not before (the global rule is brief first). The work was a
  direct port of `TASK-0097`, scoped by `B-032`'s row; the order was still
  wrong, and is recorded rather than smoothed over.
- Result: **done.**
- Commit: `98ce299`. Pre-commit hook ran `tests/validate.sh`: OK.
- Push: **confirmed** — `5ca7556..98ce299`, local and remote hash equal.
