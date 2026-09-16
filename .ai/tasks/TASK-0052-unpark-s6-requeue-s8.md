# TASK-0052 — Un-park sprint S6, re-queue S8, and correct four defects in S6's own plan

## Objective
Return S6 to current on a human decision (2026-09-16), send S8 back to the
queue it came from, and record **four defects found in S6's remaining plan
while verifying its preconditions** — before any of that plan is executed
against them.

This is a sprint state change, not a lasting decision, so it gets no ADR.
TASK-0033 is the precedent: it parked this same sprint and took no ADR
either.

## Minimal context

### Why S6 comes back rather than staying parked
Human decision, 2026-09-16, in answer to a direct question about how S6
should re-enter. The chosen option was **un-park S6 and finish it before
S8**, with two supporting decisions taken in the same exchange: the three
ADRs get **bodies written from spike evidence and stay `Proposed`** for
human ratification, and TASK-0026's narrowing of the `ansible_navigator`
authorization is **re-confirmed as still granted**.

Un-parking is cheap for the same reason parking was: **S6 still has zero
implementation**. TASK-0029 and TASK-0030 were delivered by S7's pilot, but
by another route entirely — nothing in S6's own remaining plan has run. The
archived sprint file is still the plan as written.

S8 is the reciprocal case and is **also cheap to re-queue**: all four of its
tasks (`TASK-0048…0051`) are `planned` and **zero components were changed**
by its planning, which was the explicit instruction at the time. So no
partial execution needs reconciliation in either direction. Had either
sprint been half-built, this swap would have cost real work.

### Re-queued, not parked — and the distinction is deliberate
This repo already has three sprint end-states and they are not
interchangeable. A **closed** sprint gets a `REVIEW-####` and its backlog
items resolve. A **parked** sprint keeps its artifacts `planned`/`proposed`
and its items `ready`. S8 gets a third treatment: it was **promoted and is
now un-promoted before doing any work**, so it returns to `sprints/` in
exactly the state it was planned in.

The precedent for the *file movement* already exists and is worth naming,
because it was previously a defect: S8's own header records that it "sat in
`sprints/` with a note that it was not yet current". That is where it goes
back. **B-019 and B-020 stay `ready`** — the same rule that kept
B-010…B-013 `ready` through S6's park. Re-queuing a sprint does not
un-scope its backlog items.

### Four defects in S6's remaining plan, found before executing it
All four were found by opening the files the briefs name, which is standing
lesson 7: *planning prose is a hypothesis about files.* All four bear on
**TASK-0031**, the guard — S6's highest-value deliverable — and two of them
would have produced the unfailable check this repo has now authored twice
(standing lesson 8).

**D1 — the guard's target-identification strategy does not match the only
real playbook.** `TASK-0031` scopes detection of "PVE-class" hosts around
group names (`pve_cluster`/`pve_voting`, made configurable). But
`SIGMA-infrastructure/playbooks/capture_pve_baseline.yml:21` reads
`hosts: sigsrvpve1` — a **bare hostname**. Matching a play's `hosts:` value
against group names would never classify the one playbook in the estate
that actually targets a PVE node. Correct detection requires resolving
host→group membership from `inventory/production.yml`
(`pve_cluster` → `pve_voting` → `sigsrvpve1`), which the brief never
mentions.

**D2 — fixture 5 cannot distinguish a working guard from a broken one.**
This is the most consequential of the four. `TASK-0031` makes "the two real
playbooks → guard **silent**" an acceptance criterion. Both playbooks are
`gather_facts: false` (verified), so a correct guard is indeed silent. **But
a guard suffering D1 — one that never recognises `sigsrvpve1` as PVE-class
at all — is silent on them too.** The fixture passes either way, which is
precisely the shape of a check that cannot fail. It needs a **sixth
fixture** the brief does not have: a PVE host addressed by **bare hostname**
with `gather_facts: true` and no exclusion, which a correct guard must
**fail**. Without it, five green fixtures prove nothing about the estate the
guard was written for.

