# Rule 3 in practice: long gates

## The arithmetic that forces the design

| | |
|---|---|
| A real build, measured three times | **68m10s**, **70m23s**, **72m44s** |
| An agent's shell call cap | **ten minutes** |

No arrangement of prompts closes a 7× gap. The gate has to run **outside** an
agent call, and the agent has to **poll** for its result in calls that each
finish well inside the cap.

**The superseded figure, named rather than quietly dropped.** The source
project's changelog still records **21–24 minutes** for the same build. It is
older and it is smaller. Quote the three above. A reader who finds both and
averages them gets a timeout wrong in the direction that costs the most: a
gate killed at 45 minutes is a gate that told you nothing, and it will be read
as a failure of the work.

## The shape

1. **One detaching entry point.** A single script the driver calls, which
   starts the real gate behind a watchdog and returns immediately with a
   handle. Everything long goes through it — one choke point, not a list of
   long commands.
2. **Bounded polling.** The driver asks for status in short calls. Each call
   returns quickly whether or not the gate has finished.
3. **A watchdog with its own timeout**, so a wedged gate ends as a stated
   timeout rather than as a run that never returns.
4. **Evidence written by the gate, read by the agent.** The `gate-runner`
   reads the evidence file. It does not tail a console, and it does not
   summarise a screen (`references/evidence.md`).

**One entry point is also how `B-021` is routed around rather than reopened.**
The `gate-runner`'s boundary allowlists **the entry point**, not a list of
commands, so its description claims only what its allowlist permits. A
command list is the construction that let a role's description overstate its
boundary in the first place.

## Batching

Long gates run **once per group the run actually touched**, after the per-task
cycle, **one at a time and never concurrently**.

- **Once per group, not once per task.** Running a 70-minute gate per task is
  how a queue of five tasks becomes a six-hour run that finishes after
  everyone has stopped caring about it.
- **Only groups the run touched.** A group nothing changed does not need
  re-verifying; a group that was touched does, regardless of which task
  touched it.
- **Never concurrently.** Two long gates in parallel contend for the same
  build outputs and produce failures that belong to neither. A serialised
  failure can be read in order; interleaved output from concurrent gates is
  where the first failure gets lost — the same reason a narrow fork count is
  blast-radius control in `skills/ansible-ops/`.

**Nothing in the batched stage is committed.** It verifies commits already
made. If a batched gate fails, that is a finding for the handover, not a
reason to amend a commit that was correctly closed on the evidence available
at the time.

## The one retry

A gate that times out is retried **at most once**. **A second timeout is a
finding for the operator, not a flake.**

Stated as a number because the alternative is an agent deciding at 3am how
many 70-minute retries a night can afford. Repeated identical failure means
the diagnosis is wrong, not that the fix needs another pass.

## What is untested

`ADR-0022` **F7** — *"routing every gate through one detaching entry point
keeps each agent shell call inside the client's cap"* — is **untested**. It
would be falsified by a measured wait exceeding the cap. If it fails, rule 3
does not generalise and the binding contract needs a second mechanism; it does
not mean the long gate can be run inline after all.

## In the binding

Four slots, all in `templates/binding.md`: the detaching entry point, the
poll command and its interval, the long-gate groups, and the watchdog
timeout. An unfilled slot reads `unknown`, and **`unknown` is a stop** — a run
that does not know its watchdog timeout will discover it by hanging.
