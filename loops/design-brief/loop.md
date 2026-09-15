---
name: design-brief
description: Converge a project idea into a brief the human has accepted and locked, via bounded ideate-critique rounds. Run before any implementation planning; stop when accepted or when the cap is reached.
---

# Design Brief Loop

Turns an idea into an **accepted, locked brief** that the production stage
can implement without re-litigating the design. This loop owns the
**sequence and its exit conditions** only; the rules and the method it
applies live elsewhere and are linked, never restated:

- `ADR-0019` — convergence is explicit human acceptance; the autonomy
  boundary; why dynamic workflows are not used here.
- `skills/design-flow/` — the *method*: how to clarify, what makes
  alternatives distinct, what a critique must examine, what an accepted
  brief contains.
- `AGENTS.md` — the ambiguity policy, and the rule that destructive changes
  need explicit human authorization.
- `loops/project-build/` — what consumes this loop's output.

If this loop and `AGENTS.md` ever disagree, `AGENTS.md` wins. If it and
`ADR-0019` disagree, the ADR wins.

**This loop produces a design brief, not a governance artifact.** It has no
task IDs, no sprint concept, and no opinion about `.ai/`. See `ADR-0013`.

## Trigger

A project idea, feature request, or problem statement exists and no
accepted design for it does. Start here when the work is large enough that
implementing the wrong thing would be expensive.

**Not for:** a change whose shape is already settled — go straight to
`loops/project-build/`. Not for re-opening an already-accepted brief
either: that is a new run of this loop against the existing brief as input,
not an in-place edit (`ADR-0019` clause 1.4).

**Requires a human in the session.** Step 1 and step 6 both need answers
only the human can give. This loop cannot be run unattended, and the
terminating condition is not something an agent may supply on the human's
behalf.

## Steps

The **manager** is a primary agent — it holds the conversation and owns the
brief file. `ideator`, `critic` and `git-ops` are subagents. That split is
structural, not stylistic: a subagent cannot ask the user a question, and
cannot spawn workers of its own. See `ADR-0018`.

`git-ops` is reused from `skills/agent-tiers/`, not invented here, so the
guarded commit boundary has one owner across both loops.

Steps 1 and 7 run once. Steps 2–6 are **the cycle**, and one pass through
2→6 is **one iteration** for the purposes of the cap below.

1. **Clarify (manager, once).** Establish what the human actually wants:
   the problem, the constraints, what is explicitly out of scope, and how
   success would be recognised. Ask about what is genuinely ambiguous;
   assume what is merely unstated and **record the assumption as an
   assumption**.
   Expected: a written problem statement and a constraint list the human
   has confirmed. Not a design — no solution is chosen here.

2. **Ideate (`ideator`, parallel).** Generate alternative approaches
   satisfying the constraints, each meeting `skills/design-flow/`'s
   distinctness requirement.
   Expected: candidates that differ in *approach*, not in detail. Three
   variants of one idea is a failed step, not three alternatives — say so
   and re-run rather than passing them on.

3. **Critique (`critic`, parallel, read-only).** Review every candidate
   against the obligations `skills/design-flow/` enumerates.
   Expected: per candidate, what it costs, where it fails, what it assumes.
   **An empty critique must state what was examined**, so "found nothing"
   is distinguishable from "did not look."

4. **Converge (manager).** Select one candidate, or a stated combination,
   and write the brief. Record what was rejected **and why** — a brief that
   records only the winner invites the discarded options to be re-proposed
   later.
   Expected: a brief at the path agreed in step 1, containing what
   `skills/design-flow/` requires, with the rejected alternatives named.

5. **Verify the brief against the constraints (manager).** Re-read step 1's
   constraint list and check the brief satisfies each one, naming any it
   knowingly violates.
   Expected: a constraint-by-constraint pass, or an explicit, justified
   exception. This step exists because the brief is written from the
   critique, and the critique is about candidates rather than about the
   original constraints — so drift enters here and nowhere else.