**D3 — a naive `module_defaults` check would over-accept the real
playbook.** `capture_pve_baseline.yml:23` *has* a `module_defaults:` block —
but scoped to `group/community.proxmox.proxmox`, supplying API connection
parameters, with **no `ansible.builtin.setup` entry**. A guard that accepts
the presence of the `module_defaults` key rather than a `setup`-scoped
`gather_subset` inside it would pass dangerous code while appearing to
implement the second accepted form. `TASK-0031`'s fixture 3 tests only the
*correct* form, so this gap is untested by the plan's own design. The brief
warns about "over-accepting" in the abstract and then specifies fixtures
that cannot detect it.

**D4 — `ansible-lint`'s recorded location is wrong.** `TASK-0031`'s Inputs
table lists `ansible-lint 26.8.0` as "pre-existing (SIGMA venv)". **There is
no virtualenv in `SIGMA-infrastructure`.** The binary is at
`/home/armando.martires/.venvs/sigma-ansible/bin/ansible-lint` and is **not
on `PATH`**, so every invocation needs the absolute path. Version confirmed
by running it: `ansible-lint 26.8.0 using ansible-core 2.20.8`. The version
claim held; the location claim did not. Minor next to D1–D3, but it is the
row TASK-0027 would have started from.

### What these four have in common
D1 and D3 are wrong *about the estate*; D2 is wrong about *what the proof
proves*. All three survived because the plan was written from a reading of
`ansible.cfg`'s prose — which is accurate and emphatic about the hazard —
without opening the playbook that the guard must actually classify.
`ansible.cfg` describes the rule; the playbook is where the rule is applied.
**The brief verified the hazard and never verified the subject.**

Recorded here rather than fixed silently inside TASK-0031, for the reason
REVIEW-0008's finding 2 gives: a finding recorded only in the task log of
the task that fixes it gets rediscovered rather than reused. D2 in
particular generalises past this guard — it is the fixture-design failure
mode, not an Ansible fact.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/planning/sprints/SPRINT-S6-ansible-agent-guardrails.md` | TASK-0033 | 188 lines; parking note in a blockquote header dated 2026-09-15; body is the sprint as opened 2026-09-14, unedited |
| `.ai/planning/SPRINT-CURRENT.md` | S8 planning, promoted by REVIEW-0008's closure | Holds **S8**; 183 lines; header records the promotion and the corrected task counts |
| `.ai/planning/ROADMAP.md` | multiple | 459 lines; Phase 6 section at `:159`, status **parked**; Phase 8 section at `:337`, "planned … not started" |
| `.ai/tasks/TASK-0026…0032` | PLAN-0003 | `TASK-0026`, `0027`, `0028`, `0031`, `0032` are `planned`; `0029` and `0030` are `done` (delivered by S7's pilot) |
| `.ai/tasks/TASK-0048…0051` | PLAN-0005 | All four `planned`, verified by grep of their Status lines; **zero components changed** by S8 |
| `.ai/decisions/0014`, `0015`, `0016` | PLAN-0003 | All three `Proposed`; all three are **skeletons** — every `## Context`, `## Decision`, `## Consequences` says "to be written"/"to be completed" |
| `.ai/planning/BACKLOG.md` | multiple | B-010…B-013 `ready` (S6); B-019, B-020 `ready` (S8) |
| `SIGMA-infrastructure` | pre-existing, read-only | `git status` clean, verified at session start. **Read as evidence, never modified** |
| Human decisions | human, 2026-09-16 | Three, given in one exchange: un-park S6 before S8; ADR bodies drafted but left `Proposed`; `ansible_navigator` narrowing re-confirmed |

**Verify the expected state; don't assume it.** A stale row here is the one
failure this convention cannot catch for you.

## Scope

### Included
- Move S8 back to `.ai/planning/sprints/SPRINT-S8-third-party-extensions.md`
  with a **re-queued** note stating the date, the reason, and that its four
  tasks and two backlog items are untouched.
- Restore S6 to `.ai/planning/SPRINT-CURRENT.md` with an **un-parked**
  header that keeps the original parking note visible rather than deleting
  it, and that records the four defects above as binding on TASK-0031.
