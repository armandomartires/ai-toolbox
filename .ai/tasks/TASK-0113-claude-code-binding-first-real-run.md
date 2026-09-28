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

- [x] The task chosen at step 1 is named in this file, with a timestamp showing
      it was recorded before the run.
- [x] A full transcript of the run is captured and its path recorded.
- [x] The run reached a terminal state and that state is one of the five
      verdicts, quoted verbatim.
- [ ] Every role invocation has a recorded duration — **NOT MET**. The
      workflow journal records no label, phase or duration (deviation 3).
- [x] The step-8 close verification is recorded with its commands and output,
      from the scratch repository.
- [x] Every delegation in the transcript is cross-checked against the roles
      actually emitted for Claude Code, and the result stated — including
      "none attempted" if that is the answer.
- [x] Each finding has a backlog item; a run with zero findings says so
      explicitly and is treated as weak evidence, not as a pass.
- [~] `claude mcp list` no longer lists `gates` — **not applicable**: the
      binding never uses the MCP server, so nothing was registered (deviation 1).
- [x] This repository's tree is clean and `master` unmoved except for this
      task's own commit.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed)
- [x] `node --test .../claude-code/tests/unattended-run.test.mjs` — 25/25, before the run
- [x] `skills/unattended-ops/scripts/check-binding.sh` accepts the scratch binding

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
| `skills/unattended-ops/templates/bindings/claude-code/` | **Byte-identical.** The pilot ran a *copy*, which is how a consuming repository deploys it |
| `.ai/planning/BACKLOG.md` | `B-043`, `B-044`, `B-045` raised; summary 8 → 11 open |
| `.ai/planning/SPRINT-CURRENT.md` | Item 5's Claude Code half closed; its OpenCode half left open and said so |
| `.ai/context/CURRENT_STATE.md` | New dated section |
| `.ai/tasks/TODO.md` | `TASK-0113` checked off |
| `/tmp/opencode/cc-pilot/` | Scratch: repo at `aae3965`, gate map, filled binding, the modified copy, the run's `.run/` tree. **Left in place** — it is the evidence behind `B-043` |

**Deviations, and two of them are corrections to this brief rather than to the run.**

1. **Step 4 was wrong: no MCP registration was needed.** The brief said to
   register the `gates` server and deregister it afterwards. The Claude Code
   binding does not use it — gates go through `run-gate.sh` by shell, via the
   gate-runner. Nothing was registered, so nothing was left behind, and the
   corresponding acceptance criterion is not applicable rather than met.
2. **The binding could not be pointed at a scratch repository at all** —
   `B-044`. The brief forbade running against this repository and required a
   scratch one, and the template supports neither: every path is repo-relative
   and every `git` command in every prompt is bare. Recorded **before** acting,
   as the brief requires of an edit needed to run at all. Resolved without
   touching the shipped template: the consuming repo got a copy, differing by
   one hunk in `header()` behind an optional `args.repoRoot`.
3. **Per-role durations were not obtainable.** An acceptance criterion asked
   for one per invocation so `ADR-0022` F7 would have data. The workflow
   journal records only `{agentId, key, result, type}` — no label, phase or
   duration. The criterion is **not met**, recorded as such rather than quietly
   dropped; F7 was settled independently by `TASK-0114` the same day, so
   nothing is lost but the observability gap is real.

**A fair criticism of this task's own fixture, made by the run.** Its second
adhoc title: *"A pilot task whose acceptance criterion and gate predicate are
the same proposition yields one fact under two labels, so its green gate adds
no independent confirmation."* That is correct and it is my fixture's flaw —
criterion 1 and the `unit` gate both test `grep -qx 'hello, world'`. The gate
was proved failing beforehand, so it is revert-proof, but it corroborates
nothing the criterion did not already assert. A better pilot task would have a
gate that tests something the criteria do not restate.

**Next task starts here**: the binding has been run once and `REVIEW-0012`
finding 4 is discharged. `B-043` is the live one and needs a **human ruling or
a line-format change, not a re-run** — a re-run reproduces the identical
evidence line. `B-035`'s Claude Code half remains open for a sharper reason
than before. The scratch tree at `/tmp/opencode/cc-pilot/` is the evidence and
was deliberately not deleted.

## Status

- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-27
- Updated: 2026-09-27

**Unblocked 2026-09-27 by `TASK-0112`** (`0b6ec40`): the binding is accepted by
`check-binding.sh` and its stub suite is 25/25. Was `blocked` on exactly that.
Status corrected by `TASK-0118`, which would otherwise have registered a
blocker that no longer existed.

## Pre-run record

**Written before anything was wired, at 2026-09-27T21:56:10+0200.** Step 1 of the plan requires the
task to be named first; a pilot whose subject is chosen afterwards is a demo.

- **Run id:** `20260927-2000`
- **Consuming repository:** `/tmp/opencode/cc-pilot/repo`, fixture commit
  `aae3965`, scratch, created for this run
