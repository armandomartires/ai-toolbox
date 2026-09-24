# TASK-0095 — Roles read the paths the driver resolved; they never glob for them

## Objective

Fix the S10.7 dry run's halt (`TASK-0092` finding 1): make every OpenCode
role read a file at the exact path the driver hands it, instead of globbing
for it, and make loop step 2 and the `preflight` role say so.

## Minimal context

**Confirmed 2026-09-24:** OpenCode's glob tool does not see dot-directories —
in a throwaway repository, `.hidden/TASK-1-*.md` returned *"No files found"*
while `visible/TASK-1-*.md` returned the file (opencode 1.18.31). This
repository's task files live under `.ai/`. The dry run's `preflight` role
globbed for them, found nothing, and — correctly — halted the run, while the
driver's own structural check had resolved each to exactly one committed
file.

**The human's decision, 2026-09-24 (multiple choice; the agent chose none):**
*"Driver hands paths, role reads"* — the driver's prompts give each role the
exact resolved paths and say to read them, never glob; loop step 2 and the
`preflight` role say the driver resolves the file and the role reads it.

The driver already passes each task's resolved path (`task_file`, and
`tasks[].file` to preflight). What is missing is the instruction, in three
places.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/unattended-ops/templates/bindings/opencode/driver.py` | `TASK-0086` | `prompt()` passes paths; says nothing about how to open them |
| `loops/unattended-run/loop.md` step 2 | `TASK-0061` | "For each task, glob its file…" |
| `agents/preflight/agent.md` | `TASK-0063` | No instruction to read by exact path |

## Scope

### Included

- `driver.py`: `prompt()` tells every role to read given paths directly and
  never glob for them, citing the finding; the preflight instruction says the
  driver has resolved each file.
- A stub test asserting the preflight prompt carries each resolved path and
  the read-not-glob instruction, shown failing when the change is reverted.
- loop.md step 2, and `agents/preflight/agent.md`: one sentence each.
- Re-emit the roles (`install.sh link`) so the OpenCode `preflight` carries
  the change.

### Not included

- The Claude Code binding: its script has no filesystem, so its preflight
  still resolves the file itself; whether Claude Code's glob sees
  dot-directories is untested and recorded as such.
- The intermittent stall (`TASK-0092` finding 2).

## Likely files

`skills/unattended-ops/templates/bindings/opencode/driver.py`,
`skills/unattended-ops/templates/bindings/opencode/tests/test_driver.py`,
`loops/unattended-run/loop.md`, `agents/preflight/agent.md`,
`.ai/tasks/TODO.md`, `.ai/context/CURRENT_STATE.md`.

## Execution plan

1. Add the test; watch it fail.
2. Change `prompt()` and the preflight instruction; watch it pass; run both
   suites.
3. Amend loop step 2 and the preflight role.
4. `install.sh link`; `tests/validate.sh`; commit; push.

## Acceptance criteria

- [x] Every prompt the driver sends says to read given paths directly and
      never glob for them.
- [x] The preflight prompt carries each task's resolved path and says the
      driver resolved it.
- [x] The new test fails when the instruction is removed.
- [x] loop.md step 2 says the driver resolves the file where it can and the
      role reads it at that path.
- [x] `agents/preflight/agent.md` says to read by exact path, with the reason.
- [x] OpenCode's emitted `preflight.md` carries the change after re-install.
- [x] Both binding suites and `tests/validate.sh` pass.

## Mandatory validations

- [x] `python3 -m unittest discover -s tests` (OpenCode binding dir)
- [x] `node --test …/claude-code/tests/unattended-run.test.mjs`
- [x] `tests/validate.sh`

## Risks and rollback

- An instruction is prompt-level; a role could still glob. The pilot's next
  dry run is where that shows. Rollback: `git revert`.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `driver.py` | `prompt()` tells every role to read given paths and never glob, with the reason; the preflight instruction says the driver resolved each file |
| `tests/test_driver.py` | + one test (now 18 driver tests, 24 in the suite) |
| `loops/unattended-run/loop.md` step 2 | Driver resolves where it can; the role reads the path |
| `agents/preflight/agent.md` | + "Do not glob for a task file you were given a path to", with the observed reason |
| `~/.config/opencode/agents/preflight.md` | Re-emitted with the change |

**Next task starts here**: the dry-run halt's cause is addressed in the
driver, the loop and the role. The pilot's other blocker — the stall — is
diagnosed in `TASK-0092` and awaits the human's choice on plugins.

## Status
- Status: done
- Owner: agent (decision: human)
- Created: 2026-09-24
- Updated: 2026-09-24

## Execution log
### Attempt 1
- Date: 2026-09-24
- Agent: Claude Opus 5.5 (1M context)
- Actions: test first (red); instruction added to `prompt()` and to the
  preflight step; loop step 2 and the preflight role amended; roles
  re-emitted.
- Validation: new test red before, green after; instruction removed →
  `FAILED (failures=1)`, restored and `cmp`-verified; OpenCode suite OK;
  Claude Code suite 23/23; emitted `preflight.md` contains the new rule;
  `tests/validate.sh` OK.
- Result: **done** — prompt-level, as the brief's risk says; the next dry run
  is where a role that globs anyway would show.
- Commit: *(recorded in the follow-up commit)*
- Push: *(recorded in the follow-up commit)*
