# TASK-0113 — Run the Claude Code unattended binding against a real run, once

## Objective

Exercise `skills/unattended-ops/templates/bindings/claude-code/` against a
genuine Claude Code Workflow run, on a real task, in a real repository. It has
**never been run** — `REVIEW-0012` finding 4 — and is stub-proven only. This
discharges item 2 of `SPRINT-CURRENT.md`'s S10 criterion-3 gaps and answers the
pre-committed question S10 left half-answered: the OpenCode binding got a pilot
(`TASK-0092`), its sibling got none. Now, because `REVIEW-0012` finding 3
measured exactly what stubs cannot reach, and that argument applies unchanged
to the untested half.

## Minimal context

**What the OpenCode pilot found that 52 stub tests did not.** `REVIEW-0012`
finding 3: "The real run then found the glob blindness, the missing preflight
evidence, the skill-read denials, the quoting asymmetry, the bulk-staging
allow, the false self-claim and the timeout sizing — **none reachable by a
stub**." Seven defects, from one run. The Claude Code binding has 25 stub tests
and zero runs.

**Be precise about what is still open.** `REVIEW-0012` finding 4 reads: "It is
stub-proven only, and has the commit-paths gap `TASK-0097` closed for
OpenCode." The second half is **no longer true** — `B-032` was closed on
2026-09-25 by `TASK-0103` (`98ce299`), which added the file-list check to
`verifyHead()` and `step10Close()`. What remains of finding 4 is only the first
half: it has not been run.

**Three things the OpenCode binding has and this one does not**, all of which
the run should be expected to expose rather than be protected from:

1. **No embedded decision standard.** `TASK-0106` shipped
   `bindings/opencode/decision-standard.md`, generated and gate-checked against
   `references/verdicts.md` and `references/evidence.md`. The Claude Code
   binding has no equivalent — deliberately left, per `SPRINT-CURRENT.md` item
   4, because whether its roles can read the skill turned on the
   `worktree-only` question `TASK-0111` is measuring. Its `binding.md` cites
   `references/verdicts.md` at lines 153 and 155 as though the role reads it.
2. **No per-role timeouts.** `B-033` was closed by `TASK-0100` for the OpenCode
   driver, which takes a `role_timeouts:` mapping. The Claude Code binding has
   only `watchdog_timeout`, the gate timeout. The pilot's finding 9 was that
   10 minutes is too short for a refuter.
3. **No clean stop.** The same task gave the OpenCode driver SIGTERM/SIGINT/
   SIGHUP handling. A Workflow script cannot be signalled the same way.

**`ADR-0018` clause 8.3 is the constraint that shapes the whole binding.**
Claude Code has no per-agent command boundary, so where OpenCode denies, this
binding *witnesses*: `binding.md` line 126 records that the closer's commit and
a park's clean tree are "cross-checked by a second agent because the script
cannot run git", and that "a second agent is a witness, not a gate." A real run
is the only way to learn what a witness misses.

**`ADR-0022` F5 is live here.** An emitted Claude Code role whose `tools:
Agent(x)` names a role never emitted for Claude Code is a **silent** dead
reference — confirmed 2026-09-23, zero bytes of stderr. Only `task-planner` and
`adjudicator` emit for Claude Code (`TASK-0090`); the other seven roles are
OpenCode-only. Any delegation this run attempts outside those two fails
silently, and the run must be watched for it rather than trusting exit codes.

