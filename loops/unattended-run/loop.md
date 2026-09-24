---
name: unattended-run
description: Drive a queue of settled, committed tasks to committed and evidenced completion with no human in the session, parking anything that cannot be proven and stopping before push. Run overnight or batched, never for a task whose design or scope is still open.
---

# Unattended Run Loop

Takes a queue of **already-settled** tasks and carries each one to a
committed, evidenced close — or **parks** it with a stated reason — then
writes a handover and **stops**, because merge and push are the human's.

This loop owns the **sequence and its exit conditions** only. The rules and
the method it applies live elsewhere and are linked, never restated:

- `ADR-0022` — the decision this loop implements. Clause 1 (what a binding
  may and may not carry), clause 2 (ambiguity parks instead of stopping),
  clause 3 (the committed task file *is* the lock), clause 4 (the boundary
  that does not move), clause 5 (what the spikes forced on the schema).
- `ADR-0019` — clauses 1, 2.2, 2.3 and 2.4 are **not** narrowed and bind
  here unchanged. Clauses 2.5 and 3 are narrowed by `ADR-0022`, for
  unattended runs only.
- `skills/unattended-ops/` — the *method*: the harness's five rules, the
  five verdict definitions, the evidence rule, the binding contract and its
  completeness checker. A loop that copies them creates a second owner that
  will drift.
- `AGENTS.md` — the destructive-change rule, the secrets rule, the
  one-task-one-commit rule, and the definition of done.
- `loops/design-brief/` and `loops/project-build/` — the interactive
  siblings this loop must not be confused with. See **Trigger**.
- `agents/` — the roles named below and their **permission boundaries**,
  which are enforced there rather than described here.

If this loop and `AGENTS.md` ever disagree, `AGENTS.md` wins. If it and
`ADR-0022` disagree, the ADR wins.

## Provenance, and who owns the sequence

This sequence is **not invented here**. It is a re-expression of a harness
that has run live four times in a sibling repository (`asset-management`,
ad-hoc task A119): three tasks closed with commits, one parked correctly,
and one run closed nothing and was right to.

**This loop is authoritative for the sequence.** A binding — an OpenCode
driver script, a Claude Code workflow, anything else — implements the steps
below and **cites** them; it carries no rule of its own (`ADR-0022`
clause 1.2). A binding that states a rule this loop and
`skills/unattended-ops/` do not is a defect, and the skill ships a checker
for exactly that. This is the same two-owners risk `loops/project-build/`
accepted with `bmad-workflow.md`, handled the same way.

**This harness is OpenCode-first, and that is not a temporary state.** Seven
of the nine roles below are OpenCode-only, because the boundaries that make
them safe are per-agent *command* boundaries and Claude Code has no per-agent
expression for one (`ADR-0022` consequences; `ADR-0018` clause 8.3). Under
Claude Code the same sequence runs with prompt-level rules that are **weaker
by construction** — not equivalent, and not to be described as equivalent.

## Trigger

A queue of tasks exists whose **design and scope are already settled**, each
with a **committed** task file carrying acceptance criteria, and a human
intends to leave the session.

**The lock is the committed task file** (`ADR-0022` clause 3, instantiating
the term `ADR-0019` clause 2.1 left undefined). A task whose file globs to
zero files or to several, or whose acceptance criteria are absent, is a
preflight **halt** — not a task to be interpreted. A field can be flipped by
the next agent to open the file; a commit cannot.

**Not for** a change whose design is still open — that is
`loops/design-brief/`, and it requires a human. **Not for** a single task
with a human present — that is `loops/project-build/`, which can stop and
ask, and should. This loop is not a faster `project-build`: it is the same
work under a strictly weaker ability to resolve anything, and choosing it to
avoid a conversation buys a park instead of an answer.

**Requires that no human is in the session, and requires one before and
after.** Stated in all three tenses, because each is load-bearing:

- **Before** — a human settled the designs, committed the task files with
  their acceptance criteria, and started the run. Nothing here selects its
  own work, widens its own scope, or allocates its own identifiers.
