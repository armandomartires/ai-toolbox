# TASK-0044 — Author the project-build loop

## Objective
Author `loops/project-build/loop.md`: the production sequence — plan,
implement, test, fix, review, commit — derived from `agent-tiers`'
`bmad-workflow.md`, re-expressed as a validated loop with mandatory exit
conditions and **the human merge/push gate made explicit**.

## Minimal context

### This is a re-expression, not an invention
`skills/agent-tiers/templates/bmad/bmad-workflow.md:8-38` already defines
the loop:

```
plan → build → qa-test → (fix loop, max 3 iterations) → review → git-ops commit
```

with real substance: the fix loop bounded at 3, `review` returning
pass/blocked and **never fixing what it finds**, a `review` rejection
explicitly *not* counted against the fix-loop cap, and `git push` always
requiring confirmation.

What it lacks is the `loops/` category's contract: frontmatter, a `##
Trigger`, and `## Exit conditions` that the gate enforces
(`validate.sh:193-213`). It is a document wired into two agents' context via
the `instructions` config key — useful, but not a validated component.

So the work is translation plus the one substantive addition below. **Do not
redesign the sequence.** Its permission boundaries are the real safety
control and they already work.

### The one substantive addition: the merge gate
ADR-0019 clause 2 settles what `bmad-workflow.md` only half-encodes. That
file makes `git push` `ask` and has `git-ops` commit after a `review` pass —
so it stops short of pushing, but it does not *state* a boundary, and it
says nothing about merge.

Clause 2 states it: the stage runs autonomously through implement, test,
fix, review and document, then **stops before merge and push**, because
`AGENTS.md` requires explicit human authorization in the task file for
destructive changes and ADR-0009 forbids an agent provisioning its own push
credential. Clause 2.4 adds that *a read-only review agent is not a
substitute for the human gate* — it is a filter in front of it.

Clause 2.5 is the subtle one and must survive translation: the ambiguity
policy still applies **inside** the autonomous stretch. *"Autonomous" means
not asking about decisions the locked brief already settled, not inventing
answers to ones it did not.*

### Two bounds that must not be conflated
`bmad-workflow.md:32-34` is precise about this and it is easy to lose:

- The **fix loop** is capped at 3 `qa-test` failures. Past that, `build`
  stops and reports rather than looping.
- A **`review` rejection** returns control to implement and is **not**
  counted against that cap.

A translation that merges them either makes review rejections fatal at the
third one or makes the fix loop unbounded through the review path. Both are
wrong, and the second is the unbounded-instruction shape the authoring
guide warns about.

### Link, don't restate
The authoring guide's Loops rule, and `release-check`'s practice: loops
state *sequence only*, linking to the rules they enforce, because *"a copied
rule creates a second owner that drifts."* `release-check` ends with *"If
this loop and `AGENTS.md` ever disagree, `AGENTS.md` wins."*

This loop therefore links to ADR-0019 for the boundary, to
`skills/agent-tiers/` for the role method and artifact contracts, and to
`AGENTS.md` for the definition of done. It does not restate the permission
boundaries — those live in the role definitions, where they are enforced.

### What it consumes
The design stage's output: a **locked** brief. ADR-0019 clause 1.4 — the
production stage *reads it and does not edit it*, and a change to a locked
brief re-enters the design loop rather than being amended during
implementation. TASK-0041 decided the concrete lock mechanism, and this
loop's `## Trigger` must require it.

### The relationship to `release-check`
`loops/release-check/loop.md` already covers verify → index → review →
commit for a completed unit of work in **this** repo. This loop is broader
(it includes implementation) and general (it is not repo-specific).

