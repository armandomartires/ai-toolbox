# TASK-0101 — Run roles stop being told to read the skill at run time

## Objective

Close `B-029`: no run role's body tells it to open
`skills/unattended-ops/` during a run, and the OpenCode driver's prompt tells
every role that everything it needs is in the message and its definition.

## Minimal context

`TASK-0092` findings 7 and 13: OpenCode's `external_directory` rule (the
roles' `worktree-only`) denied every read under
`~/.claude/skills/unattended-ops/` and `~/.config/opencode/skills/unattended-ops/`
— **57 of 92 denied calls** in `s10-7-live2`, each a wasted model round —
because seven role bodies say *"read them there"* of `return-schemas.md`, and
the adjudicator's says *"read it every time"* of `verdicts.md`.

**The human's decision, 2026-09-25 (multiple choice, the recommended
option):** *stop pointing roles at it.* Citations stay, as provenance — the
reference still **owns** the rule — but no body instructs a read. Not the
other route (allow the path per role), which would widen nine boundaries.

**What this does not carry, found while scoping.** The return **shapes** are
in every prompt in both bindings (the OpenCode driver's `shape` argument; the
Claude Code binding's `schema`), so a role loses nothing there. The
adjudicator's **decision standard** is different: `verdicts.md`'s
definitions, misuse cases, park-versus-halt-run test and decision order are
**not** in its prompt. The pilot's adjudicator could not read them either and
still decided both tasks correctly, so this task removes nothing a role had —
but it is a gap, and it is raised as a backlog item for the human rather than
resolved here by copying the file into the body (one owner per fact).

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `agents/{preflight,task-planner,implementer,gate-runner,refuter,adjudicator,run-scribe}/agent.md` | S9 | instruct a read of the skill |
| `…/bindings/opencode/driver.py` | `TASK-0100` | `prompt()` says "never glob"; nothing about the skill |

## Scope

### Included

- The seven role bodies above: reword each read instruction to "owns …; the
  prompt carries it"; the adjudicator's standard paragraph says plainly what
  reaches it in a run and what does not, and that an unsettled case parks.
- `driver.py` `prompt()`: one sentence — the skill's files are outside the
  worktree and not to be opened; the message and the agent definition are
  everything.
- A test: every prompt carries that sentence. Revert-proved.
- `B-035` raised: the adjudicator's decision standard does not reach it.

### Not included

- `closer`, `park-steward` (they cite the reference without instructing a
  read) — unchanged.
- Re-emitting to `~/.config/opencode/agents/`: done once at the end of the
  backlog pass, after `TASK-0102` changes emission.

## Likely files

The seven `agents/*/agent.md`, `…/opencode/driver.py`,
`…/opencode/tests/test_driver.py`, `.ai/planning/BACKLOG.md`,
`.ai/tasks/TODO.md`, `.ai/planning/SPRINT-CURRENT.md`,
`.ai/context/CURRENT_STATE.md`.

## Execution plan

1. Test first; watch it fail.
2. The prompt sentence; the seven bodies.
3. A grep for any remaining read instruction; suite; `validate.sh`;
   `sync-registry.sh`.
4. Raise `B-035`; state; commit; push.

## Acceptance criteria

- [x] No run role body instructs reading `skills/unattended-ops/`
      (`grep -n "read them there\|read there\|read it there\|read it every time\|where you read it"`
      over `agents/` returns nothing).
- [x] Every OpenCode prompt tells the role not to open the skill's files; the
      test fails when the sentence is removed.
- [x] `B-035` is in the backlog with the gap stated.
- [x] The OpenCode suite and `tests/validate.sh` pass; the registry is
      unchanged or regenerated.

## Mandatory validations

- [x] `python3 -m unittest discover -s tests` (OpenCode binding dir)
- [x] `tests/validate.sh`
- [x] `scripts/sync-registry.sh`

## Risks and rollback

- A Claude Code adjudicator, which *could* read the skill, is now not told
  to. Accepted: uniform bodies, and `B-035` owns the standard reaching the
  role. Rollback: `git revert`.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `agents/{preflight,task-planner,implementer,gate-runner,refuter,run-scribe}/agent.md` | "Read them there" → the reference owns the facts, the invoking prompt states them, the skill is not opened during a run |
| `agents/adjudicator/agent.md` | The standard paragraph says the two references **do not reach it in a run**, names what does, and says an unsettled case parks (cites `B-035`); "where you read it" → the prompt states the shape |
| `driver.py` | `prompt()`: "Everything you need is in this message and your agent definition: do not open the skill's files …" |
| `tests/test_driver.py` | + 1 test (36 in the suite) |
| `.ai/planning/BACKLOG.md` | `B-029` done; **`B-035` raised** |
| Not changed | `closer`, `park-steward`, the Claude Code binding; emitted copies (re-emitted at the end of the pass) |

**Next task starts here**: `B-029`…`B-031`, `B-033` closed; `B-025`,
`B-032`, `B-034`, `B-035` open. OpenCode suite 36 tests, green.

## Status
- Status: done
- Owner: agent (decision: human, 2026-09-25)
- Created: 2026-09-25
- Updated: 2026-09-25

## Execution log
### Attempt 1
- Date: 2026-09-25
- Agent: Claude Opus 5.5 (1M context)
- Actions: test first; the prompt sentence; seven role bodies; raised
  `B-035`.
- Validation: new test red before the sentence, green after; `driver.py` at
  `HEAD` → red again; restored and `cmp`-verified. The acceptance grep over
  `agents/` returns one line, `gate-runner` line 89 — *"a gate nobody read
  there did not run"*, which is about the evidence file, not the skill; kept.
  Full suite OK (36); `tests/validate.sh` OK; `sync-registry.sh` left
  `docs/registry.md` unchanged (no description changed).
- Result: **done.**
- Commit: *(follow-up commit)*
- Push: *(follow-up commit)*