- Correct S6's task table: `TASK-0029`/`TASK-0030` shown as **done,
  delivered by S7's pilot**, not `planned`. They currently read `planned` in
  the archived sprint file while their own files say `done` — the exact
  four-files-disagree defect REVIEW-0008 swept for S7.
- Update `ROADMAP.md`: Phase 6 → current with the un-parking recorded and
  the four defects noted against its guard exit criterion; Phase 8 →
  re-queued.
- Update `.ai/tasks/TODO.md` and `.ai/context/CURRENT_STATE.md`.
- Add `TASK-0031`'s missing **sixth fixture** and the D1/D3 corrections to
  that brief's Scope and Acceptance criteria, so the task is executed
  against a corrected plan rather than a corrected memory.
- Correct `TASK-0031`'s `ansible-lint` Inputs row (D4).

### Not included
- **Executing any of S6's remaining tasks.** The spikes, the ADR bodies,
  TASK-0026 and the guard are their own tasks and their own commits.
- **Ratifying ADR-0014/0015/0016.** Human act; the bodies are not even
  written yet.
- **Any change to S8's four task briefs or to `PLAN-0005`.** Re-queuing is a
  location change, not a rescope. Their content stays exactly as planned.
- **Resolving B-019/B-020, or B-010…B-013.** All stay `ready`.
- **A `REVIEW-####` for S8.** It is not being closed; it never started.
- **Any modification to `SIGMA-infrastructure`.**
- Adding a check that sprint status claims agree across files. REVIEW-0008
  established this cannot be gated (`validate.sh` checks section presence,
  never cross-file agreement) and that sweeping the columns is part of the
  human process instead.

## Likely files
- `.ai/planning/SPRINT-CURRENT.md` (becomes S6)
- `.ai/planning/sprints/SPRINT-S8-third-party-extensions.md` (new location)
- `.ai/planning/sprints/SPRINT-S6-ansible-agent-guardrails.md` (removed as
  the archive copy, its content promoted)
- `.ai/planning/ROADMAP.md` — Phases 6 and 8
- `.ai/planning/BACKLOG.md` — status-note wording only, no status changes
- `.ai/tasks/TODO.md`
- `.ai/tasks/TASK-0031-gather-subset-guard.md` — the four defect corrections
- `.ai/context/CURRENT_STATE.md`
- `.ai/sessions/SESSION-*.md` + `.ai/sessions/INDEX.md`

## Execution plan
1. Re-read every Inputs row against the file. Record drift.
2. Move S8's file to `sprints/`, adding the re-queued note. Preserve its
   existing header verbatim below the new one — it carries S7's two binding
   findings and the corrected counts.
3. Promote S6's file to `SPRINT-CURRENT.md`, adding the un-parked header
   above the preserved parking note.
4. Fix the S6 task table's `TASK-0029`/`0030` rows to `done`.
5. Amend `TASK-0031` for D1, D2, D3, D4 — Scope, Acceptance criteria and
   the Inputs row. Add fixture 6.
6. Update `ROADMAP.md` Phases 6 and 8; `TODO.md`; `BACKLOG.md` notes.
7. Update `CURRENT_STATE.md`.
8. `bash tests/validate.sh` → expect OK. Governance-only change, so
   `sync-registry.sh` must produce **no diff**; run it to confirm rather
   than assume.
9. Write the session record and `INDEX.md` row. REVIEW-0008 finding 2 is
   that four S7 tasks skipped this, so it is a step here, not an option.
10. Review the diff, commit, push, record hash and push result.

## Acceptance criteria
- [ ] `SPRINT-CURRENT.md` holds S6, un-parked, with the original parking
      note still visible
- [ ] S8 is at `sprints/SPRINT-S8-third-party-extensions.md` with a
      re-queued note; its four briefs and `PLAN-0005` are **unmodified**
      (verified by `git status`, not by intention)
- [ ] S6's task table shows `TASK-0029`/`0030` as done-by-S7, agreeing with
      those files