There is real overlap at the tail. Worth deciding rather than duplicating:
whether `project-build`'s commit step **references** `release-check` or
restates it. Referencing is consistent with the link-don't-restate rule; the
complication is that `release-check` is explicitly scoped to this repo, so
using it from a general loop needs a stated caveat.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/decisions/0019-design-convergence-and-the-autonomy-boundary.md` | TASK-0033 | **Accepted 2026-09-15** — gate satisfied. Clause 2's five sub-clauses are this loop's exit-condition source; clause 3 is why the loop uses portable primitives rather than a workflow |
| `skills/agent-tiers/templates/bmad/bmad-workflow.md` | TASK-0035 | In this repo after the import; 53 lines; `:8-38` the sequence, `:22-26` the fix-loop bound, `:32-34` the review-rejection distinction, `:40-46` the artifact contract table |
| `loops/release-check/loop.md` | TASK-0008 | 96 lines; the shape precedent and the tail-overlap question |
| `loops/design-brief/loop.md` | TASK-0041 | `done`; the **lock mechanism** this loop's Trigger requires |
| `loops/_template/loop.md` | pre-existing | `## Trigger`, `## Steps`, `## Exit conditions` |
| `docs/development/authoring-guide.md` | pre-existing | Loops rule table; why exit conditions are the point; link-don't-restate |
| `tests/validate.sh` | pre-existing | `:193-213` — `name`↔directory, single-line `description`, the three sections |
| `AGENTS.md` | pre-existing | The definition of done, the destructive-change rule, the ambiguity policy — the four rules clause 2 reconciles against |

**Verify the expected state; don't assume it.** ADR-0019 was accepted on
2026-09-15, so that gate is **already satisfied**; re-read it for content
anyway, since ratification corrected its clause count. **This task's real
remaining dependency is TASK-0035** — read `bmad-workflow.md` at its path in
this repo *after* the import, because the drift resolution may have changed
its content and this brief's line references are to the pre-import file.

## Scope

### Included
- `loops/project-build/loop.md` with conformant frontmatter and the three
  mandatory sections.
- `## Trigger` — requires a brief in the **locked** state, per TASK-0041's
  mechanism.
- `## Steps` — numbered, each with an expected output, naming the role that
  performs it: plan → implement → test → (fix, bounded) → review →
  document → commit → **stop at the gate**.
- `## Exit conditions` covering: success (the gate reached with a clean
  review); the **fix-loop cap** reached → stop and report, not loop; a
  `review` block → return to implement, **not** counted against the cap; a
  genuinely ambiguous requirement → **stop and ask** (clause 2.5); and a
  destructive action required → escalate without retrying, matching
  `release-check`.
- An explicit statement that merge and push are **outside** the loop and
  require the human.
- A decision on the `release-check` tail overlap: reference or restate, with
  reasoning, and a caveat if referenced.
- A disagreement-precedence line.

### Not included
- **Redesigning the sequence.** It works; this is a translation.
- **Restating the role permission boundaries.** They live in the role
  definitions (TASK-0045), which is where they are enforced.
- **Authoring or reconciling roles.** TASK-0045.
- **Running the loop.** TASK-0046.
- **Any change to `agent-tiers`' own `bmad-workflow.md`.** It stays as the
  skill's document; this loop is a separate component. If the two disagree
  later, that is a two-owners problem to record — see the risks.
- Applying any topology to a live config. Out of S7's scope.
- Any governance opinion or client-specific syntax.

## Likely files
- `loops/project-build/loop.md`
- `docs/registry.md` — regenerated
- `.ai/tasks/TASK-0044-author-project-build-loop.md` — this file

## Execution plan
1. Re-read ADR-0019 (accepted 2026-09-15) — gate met, so this is a read for
   content. Clause 2's five sub-clauses are the exit-condition source;
   clause 2.5's ambiguity distinction is the one most easily lost in
   translation.
2. Read `bmad-workflow.md` at its post-import path; note any content change
   from the drift resolution.
3. Read `release-check/loop.md` for style, and decide the tail-overlap
   question with reasoning.
4. Draft `## Steps`, preserving the sequence and naming each step's role and
   expected output.
5. Draft `## Exit conditions`. **Keep the two bounds distinct**: the
   fix-loop cap, and the review-rejection path that does not consume it.
6. Write the merge-gate statement and the ambiguity-stop condition.
7. Add the disagreement-precedence line.
8. **Read the loop back as an executor**: walk each step and confirm no step
   requires a capability a subagent lacks, and that the autonomous stretch
   is genuinely unambiguous about where it ends.
9. Verify the two-owners risk: confirm this loop and `bmad-workflow.md` do
   not both claim to define the sequence normatively. State which is
   authoritative.
10. `bash tests/validate.sh`.
11. `bash scripts/sync-registry.sh`; confirm a third Loops row.
12. Review the diff; commit; record the hash; push; confirm; record.

## Acceptance criteria
- [ ] `loops/project-build/loop.md` carries the three sections, `name`
      equal to the directory, single-line `description`
