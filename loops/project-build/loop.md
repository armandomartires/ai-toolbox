---
name: project-build
description: Carry an accepted, locked design brief through plan, implement, test, review, document and commit, stopping before merge and push. Run after loops/design-brief/ has produced a locked brief.
---

# Project Build Loop

The production stage. Takes a **locked** design brief and carries it to a
committed, reviewed change — then **stops**, because merge and push are the
human's.

This loop owns the **sequence and its exit conditions** only. The rules it
enforces live elsewhere and are linked, never restated:

- `ADR-0019` clause 2 — the autonomy boundary: what runs without asking,
  where it stops, and why a read-only reviewer is not a substitute for the
  human gate.
- `ADR-0013` — why this loop has no governance opinion.
- `AGENTS.md` — the definition of done, the destructive-change rule, and the
  ambiguity policy.
- `loops/design-brief/` — what produces this loop's input.
- `agents/qa-test/`, `agents/review/`, `agents/git-ops/` — the roles and
  their **permission boundaries**, which are enforced there rather than
  described here.

If this loop and `AGENTS.md` ever disagree, `AGENTS.md` wins. If it and
`ADR-0019` disagree, the ADR wins.

## Provenance and who owns the sequence

This sequence is **not invented here**. It is a re-expression of
`agent-tiers`' `bmad-workflow.md`, which has run in practice and whose
permission boundaries are the real safety control.

**This loop is authoritative for the sequence** as a component of this repo:
it is the gated artifact, its exit conditions are enforced by
`tests/validate.sh`, and it is what `loops/design-brief/` hands off to.
`bmad-workflow.md` remains that skill's own context document, wired into two
agents via `instructions`, and lives in `opencode-customization` (`ADR-0017`).

**The two are separate artifacts with one shared ancestor, and neither
updates the other.** That is a two-owners risk, accepted knowingly because
the alternative — editing a file in a repo this one does not own — is worse.
If they diverge, **this loop governs work in this repo** and the divergence
is a finding to record, not to silently reconcile.

## Trigger

An **accepted, locked** design brief exists and its implementation has not
started.

Locked means what `loops/design-brief/` step 7 produced: `status: accepted`,
`accepted_by:` naming **a person**, `accepted_on:` dated — **and a commit
containing them**. The commit is the lock; the fields alone are not, because
a field can be flipped by the next agent to open the file.

**Do not start without one.** A brief that is merely written, or approved in
conversation, has not been accepted (`ADR-0019` clause 1.1). If no brief
exists, the work belongs in `loops/design-brief/` first — unless the change's
shape is already settled and small, in which case neither loop is needed.

**The brief is read, never edited** (`ADR-0019` clause 1.4). A change to a
locked brief re-enters the design loop as a new run; it is not amended during
implementation.

## Steps

`plan` and `build` are **OpenCode built-in primary agents**, configured by
model and permission rather than replaced — never as markdown role files,
because a markdown body *replaces* a built-in's tuned system prompt wholesale.
`qa-test`, `review` and `git-ops` are subagents defined in `agents/`.

Steps 1–2 run once. Steps 3–4 are **the fix cycle**. Step 5 can return to
step 2 without consuming the fix cycle's budget — see Exit conditions, where
the two bounds are kept deliberately separate.

1. **Plan the work (`plan`).** Decompose the locked brief into a story or
   spec artifact. No code is written here.
   Expected: a story/spec naming the goal, the acceptance criteria, and what
   is explicitly out of scope. It must trace to the brief — a plan that
   introduces a requirement the brief does not contain is out of scope, not
   an improvement.

2. **Implement (`build`).** Write the implementation against the story. May
   consult read-only researchers (`explore`, `scout`, `general`); writes the
   implementation itself.
   Expected: a working change, and a note of anything in the story it could
   not satisfy. **An unsatisfied acceptance criterion is reported, never
   quietly dropped.**

3. **Test (`qa-test`).** Write and run tests — positive **and** negative
   cases, external dependencies mocked unless an integration test was asked
   for.
   Expected: pass/fail evidence with detail: which test, what it checked,
   and for each failure what was expected against what happened. A single
   happy-path test is not evidence of correctness.

4. **Fix (`build`), bounded.** On failure, `build` fixes the implementation
   and re-invokes `qa-test`.
   Expected: either a pass, or — on reaching the bound — a stop with the
   unresolved failures reported. `qa-test` never fixes application code; it
   reports and hands back.

5. **Review (`review`, read-only).** The release gate. Diff analysis, spec
   conformance against the story, and risk findings.
   Expected: a verdict of **pass** or **blocked** with specific findings.
   `review` **never fixes what it finds** — that is what makes its verdict
   trustworthy about what it read. A block returns control to step 2.