**Precondition, and it is hard.** `TASK-0112` must land first: the binding's
own `check-binding.sh` currently **rejects** its `binding.md`, and the stub
suite is red at 24/25. Running a binding whose consistency check fails measures
a known-broken artifact.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/unattended-ops/templates/bindings/claude-code/unattended-run.js` | TASK-0087, TASK-0103 | 468 lines; `verifyHead()` checks the commit's file list |
| `skills/unattended-ops/templates/bindings/claude-code/binding.md` | TASK-0087, TASK-0089, TASK-0103 | **Accepted by `check-binding.sh`** — requires `TASK-0112` done first |
| `.ai/tasks/TASK-0112-claude-code-binding-suite-is-red.md` | TASK-0112 | `done`; suite 25/25 |
| `.ai/tasks/TASK-0092-s10-7-pilot.md` | TASK-0092 | `done`; the OpenCode pilot's method, run names and findings — the model for this one |
| `.ai/reviews/REVIEW-0012-sprint-s10-unattended-bindings.md` | TASK-0105 | Finding 3 (stubs insufficient) and finding 4 (never run) |
| `.ai/decisions/0022-unattended-runs-and-the-narrowed-workflow-clause.md` | TASK-0076 | `Accepted`; F5 confirmed, F7 and F9 untested |
| `mcp-servers/gates/` | TASK-0088 | Builds; 14 tests pass; `tests/smoke-mcp.sh --server gates` PASS |
| `claude` CLI | pre-existing | `2.1.246`, confirmed 2026-09-27 |
| A real task to run | this task | **Must be chosen and named before starting** — see Execution plan step 1 |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

One pilot run, its findings, and the backlog items they raise. Not a fix-up of
everything the run exposes.

### Included

- Choose a **real, small, already-written** task for the run to execute, and
  name it here before starting.
- Wire the binding in a scratch consuming repository per `binding.md`, with the
  `gates` MCP server registered and then removed afterwards.
- Run it once, unattended, with a task cap of 1.
- Record **every** role return, verdict, gate result and timing, verbatim.
- Watch specifically for: silent dead `Agent(...)` references (`ADR-0022` F5),
  the adjudicator deciding without a decision standard in its prompt, a role
  exceeding its timeout, and anything the witness pattern fails to catch that
  OpenCode's denials would have.
- Write the findings into this file and raise a backlog item per finding.

### Not included

- **No fixes to anything the run exposes.** `TASK-0092` raised `B-029`…`B-034`
  and fixed none of them inside the pilot; this follows that shape. A pilot
  that fixes as it goes cannot say what it found.
- **Not embedding the decision standard**, not adding per-role timeouts, not a
  clean stop. Those are the three known gaps; the run measures what they cost,
  and each is its own task afterwards.
- **No second run to "confirm" a green result.** One run is one sample either
  way, and `ADR-0022` F3 already says six returns is a sample, not a rate.
- **Nothing runs against this repository's own `master`.** Scratch repository
  only.
- **No change to the emitted role set.** If the run needs a role that is
  OpenCode-only, that is a finding, not a licence to widen `clients:`.

## Likely files

- `.ai/tasks/TASK-0113-claude-code-binding-first-real-run.md` — this file, with
  the run's full evidence
- `.ai/planning/BACKLOG.md` — one item per finding
- `.ai/context/CURRENT_STATE.md` — a dated section
- `.ai/planning/SPRINT-CURRENT.md` — item 5 updated with the result
- Possibly `configs/claude-code/README.md`, if the run's wiring differs from
  what is recorded there

The binding itself is expected **not** to change. If it must be edited to get a
run at all, that edit is a finding and is recorded before it is made.

## Execution plan

1. Choose the task to run, and write its identifier into this file **before**
   wiring anything. A pilot with a task chosen afterwards is a demo.
2. Confirm `TASK-0112` is `done` and the stub suite is 25/25. Do not proceed on
   a red suite.
3. Build the scratch consuming repository: a git repo, a tracker, a gate map,
   a filled `binding.md`. Run `check-binding.sh` against it and require
   acceptance.
4. Register the `gates` MCP server for Claude Code; record
   `claude mcp get gates` output.
5. Run the workflow once, task cap 1. Capture the full transcript to a file.
6. While it runs, watch for the F5 failure mode: a delegation to a role not
   emitted for Claude Code produces no error. Check the transcript for
   delegations, and cross-check each against the emitted role list.
7. When it stops — for any reason — record: the verdict, every role return, every
   gate invocation and its duration, the tracker's final state, and
   `git log --stat` of the scratch repository.
8. Verify the close **from the scratch repository**, not from the run's report:
   did the commit land, are its files exactly the declared paths, is the tracker
   row consistent with the commit? `REVIEW-0012` finding 17 is the precedent for
   not trusting a role's self-claim.
9. Write findings. Raise one backlog item per finding.
10. Deregister the MCP server. Confirm `claude mcp list` no longer shows it.
    Leave the scratch repository in place until the findings are written.

## Acceptance criteria

- [ ] The task chosen at step 1 is named in this file, with a timestamp showing
      it was recorded before the run.
- [ ] A full transcript of the run is captured and its path recorded.
- [ ] The run reached a terminal state and that state is one of the five
      verdicts, quoted verbatim.
- [ ] Every role invocation has a recorded duration, so `ADR-0022` F7 has data
      even though this task does not test it.
- [ ] The step-8 close verification is recorded with its commands and output,
      from the scratch repository.
- [ ] Every delegation in the transcript is cross-checked against the roles
      actually emitted for Claude Code, and the result stated — including
      "none attempted" if that is the answer.
- [ ] Each finding has a backlog item; a run with zero findings says so
      explicitly and is treated as weak evidence, not as a pass.
- [ ] `claude mcp list` no longer lists `gates`, output pasted.
- [ ] This repository's tree is clean and `master` unmoved except for this
      task's own commit.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed)
- [ ] `node --test .../claude-code/tests/unattended-run.test.mjs` — 25/25, before the run
- [ ] `skills/unattended-ops/scripts/check-binding.sh` accepts the scratch binding

## Risks and rollback

- **The run touches a real repository.** Bounded by using a scratch repository
  created for this task, task cap 1, and by step 10's teardown. The gate map is
  written for this run and is not reused.
- **A green run is read as validation.** One run is one sample; the OpenCode
  pilot found seven defects in one run, so a clean result here is more likely to
  mean the run was too easy than that the binding is sound. The acceptance
  criteria force that reading to be written down.
- **The pilot quietly becomes a fixing session.** This is the specific failure
  the "Not included" section exists to prevent, and `TASK-0092` is the
  precedent for holding the line.
- **F5's silent dead reference makes a broken run look successful** — exit 0, no
  stderr. Step 6 is the only defence and it is manual; if it is skipped, the
  run's result cannot be trusted.
- **An MCP registration is left behind.** Caught by step 10's explicit check.
- **Rollback:** delete the scratch repository; `git revert` the documentation
  commit in this repository. Nothing in this repo's components changes.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          | what it now contains, plus anything deliberately *not* changed |

**Next task starts here**: one line naming the state the next task picks
up from — not a prediction of what that task will be. Record any
deviation from the Plan here too: the next task may have been scoped
against the original.

## Status

- Status: blocked   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-27
- Updated: 2026-09-27

Blocked on `TASK-0112`: the binding's own consistency check currently rejects
it and its stub suite is red at 24/25.

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
