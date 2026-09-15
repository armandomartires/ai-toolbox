# TASK-0042 — Author the design-flow skill

## Objective
Author `skills/design-flow/`: the method the design-brief loop references —
how to clarify a brief, how to generate genuinely distinct alternatives, what
a critique must cover, and what an accepted brief contains — as a portable
core plus per-project templates.

The loop owns the *sequence*. This skill owns the *how*.

## Minimal context

### Why the skill comes after the loop
The inverse of S6's ordering (TASK-0029 skill → TASK-0030 loop, where *"the
skill settles the vocabulary the loop references"*). Here the hard part was
the **exit conditions** — what "converged" means — so ADR-0019 and
TASK-0041 fixed that first, and the method follows from the sequence rather
than the sequence from the method.

Recorded because the reversal is deliberate and a reader comparing the two
sprints will otherwise read it as inconsistency.

### The shape: portable core plus per-project templates
`skills/project-workflow/` is the exemplar, and ADR-0015 (proposed, S6)
names the same pattern for `ansible-ops`: a portable invariant core in
`SKILL.md` with per-project facts in `templates/`. `project-workflow` pushes
detail into `templates/reference/` — seven load-on-demand documents — keeping
`SKILL.md` terse at 53 lines.

That structure exists for a reason lesson 6 records: `00.CONVENTIONS.md` sat
3087 bytes over its own declared ~3 KB budget because *"a budget nobody
measures is not a budget."* Progressive disclosure is how an always-loaded
file stays small.

### No invented budget
ADR-0008, and `authoring-guide.md:17-21`: **no `SKILL.md` size budget
exists** and inventing one is forbidden. To add one you define it in the
guide first, in bytes, with a rationale.

Note the tension worth naming: this task should keep `SKILL.md` small for the
same reasons `project-workflow` does, while being forbidden from declaring a
number. Terse by construction, not by a cap. If a budget is genuinely
wanted, that is its own task.

### The copy-never-symlink rule for scaffolded templates
`project-workflow`'s own rule, recorded in ADR-0004's consequences: a lesson
learned scaffolding a real project propagates *into the skill's templates*
— *"never retroactively into an already-scaffolded project."* A project gets
a **copy** of a template so its local edits survive; the skill's copy is the
one that improves.

Whatever `design-flow/templates/` contains inherits that rule.

### Not a governance framework
ADR-0013 records two skills scaffolding two deliberately different
governance frameworks, and warns that a third must not appear. `design-flow`
is **operational**: it produces a design brief. It must not acquire a
task-ID scheme, a sprint concept, a `.ai/` layout opinion, or a
`00.CONVENTIONS.md`-shaped entry point.

The boundary is sharper than it looks. A design brief with a status field
and a lock marker (TASK-0041 decides the mechanism) starts to resemble a
task brief — and the next step someone takes is asking where its sprint is.
The skill must state what it is not.

### What a critique step actually needs to be useful
The one substantive method question. An adversarial review that returns
"looks good" every time is worse than no review, because it is recorded as a
pass — the same shape as lesson 1's unfailable check.

ADR-0019 clause 1 already encodes the structural half: *a critique round
that finds nothing is not evidence of convergence.* The skill supplies the
other half: what a critique is obliged to examine, so that an empty result
means "examined and found nothing" rather than "did not look".

### The anti-pattern to avoid in ideation
Generating three variants of one idea, presented as three alternatives. The
method needs a distinctness requirement, or the ideate step produces the
appearance of options without the substance — and the critique step then
compares near-identical candidates and reports no meaningful differences.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `loops/design-brief/loop.md` | TASK-0041 | `done`; the step sequence, the iteration cap with its unit, the acceptance condition, and the **decided lock mechanism** |
| `.ai/decisions/0019-design-convergence-and-the-autonomy-boundary.md` | TASK-0033 | Accepted; clause 1's convergence criterion, including the empty-critique rule |
| `skills/project-workflow/` | TASK-0021 | `3.2.0`; the portable-core-plus-templates exemplar, terse `SKILL.md` + `templates/reference/` |
| `skills/_template/` | pre-existing | `SKILL.md` + `assets/` + `references/` + `scripts/` — the shape to copy from |
| `docs/development/authoring-guide.md` | pre-existing | Skills rule table; `:17-21` the deliberate absence of a size budget; **no `README.md` inside a skill folder** |
| `tests/validate.sh` | pre-existing | ADR-0003's five frontmatter rules; `name`↔directory; single-line `description` |
| `.ai/decisions/0013-two-governance-frameworks.md` | pre-existing | Accepted; the two-frameworks divergence, and why a third must not appear |
| `.ai/decisions/0003-skill-frontmatter-schema.md` | pre-existing | Accepted; required `name`/`description`, optional `license`/`metadata`, semver |

