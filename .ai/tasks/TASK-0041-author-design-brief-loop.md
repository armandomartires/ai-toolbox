# TASK-0041 — Author the design-brief loop

## Objective
Author `loops/design-brief/loop.md`: the clarify → ideate → critique →
converge cycle that turns a project idea into an accepted, locked brief,
with a bounded iteration count and an acceptance gate as its exit
conditions.

This is the sprint's genuine new capability. Everything before it is
cleanup, plumbing, or reclamation.

## Minimal context

### What does not exist today
`agent-tiers`' `plan` writes a story or spec artifact directly:
`bmad-workflow.md:14-16` — *"`plan` breaks the work into a story/spec
artifact under `docs/stories/` … No code is written in this phase."*

One pass, one artifact. Nothing generates alternatives, nothing critiques
them, and — the part that matters most — **nothing defines when the design
is finished**. That is B-017, and it is the only one of S7's four backlog
items that is a capability gap rather than a defect, a drift, or an orphan.

### Why the exit conditions are the whole task
`docs/development/authoring-guide.md`'s Loops section states it: exit
conditions **are the point**, because *"A loop without them is an unbounded
instruction — the shape that has an agent retrying a failing action
forever."* `validate.sh:193-213` enforces the section's presence.

An "iterate until we're happy" loop is precisely that unbounded shape. Left
unstated, it resolves one of two ways and both are bad: it runs forever, or
it stops when the model judges the design good enough. **The second is worse
than the first, because it looks like success.**

ADR-0019 clause 1 settles this: the terminating condition is the **human
accepting a named artifact**, there is a hard iteration cap, reaching the cap
escalates and stops, and *a critique round that finds nothing is not
evidence of convergence.*

### Where the iteration cap's value is decided
Here, not in the ADR. ADR-0019 clause 1 deliberately defers it: *"The cap's
value is set in TASK-0041 against the `release-check` precedent (3) and
stated in the loop file, not here, so the number has one owner."*

`loops/release-check/loop.md` bounds validation retries at 3 and uses
escalate-without-retry for destructive actions. `bmad-workflow.md:22-26`
bounds its fix loop at 3 and, notably, *"If failures persist after the 3rd
attempt, `build` stops and reports the unresolved failures back to whoever
is driving the session rather than continuing to loop."* Two independent
precedents at 3.

### Loops state sequence and link, they do not restate
The authoring guide's rule, and `release-check`'s practice: loops state
*sequence only*, **linking** to the rules they enforce, because *"a copied
rule creates a second owner that drifts."* `release-check` ends with *"If
this loop and `AGENTS.md` ever disagree, `AGENTS.md` wins."*

So this loop references ADR-0019 for the convergence criterion and
`skills/design-flow/` for the method — it does not restate either. That is
also why TASK-0042 comes *after* this task despite the skill settling
vocabulary: the loop names the steps, the skill supplies the how. Note this
is the inverse of S6's ordering (TASK-0029 skill → TASK-0030 loop), and the
reason is that here the *exit conditions* are the hard part and the method
follows from them.

### What "locked" means is an open question this task must answer
ADR-0019's consequences name the gap explicitly: *"A locked brief needs a
lock mechanism, and this ADR does not supply one. TASK-0041 and TASK-0042
must decide what 'locked' means concretely — a status field, a path
convention, a frontmatter key — and nothing here enforces it."*

So this task decides the mechanism and states it. It must not leave
"locked" as an adjective.

### The roles this loop delegates to do not exist yet
TASK-0043 authors `designer-manager`, `ideator`, `critic` and
`design-doc-writer`. This loop is authored **first**, so the roles are
shaped by the sequence rather than the sequence by the roles. The loop
therefore names roles by their function and must not assume a file path or a
client-native capability — those come from ADR-0018's contract.

One structural fact constrains the topology and is already established:
`designer-manager` must be a **primary** agent, because Claude Code strips
`AskUserQuestion` from every subagent and OpenCode's `subagent_depth: 1`
prevents a subagent from spawning workers. A loop step that has a subagent
ask the user is unimplementable.

