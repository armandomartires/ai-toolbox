# TASK-0046 — Pilot: run both loops end to end to produce ansible-ops and ansible-change

## Objective
Run the design loop and then the production loop, for real, to produce S6's
two planned components: `skills/ansible-ops/` and `loops/ansible-change/`.

**This is the task that decides whether S7 delivered anything.** Everything
before it is scaffolding until a loop is executed.

## Minimal context

### Why the pilot is not optional and not a throwaway
`PLAN-0004`'s stated risk, and S7's known limitation recorded at plan time:
this sprint adds two loops, one skill, a component category and six or seven
roles. **If the pilot does not run, all of it is scaffolding** — and the
sprint would have diagnosed that exact pattern in `agent-tiers` (owned,
drifted, never switched on) while reproducing it.

This would be the **third** instance. `mcp-servers/_template/` established
the pattern and ADR-0010 recorded it; `CURRENT_STATE.md` uses it as the
repo's reference case for *plausible, unexercised scaffolding*; `agent-tiers`
is the second.

Hence the human's decision of 2026-09-15: the pilot produces **real,
already-scoped components** rather than a throwaway. It delivers S6's
TASK-0029 and TASK-0030 as a by-product of proving the loops work.

### What is being produced, and why it was already scoped
From S6's `PLAN-0003`, which read a real Ansible repository as evidence:

- `skills/ansible-ops/` — the instruct layer the pinned `ansible` MCP
  server has lacked since S1. ADR-0015 (proposed) names its shape: a
  portable invariant core plus per-project templates.
- `loops/ansible-change/` — the real gate sequence with exit conditions.

Two corrections from that plan bind this pilot and must not be re-derived:

- **There is no staging inventory in the target estate and there cannot
  be.** One inventory file, one 6-node PVE cluster at 3-of-4 quorum, one DC
  holding all seven FSMO roles. The real graduated workflow is
  `--check --diff` **plus snapshot and rollback**. Building from the
  original source analysis would have produced a runbook gating on an
  inventory that does not exist.
- **`ansible_navigator` cannot express the safe workflow** — no inventory,
  limit, `--check` or `--diff` parameter — while it *can* execute against
  production.

### The constraint that survives S6 being parked
`SIGMA-infrastructure` is **read as evidence and never modified**, and its
unpushed commits are left untouched. S6's decision 3 (Option a), and S7's
standing constraints restate that parking S6 does **not** relax it.

Verify with `git status` there before and after. No playbook is run, in any
mode, including `--check`.

### The dependencies this pilot inherits, and the honest gap
`ADR-0014` and `ADR-0015` are **proposed** and both depend on S6's
`TASK-0027` — a lint spike that has not run. So the pilot produces
`ansible-ops` while the ADR meant to settle its shape is unratified, and
without the observed lint result that ADR was to be written against.

**This is a real gap and must not be glossed.** Two defensible options, to be
decided at execution time with the human:

1. Run S6's `TASK-0027` first as a prerequisite, accepting that the pilot
   then spans two sprints' artifacts.
2. Produce `ansible-ops` from `PLAN-0003`'s already-recorded evidence (F1–F7
   were read from real files) and mark the ADRs as still owing ratification.

Option 2 is cheaper and option 1 is more honest. Either way, **what the
pilot is allowed to claim about `ansible-ops` depends on which was
chosen**, and that must be recorded.

Note also that S6's highest-value item, `TASK-0031` (the `gather_subset`
guard), is **not** delivered by this pilot. B-011 remains open.

### What the pilot is actually measuring
Not "did two components get produced" — that could be done by hand in an
afternoon. The questions are:

- **Where did each loop's exit conditions actually fire?** A loop whose exit
  conditions never engage has not been tested, only walked.
- **Did the design loop converge, hit its cap, or get accepted trivially?**
  A brief accepted on the first pass means the ideate and critique steps
  did no work, which is a finding about the method, not a success.