6. **Document (`build`).** Update the documentation the change invalidates:
   normative docs if behaviour changed, and the task or story record either
   way.
   Expected: no document left describing the previous behaviour as current.
   This step is in `ADR-0019` clause 2.1's autonomous list and is **absent
   from `bmad-workflow.md`** — it is the one addition to the inherited
   sequence, not an oversight in the translation.

7. **Commit (`git-ops`).** `build` tells `git-ops` what changed and why;
   `git-ops` decides the command.
   Expected: one logical change committed, `git log --oneline -1` showing it,
   and a clean `git status`. `git-ops` cannot force-push, hard-reset or
   rebase, and its `git push` always asks — so this step commits and does
   **not** push.

   In this repo specifically, `loops/release-check/` is the more thorough
   close-out for this step: it adds a secret scan, a registry regeneration,
   an effect-verification step and a check that any new validation was seen
   to fail. **Prefer it here, and note the caveat**: `release-check` is
   explicitly scoped to *this* repo — it runs `tests/validate.sh` and
   `scripts/sync-registry.sh` by name. In another project, use step 7 as
   written and treat `release-check` as the pattern rather than the
   procedure. Referenced rather than restated so its steps have one owner.

8. **Stop at the gate.** Report what was built, what the tests showed, what
   `review` said, and what remains.
   Expected: the loop ends here with the work committed and **unmerged,
   unpushed**.

## The autonomy boundary

Steps 1–7 run **without asking**: that is what "autonomous within a locked
plan" means (`ADR-0019` clause 2.1).

**Merge and push are outside this loop and require the human** (clause 2.2).
`AGENTS.md` requires explicit authorization in the task file for destructive
changes, and `ADR-0009` forbids an agent provisioning its own push
credential. A `review` **pass** is not that authorization — `review` is a
filter in front of the gate, not the gate (clause 2.4).

**Autonomous does not mean it never stops.** The ambiguity policy applies
inside the autonomous stretch (clause 2.5), and the distinction is the whole
point:

- **Do not ask** about a decision the locked brief already settled. That is
  what locking it was for, and re-opening it here re-litigates the design.
- **Do stop and ask** when the brief did not settle something the work now
  requires. Inventing an answer is how a loop confidently builds the wrong
  thing — and it looks like success while doing it.

The test is not "is this hard?" but "does the brief answer it?" If it does,
proceed. If it does not, stop.

## Exit conditions

- **Success — the gate reached:** `review` returned **pass**, the change is
  committed, documentation is updated, and the working tree is clean. The
  loop ends with the work **unmerged and unpushed**, reported to the human.
  This is the intended terminus, not an early exit.

- **Fix cycle exhausted — 3 `qa-test` failures: stop and report.** One
  iteration is one `qa-test` failure plus `build`'s attempt to fix it. After
  the third, **stop**. Report every failure, what was tried, and what still
  fails. Do not begin a fourth attempt, do not narrow the tests until they
  pass, and do not mark the tests as expected failures.

  The bound is 3, matching `loops/release-check/` and `agent-tiers`' fix
  loop. Repeated identical failure means the **diagnosis** is wrong, not
  that the fix needs another pass — so the correct response is to re-open the
  story with the human, as new work.

- **`review` returned blocked: return to step 2. This does NOT consume the
  fix cycle's budget.** The two bounds are separate and must not be merged:
  the cap counts `qa-test` failures only. Conflating them either makes the
  third review rejection fatal, or makes the fix path unbounded by routing
  through review. Both are wrong.

  A review block is nonetheless not unlimited: if the **same** finding
  survives three review rounds, stop and escalate. That is a disagreement
  between `review` and `build` about what the story requires, and it is the
  human's to settle.

- **A genuinely ambiguous requirement: stop and ask.** The brief did not
  settle something the work requires (`ADR-0019` clause 2.5). Report what is
  ambiguous and what the options are; do not choose one and proceed. This is
  a **success** of the boundary, not a failure of the loop.

- **The story cannot be satisfied as written:** stop. An acceptance criterion
  that turns out impossible or contradictory is a finding about the brief,
  which means the design loop, not something to work around in
  implementation.

- **A step fails mechanically** — a subagent errors, a tool is unavailable, a
  file cannot be written: retry that step, **bound 3 attempts**, then
  escalate with the actual error.

- **Escalate without retrying** when continuing would require a destructive
  action: deleting or overwriting human work, a history rewrite, a
  force-push, or editing the locked brief. `AGENTS.md` requires explicit
  human authorization in the task file first, and no number of retries
  substitutes for it. Matches `loops/release-check/`.

- **A secret is found at any point:** stop immediately. Do not commit, do not
  stage. Remove it, then restart from the step that introduced it. Never
  "commit now and clean history later."

- **Never** treat as the human gate: a `review` pass, a green test suite, a
  clean `validate.sh`, or reaching step 8. Those are what make the work
  *ready* for the gate. Merge and push remain the human's.