- [ ] Every step states its expected output and its role
- [ ] `## Trigger` requires a brief in the **locked** state per TASK-0041's
      mechanism
- [ ] The **fix-loop cap** and the **review-rejection path** are distinct
      and cannot be read as one bound
- [ ] Reaching the cap **stops and reports**; it does not loop again
- [ ] Merge and push are stated as **outside** the loop, requiring the human
- [ ] A genuinely ambiguous requirement **stops the loop** (ADR-0019 clause
      2.5), and this is distinguished from asking about settled decisions
- [ ] Destructive actions escalate **without retrying**, matching
      `release-check`
- [ ] The `release-check` overlap is **decided with reasoning**, with a
      caveat if referenced
- [ ] The loop **links** to ADR-0019, `skills/agent-tiers/` and `AGENTS.md`
      rather than restating them
- [ ] It is stated which of this loop and `bmad-workflow.md` is
      authoritative for the sequence
- [ ] `tests/validate.sh` green; registry regenerated and committed

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — **required**

## Risks and rollback
- **Risk: two owners for one sequence.** `bmad-workflow.md` stays in the
  skill and is wired into agents' context via `instructions`; this loop is
  the validated component. If both claim to define the sequence, they will
  drift — the exact defect the link-don't-restate rule and lesson 6 both
  address. Step 9 forces the question; the honest answers are either "the
  loop is authoritative and the skill's copy points at it" or "the skill's
  is authoritative and the loop is a thin gated wrapper". Silence is the bad
  outcome.
- **Risk: conflating the two bounds.** The most likely translation error,
  because `bmad-workflow.md` states the distinction in one clause that is
  easy to compress. Merging them either makes the third review rejection
  fatal or makes the fix path unbounded via review.
- **Risk: "autonomous" read as "never stops".** Clause 2.5's distinction —
  not asking about settled decisions vs not inventing answers to open ones —
  is the difference between a loop that works and one that confidently
  builds the wrong thing. It must be written so a reader cannot take the
  simpler reading.
- **Risk: redesigning while translating.** The sequence has permission
  boundaries that were reasoned about and a model-tier mapping justified per
  role. Improving it in passing loses that reasoning without replacing it.
- **Risk: a placeholder exit condition passing the gate.** The check verifies
  presence and non-emptiness, not that anything is bounded. Same shape as
  lesson 1, applied to content.
- **Risk: scoping against the pre-import file.** This brief's line numbers
  are to `bmad-workflow.md` as it existed in `~/.config/opencode/`. Step 2
  reads the landed copy instead.
- **Rollback:** one new directory plus a regenerated registry. `git revert`
  removes both. Nothing depends on this loop until TASK-0046.

## Outputs / handover

**Intended end state — this task has not run.** The table below is a plan.
`validate.sh` requires this section non-empty for briefs ≥ 0020 and cannot
distinguish an intention from a state (ADR-0012 Decision 3), so this
sentence does it.

| Artifact | Intended end state |
|----------|-------------------|
| `loops/project-build/loop.md` | The production sequence as a validated loop; both bounds distinct; the merge/push gate explicit; the ambiguity-stop condition written so it cannot be read as "never stops" |
| The two-owners question | **Answered**: one of this loop and `bmad-workflow.md` is stated authoritative for the sequence, with the other pointing at it |
| The `release-check` overlap | Decided with reasoning; a caveat recorded if referenced, since that loop is scoped to this repo |
| `docs/registry.md` | Regenerated; Loops section gains a third row |
| `skills/agent-tiers/templates/bmad/bmad-workflow.md` | **Unchanged by this task**, beyond any pointer needed to resolve the ownership question |
| Roles | **Not authored or reconciled.** TASK-0045 |

**Next task starts here**: the production sequence is a gated component with
a stated autonomy boundary, so TASK-0045 can reconcile the three existing
roles against a loop that names what each must do, and TASK-0046 has both
loops available.

Deviation to watch for: if TASK-0035's drift resolution changed
`bmad-workflow.md`'s sequence or its bounds, this loop's translation follows
the **landed** file and the divergence from this brief must be recorded —
TASK-0045 is scoped against the roles that sequence implies. If the
ownership question resolves toward the loop being authoritative,
`skills/agent-tiers/` needs a pointer added, which is a change to a skill
this repo now owns and should be recorded as such rather than done silently.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-15
- Updated: 2026-09-15

