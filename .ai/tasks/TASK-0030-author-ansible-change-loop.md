# TASK-0030 — Author the `ansible-change` loop

## Objective
Ship `loops/ansible-change/loop.md`: the gated sequence for applying an
Ansible change to a live estate, with real exit conditions. The loop owns
the **sequence and its stopping rules**; the rules themselves live in
`skills/ansible-ops/` and are linked, never restated.

## Minimal context

### Why a loop and not more skill content
`loops/release-check/loop.md` already demonstrates the division that makes
this worth a separate component: it states at `:8-16` that it owns "the
**sequence and its exit conditions** only; the rules it enforces live
elsewhere and are linked, never restated", and closes with "If this loop
and `AGENTS.md` ever disagree, `AGENTS.md` wins."

That is the shape to copy. A skill answers "what are the rules"; a loop
answers "in what order, and when do I stop". Duplicating the rules into the
loop would create the drift that `release-check` explicitly avoids.

`loops/` also already has tooling — `validate.sh:193-213` requires
`## Trigger`, `## Steps`, `## Exit conditions`, and `sync-registry.sh`
emits a Loops section. So the runbook layer needs **no new component
category**, which is a large part of why ADR-0016 is expected to say no to
hooks.

### The sequence, and the two steps that are not obvious
```
lint → syntax-check → --check --diff → snapshot-possible? → snapshot
     → apply → verify independently → delete snapshot
```

Two steps carry the weight:

- **`snapshot-possible?` before `snapshot`.** From the target repo's
  `AGENTS.md` Change safety: "A snapshot is only a rollback path if the
  platform can actually take one. Never assume the safety net exists;
  verify it, then use it." A loop that snapshots without checking has a
  rollback step that may silently not exist.
- **`delete snapshot` after verification.** Same source: "This is the step
  most often skipped, and the one most likely to cause real cost later — a
  snapshot left in place grows as the guest diverges and is not a backup."
  A loop that ends at "apply and verify" leaves cost behind every run.

### Why there is no staging step
The source analysis's sequence had `-l staging` twice. The target estate
has one inventory and no staging (PLAN-0003 finding F1). The loop's preview
step is `--check --diff` **against production**, with the snapshot as the
actual safety net. This is the plan's central correction and the loop is
where it becomes operational.

### Why `--check` passing is not a step that can be trusted alone
`community.proxmox.proxmox_storage` 2.0.0 check-mode confirms a storage
*name* exists and never compares any declared field against live values —
so it reports "already present, zero changes" whether or not the
declaration is correct. The loop must therefore include an explicit stop
condition for **"check-mode is not meaningful for the modules in this
play"**, rather than treating a clean `--check` as a gate that was passed.
That is a genuine exit condition, not a caveat.

### Exit conditions must be real
`release-check` sets the standard: bounded retries (3 attempts, `:79-83`)
with the reasoning that "repeated identical failure means the diagnosis is
wrong, not that the fix needs another pass"; a hard stop on a secret; and
**escalate without retrying** for destructive actions, because `AGENTS.md`
requires human authorization first and "no number of retries substitutes
for it."

An Ansible change loop needs those plus at least: a stop when the snapshot
precondition fails, a stop when `--check` is not meaningful, and a stop
when verification disagrees with what Ansible reported. The last is the
`changed=1` problem as a stopping rule rather than as advice.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/ansible-ops/` | TASK-0029 | **done**; invariant core exists with stable names the loop can reference |
| `loops/release-check/loop.md` | TASK-0008 | 96 lines; the shape to follow — steps with expected outputs, bounded retries, escalate-without-retry |
| `loops/_template/loop.md` | pre-existing | The scaffold; `name` must equal the directory |
| `tests/validate.sh` | TASK-0008, TASK-0012 | `:193-213` loop checks: `name:`, `description:`, name==directory, and the three mandatory sections as exact `^## X$` headings |
| `docs/development/authoring-guide.md` | pre-existing | `:69-91` the Loops section |
| `ADR-0015` | this sprint | **accepted**; check+snapshot, not staging — **NOT MET: still `proposed`, waived by Option 2** (see the note below) |
| `PLAN-0003` finding F1 | this session | Written; no staging inventory exists or can |
| SIGMA `AGENTS.md` Change safety | pre-existing, read-only | The snapshot discipline this loop operationalises. **Read, never modified** |