**Verify the expected state; don't assume it.** Read TASK-0041's loop file
rather than this brief's description of it — in particular the **lock
mechanism it actually chose** and whether its step list still matches the
four-step clarify/ideate/critique/converge shape. TASK-0041's own handover
warns its step list may have changed during the read-back.

## Scope

### Included
- `skills/design-flow/SKILL.md` — terse, portable, with ADR-0003-conformant
  frontmatter and `name` equal to the directory.
- The method for each loop step:
  - **Clarify** — what to establish before ideating, and what makes a
    question worth asking the human versus assuming.
  - **Ideate** — how to produce genuinely distinct alternatives, with a
    stated **distinctness requirement**.
  - **Critique** — what a critique is *obliged* to examine, so an empty
    result is informative.
  - **Converge** — how a single design is selected from critiqued
    alternatives, and what the accepted brief must contain.
- `skills/design-flow/templates/` — the brief template, and whatever
  per-project artifacts the method needs, carrying the copy-never-symlink
  rule.
- Load-on-demand detail under `references/` rather than inline, following
  `project-workflow`'s progressive disclosure.
- An explicit statement of what this skill is **not**: not a governance
  framework, no task IDs, no sprints; and a pointer to `project-workflow`
  and `project-migration` for that layer, matching ADR-0013's resolution of
  naming siblings in each `SKILL.md`.
- The relationship to `loops/design-brief/` stated once, in the skill, as
  sequence-vs-method.

### Not included
- **Restating the loop's sequence or its exit conditions.** Link. The
  link-don't-restate rule; a copied rule creates a second owner that drifts.
- **Authoring the roles.** TASK-0043.
- **The production side.** TASK-0044, TASK-0045.
- **Running the method.** TASK-0046 is the pilot.
- **Inventing a size budget.** ADR-0008.
- **A `README.md` inside the skill folder.** Forbidden by the authoring
  guide.
- Any governance opinion, task-ID scheme, or `.ai/` layout.
- Any client-specific capability syntax.

## Likely files
- `skills/design-flow/SKILL.md`
- `skills/design-flow/templates/` — contents decided at execution time
  against the loop's actual step list, which is why they are not enumerated
  here
- `skills/design-flow/references/` — the load-on-demand tier
- `docs/registry.md` — regenerated
- `.ai/tasks/TASK-0042-author-design-flow-skill.md` — this file

## Execution plan
1. Read `loops/design-brief/loop.md` as landed — its real step list, cap
   unit, and lock mechanism. Note any divergence from this brief's
   assumptions.
2. Re-read `project-workflow/SKILL.md` and its `templates/reference/` for
   the progressive-disclosure pattern and the terse-core style.
3. Draft the four step methods. For **critique**, enumerate what it must
   examine; for **ideate**, state the distinctness requirement concretely
   enough to be checkable by a reader.
4. Decide what belongs in `SKILL.md` versus `references/`. Default to
   `references/` for anything a reader does not need on every invocation.
5. Write the brief template, including whatever the loop's lock mechanism
   requires (a field, a marker), and the copy-never-symlink note.
6. Write the "what this skill is not" section, naming the two governance
   skills.
7. **Read the method back against the loop**: for each loop step, confirm
   the skill answers "how" without restating "when" or "whether to
   continue". A method that re-decides the exit conditions is a second
   owner.
8. Confirm no `README.md` inside the skill folder.
9. `bash tests/validate.sh` — expect the five frontmatter rules to pass.
10. `bash scripts/sync-registry.sh`; confirm a fourth skill row appears
    (third if TASK-0035 has not landed).
11. Review the diff; commit; record the hash; push; confirm; record.

## Acceptance criteria
- [ ] `skills/design-flow/SKILL.md` passes every ADR-0003 frontmatter rule;
      `name` equals the directory; `description` single-line