### Not a third governance framework
ADR-0013 records two skills scaffolding two deliberately different
governance frameworks. This loop produces a **design brief**, not a
governance layer. It must not acquire a `.ai/`-shaped opinion, a task-ID
scheme, or a sprint concept.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/decisions/0019-design-convergence-and-the-autonomy-boundary.md` | TASK-0033 | **Accepted** by the human; clause 1 fixes the convergence criterion and defers the cap's value to this task |
| `loops/release-check/loop.md` | TASK-0008 | 96 lines; the shape precedent — numbered steps with expected outputs, retries bounded at 3, hard stops, escalate-without-retry, and the `AGENTS.md`-wins line |
| `loops/_template/loop.md` | pre-existing | 17 lines; `## Trigger`, `## Steps`, `## Exit conditions` |
| `docs/development/authoring-guide.md` | pre-existing | Loops section: the 5-element rule table, why exit conditions are the point, and the link-don't-restate rule |
| `skills/agent-tiers/templates/bmad/bmad-workflow.md` | TASK-0035 | In this repo after the import; `:14-16` is the one-pass plan step this loop replaces; `:22-26` the 3-iteration precedent |
| `tests/validate.sh` | pre-existing | `:193-213` enforces `name`↔directory, single-line `description`, and the three `## ` sections |
| `.ai/decisions/0013-two-governance-frameworks.md` | pre-existing | Accepted; the two-frameworks divergence this loop must not extend to a third |

**Verify the expected state; don't assume it.** Confirm ADR-0019 is
`Accepted` rather than `Proposed` — its clause 1 is this loop's entire exit
condition, and authoring against an unratified decision would put a
placeholder in a file the gate marks green, which is the "check that cannot
fail" shape in a different costume.

## Scope

### Included
- `loops/design-brief/loop.md` with frontmatter (`name` equal to the
  directory, single-line `description`) and the three mandatory sections.
- `## Trigger` — when this loop starts, and what it requires to exist first.
- `## Steps` — numbered, each with an **expected output**, matching
  `release-check`'s style: clarify → ideate → critique → converge, naming
  which role performs each and which are parallelisable.
- `## Exit conditions` covering, at minimum: success (human acceptance of
  the named artifact); the **iteration cap reached without acceptance** →
  escalate and stop; the human rejecting the brief outright; a step failing
  for a mechanical reason; and an explicit statement that **an empty
  critique round is not convergence**.
- The iteration cap's **value**, stated in this file, with its reasoning
  against the two precedents at 3.
- The concrete **lock mechanism** for an accepted brief.
- A line stating which document wins on disagreement, matching
  `release-check`'s precedent.

### Not included
- **Authoring the roles.** TASK-0043.
- **Authoring the skill.** TASK-0042 supplies the method — how to ideate,
  what a critique covers, the brief's structure.
- **The production loop.** TASK-0044.
- **Running the loop.** TASK-0046 is the pilot.
- **Restating ADR-0019's reasoning or the skill's method.** Link to both.
- Any governance opinion: no task IDs, no sprints, no `.ai/` shape.
- Any client-specific capability syntax. ADR-0018's contract owns that.

## Likely files
- `loops/design-brief/loop.md`
- `docs/registry.md` — regenerated (a new loop appears)
- `.ai/tasks/TASK-0041-author-design-brief-loop.md` — this file

## Execution plan
1. Confirm ADR-0019 is `Accepted`. **Stop and escalate if not.**
2. Re-read `release-check/loop.md` in full for step-and-expected-output
   style, and the authoring guide's Loops rule table.
3. Draft `## Steps`. For each step: which role, what it consumes, what it
   produces, and whether it can run in parallel with siblings.
4. Decide the iteration cap. Record the reasoning against `release-check`'s
   3 and `bmad-workflow.md`'s 3 — including whether a critique round and an
   ideation round count as one iteration or two, since that is ambiguous
   and someone will read it the other way.
5. Decide the lock mechanism concretely. Prefer the cheapest thing that
   cannot be done by accident.
6. Write `## Exit conditions`, ensuring every failure path has either a
   bound or an escalation, and that the empty-critique case is explicit.
7. Add the disagreement-precedence line.
8. **Read the loop back as an executor**: walk each step and ask what an
   agent would actually do, and whether any step requires a capability a
   subagent does not have (asking the user, spawning a worker). Any such
   step is a defect found on paper rather than in the pilot.
9. `bash tests/validate.sh` — expect the three-section and frontmatter
   checks to pass.
