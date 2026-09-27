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

- [ ] F7 has a recorded **maximum** single agent-side call duration, with the
      full list of call timings, and a verdict stated against the ten-minute cap.
- [ ] The synthetic gate's duration is recorded and exceeds the cap; a run where
      it did not is not evidence and is discarded rather than reinterpreted.
- [ ] The equivalence statement is written and names at least one thing the
      synthetic gate does **not** establish.
- [ ] F9 has at least two interruptions recorded, one of them in the irreducible
      window, each with the tracker/task-file/`git log`/journal state after it.
- [ ] F9's verdict explicitly addresses the irreducible window rather than
      averaging over it, and states what `git log --grep <taskId>` returns.
- [ ] Both `ADR-0022` rows are replaced, carry a date, and neither still reads
      `UNTESTED`.
- [ ] Every claim in both rows traces to output pasted into this file.
- [ ] `run-gate.sh` and `driver.py` are byte-identical to their pre-task state,
      or the deviation is recorded with its reason.
- [ ] `tests/validate.sh` exits 0 and this repository's tree is clean.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed)
- [ ] The OpenCode binding's pytest suite, before and after — unchanged result
- [ ] `skills/unattended-ops/scripts/check-binding.sh` on the scratch binding

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
|          | what it now contains, plus anything deliberately *not* changed |

**Next task starts here**: one line naming the state the next task picks
up from — not a prediction of what that task will be. Record any
deviation from the Plan here too: the next task may have been scoped
against the original.

## Status

- Status: ready   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-27
- Updated: 2026-09-27

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