- **Did the critique step find anything?** ADR-0019 clause 1.3: *a critique
  round that finds nothing is not evidence of convergence.* An empty
  critique here is the method's central failure mode made visible.
- **Did any role's emitted permissions block something they should have?**
  A boundary that never binds is untested.
- **Was the handover contract sufficient across a real session gap?**
  REVIEW-0007's finding 8 — S5's central claim is **still untested**, since
  all four of its tasks ran in one session. This pilot is a genuine
  opportunity to test it, and S5's follow-up 1 asks the next task after a
  real gap to record whether its `Inputs` table sufficed.

### The failure mode that would look like success
Producing both components while **bypassing the loops** — an agent doing the
work directly and writing the artifacts, because that is faster and the
output is the same. The output would be indistinguishable. Only the
execution log distinguishes them, which is why the log's content is the
deliverable and the components are the by-product.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `loops/design-brief/loop.md` | TASK-0041 | `done`; step list, iteration cap with its unit, acceptance condition, lock mechanism |
| `skills/design-flow/` | TASK-0042 | `done`; method per step, critique obligations, distinctness requirement |
| `loops/project-build/loop.md` | TASK-0044 | `done`; both bounds distinct, merge gate explicit, ambiguity-stop condition |
| `agents/` | TASK-0043, TASK-0045 | `done`; design and production roles authored, emitted, boundaries proven per client |
| `.ai/planning/plans/PLAN-0003-ansible-agent-guardrails.md` | S6 | 352 lines; F1–F7, the evidence `ansible-ops` is built from |
| `.ai/tasks/TASK-0029-author-ansible-ops-skill.md`, `TASK-0030-*.md` | S6 | `planned`; the original scoping this pilot delivers against |
| `.ai/decisions/0014-*.md`, `0015-*.md` | S6 | **Proposed**, bodies largely unwritten, both dependent on S6's TASK-0027 — the inherited gap |
| `/home/armando.martires/SIGMA-infrastructure` | pre-existing | **Read-only.** Record `git status` before and after; unpushed commits untouched |
| `mcp-servers/ansible/server.json` | pre-existing | The pinned manifest. Note S6's TASK-0026 (blast-radius correction, `navigator` disablement) has **not** run |
| `loops/release-check/loop.md` | TASK-0008 | The loop-shape precedent `ansible-change` must match |

**Verify the expected state; don't assume it.** Confirm every Phase 3 and
Phase 4 artifact is `done` — a pilot run against a half-built loop measures
nothing. And **read this brief's own `Inputs` table critically when starting
cold**: if it proves insufficient, record that, because S5's central claim
is still untested and this is the test.

## Scope

### Included
- Decide, with the human, which option resolves the ADR-0014/0015 gap; record
  it.
- **Run `loops/design-brief/`** to converge a brief for `ansible-ops`,
  following its steps and using its roles. Record each iteration.
- **Run `loops/project-build/`** against the locked brief to produce
  `skills/ansible-ops/` and `loops/ansible-change/`.
- Record, per loop: which exit condition fired, how many iterations ran,
  what the critique found, whether any role's boundary blocked anything.
- Record whether this brief's `Inputs` table sufficed for a cold start
  (S5 follow-up 1).
- Decide and record the disposition of S6's TASK-0029 and TASK-0030 —
  closed as delivered-by-S7, rewritten, or left parked. S6's archived
  sprint file explicitly defers this decision here.
- Verify `SIGMA-infrastructure` unmodified.

### Not included
- **Modifying `SIGMA-infrastructure` in any way.** Not even a cache file.
- **Running any playbook, in any mode, including `--check`.** Nothing may
  touch the live estate.
- **S6's TASK-0031** (the `gather_subset` guard). B-011 stays open; this
  pilot does not deliver the highest-value item of either sprint.
- **S6's TASK-0026** (blast-radius correction, `navigator` disablement).
  Still unrun; `ansible-ops` is authored knowing the wiring is uncorrected.