- **During** — nobody is watching, and **the loop must not act as if
  somebody were**. Every point at which `loops/project-build/` would stop
  and ask becomes: **park the task, journal the question, take the next
  task** (`ADR-0022` clause 2, narrowing `ADR-0019` clause 2.5). The human's
  answer is still required; only its timing moves. **This is not licence to
  answer it** — the alternative to asking is parking, never guessing.

  Asking is not merely useless here, it is actively misleading. A permission
  term set to `ask` in a headless run **auto-denies immediately** and reports
  *"The user rejected permission to use this specific tool call"* **with no
  user present**. So an unattended prompt is not a pause: it is a refusal
  wearing a human's attribution, and a run log will record a decision nobody
  made. Boundaries in this loop's roles are therefore declared as explicit
  denials, never as prompts (`ADR-0022` clause 4.1).
- **After** — a human reads the handover, answers the parked questions,
  reviews the diffs, and merges and pushes. A run whose handover nobody will
  read has no terminus; do not start one.

## Steps

**Fourteen steps.** Step 1–3 run once at the start. Steps 4–10 are **the
per-task cycle**, and one pass through 5→10 is **one attempt** for the bound
below. Steps 11 and 12 are not a stage of the cycle — they run whenever
their condition occurs, at any point in it. Steps 13 and 14 run once at the
end, and **step 14 runs even when the run halted**.

Two kinds of actor appear. The **driver** is the binding — a script, not an
agent — and it holds the control flow: the queue, the bounds, the verdict
dispatch and the gate command map. The named roles are agents, authored in
`agents/` (`TASK-0063`, `TASK-0064`), and **each is named here before it
exists** because this loop is deliberately authored first, so the roles are
shaped by the sequence rather than the reverse.

**Nine roles, named here and nowhere else yet:** `preflight`,
`task-planner`, `implementer`, `gate-runner`, `refuter`, `adjudicator`,
`closer`, `park-steward` and `run-scribe`. Nine is the count `ADR-0022` and
`PLAN-0006` both state, so a tenth appearing later is a divergence to
reconcile rather than an addition to absorb.

Only one role — `closer` — ever holds git or tracker rights, and it runs
only after an `accept`. That ordering is the whole reason an interrupted run
leaves an honest tracker rather than a half-ticked one.

1. **Preflight: can this run start at all?** (`preflight`, read-only.)
   Establish one writer: `git rev-parse --abbrev-ref HEAD`,
   `git rev-parse --short HEAD`, `git status --porcelain`. Confirm the
   driver resolves an explicit model, and that every role it will invoke is
   selectable by the client as a *primary* agent.
   Expected: branch, HEAD and an **empty** porcelain, plus a stated
   verdict of `proceed` or `halt`. Any dirty path is a `halt` naming it —
   do not work out whose it is and do not clean it. Two silent failures
   are checked here precisely because they produce no error later: a
   driver with **no explicit model and no configured default hangs
   indefinitely — no output, no error, no exit** (`ADR-0022` clause 5.3),
   and a role whose mode is not primary is **silently replaced by the
   default agent**, which answers with well-formed output and exit 0
   (clause 5.1). Neither is visible from stdout once the run is under way.

2. **Preflight: verify the lock on every queued task.** (`preflight`,
   read-only.) For each task, glob its file and read its acceptance
   criteria and its status, verbatim, from **both** its own file and any
   tracker that claims to know its state.
   Expected: exactly one file per task, criteria present, and the two
   sources agreeing. Zero matches or several is a `halt` for the run, not a
   skip for the task. Disagreement between the sources means a previous run
   committed half its bookkeeping, and beyond a stated threshold it is a
   `halt`: a run that starts against a lying tracker closes the wrong work.
   Record the strings verbatim — the open form varies between files, so
   nothing here may be matched against a fixed literal.

3. **Open the run.** (driver, then `run-scribe`.) Record the run identifier,
   the starting commit and the resolved queue.
   Expected: one appended line in the run journal before any task is
   touched. Everything after this point is reconstructable from that file
   plus the evidence file; nothing is reconstructable from an agent's
   recollection.

