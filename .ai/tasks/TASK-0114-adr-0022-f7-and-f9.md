# TASK-0114 — Test ADR-0022's two untested falsifiers, F7 and F9

## Objective

Run the two measurements `ADR-0022`'s falsifier table still marks **UNTESTED**,
and replace each verdict with an observed one. **F7:** does routing every gate
through one detaching entry point keep each agent shell call inside the
client's cap? **F9:** does a run interrupted between the gate step and the close
step leave the tracker untouched? Both are carried in `SPRINT-CURRENT.md` item
9 and named in `REVIEW-0012`'s "Left open by S10". Now, because the S10.7 pilot
could not reach either by accident — every gate it ran took 1–3 seconds, and its
one interruption came before any close — so neither will ever be answered by
running the loop normally.

## Minimal context

**F7's arithmetic, from `skills/unattended-ops/references/long-gates.md`.** A
real build was measured three times at **68m10s, 70m23s, 72m44s**. An agent's
shell call cap is **ten minutes**. "No arrangement of prompts closes a 7× gap"
— which is why rule 3 exists: one detaching entry point, bounded polling, a
watchdog owning the timeout, evidence written by the gate and read by the agent.

The reference also names a **superseded figure deliberately kept visible**: the
source project's changelog records 21–24 minutes for the same build, older and
smaller. A reader who averages the two "gets a timeout wrong in the direction
that costs the most: a gate killed at 45 minutes is a gate that told you
nothing". This task must not quietly reintroduce that average.

**What F7 actually claims, and what it does not.** It is a claim about the
*polling caller*, not the gate. `run-gate.sh start` returns immediately with a
handle; `run-gate.sh wait <handle> [secs]` blocks at most `secs`, default 60;
`status` returns without waiting. Every action prints exactly one line:
`GATE <handle> NAME=… STATE=… EXIT=… ELAPSED=…s LOG=…`. So F7 is falsified by
**a measured wait exceeding the cap**, not by a gate that takes a long time —
a long gate is the *premise*. A synthetic long gate is therefore a legitimate
subject: what is under test is whether the agent's own calls stay short while
one runs, and a 70-minute compile and a 70-minute `sleep` are indistinguishable
from the poller's side. Stating that equivalence is part of the task; assuming
it silently would be the same over-claim `TASK-0027` made when it read a silent
custom rule as a working one.

**F9's window, located exactly.** `driver.py`'s `step10_close()` has the closer
commit, then verifies before journaling: `git rev-parse` the claimed commit,
`HEAD~1` against the recorded parent, porcelain empty, the task id present in
the message, then `git show --name-only` for undeclared paths, then the log
entries — and only at line 661 `self.journal("close", …)`. The tracker is not
written by the driver at all: it is handed to the **closer** (`driver.py:607`,
`:610`) and lands inside the same commit as the task file. So "the tracker is
untouched" and "no commit exists" should be the same statement, and F9 is
falsified by "a ticked tracker row with no commit behind it".

**`ADR-0022` already concedes one window is irreducible** — between `git commit`
returning and the journal line reaching disk — and says a binding "closes it in
practice with a `git log --grep <taskId>` guard on resume, never in theory. Say
so rather than imply otherwise." `driver.py:635` confirms the guard's input:
the task id in the commit message is what `loop.md` step 12's resume guard
reads. **So F9 cannot come back CONFIRMED without qualification**, and a result
that claims it did is wrong. The honest outcome is a verdict plus the named
window, measured.