- **Merging or pushing without the human.** ADR-0019 clause 2 — the loop
  stops at the gate, and this pilot must demonstrate that it does.
- **Doing the work directly and writing the artifacts.** The named failure
  mode; see the risks.
- Applying any topology to a live `opencode.jsonc`.

## Likely files
- `skills/ansible-ops/` — produced by the pilot
- `loops/ansible-change/loop.md` — produced by the pilot
- The design brief artifact, at whatever path TASK-0041's lock mechanism
  specifies
- `docs/registry.md` — regenerated
- `.ai/tasks/TASK-0046-pilot-run-both-loops.md` — this file's execution log
  **is the primary deliverable**
- `.ai/tasks/TASK-0029-*.md`, `TASK-0030-*.md` — status updated per the
  disposition decision
- Possibly a separate findings file if the log outgrows the brief

## Execution plan
1. Confirm all Phase 3/4 artifacts are `done`. **Stop if any is not.**
2. `git status --short` in `SIGMA-infrastructure`; record verbatim.
3. Resolve the ADR-0014/0015 gap with the human; record the choice and what
   it permits the pilot to claim.
4. **Run the design loop.** For each iteration record: alternatives
   generated and how they differed, what the critique found, whether
   convergence was reached and how. Do not skip steps because the outcome
   seems obvious.
5. Obtain explicit human acceptance of the brief; apply the lock mechanism.
6. **Run the production loop** against the locked brief. Record each step's
   output, any fix-loop iterations, and any review block.
7. Stop at the merge gate. **Record that the loop stopped there rather than
   pushing** — that is ADR-0019 clause 2 demonstrated, not asserted.
8. `bash tests/validate.sh`; `bash scripts/sync-registry.sh`.
9. `git status --short` in `SIGMA-infrastructure`; confirm byte-identical to
   step 2.
10. Write the findings: per-loop exit conditions fired, critique yield,
    boundary engagements, cold-start sufficiency.
11. Decide the TASK-0029/0030 disposition; update those briefs.
12. Review the diff; commit; record the hash; obtain the human's
    authorization to push; push; confirm; record.

## Acceptance criteria
- [ ] **Both loops were executed**, not simulated — the execution log shows
      per-iteration detail, not a summary of outputs
- [ ] `skills/ansible-ops/` exists and passes every ADR-0003 frontmatter
      rule; **no size budget invented** (ADR-0008)
- [ ] `loops/ansible-change/loop.md` carries the three sections with bounded
      retries and escalate-without-retry for destructive actions
- [ ] **Which exit condition fired is recorded for each loop**, with the
      iteration count
- [ ] **What the critique step found is recorded.** If it found nothing,
      that is reported as a finding about the method (ADR-0019 clause 1.3),
      not as a clean pass
- [ ] Whether the design loop converged, hit its cap, or was accepted
      trivially is stated plainly
- [ ] The production loop **stopped at the merge gate**, demonstrated
- [ ] Whether any role's emitted boundary blocked anything is recorded; a
      boundary that never bound is noted as untested
- [ ] Cold-start sufficiency of this brief's `Inputs` recorded (S5
      follow-up 1)
- [ ] The ADR-0014/0015 gap resolution recorded, with what it permits the
      pilot to claim about `ansible-ops`
- [ ] S6's TASK-0029/0030 disposition **decided and recorded**
- [ ] `SIGMA-infrastructure` byte-identical before and after; unpushed
      commits untouched
- [ ] No playbook run in any mode
- [ ] `tests/validate.sh` green; registry regenerated and committed

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — **required**; this
      task adds a skill and a loop

## Risks and rollback
- **Risk: producing the components without running the loops.** The named
  failure mode, and the most likely one, because it is faster and the output
  is identical. Only the execution log distinguishes a run from a
  reconstruction — which is why the log is the deliverable and the
  components are the by-product. An agent that finds itself writing
  `ansible-ops` directly has failed this task while appearing to complete it.
- **Risk: a trivially accepted brief read as success.** If the human accepts
  the first draft, the ideate and critique steps did no work and the loop is
  **walked, not tested**. That is a finding about the method. The same
  applies to an empty critique — lesson 1's shape, in content form.
- **Risk: exit conditions that never fire.** If no loop ever hits a cap, a
  block, or an escalation, the sprint has evidence the happy path works and
  none that the bounds do. Worth stating explicitly rather than reading
  green as complete.
- **Risk: authoring against unratified ADRs.** ADR-0014 and ADR-0015 are
  proposed and depend on a spike that has not run. Whatever option is
  chosen, `ansible-ops` must not claim to implement a decision that does not
  exist yet.
- **Risk: touching the target repo.** `ansible-lint` can write
  `.ansible-lint-ignore` with `--generate-ignore` and caches elsewhere.
  Never pass that flag; work only on copies under `/tmp/opencode/` if
  anything must be run; verify with `git status` afterwards.
- **Risk: running a playbook.** The estate is a 6-node cluster at 3-of-4
  quorum with no verified margin and a single DC holding all seven FSMO
  roles. Even `--check` loads inventory and connects. Out of scope entirely.
- **Risk: pushing without authorization.** ADR-0019 clause 2 is the thing
  this pilot exists partly to demonstrate. Pushing autonomously here would
  falsify the sprint's own boundary claim in the very task meant to prove it.
- **Risk: the pilot reveals a defect in a Phase 2/3/4 artifact.** Likely, and
  a **successful** outcome — it is what a pilot is for. Record and attribute
  it to the owning task rather than patching it here, or the owning task's
  proofs keep claiming success.
- **Rollback:** repo changes revert in one commit. Emitted agent files are
  outside the repo. `SIGMA-infrastructure` is untouched throughout and needs
  no rollback — verified twice.

## Outputs / handover

**Intended end state — this task has not run.** The table below is a plan.
`validate.sh` requires this section non-empty for briefs ≥ 0020 and cannot
distinguish an intention from a state (ADR-0012 Decision 3), so this
sentence does it. The irony is load-bearing: **this brief describes running
a loop that produces artifacts, and cannot itself claim they exist.**

| Artifact | Intended end state |
|----------|-------------------|
| This brief's execution log | **The primary deliverable.** Per-iteration detail for both loops; which exit conditions fired; critique yield; boundary engagements; cold-start sufficiency; the ADR-gap resolution |
| `skills/ansible-ops/` | Produced **through** the design and build loops; ADR-0003 conformant; delivers S6's TASK-0029 |
| `loops/ansible-change/loop.md` | Produced through the loops; three sections, bounded retries; delivers S6's TASK-0030 |
| The design brief | Converged and **locked** per TASK-0041's mechanism, accepted explicitly by the human |
| S6's TASK-0029/0030 | Disposition decided and recorded — closed as delivered-by-S7, rewritten, or left parked |
| `SIGMA-infrastructure` | **Byte-identical**, proven by `git status` twice; unpushed commits untouched |
| B-011 / S6's TASK-0031 | **Still open.** The highest-value item of either sprint is not delivered here |
| Phase 2/3/4 artifacts | **Exercised.** Whether they survived contact is the finding REVIEW-0008 opens with |

**Next task starts here**: REVIEW-0008 can answer S7's pre-committed
headline question — *did anything get exercised?* — from recorded evidence
rather than from the existence of files. Whatever the pilot broke is
attributed to its owning task and is the sprint's real output.

Deviation to watch for: if the loops proved unrunnable as written, **that is
the sprint's most valuable finding** and must be recorded as such rather
than worked around by producing the components by hand. A loop that cannot
be executed is not a loop; discovering that here is exactly what this task
is for, and reporting it honestly is worth more than two components that
were going to be written anyway.

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