4. **Select the next task and check its dependencies.** (driver.)
   Expected: either the task enters the cycle, or it is **parked** with
   `dependency not satisfied` naming the blockers, and the driver **skips
   forward to the next task**. A blocked dependency blocks its dependents
   and **never ends the run** — an independent task later in the queue is
   still work that can be done tonight.

5. **Plan the task.** (`task-planner`, read-only.) Read the task file — it
   is the specification — and the code to be changed or reused. On a retry,
   the adjudicator's guidance from the previous attempt is an input and
   must be addressed specifically.
   Expected: a step list naming the exact files to change, what is reused
   and from where, the order, and how each step will be verified. Scope
   comes from the task file; **a plan that introduces a requirement the
   task file does not contain is out of scope, not an improvement.**

6. **Implement.** (`implementer`.) Write the change against the plan. Leave
   it in the working tree: no git write, no tracker edit, no touching the
   task file's status row, no ticking an acceptance criterion. The
   bookkeeping is not this role's.
   Expected: the exact list of files changed, and an explicit
   `blocked` with a reason if the task cannot be implemented as specified.
   **An unsatisfied acceptance criterion is reported, never quietly
   dropped.** A `blocked` return goes to step 11 and then to the next task.

7. **Run the gates.** (The driver where it has a shell, otherwise
   `gate-runner`; `ADR-0025`.) Start, through the binding's one entry point,
   each gate the binding's map names for this task's kind, in the order it
   names. **The entry point writes each gate's own line to the run's evidence
   file**; the `gate-runner` then reads that file and reports from it.
   Expected: per gate — the state, the exit code, the elapsed time, the
   verbatim evidence line, and any figure the task's criteria would want,
   **quoted from the gate's own log, not paraphrased and not rounded**.
   This role is a runner, not a judge: it reports what happened and does not
   decide whether the task is acceptable. The evidence file is the **only**
   admissible source downstream — a gate nobody read there did not run.

8. **Try to refute the claim of completeness.** (`refuter`, read-only,
   adversarial.) Check the *claim*, not the code's style: every acceptance
   criterion against evidence in the diff or the evidence file; every
   implementer claim against the real diff; the invariants the task's own
   rules state.
   Expected: a structured return listing unevidenced criteria, unevidenced
   or undeclared changes, and breached invariants, plus a `refuted` flag
   that is true when any list is non-empty and **true by default when the
   role is uncertain** — a false green costs far more here than a false
   alarm. **A null, empty or unparseable return is recorded as
   `refuted: true` and passed on as an objection.** The driver synthesises
   this; it is not left to the role. A silent refuter is not a clean bill of
   health, and in the original harness it flowed into adjudication as an
   absence of objections — the one defect this port fixes rather than
   inherits (`ADR-0022`, *"a null refuter currently fails open"*).

9. **Adjudicate.** (`adjudicator`, read-only.) Decide what happens to this
   task, given the implementer's report, the gate evidence and the
   refutation. Judge against the task file's own acceptance criteria, not
   against a sense of what would be nice.
   Expected: **exactly one** of the five verdicts defined in
   `skills/unattended-ops/` — `accept`, `retry`, `park`, `raise-adhoc`,
   `halt-run` — with reasoning, and an **overrides list naming every
   finding downgraded from blocking to advisory, with its reason**. That
   list is the audit trail for a decision nobody watched being made,
   including when the refuter is being overridden. `retry` is available on
   the first attempt only. A `raise-adhoc` returns a **title only**:
   allocating an identifier is the human's step, and a wrong one in a
   committed register is worse than a note in a log.