- [ ] All four defects D1–D4 are recorded in this brief **and** reflected in
      `TASK-0031`'s Scope and Acceptance criteria
- [ ] `TASK-0031` carries a sixth fixture: PVE host by **bare hostname**,
      `gather_facts: true`, no exclusion → guard must **fail**
- [ ] `ROADMAP.md` Phase 6 reads current; Phase 8 reads re-queued
- [ ] B-010…B-013, B-019, B-020 all still `ready` — no item resolved by a
      sprint transition
- [ ] `tests/validate.sh` reports OK
- [ ] `scripts/sync-registry.sh` produces no diff
- [ ] A session record and `INDEX.md` row exist
- [ ] No file under `/home/armando.martires/SIGMA-infrastructure` is
      modified

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed)

## Risks and rollback
- **Risk: a sprint transition silently resolves a backlog item.** Parking
  S6 got this right by stating the rule explicitly; re-queuing S8 must not
  quietly drop B-019/B-020. Both are checked as acceptance criteria.
- **Risk: overwriting S8's header loses S7's two binding findings.** Its
  current header carries the `validate.sh` timing trap and the
  findings-must-reach-`BACKLOG.md` lesson. Preserve, do not replace.
- **Risk: the four defects get "fixed" only in prose here and not in
  `TASK-0031`.** That is REVIEW-0008 finding 2's exact failure mode. Hence
  the criterion requiring both.
- **Risk: correcting `TASK-0031` before its dependency spike runs.** D1–D4
  are observations about files, not decisions about implementation shape;
  the shape still waits on TASK-0027 and ADR-0016. Keep the amendments
  factual and do not pre-empt the spike's recommendation.
- **Risk: the guard's scope quietly widens from one estate to "portable".**
  D1's fix requires reading an inventory to resolve group membership, which
  is more machinery than matching a group name. If that proves large, it is
  a finding for TASK-0031, not a reason to keep the broken matcher.
- **Rollback:** governance files only, one commit, no generated artifacts
  (`docs/registry.md` expected unchanged). `git revert` is sufficient.

## Outputs / handover

**This section describes a verified state.** The task has run; every row
below was checked against the file rather than intended.

| Artifact | End state |
|----------|-----------|
| `.ai/planning/SPRINT-CURRENT.md` | **S6**, un-parked. New header above the **preserved** parking note; four defects recorded as binding on TASK-0031; `TASK-0029`/`0030` rows corrected to `done` |
| `sprints/SPRINT-S8-third-party-extensions.md` | S8 re-queued. Original header preserved with **one** edit — its "NOW CURRENT" claim struck through rather than left false. Four briefs and `PLAN-0005` **unmodified** (confirmed by `git status`) |
| `.ai/tasks/TASK-0031-*.md` | D1–D4 corrected in Inputs, Scope, Execution plan, Acceptance criteria, Risks and handover. **Seven** fixtures. `validate.sh`'s decayed size/timing row also corrected |
| `.ai/planning/ROADMAP.md` | Phase 6 → current with D1–D4 and the amended guard exit criterion; Phase 8 → re-queued |
| `.ai/planning/BACKLOG.md` | Six items still `ready`. Added what "done" now means for B-011: fixture 6 observed failing, not a green run |
| `.ai/context/CURRENT_STATE.md` | New opening section; four superseded/stale S6+S8 status claims corrected in place; **lesson 8 gains its third instance** |
| `.ai/tasks/TODO.md` | S6 → current, S8 → re-queued, 0029/0030 boxes ticked, fixture count 5→7, a stale open-item count retired |
| `docs/registry.md` | **Unchanged** — `sync-registry.sh` produced no diff, as expected for a governance-only change |
| `SIGMA-infrastructure` | **Untouched.** `git status` clean at session start; only reads performed |

**Next task starts here**: S6 is the current sprint with a corrected plan, so
`TASK-0027` can run its lint spike knowing the guard must classify a **bare
hostname** via inventory group resolution, that fixture 5 alone cannot prove
the guard works, and that `ansible-lint` is at
`/home/armando.martires/.venvs/sigma-ansible/bin/ansible-lint` — absolute
path, not on `PATH`.