- **Task the run will execute:** `TASK-0001 — Make the greeting say hello`
  (`/tmp/opencode/cc-pilot/repo/.ai/tasks/TASK-0001-greeting-says-hello.md`).
  `src/greeting.txt` reads `goodbye` and must read `hello, world`.
- **Gate:** one, `unit`, from `/tmp/opencode/cc-pilot/gates.json` — outside the
  repository, per `TASK-0098`. **Proved failing before the run**: `0 passed,
  1 failed`, exit 1. A green gate at the end therefore means something.
- **Task cap:** 1.
- **Prediction, recorded so it can be wrong:** the run completes with
  `accept` and one commit. The interesting outcomes are the ones that are not
  that.

## Execution log

### Attempt 1

- Date: 2026-09-27 (run) / 2026-09-28 (write-up)
- Agent: Claude Opus 5 (1M context), Claude Code
- Actions:
  1. Preconditions: `TASK-0112` `done`, suite **25/25**.
  2. Built the scratch consuming repository, fixture `aae3965`, and a gate map
     **outside** it (`TASK-0098`). **Proved the gate failing first**: `0
     passed, 1 failed`, exit 1 — so a green gate would mean something.
  3. Hit `B-044` before the run could start; recorded it, then copied the
     template and added one hunk to `header()` behind `args.repoRoot`.
     `diff` against the shipped file: 11 lines, one function.
  4. Filled `binding.md`; `check-binding.sh` → `BINDING OK (20 slots answered,
     all 14 loop steps declared, no uncited rule)`.
  5. Wrote the pre-run record at **21:56:10 +0200**, naming the task, the run
     id and a prediction of `accept`, before wiring anything further.
  6. Ran it: `Workflow({scriptPath: …})`, task cap 1. 13 agents, 0 errors,
     120 tool uses, 463,859 subagent tokens, 1,180,724 ms.
  7. Verified the outcome from the scratch repository, never from the report.
  8. Verified the headline finding against `run-gate.sh`'s source by hand.
  9. Checked which skill files the roles actually read, and from which path.
- Observations:
  - **It parked, and the prediction was wrong.** `HEAD` still `aae3965`, `git
    log --grep=TASK-0001` empty, tracker `- [ ]`, porcelain clean, change
    stashed, handover 13,971 bytes.
  - **`B-043` is the run's deliverable and it is not client-specific.**
    `summary()` emits `GATE <handle> NAME= STATE= EXIT= ELAPSED= LOG=` and
    line 170 appends exactly that; `loop.md:234-235` tells the closer to copy
    "every figure from the evidence file". There is no figure in it, ever. And
    `run-gate.sh` is the **OpenCode** binding's entry point.
  - **The adjudicator's reasoning is better than the verdict alone.** It
    declined to override because accepting would hand an unsatisfiable
    instruction to the only role with git rights — outcomes being a refusal
    with git engaged, or an invented figure in a committed task file. It named
    the unsettled scope question and refused to resolve it. It also declined
    `retry` ("retrying a structural gap is asking a correct answer to change")
    and `halt-run` ("the run's premise is intact").
  - **The implementer refused to quote its own probe as the gate's figure**,
    unprompted, and declared a criterion half-discharged rather than claiming
    it. The adjudicator upheld that restraint and recorded upholding it.
  - **`B-045` came from a near-miss inside the run.** The adjudicator itself
    used `git log --all --grep=TASK-0001` and got an empty result — correct
    only because the park-steward's stash did not exist yet. After the park,
    that same command returns the stash commit.
  - **`B-035`'s Claude Code half: answered and still open.** Roles read
    `verdicts.md` ×7, `park-and-recover.md` ×6, `evidence.md` — unembedded and
    undenied. But the reads resolved to `/…/ai-toolbox/skills/…`, the pilot
    session's own cwd, which a real consumer has no reason to have. The
    sibling-file argument is about location, not permission, and survives.
  - **`ADR-0022` F5 was structurally unreachable**: the binding selects roles
    by `opts.agentType`, never `tools: Agent(...)`, and an unresolvable type
    throws into `Halt` rather than failing silently. Checked by grep, not
    assumed.
- Validation:
  - `check-binding.sh` on the filled binding → `BINDING OK`
  - Claude Code stub suite before the run → 25 tests, 25 pass
  - Scratch repo after: `HEAD` `aae3965`, `git log --grep=TASK-0001` empty,
    porcelain empty, `TODO.md` row `- [ ]`, `stash@{0}` present
  - Evidence file: one line, `STATE=PASSED EXIT=0 ELAPSED=1s`; the gate log it
    names contains `1 passed, 0 failed`
  - Journal events: `run-start > gates > adjudication > park > run-end`
  - `run-gate.sh`, `unattended-run.js`, `binding.md` — all byte-identical
  - `tests/validate.sh` → `validate.sh: OK`; `scripts/sync-registry.sh` → no diff
- Result: done. The binding has been run; `REVIEW-0012` finding 4 discharged;
  `B-043`, `B-044`, `B-045` raised; nothing fixed inside the pilot.
- Commit: COMMIT_HASH
- Push: PUSH_RESULT
