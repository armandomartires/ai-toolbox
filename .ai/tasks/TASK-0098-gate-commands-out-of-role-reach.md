# TASK-0098 — Keep every gate command outside the tree the roles can read

## Objective

Close `B-030`: make rule 2 structural against the **filesystem**, not only
against prompts. After this task no file inside the repository an OpenCode
run works in holds a gate command, so a role with `read` has nothing to open.

## Minimal context

`TASK-0092` finding 10: in `s10-7-live` the refuter **read
`.pilot-scratch/s10-7/gates.json`** — the gate map, commands included — with
its `read` tool. No prompt carried a command; the map simply sat inside the
worktree. `REVIEW-0012` rated this `B-030`, high.

**Two leaks, not one** (found while scoping this task):

1. The **map** itself, wherever the binding's `gate_map` slot points.
2. **`run-gate.sh start` copies each gate's `argv` into
   `<GATE_RUN_ROOT>/gates/<handle>/spec.json`**, and the driver sets
   `GATE_RUN_ROOT` to the evidence file's directory — which must be inside
   the repository, because `gate-runner` reads the evidence file and quotes
   figures from the gate logs beside it. So moving the map alone would still
   leave every command readable one directory over.

**The route (agent's choice; `B-030` named two candidates):** keep the map
**outside the repository**, and have `run-gate.sh` write no copy of a
command anywhere. Chosen over a per-role `read` deny because the map's path is
the consumer's, while every role already declares `worktree-only`, which
OpenCode emits as `external_directory: deny` — **observed denying reads
outside the worktree** 57 times in `s10-7-live2` (`TASK-0092` findings 7,
13). A per-role deny would need a vocabulary term naming a path the roles do
not know. The driver refuses a binding whose map resolves inside the
repository, so the condition is checked, not advised.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `…/bindings/opencode/driver.py` | `TASK-0086`…`0097` | `Binding` reads `gate_map` from anywhere |
| `…/bindings/opencode/run-gate.sh` | `TASK-0086` | `start` writes `spec.json` into the handle directory |
| `agents/*/agent.md` (the nine run roles) | S9 | all declare `worktree-only` |

## Scope

### Included

- `driver.py`: `Binding` refuses (exit 2, before any role runs) when
  `gate_map` resolves inside the repository root.
- `run-gate.sh`: `start` validates the gate against the map and writes no
  spec; the watchdog re-reads `argv` from `$GATE_MAP` by gate name.
- Tests: fixtures move the map outside the repository; a map inside is
  refused; after a full run **no file in the repository tree** holds an
  argv-only sentinel.
- Docs: the OpenCode `binding.md` (slot text, rule-2 row) and
  `references/gate-map.md` ("Where it lives").
- One live check against the real client: a run role asked to read a map
  outside the worktree is denied.

### Not included

- The Claude Code binding. Its `worktree-only` is `isolation: worktree`
  (partial, `emit-agents.py`), which redirects rather than refuses, so the
  same structure would not hold there; recorded, not fixed.
- `binding.md` itself, which carries paths and no commands.

## Likely files

`…/opencode/driver.py`, `…/opencode/run-gate.sh`,
`…/opencode/tests/test_driver.py`, `…/opencode/binding.md`,
`skills/unattended-ops/references/gate-map.md`, `.ai/planning/BACKLOG.md`,
`.ai/tasks/TODO.md`, `.ai/planning/SPRINT-CURRENT.md`,
`.ai/context/CURRENT_STATE.md`.

## Execution plan

1. Tests first — map moved out, the refusal test, the no-command-in-tree
   test; watch the last two fail.
2. Implement the refusal and the spec-free `run-gate.sh`; run both suites.
3. Revert-prove each change separately.
4. Live check against `opencode` 1.18.31.
5. Docs, backlog, state; commit; push.

## Acceptance criteria

- [x] A binding whose `gate_map` is inside the repository is refused with
      exit 2 and no role invoked.
- [x] After a full stubbed run, no file under the repository (ignored run
      files included) contains an argv-only sentinel.
- [x] Each of the two tests fails when its change is reverted.
- [x] The OpenCode suite and `tests/validate.sh` pass.
- [x] The live check's outcome is recorded verbatim, whichever it is.
      *(It stalled — see the log. Recorded, not established.)*

## Mandatory validations

- [x] `python3 -m unittest discover -s tests` (OpenCode binding dir)
- [x] `tests/validate.sh`

## Risks and rollback

- A consumer's existing binding with the map inside the repository stops
  starting. Intended: that binding leaks every command to every role.
  Rollback: `git revert`.
- A map edited between `start` and the watchdog's read would run the new
  entry. The driver owns the map and does not edit it mid-run.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `driver.py` | `Binding` refuses a `gate_map` resolving inside the repository (exit 2, before any role) |
| `run-gate.sh` | `start` validates through a `spec()` helper that prints to a pipe; the watchdog re-reads the entry from `$GATE_MAP`; **no `spec.json` is written** |
| `tests/test_driver.py` | Fixture map moved outside the repository; `make_repo(binding_overrides=, map_in_repo=)`; + 2 tests; the model-refusal test now also asserts *why* it refused (28 in the suite) |
| `binding.md` (OpenCode), `references/gate-map.md` | Slot text, rule-2 row and map section say *outside the repository*; the disk half's evidence stated as observed for skill directories, not for a map |
| Claude Code binding | **Not changed** — its `worktree-only` redirects rather than refuses |

**Next task starts here**: `B-030` closed; `B-029`, `B-031`…`B-034` open,
`B-025` to be re-statused. OpenCode suite 28 tests, green.

## Status
- Status: done
- Owner: agent (decisions: human — all backlog items, 2026-09-25)
- Created: 2026-09-25
- Updated: 2026-09-25

## Execution log
### Attempt 1
- Date: 2026-09-25
- Agent: Claude Opus 5.5 (1M context)
- Actions: tests first; driver refusal; `run-gate.sh` stores no command;
  docs; revert-proved each change on its own.
- Validation: before the fix, **both new tests red for the right reason** —
  `['.run/r1/gates/TASK-0001.a1.unit/spec.json'] != []` and `0 != 2`.
  After: `Ran 28 tests … OK`. Reverting `driver.py` alone → only the
  refusal test fails (`0 != 2`); reverting `run-gate.sh` alone → only the
  tree test fails (the `spec.json` path); each restored and `cmp`-verified.
- **Live check — not established.** `opencode` 1.18.31, the emitted
  `refuter`, model `perplexity-agent/anthropic/claude-sonnet-5`, a
  throwaway repository with the map in a sibling directory: the run
  **stalled with zero bytes of output** and was killed by `timeout` at
  300 s (exit 124); retried with `--pure`, the same at 240 s. Consistent
  with `TASK-0092` finding 2's stall, or with this session's sandbox; not
  diagnosed. The claim therefore rests on the pilot's 57 observed
  `external_directory` denials of reads outside the worktree, and
  `binding.md` says so.
- Result: **done.**
- Commit: `96475c2`. Pre-commit hook ran `tests/validate.sh`: OK.
- Push: **confirmed** — `5bd4951..96475c2`, local and remote hash equal.