**Deviations from the Execution plan, recorded:**

1. **Two extra corrections were made that the plan did not forecast**, both
   found while editing rather than while verifying. S8's preserved header
   asserted **"NOW CURRENT"** in the present tense, and `ROADMAP.md`'s
   Phase 8 paragraph named `SPRINT-CURRENT.md` as its file. Preserving either
   verbatim would have left a false present-tense claim in place — the exact
   class `REVIEW-0008` swept across four files. The header claim is **struck
   through rather than deleted**, so the history stays visible.
2. **`ROADMAP.md`'s Phase 8 paragraph has now been wrong twice in opposite
   directions in one day** (`sprints/` → `SPRINT-CURRENT.md` → `sprints/`).
   Recorded in the file itself as a general observation: a path written into
   prose is a claim that decays every time the thing moves, and `validate.sh`
   cannot detect it — it checks section presence, never whether a path
   assertion resolves.
3. **A stale count was retired rather than updated** in `TODO.md`
   ("eight items are open"). `BACKLOG.md` owns that number; restating it in a
   second file is how it decayed. One-owner-per-fact applied instead of
   patching the copy.
4. **`TASK-0031`'s `validate.sh` Inputs row was corrected beyond D1–D4**: it
   claimed "474 lines, ~0.37 s", now **732 lines and ~1150 ms**. Not one of
   the four defects, but false in a row the task would have started from.

**Anyone who read `TASK-0031` before this amendment has the old shape**:
group-name matching, five fixtures, `module_defaults` matched by key, and a
wrong `ansible-lint` path.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-16
- Updated: 2026-09-16

## Execution log
### Attempt 1
- Date: 2026-09-16
- Agent: opencode (claude-opus-5)
- Actions: Verified all nine Inputs rows against the files. `git mv` in both
  directions (S8 → `sprints/`, S6 → `SPRINT-CURRENT.md`), preserving history.
  Wrote the un-parked header for S6 and the re-queued note for S8. Corrected
  the `TASK-0029`/`0030` rows. Amended `TASK-0031` for D1–D4 plus the decayed
  `validate.sh` row, raising the fixture count to seven. Updated `ROADMAP.md`
  Phases 6 and 8, `TODO.md`, `BACKLOG.md`, `CURRENT_STATE.md`, and lesson 8.
- Observations:
  - **The first read of the S6 sprint file found a status disagreement**:
    its table said `TASK-0029`/`0030` were `planned` while both task files
    said `done`. `REVIEW-0008`'s four-files-disagree class, recurring
    immediately in the sprint being un-parked.
  - **Four defects in S6's remaining plan (D1–D4)**, all bearing on
    TASK-0031, all found by opening the files the brief names. **D2 is the
    consequential one**: the original five fixtures were all satisfiable by a
    guard that resolves no hostnames, so a fully green fixture run would have
    proven nothing. That is lesson 8's **third** instance and the first in a
    fixture set rather than a check.
  - **The common cause generalises**: the plan was written from
    `ansible.cfg:21-48` — accurate, emphatic, detailed about the hazard — and
    never opened `capture_pve_baseline.yml`, which is what the guard must
    classify. **The hazard was verified; the subject was not.**
  - **Both directions of the sprint swap were free**, confirming TASK-0033's
    prediction from the other side: S6 had zero implementation, S8 had zero
    components changed.
  - Two unforecast false present-tense claims found and handled (deviation 1).
- Validation: `bash tests/validate.sh` → **`validate.sh: OK`** (run three
  times: before any edit, mid-way, and after the final edit).
  `bash scripts/sync-registry.sh` → **no diff** to `docs/registry.md`, the
  correct result for a governance-only change.
  `git status` in `/home/armando.martires/SIGMA-infrastructure` → **clean**,
  verified at session start; only reads performed there.
- Result: **Done.** S6 is current with a corrected plan; S8 is re-queued with
  its content unrescoped; six backlog items still `ready`.
- Commit:
- Push:
