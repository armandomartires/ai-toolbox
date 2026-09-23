# Parking, and what a human needs to recover

A park is not a failure. It is the run saying **"this could not be proven
here, and here is everything needed to prove it"** — and it is a success of
the boundary (`ADR-0022` clause 2.1).

## What a park must leave behind

Three things, and the run is not allowed to continue without all three.

1. **A clean working tree.** `git status --porcelain` empty.
2. **The work, kept.** Stashed under **the run identifier and the park
   reason**.
3. **One journal line** recording the stash message and the paths captured.

## Why the clean tree is not tidiness

**Without it, one park poisons every task after it in the same run.** The next
task's `closer` re-checks `git status --porcelain` against the paths its own
task declared, finds paths it did not expect, and **refuses** — correctly, and
for entirely the wrong reason. One unprovable task becomes a run that closes
nothing, and the handover blames the wrong task.

## Why the work is never discarded

**A park usually leaves sound work that simply could not be proven.** An
ambiguity in a task file, a dependency that was not ready, a gate that needed
a figure nobody had. The change itself is frequently exactly what the human
would have written, and re-deriving it in the morning is the most expensive
possible outcome.

So: **`git checkout --`, `git reset --hard`, `git clean` and `git stash drop`
are never used.** They are on the escalate-without-retry list because they
destroy human-recoverable work, and `AGENTS.md` requires explicit human
authorization **in the task file** for anything destructive. No number of
retries substitutes for that authorization.

## The stash message

It is the recovery instruction, so it carries what a human needs to find it
three days later without reading the journal first:

- the **run identifier**;
- the **task identifier**;
- the **park reason**, in the words the handover uses — the same string, not a
  paraphrase, so a search for one finds the other.

## What the handover must say about each park

The loop owns the handover's shape; what this skill owns is the **content
standard** for the park entries:

- **Exactly what a human must do to finish it.** Not "needs review" — the
  specific question, the specific missing dependency, or the specific figure
  that had no evidence behind it.
- **The options as options**, where the park was an ambiguity. Not a
  recommendation dressed as a finding: the run declined to choose, and
  presenting a preference undoes that.
- **Where the work is** — the stash entry by name.
- **What was already proven**, so the recovery does not start from zero. A
  gate that ran and passed before the park still ran and passed, and its
  evidence line is still the only admissible source for its figure
  (`references/evidence.md`).

## Parks that are not ambiguities

The same three obligations apply whatever the reason:

| Reason | What the human needs, specifically |
|---|---|
| Unsatisfied dependency | The blockers, by name. The run skipped forward; independent tasks later in the queue still closed |
| Attempt bound reached | **Everything that was tried**, both attempts, and the adjudicator's guidance from attempt 1 |
| Closer refused | The undeclared path, or the figure with no evidence behind it. **Not retried** — a refusal is the boundary working |
| Mechanical failure past its retries | The identical failure, repeated. Repeated identical failure means the diagnosis is wrong, not that another pass would help |
| Unparseable or out-of-enum verdict | The raw return, verbatim, and the fact that one reprompt was journalled |
| **A discovered secret** | Named **first** in the handover. Nothing staged, nothing committed. **Never "commit now and clean history later"** — and if a secret reached a commit this run already made, that is a `halt-run`, because the remedy is a history rewrite and that is the human's |

## What a park is not

- **Not a quiet failure.** A parked task with no stated reason and no recovery
  is a dropped task wearing a label.
- **Not a slower `retry`.** The attempt bound is the loop's, and a park after
  it is where the task stops for tonight.
- **Not a way to avoid `halt-run`.** If acting on the finding means changing
  **what** gets built, parking this task leaves the next one to inherit the
  same broken premise. `references/verdicts.md`.