10. `bash scripts/sync-registry.sh`; confirm the Loops section gains a row.
11. Review the diff; commit; record the hash; push; confirm; record.

## Acceptance criteria
- [ ] `loops/design-brief/loop.md` carries `## Trigger`, `## Steps`,
      `## Exit conditions`, with `name` equal to the directory and a
      single-line `description`
- [ ] Every step states its **expected output**, matching `release-check`
- [ ] The iteration cap has a **stated value and reasoning**, and it is
      unambiguous what counts as one iteration
- [ ] Reaching the cap without acceptance **escalates and stops** — it does
      not loop again with a longer prompt
- [ ] The exit conditions state explicitly that **an empty critique round is
      not convergence**
- [ ] Every failure path has a bound or an escalation; none is open-ended
- [ ] The **lock mechanism is concrete** — a named field, path, or
      convention, not the adjective "locked"
- [ ] The loop **links** to ADR-0019 and `skills/design-flow/` rather than
      restating them
- [ ] A disagreement-precedence line is present
- [ ] No step requires a subagent to ask the user or to spawn a worker —
      verified by the step-by-step read-back
- [ ] No governance opinion: no task IDs, sprints, or `.ai/` structure
- [ ] `tests/validate.sh` green; registry regenerated and committed

## Risks and rollback
- **Risk: a placeholder exit condition that passes the gate.** The check
  verifies the section is **present and non-empty**, not that its contents
  bound anything. A section reading "until the design is good" would pass.
  This is the "check that cannot fail" shape applied to content rather than
  code, and it is why ADR-0019 was written before this task rather than
  alongside it.
- **Risk: the cap's unit is ambiguous.** If one "iteration" could mean an
  ideation round, a critique round, or a full cycle, two readers get two
  different caps and one of them thinks the loop is broken. Step 4.
- **Risk: restating the skill's method in the loop.** The link-don't-restate
  rule exists because a copied rule creates a second owner that drifts. The
  temptation is strong here because the loop reads better with the method
  inline.
- **Risk: a step no agent can perform.** The subagent constraints
  (`AskUserQuestion` stripped; `subagent_depth: 1`) are structural. A step
  like "the critic asks the user which option they prefer" is
  unimplementable, and finding that in the pilot costs a sprint. Step 8 is
  the control.
- **Risk: designing the roles implicitly.** Authoring the loop first is
  deliberate, but it means every step's phrasing constrains TASK-0043. Name
  roles by function and resist specifying their capabilities here — that is
  ADR-0018's contract's job.
- **Risk: a third governance framework.** ADR-0013's warning. A design brief
  with a status field and an ID scheme starts to look like a task brief, and
  then someone asks why it does not have sprints.
- **Rollback:** one new directory plus a regenerated registry. `git revert`
  removes both. Nothing depends on this loop until TASK-0043 and TASK-0046.

## Outputs / handover

**Intended end state — this task has not run.** The table below is a plan.
`validate.sh` requires this section non-empty for briefs ≥ 0020 and cannot
distinguish an intention from a state (ADR-0012 Decision 3), so this
sentence does it.

| Artifact | Intended end state |
|----------|-------------------|
| `loops/design-brief/loop.md` | The clarify→ideate→critique→converge sequence; every step with an expected output; a stated iteration cap with reasoning; acceptance as the terminating condition; every failure path bounded or escalating; the empty-critique case explicit |
| The lock mechanism | **Decided and named** — the gap ADR-0019 deliberately left open is closed here, concretely |
| `docs/registry.md` | Regenerated; Loops section gains a second row |
| Roles | **Not authored.** Named by function only, so TASK-0043 is shaped by the sequence rather than the reverse |
| `skills/design-flow/` | **Not authored.** Referenced as the method's owner; TASK-0042 supplies it |

**Next task starts here**: the design sequence and its convergence criterion
are fixed and gated, so TASK-0042 can write the method the loop references
and TASK-0043 can author roles against a known step list.

Deviation to watch for: if the step-by-step read-back (step 8) finds a step
that no agent can perform, the sequence changes and **TASK-0043's role set
may change with it** — a four-role split is a forecast, not a requirement.
Record any such change here, since TASK-0042 and TASK-0043 are scoped
against the sequence as written.

## Status
- Status: planned
- Owner: agent
- Created: 2026-09-15
- Updated: 2026-09-15

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
