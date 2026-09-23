# The evidence rule

> **The run's evidence file is the only admissible source for a figure, and a
> gate nobody read there did not run.**

One sentence, two halves, and both are load-bearing. The first says where a
number may come from. The second says what an unrecorded gate is worth:
nothing, regardless of whether it ran.

## Why this is the rule rather than a preference

Unattended, every downstream reader is an agent reading a summary written by
another agent. A figure that entered the chain from a recollection is
indistinguishable from a measured one by the time it reaches a task file, and
a task file is committed. Rule 4 — **nothing is invented** — has no mechanism
without this rule; this is its mechanism.

## What is admissible

- A line **quoted verbatim from the gate's own output**, as written to the
  evidence file by the `gate-runner` at the moment the gate ran.
- For each gate: its state, its **exit code**, its **elapsed time**, the
  verbatim evidence line, and any figure the task's criteria would want.

## What is not admissible, however plausible

- **An agent's recollection.** Including the implementer's, including the
  same agent's, including five minutes later.
- **A paraphrase.** "All tests passed" is not `241 passed, 0 failed`.
- **A rounded figure.** `~70 minutes` is not `70m23s`. Rounding is invention
  with a friendly face, and it is how three measurements of 68m10s, 70m23s
  and 72m44s become one number that was never observed.
- **An exit code standing in for a figure.** Exit 0 says the tool ran to
  completion. It does not say what it read, and a gate that opened none of
  the task's files exits 0 exactly like one that opened all of them
  (`references/gate-map.md`, rule B).
- **A gate result recovered from a terminal scrollback, a CI page or a log
  the run did not write.** If it is not in the evidence file, the gate did not
  run, and re-running it is the remedy.

## `Pending` is an unwritten test, not a pass

A result reading **`Pending`** — or `Skipped`, `Inconclusive`, `Not run`, or a
framework's equivalent — is **not a pass**. It is most often a test that was
never written, and it is the one result that looks green in a summary line and
is green in nothing else.

**Three outcomes, kept distinct at every step: PASS, FAIL and SKIP.** A SKIP
is not a PASS. This repository's own `tests/smoke-mcp.sh` already reports the
three separately for the same reason; the rule is not new here, only applied
somewhere with nobody watching.

## Who depends on this rule

- **The `gate-runner`** writes the evidence file, and is a runner rather than
  a judge. It reports what happened; it does not decide whether the task is
  acceptable.
- **The `refuter`** checks every acceptance criterion against evidence in the
  diff or the evidence file. A criterion with no evidence is an unevidenced
  criterion, which is a finding — **not** an assumption that it must be fine.
- **The `closer`** copies **every figure from the evidence file** into the
  task file, and **refuses** if a figure it is asked to write has nothing
  behind it. That refusal is the boundary working; it is a `park`, never a
  retry.

## The evidence file itself

Its path is a **binding slot** (`templates/binding.md`) — this skill does not
say where it lives, only that there is exactly one per run and that everything
after the run's opening line is reconstructable from it plus the journal.

It is **append-only**, like the journal: never truncated, never rewritten. A
file a later step can edit is a file that can be made to agree with a summary,
which is the failure this rule exists to make impossible rather than
unlikely.

## What this rule does not do

It does not make a gate honest. A gate can run, write a verbatim line, and
still have checked nothing — that is exactly what `A120` was, for two stages.
The evidence rule guarantees that **what is claimed was observed**; the gate
map's construction rules are what give the observation content. Neither
substitutes for the other, and a reader who has only one of them has a run
that is either honest about nothing or dishonest about something.