**Why a kill, not a stub.** `TASK-0100` gave the driver SIGTERM/SIGINT/SIGHUP
handling and a handover write. The interruption has to be a real signal to a
real driver at a real point in the run, because the thing under test is the
*ordering of side effects on disk*, which a stub replaces rather than exercises.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/decisions/0022-unattended-runs-and-the-narrowed-workflow-clause.md` | TASK-0076 | `Accepted`; F7 at table line 470 and F9 at 472, both **UNTESTED** |
| `skills/unattended-ops/references/long-gates.md` | TASK-0102 | Carries 68m10s/70m23s/72m44s, the ten-minute cap, and the superseded 21–24m figure |
| `skills/unattended-ops/templates/bindings/opencode/run-gate.sh` | TASK-0089 | `start`/`wait`/`status`/`kill`; `wait` defaults to 60s; one summary line per action |
| `skills/unattended-ops/templates/bindings/opencode/driver.py` | TASK-0086, TASK-0100, TASK-0097 | `step10_close()` journals at line 661, after all verification; SIGTERM/SIGINT/SIGHUP handled |
| OpenCode binding test suite | TASK-0086 onward | **Green** — `39 passed, 13 subtests`, confirmed 2026-09-27 via `uv run --with pytest` (~2m20s) |
| `.ai/tasks/TASK-0092-s10-7-pilot.md` | TASK-0092 | `done`; every pilot gate 1–3s; its one interruption preceded any close |
| `opencode` CLI | pre-existing | `1.18.32`, confirmed 2026-09-27. **Note the drift:** `ADR-0022`'s F1/F2/F4/F5 verdicts were settled against `1.18.31` |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

Two measurements and the ADR rows they replace. Nothing is redesigned.

### Included

- **F7:** a synthetic gate that outlasts the cap by a clear margin, run through
  `run-gate.sh`, with **every** driver-side call timed. The claim is tested
  against the longest single agent shell call observed, not against an average.
- An explicit written statement of why a synthetic long gate is equivalent to a
  real one *for this claim*, and what it does not establish.
- **F9:** a real run interrupted by signal inside the gate-to-close window, with
  the tracker, the task file, `git log` and the journal all inspected afterwards.
- At least one interruption placed deliberately in the **irreducible** window —
  after `git commit` returns, before the journal line lands — so the conceded
  gap is measured rather than restated.
- Replacing both table rows in `ADR-0022` with dated verdicts, in the shape the
  four settled rows already use: verdict, date, evidence, and what it means.

### Not included

- **No fix for whatever either measurement falsifies.** `ADR-0022`'s own "If
  false" column already names the consequence for each — F7 falsified means
  "rule 3 does not generalise and the binding contract needs a second
  mechanism"; that is a decision, not a task edit.
- **Not running a real 70-minute build.** The estate has no such build wired
  here, and the claim does not need one. This is stated as a limit of the
  evidence, in the row itself.
- **No change to `run-gate.sh` or `driver.py`.** If a measurement cannot be
  taken without editing one, that is a finding about observability and is
  recorded before anything is changed.
- **Nothing about the Claude Code binding**, which has no `run-gate.sh` and
  whose first real run is `TASK-0113`.
- **F3's sample size is not addressed here.** It is `SUPPORTED, small sample`
  and stays that way.

## Likely files

- `.ai/decisions/0022-unattended-runs-and-the-narrowed-workflow-clause.md` —
  two table rows replaced
- `.ai/tasks/TASK-0114-adr-0022-f7-and-f9.md` — this file, with both transcripts
- `.ai/planning/SPRINT-CURRENT.md` — item 9 closed or narrowed
- `.ai/context/CURRENT_STATE.md` — a dated section
- Possibly `skills/unattended-ops/references/long-gates.md`, if F7's measurement
  contradicts what it states
- Scratch only, not committed: a gate map, a synthetic gate, a run root

## Execution plan

1. Record the environment: `opencode --version`, the binding's suite result,
   and `git rev-parse HEAD`. The version drift from `1.18.31` is noted now so a
   later reader does not have to infer it.
2. **F7 setup.** Build a scratch gate map with one synthetic gate whose runtime
   clearly exceeds the ten-minute cap. Record the chosen duration and why.
3. Start it through `run-gate.sh start` and record the returned handle and the
   wall-clock duration of that call.
4. Poll with `run-gate.sh wait` and `status` until the gate finishes, timing
   **every** call. Record each duration, not a summary.
5. F7's verdict is the **maximum** single call duration against the cap. Record
   the maximum, the count of calls, and the gate's total elapsed time.
6. Write the equivalence statement: why `sleep` and a compile are the same to
   the poller, and what this therefore does not prove.
7. **F9 setup.** A scratch repository, a tracker, a one-task queue, a real
   driver run. Record the tracker's byte-level state before starting.
8. Interrupt the run with SIGTERM at the gate-to-close window. Inspect: the
   tracker, the task file, `git log --oneline`, the journal, the handover.
9. Repeat with the interruption placed in the irreducible window — after the
   commit returns, before the journal write. Use the driver's own ordering to
   locate it; record how the placement was achieved and how confident it is.
10. For each interruption, answer the falsifier literally: is there a ticked
    tracker row with no commit behind it? Then check what `git log --grep
    <taskId>` would return on resume.
11. Replace both `ADR-0022` rows with dated verdicts. Where F9 is qualified,
    state the qualification in the row rather than in a footnote.
12. Tear down scratch artifacts; confirm this repository's tree is clean.

## Acceptance criteria

- [x] F7 has a recorded **maximum** single agent-side call duration, with the
      full list of call timings, and a verdict stated against the ten-minute cap.
- [x] The synthetic gate's duration is recorded and exceeds the cap; a run where
      it did not is not evidence and is discarded rather than reinterpreted.
- [x] The equivalence statement is written and names at least one thing the
      synthetic gate does **not** establish.
- [x] F9 has at least two interruptions recorded, one of them in the irreducible
      window, each with the tracker/task-file/`git log`/journal state after it.
- [x] F9's verdict explicitly addresses the irreducible window rather than
      averaging over it, and states what `git log --grep <taskId>` returns.
- [x] Both `ADR-0022` rows are replaced, carry a date, and neither still reads
      `UNTESTED`.
- [x] Every claim in both rows traces to output pasted into this file.
- [x] `run-gate.sh` and `driver.py` are byte-identical to their pre-task state,
      or the deviation is recorded with its reason.
- [x] `tests/validate.sh` exits 0 and this repository's tree is clean.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed)
- [x] The OpenCode binding's pytest suite, before and after — unchanged result
- [x] `skills/unattended-ops/scripts/check-binding.sh` on the scratch binding

## Risks and rollback

- **F7 is declared confirmed from a gate that never exceeded the cap.** The
  measurement then tested nothing. Guarded by the second acceptance criterion,
  which discards such a run instead of letting it be reinterpreted.
- **The synthetic-gate equivalence is assumed rather than argued.** This is the
  `TASK-0027` failure mode — a silent custom rule read as a working one. Step 6
  exists to force the argument into writing.
- **F9's irreducible window cannot be hit reliably.** Likely: it is small by
  construction. If the placement cannot be achieved, say so and record the
  window as **unmeasured** rather than inferring a result — an untested claim
  in that table is a claim, not a finding, and the table says so itself.
- **A kill leaves a scratch repository in a state that looks like a bug in the
  driver.** It is the intended state. Step 10 answers the falsifier literally
  rather than judging the wreckage impressionistically.
- **Wall-clock cost.** F7 needs at least one gate longer than ten minutes, and
  the binding suite takes ~2m20s twice. Budget for it rather than shortening the
  gate to fit.
- **Rollback:** `git revert` the documentation commit. Scratch repositories and
  run roots are deleted; nothing in this repo's components is modified.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `.ai/decisions/0022-unattended-runs-and-the-narrowed-workflow-clause.md` | F7 and F9 rows replaced with dated `CONFIRMED` verdicts, each carrying its evidence and its stated limit. Header updated: eight of nine now carry verdicts, F8 alone open. **No `UNTESTED` verdict cell remains** |
| `.ai/planning/SPRINT-CURRENT.md` | Item 9 closed |
| `.ai/context/CURRENT_STATE.md` | New dated section |
| `skills/unattended-ops/references/long-gates.md` | **Unchanged.** The plan allowed for editing it if F7's measurement contradicted it. Nothing did — the 68–72 minute figures and the ten-minute cap were the basis of the experiment, not its subject |
| `run-gate.sh`, `driver.py` | **Byte-identical.** Both measurements were taken without modifying either, which the plan required and made an acceptance criterion |
| `/tmp/opencode/f7-harness/`, `/tmp/opencode/f9-harness/` | Scratch, not committed, removed after write-up |

**Three deviations, all recorded rather than absorbed.**

1. **F9 used a stubbed model, where the brief argued for "a real signal to a
   real driver".** The signal and the driver *were* real, as were git and the
   filesystem — the test harness's `git_wrapper.py` execs the real git, and a
   stubbed role's `sh` runs real commands. What is modelled is the closer's
   *judgement*, not its disk effects, and this claim is about disk effects. The
   brief's reasoning ("a stub replaces rather than exercises") holds against
   stubbing the *driver*; it does not apply to stubbing the *model* while the
   driver, git and filesystem stay real. Stated as a limit in the ADR row.
2. **The default stub closer does not tick the tracker, so it was rewritten.**
   `closer_sh()` stages only `src/a.txt` and the task file. F9's falsifier is
   about the tracker, so a closer that never writes it cannot exercise the
   claim — the measurement would have "passed" vacuously. The F9 closer ticks
   `TODO.md` and stages it, matching loop step 10's actual instruction.
3. **Kill placement was made deterministic rather than raced.** The plan said
   to "record how the placement was achieved and how confident it is". A
   pidfile written by the launcher, with the SIGTERM issued from the stub's own
   `sh` at the chosen point, means the placement is exact rather than probable —
   so the confidence is "certain", not "likely", and the irreducible window the
   brief feared might be unhittable was hit on the first attempt.

**Next task starts here**: `ADR-0022` has one falsifier still open — F8, for
Bionic only (S10.4). `SPRINT-CURRENT.md` items 6 and 9 are both closed;
item 2's measurement closed under `TASK-0111`, leaving a decision. `TASK-0113`
is the remaining `ready` item from this batch.

## Status

- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-27
- Updated: 2026-09-27

## Execution log

### Attempt 1

- Date: 2026-09-27
- Agent: Claude Opus 5 (1M context), Claude Code
- Actions:
  1. Environment: `opencode 1.18.32` (noted against `ADR-0022`'s `1.18.31`
     verdicts), repo `HEAD` `4f94d8a`.
  2. **F7 harness.** A gate map with one entry, `argv` `["bash","-c","echo
     start; sleep 720; echo done"]`, `timeout_seconds` 1800. **720 s chosen and
     recorded: 120 s past the 600 s cap, a 20% margin.** A poll script timing
     *every* call to `run-gate.sh`.
  3. Ran it. `start` → **0 s**, handle returned, `STATE=RUNNING`. Then 12
     `wait` polls: 61, 60, 60, 60, 60, 61, 60, 60, 60, 61, 60, 58 s. Final
     poll `STATE=PASSED EXIT=0 ELAPSED=720s`. `TOTAL_ELAPSED=721s POLLS=12`.
     Evidence file written by the gate, one line, as rule 3 requires.
  4. Wrote the equivalence statement (see Observations).
  5. **F9 harness.** Reused the binding's own test harness — real driver, real
     git (`git_wrapper.py` execs `REAL_GIT`), real filesystem, stubbed model.
     Wrote a closer that **ticks `TODO.md`** and stages it, because the default
     one does not. SIGTERM delivered from the stub's `sh` via a pidfile the
     launcher writes, so placement is exact.
  6. **Placement (a), between gate and close** — kill during adjudication:
     tracker `- [ ] TASK-0001`, commits **1** (the fixture), porcelain
     `M src/a.txt`, journal `run-start > gate > halt > run-end`,
     `git log --grep TASK-0001` **empty**, handover **present**, exit 1.
  7. **Placement (b), the irreducible window** — kill issued by the closer's
     own `sh` immediately after `git commit` returned, before
     `driver.py:661`'s journal write: tracker `- [x] TASK-0001`, commits **2**
     (`07be61b TASK-0001: change a`), porcelain **clean**, journal
     `run-start > gate > adjudication > halt > run-end` — **no `close` event**
     — `git log --grep TASK-0001` → **`07be61b`**, handover present, exit 1.
  8. Replaced both ADR rows; updated the table's header; closed
     `SPRINT-CURRENT.md` item 9.
- Observations:
  - **F7's result generalises structurally, which a single measurement normally
    would not.** The per-call ceiling is `wait`'s own 60 s bound, **not** the
    gate's length: a 720 s gate and a 4,300 s build both yield ~61 s calls and
    differ only in how many. That is why a synthetic gate is legitimate here —
    `sleep` and a compile are indistinguishable from the poller's side, which is
    the entire content of the claim. It does **not** establish anything about
    handling a real build's output, or about a gate that wedges without exiting.
  - **F9's falsifier cannot occur, and finding that out was the point.** "A
    ticked tracker row with no commit behind it" requires tracker and commit to
    diverge; the closer stages the tracker *into* the commit, so they cannot.
    Placement (b) is the proof: the tracker was ticked **and** the commit was
    there.
  - **The ADR's wording pointed at the wrong casualty.** It implies the tracker
    is what the irreducible window endangers. The **journal** is: it carried no
    `close` event after a real close. Worth correcting in the row rather than
    leaving a reader to infer it.
  - **The resume guard was observed working, not assumed.** `git log --grep
    TASK-0001` returned the commit in placement (b) — the exact mitigation the
    ADR says closes the window "in practice, never in theory".
  - **`TASK-0100`'s clean stop held under a real signal** at both placements:
    handover written, exit 1, no retry.
- Validation:
  - F7: 13 timed calls recorded; **max 61 s** against a 600 s cap; gate
    `ELAPSED=720s`, `STATE=PASSED EXIT=0`
  - F9(a): tracker untouched, 1 commit, `--grep` empty
  - F9(b): tracker ticked, 2 commits, `--grep` finds `07be61b`, journal has no
    `close`
  - `run-gate.sh` and `driver.py` unmodified — `git status` showed neither
  - `tests/validate.sh` → `validate.sh: OK`
  - `scripts/sync-registry.sh` → no diff
- Result: done. Both falsifiers settled; no `UNTESTED` verdict cell remains in
  `ADR-0022`; F8 (Bionic) is the only one still open.
- Commit: COMMIT_HASH
- Push: PUSH_RESULT