**Verify the expected state; don't assume it.** TASK-0029 must be done
first: if the skill's invariant names are still moving, the loop ends up
referencing headings that then change — the exact failure S5 sequenced its
tasks to avoid.

> **And one expectation was never met, yet the task ran.** Added 2026-09-16
> by `REVIEW-0008` finding 8b. `ADR-0015` is still **`proposed`**, not
> accepted. This task was executed anyway by **human decision (Option 2,
> 2026-09-15)** — built from `PLAN-0003`'s recorded F1–F7 evidence rather
> than from a ratified ADR — and delivered by S7's `TASK-0046` pilot.
>
> The instruction directly above is the right one and was **not** followed
> for that row, because the human waived it rather than the task ignoring
> it. **The waiver lived only in `.ai/context/CURRENT_STATE.md`** until this
> note, which left this file showing `done` above an unmet precondition. The
> part of ADR-0015 the loop relies on — check+snapshot rather than staging
> promotion (`PLAN-0003` F1: no staging inventory exists or can) — rests on
> that recorded evidence, not on the ADR.

## Scope

### Included
- `loops/ansible-change/loop.md` with frontmatter (`name: ansible-change`
  equal to the directory, single-line `description`) and the three
  mandatory sections.
- `## Trigger` — when this loop applies, and explicitly when it does not
  (a read-only `*_info` play does not need a snapshot).
- `## Steps` — the eight-step sequence, each with an **expected output**,
  following `release-check`'s format.
- `## Exit conditions` — success, plus the distinct failure modes:
  validation failure (bounded retry), snapshot precondition unmet (stop),
  check-mode not meaningful (stop), verification disagrees with Ansible's
  report (stop, do not retry), secret exposure (hard stop), destructive
  action needing authorization (escalate without retrying).
- Links to `skills/ansible-ops/` for the rules; no restatement.
- Registry regenerated.

### Not included
- **Estate-specific content.** No node names, inventory names, or platform
  assumptions beyond "if the platform supports snapshots". The loop is
  portable; the specifics are the skill's `templates/`.
- Executing the loop against any live estate. Nothing in S6 runs a playbook.
- The guard (TASK-0031).
- A `--check`-mode-meaningfulness checker. The loop *stops* on the
  condition; detecting it automatically is not in scope and may not be
  tractable.

## Likely files
- `loops/ansible-change/loop.md`
- `docs/registry.md` (generated)
- `.ai/context/CURRENT_STATE.md`

## Execution plan
1. Confirm TASK-0029 is done and read the skill's invariant names as
   written, not as planned.
2. Re-read `release-check/loop.md` for format, and `validate.sh:193-213`
   for the exact heading requirements (anchored `^## Trigger$` etc. — a
   trailing space or different casing fails).
3. Draft the frontmatter and the three sections.
4. Write each step with its expected output. A step without one is advice,
   not a gate.
5. Write the exit conditions, making each failure mode's action explicit:
   retry (bounded), stop, or escalate.
6. Add the "this loop does not own the rules; `skills/ansible-ops/` does,
   and if they disagree the skill wins" statement, mirroring
   `release-check:16`.
7. `bash tests/validate.sh`; confirm OK.
8. **Prove the loop checks bite**: remove `## Exit conditions`, confirm the
   specific failure, restore. Then mismatch `name` against the directory,
   confirm, restore.
9. `bash scripts/sync-registry.sh`; confirm exactly one new Loops row.
10. Update `.ai/context/CURRENT_STATE.md`.

## Acceptance criteria
- [ ] `loops/ansible-change/loop.md` has all three mandatory sections as
      exactly-anchored headings and passes `validate.sh`
- [ ] `name` equals the directory; `description` is a single line
- [ ] Every step states an expected output
- [ ] `snapshot-possible?` precedes `snapshot`, and `delete snapshot`
      follows verification — both present, both explained
- [ ] **No staging step**, and the reason is stated so a future reader does
      not "restore" it
- [ ] Exit conditions include bounded retries with a limit, a hard stop on
      secrets, escalate-without-retry for destructive actions, a stop when
      check-mode is not meaningful, and a stop when verification disagrees
      with Ansible's report
- [ ] The loop links the skill's rules rather than restating them
- [ ] The checks were **observed failing** (missing section, name mismatch)
      then restored