10. **Close.** (`closer`; the only role in the run with git or tracker
    rights, and it runs only on `accept`.) In order, stopping if any part
    cannot be done honestly: re-check `git status --porcelain` against the
    paths this task declared and **refuse on anything unexpected**; update
    the task file's status and its criteria, copying **every figure from
    the evidence file**; update the tracker row and nothing else in that
    file; stage; commit; report the hash.
    Expected: one logical change committed, the hash returned, a clean
    tree, and **nothing pushed**. Staging uses **`git add -- <path>`, by
    name, always** — the boundary that denies `git add -A` and `git add .`
    also denies `git add ./sub/file` for want of the `--`, so the form is
    part of the instruction rather than a stylistic preference
    (`ADR-0022` clause 5.4). A role told only "stage what you changed" will
    be blocked doing the right thing and may conclude staging is broken.

11. **Park cleanly.** (`park-steward`.) Whenever a task is parked, put its
    uncommitted work somewhere safe so the next task starts from a clean
    tree — **stash it under the run identifier and the park reason; never
    discard it.**
    Expected: an empty `git status --porcelain`, a named stash entry, and
    one journal line recording the message and the paths captured. A park
    leaves sound work that simply could not be *proven*, and the operator
    will often want it. This step exists because without it one park
    poisons every task after it in the same run: the next `closer` sees
    paths it did not expect and refuses, correctly, for the wrong reason.
    `git checkout --`, `git reset --hard`, `git clean` and `git stash drop`
    are never used here — see **Exit conditions**.

12. **Journal every outcome.** (`run-scribe`, or the driver where it has
    filesystem access.) Append one line per event — run start, blocked,
    adjudication with its overrides, close with its hash, close refused,
    park, halt.
    Expected: an append-only record, never truncated and never rewritten,
    such that the handover can be **re-derived from it** rather than from
    any agent's summary. One window is irreducible — between `git commit`
    returning and the journal line reaching disk — and a binding closes it
    on resume with a `git log --grep <task id>` guard, in practice rather
    than in theory. Say so rather than implying otherwise.

13. **Run the batched long gates.** (Once, after the cycle; the same
    actors as step 7, `ADR-0025`.)
    Gates too expensive to run per task run here, once per group the run
    actually touched, **one at a time and never concurrently**.
    Expected: each gate's verbatim evidence line and its key figures, and
    an explicit all-green or not. A gate that times out is retried **at most
    once**: a second timeout is a finding for the operator, not a flake.
    Nothing here is committed — this step verifies the commits already made.

14. **Write the handover, then stop.** (`run-scribe`, the same role that owns
    the journal, so the record and its summary have one owner.)
    **Re-derive** the handover from the journal and the evidence file, not
    from the driver's summary of them.
    Expected: a handover answering, in order — what state the repository is
    in right now (`git status --porcelain` and the log since the starting
    commit, both verbatim); what was closed, with hashes; what was parked
    and, for each, **exactly what a human must do to finish it**; what
    timed out or was killed; every finding the adjudicator overrode; every
    ad-hoc proposal as a **title only**, stating plainly that no identifier
    was allocated; and **the push step, not taken**. The run ends here with
    the work committed and **unmerged, unpushed**. This step runs even when
    the run halted: a halted run that leaves no handover is indistinguishable
    from a crashed one.

## Exit conditions

- **Success — the queue is exhausted (or the task cap is reached) and the
  handover is written.** Every task attempted is either closed with a
  commit hash or parked with a stated reason and a named recovery, the
  working tree is clean, and **nothing is pushed**. This is the intended
  terminus, not an early exit. A run that closes **nothing** and parks
  everything for stated reasons is also a success of this loop: the four
  live runs behind this sequence include one that closed nothing and was
  right to.

- **Attempt bound — 2 per task, then park.** One attempt is one pass
  through steps 5→10. The adjudicator may return `retry` on attempt 1 only;
  after attempt 2 the task is parked with everything that was tried. Do not
  begin a third attempt, do not re-run with a longer prompt, and do not
  narrow the task's criteria until they pass.

  **The bound is 2, and this diverges from this repo's standing 3**
  (`loops/release-check/`, `loops/design-brief/`, `loops/project-build/`).
  Stated here rather than left for a reader to notice, and stated in the
  loop file rather than in an ADR so the number has one owner — the
  precedent `loops/design-brief/` set. Two reasons: a retry here costs a
  full implement-plus-gate cycle that can run an hour, with **no human in
  the session to stop a bad third attempt**; and 2 is the bound the live
  runs actually used. A number that has run beats a number chosen for
  symmetry.