6. **Present for acceptance (manager).** Give the human the brief, the
   rejected alternatives with reasons, the assumptions from step 1, and any
   constraint exception from step 5.
   Expected: one of three answers — **accepted**, **changes requested**
   (return to step 2 with the feedback as a new constraint), or
   **rejected** (exit; see below). Silence, approval of a summary, or the
   critic finding nothing are **not** acceptance.

7. **Lock (manager, then `git-ops`, once).** On acceptance only:
   - The manager sets `status: accepted`, `accepted_by:` (who accepted it)
     and `accepted_on:` (the date) in the brief's frontmatter.
   - The manager then delegates the commit to **`git-ops`**, telling it what
     changed and why. The brief is committed on its own, with a subject line
     naming what was accepted.

   Expected: `git log --oneline -1` shows the brief's commit and
   `git status` is clean. **The commit is the lock**, not the frontmatter
   field: the field records the decision, and git records that it was made,
   by whom, and when. A field alone can be flipped by the next agent to
   open the file; a commit cannot be altered without a visible history
   rewrite, which `AGENTS.md` already requires authorization for.

   The commit is delegated rather than performed by the manager because
   `git-ops` is already the guarded, narrow owner of git operations — it
   cannot force-push, hard-reset or rebase, and `git push` is always `ask`.
   Giving the design manager its own commit capability would widen that
   manager's blast radius and create a second owner of the same concern.
   The manager decides *what* to commit and why; `git-ops` decides the
   command. Same split `loops/project-build/` uses.

## Exit conditions

- **Success — accepted and locked:** step 6 returned an explicit
  acceptance, step 7's frontmatter and commit are both in place, and the
  working tree is clean. `loops/project-build/` may now read the brief.
  **It reads and does not edit** (`ADR-0019` clause 1.4).

- **Cap reached — 3 iterations without acceptance: stop and escalate.**
  One iteration is one pass through steps 2–6. After the third pass
  without acceptance, stop. Report every candidate generated, every
  critique, and what the human asked for each time. **Do not begin a fourth
  pass**, do not re-run with a longer prompt, and do not narrow the brief
  until it becomes acceptable.

  The bound is 3 because both existing bounds in this repo are 3
  (`loops/release-check/loop.md`'s validation retries and `agent-tiers`'
  fix loop), and consistency is worth more than a number tuned by
  guesswork. But the *reason* differs and matters: those two bound
  **retries of a failing action**, whereas a design iteration is progress
  rather than a failure. What three unaccepted rounds indicate is that
  **the problem statement from step 1 is wrong** — which is
  `release-check`'s own logic, that repeated failure means the diagnosis is
  wrong rather than that the fix needs another pass. The correct response
  to the cap is therefore to re-open step 1 with the human, as new work,
  not to iterate harder inside this run.

- **Rejected outright (step 6):** the human rejects the direction rather
  than requesting changes. Exit without a brief. Record what was explored
  so a later run does not repeat it. This is a **successful** outcome of
  this loop — the cheap discovery that the idea should not be built is
  exactly what a design stage is for.

- **Ideation fails the distinctness requirement (step 2):** re-run step 2
  **once** with the failure named. If the second attempt also produces
  variants rather than alternatives, stop and escalate: the constraint set
  from step 1 is probably over-specified, leaving only one real approach.
  That is a finding about the constraints, not about the ideator.

- **A step fails mechanically** — a subagent errors, a file cannot be
  written, a tool is unavailable: retry that step, **bound 3 attempts**,
  then escalate with the actual error. Repeated identical failure means the
  diagnosis is wrong.

- **Escalate without retrying** when continuing would require a
  destructive action: overwriting an existing accepted brief, editing a
  locked brief in place, or rewriting history to change an acceptance.
  `AGENTS.md` requires explicit human authorization in the task file first,
  and no number of retries substitutes for it.

- **Never** treat as acceptance: an empty critique, a clean constraint
  check, the human approving a summary rather than the brief, or the cap
  being reached. Acceptance is the human's explicit answer to step 6 on the
  brief itself (`ADR-0019` clause 1.1, 1.3).
