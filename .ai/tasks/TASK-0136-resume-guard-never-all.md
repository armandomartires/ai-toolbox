# TASK-0136 — State that the resume guard must never search --all (B-045)

## Objective

Close `B-045`. The unattended-run loop's resume guard is
`git log --grep <task id>`, and it is correct only because it searches the
current branch. The park-steward stashes a parked task under a message that
carries the task id, so `git log --all --grep <task id>` finds the stash
commit and reads a **parked task as closed**. Nothing states that
constraint. State it wherever the guard is described. Routed by the human on
2026-10-05.

## Minimal context

- The guard is described in four places: `loops/unattended-run/loop.md`
  step 12, `skills/unattended-ops/references/five-rules.md` (rule 3),
  `agents/run-scribe/agent.md`, and comments in both bindings. Measured with
  `grep -rn -- '--grep'` on 2026-10-05.
- The task id in the stash message is deliberate: it lets a human find the
  stash days later (`agents/park-steward/agent.md`, *The stash message is a
  recovery instruction*). So the message stays as it is. The constraint
  belongs on the guard.
- `TASK-0113` recorded the near-miss: its adjudicator ran the `--all` form at
  step 9 and got an empty result only because the stash did not exist yet.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `loops/unattended-run/loop.md` | ongoing | step 12 names the guard with no `--all` warning |
| `skills/unattended-ops/references/five-rules.md` | ongoing | rule 3 names the guard with no warning |
| `agents/run-scribe/agent.md`, `agents/adjudicator/agent.md` | ongoing | no warning |
| `.ai/planning/BACKLOG.md` | `TASK-0135` | `B-045` `ready`; eleven open |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. One sentence on the guard, in `loop.md` step 12, `five-rules.md` and
   `run-scribe`: search the current branch, never `--all`, because the stash
   commit carries the task id.
2. `adjudicator`, *Go and look*: the same, for the case where a binding lets
   it read git history.
3. The two binding comments that name the guard get the same qualifier.
4. A reproduction recorded here, in a scratch repository: the stash is found
   by `--all` and not by the branch-only form.
5. `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md`, this brief.

### Not included

- The stash message format, which is a recovery feature.
- A gate check. The guard is written by an agent at run time, not in a
  tracked file, so a text check would read only these sentences.

## Likely files

`loops/unattended-run/loop.md`, `skills/unattended-ops/references/five-rules.md`,
`agents/run-scribe/agent.md`, `agents/adjudicator/agent.md`,
`skills/unattended-ops/templates/bindings/claude-code/unattended-run.js`,
`skills/unattended-ops/templates/bindings/opencode/driver.py`, the ledger,
this brief.

## Execution plan

1. This brief first.
2. Reproduce in a scratch repository.
3. Edit the six files. Run both bindings' check scripts if they read the
   edited files, then `tests/validate.sh`.
4. Ledger; commit; push both remotes; record commit.

## Acceptance criteria

- [x] Every place that describes the resume guard says it must not use
      `--all`, and why.
- [x] The reproduction is recorded here.
- [x] `tests/validate.sh` passes, and the emitted agents are regenerated if
      the gate requires it.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed)
- [x] the scratch-repository reproduction

## Risks and rollback

- **A binding's check rejects a changed comment or a changed `must`.**
  `check-binding.sh` cites rules by source, so only comments change in the
  binding templates.
- **Rollback:** `git revert` the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `loop.md`, `five-rules.md`, `run-scribe`, `adjudicator` | each states the no-`--all` constraint and its reason |
| both binding templates | the guard comment says *current branch, never `--all`* |
| `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md` | `B-045` done; ten open |

**Next task starts here**: `master` at the record commit.

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-05
- Updated: 2026-10-05

## Execution log

### Attempt 1

- Date: 2026-10-05
- Agent: Claude Code (Opus 5.5), main checkout
- Actions: wrote the brief, reproduced the hazard, then edited the six files.
- Observations:
  - **Reproduction**, in a `mktemp` repository: after one commit and
    `git stash push -m "unattended/run-1/TASK-0001: parked - gate red"`,
    `git log --grep=TASK-0001` printed nothing, and
    `git log --all --grep=TASK-0001` printed
    `5642ec0 On master: unattended/run-1/TASK-0001: parked - gate red`.
  - No emitted copy of `agents/` is tracked, so nothing was regenerated.
  - Both binding suites still pass, though the gate does not run them
    (`B-037`): `node --test …/unattended-run.test.mjs` gave 26 of 26 in
    0.27 s, and `python3 -m unittest discover -s …/opencode/tests` ran 40
    tests, `OK`, in 3m12s. `check-binding.sh` reports only the template
    placeholders, and neither `binding.md` changed.
- Validation: `tests/validate.sh` printed `validate.sh: OK`.
  `sync-registry.sh` left the registry unchanged.
- Result: done.
- Commit: `3cdeba4` — *State that the resume guard never searches --all (TASK-0136)*, plus the record-keeping commit after it
- Push: **confirmed to both remotes** — `5d292aa..3cdeba4 master -> master` to
  `origin` and to `github`; `HEAD`, `origin/master` and `github/master` all
  read `3cdeba4`, and `git remote -v` is token-free