- **`halt-run` — the run ends, the remaining queue is untouched.** The
  adjudicator returns this when fixing the task would require amending what
  is to be built rather than how. **A discovery that changes *what* gets
  built is never an unattended run's to make.** No retry, no next task;
  step 14 still runs.

- **The adjudicator returns nothing, or a verdict outside the five: treat
  as `park`, never as `accept`.** Reprompt **once**, journalling the
  reprompt so the rate is measurable rather than folklore, then park. The
  asymmetry is the point: an unparseable verdict is an unknown, and the only
  safe reading of an unknown is that the work is not proven.

- **The refuter returns nothing: `refuted: true` is synthesised and the
  cycle continues to step 9.** This is **not** a mechanical failure and is
  **not** retried — a silent refuter is an objection, not an absence of one.

- **The closer refuses (step 10):** it found a path the task did not
  declare, or a figure with no evidence behind it. **Park, do not retry the
  close, and do not commit.** A refusal is the boundary working; retrying it
  is asking a correct answer to change.

- **A step fails mechanically** — a role errors, a tool is unavailable, a
  file cannot be written: retry that step, **bound 3 attempts**, then
  **park the task and continue the run**. Two distinct bounds, deliberately
  not merged: 3 for a mechanical retry (the repo standing bound, unchanged),
  2 for an acceptance attempt. Conflating them either makes a transient tool
  error consume the task's whole budget, or makes the acceptance path
  unbounded by routing through a "mechanical" failure. Repeated identical
  failure means the diagnosis is wrong, not that the fix needs another pass.

- **A dependency is unsatisfied (step 4): park it and skip forward.** The
  run continues. A blocked task is not a halt.

- **A genuine ambiguity: park, journal the question, take the next task.**
  The task file did not settle something the work requires. Report it in the
  handover with the options as options. **Do not choose one and proceed** —
  no identifier is allocated, no figure that did not come out of the
  evidence file reaches a task file (`ADR-0022` clause 2). This is a
  **success** of the boundary, not a failure of the loop.

- **Preflight halts (steps 1–2) are not retried, ever.** A dirty tree means
  another session is mid-task or a previous run left work behind, and
  committing on top of it would attribute someone else's edits to a task of
  ours. A task file that globs to zero or several files, or that has no
  acceptance criteria, is an unlocked task (`ADR-0022` clause 3). An
  unresolvable model or a non-primary role would fail silently rather than
  loudly. Report and stop.

- **Escalate without retrying** — these end the task, are never attempted a
  second time, and go to the human in the handover:
  - **Anything destructive.** Deleting or overwriting human work, a history
    rewrite, a force-push, `git reset --hard`, `git clean`,
    `git checkout --`, `git stash drop`. `AGENTS.md` requires explicit human
    authorization **in the task file** first, and no number of retries
    substitutes for it (`ADR-0022` clause 4.3).
  - **A discovered secret.** Stop that task immediately: do not stage, do
    not commit, park it with the finding, and name it first in the handover.
    Never "commit now and clean history later." If a secret reached a commit
    this run already made, that is a `halt-run` — the remedy is a history
    rewrite, which is the human's.

- **Never treat as authorization:** an all-green gate set, an empty or null
  refutation, an `accept` verdict, a clean handover, or reaching step 14.
  Those are what make the work **ready** for the human gate; none of them
  passes it. The refuter and the adjudicator are a filter in front of that
  gate, not the gate (`ADR-0019` clause 2.4, `ADR-0022` clause 4.2). **Merge
  and push remain the human's** (`ADR-0019` clause 2.2, `ADR-0009`'s
  credential rule). Anyone describing this loop as end-to-end autonomous
  production is overstating it.