- [ ] `docs/registry.md` regenerated with exactly one new row
- [ ] `tests/validate.sh` OK
- [ ] `SIGMA-infrastructure` untouched

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — **required here**

## Risks and rollback
- **Risk: restating the skill's rules.** Creates two owners for one fact
  and guarantees drift. `release-check` shows the discipline; follow it.
- **Risk: a loop that cannot be followed.** An eight-step sequence with a
  snapshot precondition is only usable if each step names a concrete,
  observable expected output. Vague steps produce a document that gets
  skipped.
- **Risk: encoding a platform assumption.** Snapshots are a PVE capability
  here; the loop must express "if the platform supports snapshots, and
  verify that it does" rather than assuming Proxmox.
- **Risk: the loop is never exercised** (the sprint's stated limitation).
  `release-check` was authored and then used repeatedly in this repo;
  `ansible-change` has no such path in S6. Do not write it as though it
  has been proven.
- **Rollback:** new directory plus regenerated registry. `git revert`, then
  re-run `sync-registry.sh`.

## Outputs / handover

**Intended end state — this task has not run.** A plan, not a state; the
gate cannot distinguish them, so this sentence does.

| Artifact | Intended end state |
|----------|-------------------|
| `loops/ansible-change/loop.md` | Frontmatter + three mandatory sections; eight steps with expected outputs; six distinct exit conditions; links to the skill, restates nothing |
| `docs/registry.md` | Regenerated; one new Loops row |
| `.ai/context/CURRENT_STATE.md` | Records a second live loop and that it is unexercised |
| `SIGMA-infrastructure` | **Untouched** |

**Next task starts here**: the instruct layer is complete — rules in the
skill, sequence in the loop — so TASK-0031 can add the one piece neither
can provide, an enforcement that does not depend on an agent choosing to
comply.

Deviation to record: if a step turns out to be unwritable with a concrete
expected output, say which and why rather than shipping a vague step.
`release-check` has eight steps that all pass that bar; if this loop cannot,
that is a finding about the domain, not a formatting problem.

## Status
- Status: done — **delivered by S7's TASK-0046 pilot**, not run as its own task
- Owner: agent
- Created: 2026-09-14
- Updated: 2026-09-15

## Execution log
### Attempt 1
- Date: 2026-09-15
- Agent: OpenCode, via `loops/design-brief/` then `loops/project-build/`

**Disposition: closed as delivered-by-S7.** Decided in TASK-0046's execution
log, which S6's archived sprint file explicitly deferred to that task.

`loops/ansible-change/loop.md` exists, carries the three mandatory sections,
a bound of 3, and four escalate-without-retry conditions — and was produced
**through** S7's loops rather than by executing this brief directly.

**Three deviations from this brief's plan, each decided on evidence:**

1. **Nine gates, not eight.** The gate sequence was a HIGH ambiguity the
   accepted design brief did not settle; the `plan` agent refused to infer it
   from record-field order and **stopped to ask** (ADR-0019 clause 2.5). The
   human chose: derive → lint → syntax → `--check --diff` → fidelity verdict
   → snapshot → bounded apply → verify → close the record, ordered
   cheapest-and-safest first.
2. **This brief's "restates nothing" requirement is unsatisfiable as
   written, and asking for it caused a real defect.** `## Steps` must state
   each gate's expected output (the `release-check` precedent and the design
   brief both require it), which *is* restatement. The loop was authored
   claiming "linked, never restated" and `review` **blocked** it as a false
   claim about its own structure. The correct formulation, now shipped: the
   linked artifacts are **normative** and the loop's mentions are deliberate
   **partial summaries subordinate** to them. **Anyone reusing this brief's
   wording will re-import the defect** — `review` flagged exactly that risk.
3. **The checker is unwired.** Nothing in this repo runs
   `check-change-record.sh`; the loop's step 9 is its sole caller. Disclosed
   in eight places rather than left implied.

- Validation: `tests/validate.sh` green (including the loop-section checks at
  `validate.sh:196-213`); `scripts/sync-registry.sh` regenerated and
  `ansible-change` appears in `docs/registry.md`
- Result: **delivered as a by-product of TASK-0046**
- Commit: recorded in TASK-0046's log
- Push: awaited human authorization, per ADR-0019 clause 2.2