## Execution log
### Attempt 1
- Date: 2026-09-15
- Agent: opencode (claude-opus-5)

#### Two of this brief's stated dependencies no longer exist as written

The brief says *"This task's real remaining dependency is TASK-0035 — read
`bmad-workflow.md` at its path in this repo **after** the import."*

**There was no import.** ADR-0017 was rejected and TASK-0035 cancelled
(2026-09-15): `agent-tiers` stays with `opencode-customization`. So
`bmad-workflow.md` was read **in place** at
`~/AI_Workspaces/opencode-customization/opencode/skills/agent-tiers/templates/bmad/bmad-workflow.md`.

**No drift-resolution content change to follow**, because there was no
resolution to apply — the file is the same 53 lines, and every line
reference in this brief (`:8-38` sequence, `:22-26` fix bound, `:32-34`
review distinction, `:40-46` artifact contract) is **accurate against the
landed file**. The brief's "deviation to watch for" therefore does not fire.

Reading another repo's file as evidence is not a claim on it — S6's standing
practice with `SIGMA-infrastructure`, and TASK-0034 verified this specific
file readable in place before the dependency was dropped.

#### The one substantive addition beyond translation: a `document` step

`bmad-workflow.md`'s sequence has **seven numbered items and no
documentation step**. ADR-0019 clause 2.1's autonomous list is *"implement,
test, fix-loop, review and **document**"*.

So the ADR requires a step the inherited sequence does not contain. Added as
**step 6 (`build`)**, and **labelled in the loop itself** as the one addition
rather than left to look like part of the original — otherwise a reader
comparing the two files finds an unexplained discrepancy and cannot tell
which is stale.

#### The two-owners question, answered rather than left silent

The brief required this and warned *"silence is the bad outcome."*

**This loop is authoritative for the sequence** as a component of this repo:
it is the gated artifact, its exit conditions are enforced by
`validate.sh`, and it is what `loops/design-brief/` hands off to.
`bmad-workflow.md` remains that skill's own context document, wired into two
agents via `instructions`.

**Neither of the brief's two suggested answers was available.** It offered
*"the loop is authoritative and the skill's copy points at it"* or *"the
skill's is authoritative and the loop is a thin wrapper"* — both assume this
repo can edit the skill. **It cannot**: the skill lives in another repo whose
owner decided to keep it (ADR-0017), and adding a pointer there would be a
cross-repo write this repo has no standing to make.

So the recorded answer is the third one: **two separate artifacts with one
shared ancestor, neither updating the other, and the divergence risk accepted
knowingly.** The loop states that explicitly, including that if they diverge,
**this loop governs work in this repo** and the divergence is a finding to
record rather than silently reconcile. That is weaker than one owner, and
saying so is better than implying a synchronisation that cannot happen.

#### The `release-check` tail overlap: referenced, with the caveat stated

**Decision: reference it, do not restate it** — consistent with the
link-don't-restate rule, and `release-check` genuinely does more at the tail
(secret scan, registry regeneration, effect verification, and the
prove-new-checks-bite step).

**The caveat the brief demanded**, written into step 7: `release-check` is
explicitly scoped to *this* repo and invokes `tests/validate.sh` and
`scripts/sync-registry.sh` **by name**. In another project it is the
*pattern*, not the procedure. Step 7 therefore stands alone as written, with
`release-check` preferred *in this repo specifically*.

#### Step 8 read-back as an executor — the constraint that had to be checked

Walked every step against the roles' actual capabilities:

| Step | Role | Needs | Available? |
|---|---|---|---|
| 1 plan | `plan` (built-in) | write a story artifact | yes |
| 2 implement | `build` (built-in) | full edit | yes |
| 3 test | `qa-test` | edit **test paths only** | yes — `test-files-only` |
| 4 fix | `build` | edit app code | yes |
| 5 review | `review` | read + report, no edit | yes — `read-only` |
| 6 document | `build` | edit docs | yes |
| 7 commit | `git-ops` | git, no push | yes — `bash-allowlist` |