- [ ] **No size budget invented**, and `SKILL.md` is terse by construction
      with detail in `references/`
- [ ] The **critique** step enumerates what it is obliged to examine, so an
      empty critique means "examined and found nothing"
- [ ] The **ideate** step states a concrete distinctness requirement, so
      three variants of one idea do not pass as three alternatives
- [ ] The **converge** step states what an accepted brief must contain, and
      supports the loop's lock mechanism
- [ ] The skill **links** to `loops/design-brief/` and ADR-0019 rather than
      restating the sequence or the exit conditions
- [ ] An explicit "what this is not" section: no governance framework, no
      task IDs, no sprints, with `project-workflow`/`project-migration`
      named as the layer that does that (ADR-0013's pattern)
- [ ] Templates carry the copy-never-symlink rule
- [ ] No `README.md` inside the skill folder
- [ ] The read-back (step 7) confirms no loop exit condition is re-decided
      in the skill
- [ ] `tests/validate.sh` green; registry regenerated and committed

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — **required**; this
      task adds a skill

## Risks and rollback
- **Risk: a critique step that always passes.** The method's central failure
  mode, and the same shape as lesson 1's unfailable check — an empty result
  recorded as a pass. Mitigated only by enumerating what must be examined,
  which is why that is an acceptance criterion rather than a nicety.
- **Risk: ideation producing variants rather than alternatives.** Three
  flavours of one approach look like three options and collapse the critique
  step into comparing near-identical candidates. The distinctness
  requirement has to be concrete enough that a reader can tell when it was
  not met.
- **Risk: restating the loop.** The skill reads better with the sequence
  inline, which is exactly why the link-don't-restate rule exists. Step 7
  is the control.
- **Risk: re-deciding convergence.** Subtler than restating it. A method
  that says "continue until the critique is satisfied" has quietly replaced
  ADR-0019's human-acceptance criterion with a model's judgement — the thing
  the ADR exists to prevent.
- **Risk: a third governance framework.** ADR-0013's warning. The brief
  needs a lock marker, which makes it look like a task brief, which invites
  a status enum, an ID scheme, and then a sprint. State what the skill is
  not, explicitly.
- **Risk: growing an always-loaded file.** Lesson 6: a budget nobody
  measures is not a budget, and `00.CONVENTIONS.md` went over its own
  undeclared-in-practice cap unnoticed. No budget may be invented here, so
  the only control is deliberate restraint plus the `references/` tier.
- **Risk: scoping against a stale loop.** TASK-0041's handover explicitly
  warns its step list may have changed during its read-back. Step 1 reads
  the file rather than trusting this brief.
- **Rollback:** one new skill directory plus a regenerated registry.
  `git revert` removes both. The deployed symlink would dangle until
  `install.sh` is re-run — same as for any skill.

## Outputs / handover

**Intended end state — this task has not run.** The table below is a plan.
`validate.sh` requires this section non-empty for briefs ≥ 0020 and cannot
distinguish an intention from a state (ADR-0012 Decision 3), so this
sentence does it.

| Artifact | Intended end state |
|----------|-------------------|
| `skills/design-flow/SKILL.md` | Terse portable core: the method for each of the loop's steps, with the critique's obligations and ideation's distinctness requirement both concrete |
| `skills/design-flow/templates/` | The brief template supporting the loop's lock mechanism, carrying the copy-never-symlink rule |
| `skills/design-flow/references/` | Load-on-demand detail, following `project-workflow`'s progressive disclosure |
| Governance boundary | Stated explicitly: not a framework, no task IDs, no sprints; the two governance skills named per ADR-0013's pattern |
| `docs/registry.md` | Regenerated; skills count incremented |
| Roles | **Not authored.** TASK-0043 |

**Next task starts here**: the design stage has both a gated sequence
(`loops/design-brief/`) and a documented method (`skills/design-flow/`), so
TASK-0043 can author the four roles against a fixed step list and a fixed
method, with nothing left to infer.

Deviation to watch for: if the loop's landed step list differs from
clarify/ideate/critique/converge, the method's sections change with it —
record the divergence, since TASK-0043 is scoped against **four** roles and
a different step count may mean a different role set. Also record if any
method detail turned out to belong in the loop instead: that is a
boundary-placement finding worth having, since the sequence-vs-method split
is the whole basis for having two artifacts.

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