**The constraint that mattered: `subagent_depth: 1`.** A subagent cannot
invoke another agent. Every subagent step (3, 5, 7) is invoked **by `build`,
a primary** — never subagent-to-subagent. Verified against `agent-tiers`'
bmad fragment, whose `build` allowlist contains exactly `qa-test`, `review`,
`git-ops` (plus `shell-runner` and the read-only researchers). **The sequence
is executable under the depth limit**; a version where `qa-test` invoked
`build` to fix things would not be, and that is the natural way to write it
wrong.

`plan` and `build` are **built-in primaries configured by override, never
markdown role files** — stated in the loop, because creating `agents/plan/`
would replace OpenCode's tuned built-in prompt wholesale.

#### The gate proven to cover this file
Not assumed from a green run: `## Exit conditions` was renamed and
`validate.sh` returned **`MISSING SECTION '## Exit conditions'`, exit 1**.
Restored, hash-verified identical, green again.

- Actions:
  1. Re-read ADR-0019 clause 2's five sub-clauses (accepted, so a read for
     content); confirmed clause 2.5's ambiguity distinction verbatim.
  2. Read `bmad-workflow.md` in place — 53 lines, all brief line references
     accurate.
  3. Read `release-check/loop.md` (96 lines) for style; decided the overlap.
  4. Authored the loop: 8 steps, each with role and expected output.
  5. Wrote the exit conditions with **the two bounds deliberately
     separated**, naming both failure modes of merging them.
  6. Wrote the merge-gate statement and the ambiguity-stop.
  7. Added the precedence line (`AGENTS.md` wins, then the ADR).
  8. Read the loop back as an executor against the depth limit and each
     role's capability.
  9. Answered the two-owners question in the loop's own text.
  10. Validated; regenerated the registry; proved the gate bites.

- Observations:
  - **A third bound was needed that no source states.** A `review` block
    correctly does not consume the fix-cycle budget — but left purely at
    that, the review path is **unbounded**: block → fix → block → forever.
    `bmad-workflow.md` does not address it and neither does ADR-0019. Added:
    if the **same finding** survives three review rounds, stop and escalate,
    because that is a disagreement between `review` and `build` about what
    the story requires and it is the human's to settle. **Keeping the two
    bounds distinct is not sufficient on its own** — the brief's risk
    section anticipated conflation, not the gap conflation was hiding.
  - **The ambiguity condition is written with an explicit test**, because
    clause 2.5 is the easiest thing here to read as "never stops": *"The test
    is not 'is this hard?' but 'does the brief answer it?'"* A reader taking
    the simpler reading gets a loop that confidently builds the wrong thing.
  - **Success is stated as the intended terminus, not an early exit.** The
    loop ends with work committed, unmerged and unpushed. Worth stating
    positively — a reader who sees "stop" in a success condition may read it
    as an abort.
  - **No permission boundary is restated** — verified by grep: zero
    occurrences of `permission:`, `disallowedTools`, `deny`, `allow:`. Seven
    links to ADR-0019, four to `AGENTS.md`, one each to the three role
    directories.
  - **Steps 1 and 2 both trace to the brief.** Added a line that a plan
    introducing a requirement the brief lacks is out of scope rather than an
    improvement — the scope-creep path an autonomous stage makes cheap.

- Validation:
  - `bash tests/validate.sh` → **PASS** (`validate.sh: OK`, exit 0). Also
    **observed failing** (exit 1, `MISSING SECTION '## Exit conditions'`) on a
    deliberately renamed section, proving the gate covers this file.
  - `bash scripts/sync-registry.sh` → Loops section now **three rows**:
    `design-brief`, `project-build`, `release-check`.
  - Frontmatter checked: `name: project-build` equals the directory,
    `description` single-line, all three mandatory sections present.
  - 218 lines. No size budget exists for loops and none was invented
    (ADR-0008).

- Result: **done.** All twelve acceptance criteria met. The production
  sequence is a gated component with an explicit autonomy boundary.

  Three things the brief did not forecast, all recorded above: the
  `bmad-workflow.md` **import never happened** so the file was read in place;
  ADR-0019 requires a **`document` step the inherited sequence lacks**, added
  and labelled as the one addition; and the review path needed a **third
  bound** that no source supplies, because separating the two known bounds
  left it unbounded.

  **Not authored here:** the three roles the loop names. `qa-test`, `review`
  and `git-ops` are TASK-0045's, and **until they exist neither loop can
  execute** — `loops/design-brief/` step 7 also delegates to `git-ops`.
- Commit: recorded below
- Push: recorded below
