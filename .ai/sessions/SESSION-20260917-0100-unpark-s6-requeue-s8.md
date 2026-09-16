# SESSION-20260917-0100 — Un-park sprint S6, re-queue S8, correct four defects in S6's plan

- Date: 2026-09-16
- Agent/model: opencode (claude-opus-5)
- Objective: Act on the human request to *work on S6 complete
  implementation*. Establish what S6 actually is, what remains, and whether
  it can be completed — then execute the human's decisions on how it
  re-enters.
- Context consulted: `AGENTS.md` (+ global workflow rules),
  `.ai/planning/SPRINT-CURRENT.md` (held S8),
  `.ai/planning/sprints/SPRINT-S6-ansible-agent-guardrails.md`,
  `.ai/context/CURRENT_STATE.md` (all 1319 lines),
  `.ai/planning/ROADMAP.md` Phases 6 and 8, `.ai/planning/BACKLOG.md`,
  `.ai/tasks/TODO.md`, `.ai/templates/TASK.md`, `TASK-0026`, `TASK-0031`,
  `TASK-0033` (the parking precedent), ADR-0014/0015/0016,
  `.ai/sessions/INDEX.md`. **Outside this repo, read-only:**
  `SIGMA-infrastructure`'s `ansible.cfg`, `playbooks/*.yml`,
  `inventory/production.yml`, `.ansible-lint`, and
  `~/.venvs/sigma-ansible/bin/ansible-lint --version`.
- Tasks worked on: `TASK-0052` (new, done). No component code changed.

## What the request turned out to mean

**"Complete implementation" of S6 could not be done in one session, and
saying so was the first useful output.** S6 is the *parked* sprint; S8 was
current with zero work done. Of S6's remaining work, three items are hard
blocked on a human: all three ADRs (0014, 0015, 0016) are **empty
skeletons** — every `## Context`, `## Decision` and `## Consequences` reads
"to be written" — and `TASK-0031`, the sprint's highest-value deliverable,
depends on ADR-0016. Ratification is a human act by this repo's own
precedent (ADR-0019).

So the session reported state, asked three questions, and executed the
answers.

## Decisions

All three were the human's, taken in one exchange after the state report:

- **Un-park S6 and finish it before S8.** S8 is **re-queued** — a third
  sprint state, distinct from parked and closed: promoted and then
  un-promoted before any work, so it gets no checkpoint because there is
  nothing to check.
- **Run the spikes, draft the ADR bodies from observed evidence, leave all
  three `Proposed`.** Do not self-accept. Explicitly: do not fill them from
  `PLAN-0003`'s prose, which is how they reached skeleton state.
- **The `ansible_navigator` narrowing is re-confirmed as granted**, so
  TASK-0026 may proceed against the 2026-09-14 authorization.

Taken by the agent, within those:

- **No ADR for the sprint transition.** TASK-0033 parked this same sprint
  with no ADR; a state change is not a lasting decision.
- **Correct the four plan defects in `TASK-0031` itself, not only in the
  transition brief.** `REVIEW-0008` finding 2: a finding recorded only in a
  task log gets rediscovered rather than reused.
- **Strike, don't delete, S8's false "NOW CURRENT" claim.** Preserving it
  verbatim would leave a false present-tense assertion; deleting it would
  hide that it was ever made.

## Findings

**1. Four defects in S6's remaining plan, found before executing it — all
bearing on `TASK-0031`, the guard.** All four came from opening the files
the brief names (lesson 7):

- **D1** — the guard identified "PVE-class" hosts by **group name**
  (`pve_cluster`/`pve_voting`). The estate's only PVE-targeting playbook
  uses `hosts: sigsrvpve1`, a **bare hostname**
  (`capture_pve_baseline.yml:21`). Group-name matching would classify it as
  not-PVE and say nothing. Detection needs host→group resolution through the
  inventory's nested `children:`.
- **D2** — **the five fixtures were all satisfiable by a guard that
  classifies nothing at all.** "The two real playbooks → guard silent" was
  an acceptance criterion; both are `gather_facts: false`, so silence is
  expected from a correct guard *and* from a D1-afflicted one. A fully green
  fixture run would have proven nothing about the estate the guard exists
  for. Fixed by adding fixture 6 (PVE host by bare hostname,
  `gather_facts: true` → must **fail**), the only case that fails when D1 is
  present.
- **D3** — a `module_defaults` check matching the **key** rather than its
  `ansible.builtin.setup` entry over-accepts the real playbook, whose block
  is scoped to `group/community.proxmox.proxmox` with no `setup` entry.
  Fixture 7 added.
- **D4** — `ansible-lint` is at `~/.venvs/sigma-ansible/bin/`, **not** in
  `SIGMA-infrastructure` (which has no venv) and **not on `PATH`**. Version
  claim held (`26.8.0`, `ansible-core 2.20.8`, confirmed by running it);
  location claim did not.

**2. The common cause is more transferable than the defects.** The brief was
written from `ansible.cfg:21-48` — accurate, emphatic, detailed, and
correct about the hazard — **without opening the playbook the guard must
classify.** `ansible.cfg` describes the rule; the playbook is where the rule
is applied. **The hazard was verified and the subject was not.** That is a
new shape of lesson 7: the cited evidence was real, and simply not the
evidence the design needed.

**3. Lesson 8 has a third instance, and it is in a fixture set rather than a
check.** TASK-0031 is the task written *specifically* to avoid the
unfailable check: its brief quotes lesson 8 and makes five observed fixture
results acceptance criteria rather than steps. Those five fixtures were
uniformly blind. **Fixtures-first does not help when every fixture shares
the design's wrong assumption** — a set needs at least one case drawn from
the real subject rather than from the design's model of it. Recorded in
`CURRENT_STATE.md` under lesson 8.

**4. The sprint file disagreed with its own task files on the first read.**
S6's table listed `TASK-0029`/`0030` as `planned`; both task files say
`done` (delivered by S7's pilot). That is `REVIEW-0008`'s
four-files-disagree class recurring **immediately**, inside the sprint being
un-parked. Corrected in the table rather than deferred — a known-false
status is not a follow-up.

**5. Both directions of the sprint swap were free, confirming TASK-0033's
prediction from the other side.** That task recorded *"parking cost nothing
precisely because nothing had been implemented; the same decision one sprint
later would have needed reconciliation."* Un-parking cost nothing for
exactly that reason (S6 still has zero implementation of its own), and
re-queuing S8 cost nothing for the mirror reason (zero components changed —
planning-only was its instruction). **The prediction held in both
directions**, which is rarer in this repo's record than a prediction failing.

**6. A path recorded in prose decays every time the thing moves.**
`ROADMAP.md`'s Phase 8 paragraph has now been wrong twice in opposite
directions **in one day**: `sprints/` → `SPRINT-CURRENT.md` → `sprints/`.
`TODO.md`'s S8 block has stated three locations for one file. Neither is
detectable by `validate.sh`, which checks section presence and never whether
a path assertion resolves. Recorded in the roadmap itself rather than merely
fixed.

**7. A stale count was retired rather than updated.** `TODO.md` asserted
"eight items are open", true when written and decayed by five subsequent
backlog changes. `BACKLOG.md` owns that number, so the copy was removed
rather than patched — one-owner-per-fact instead of a second maintenance
point.

## Validation

- `bash tests/validate.sh` → **`validate.sh: OK`**, run three times (clean
  baseline before any edit, mid-way after the file moves, and after the
  final edit).
- `bash scripts/sync-registry.sh` → **no diff** to `docs/registry.md`. The
  correct result for a governance-only change, and confirmed rather than
  assumed.
- `git status` in `/home/armando.martires/SIGMA-infrastructure` → **clean**,
  verified at session start. Only reads were performed there; the standing
  never-modify constraint bound while S6 was parked and binds again now.
- `git mv` used in both directions so the sprint files keep their history.

## Handover

**S6 is the current sprint with a corrected plan.** The next task is
`TASK-0027` (the lint spike), which can now start knowing three things its
brief previously got wrong: the guard must classify a **bare hostname** via
inventory group resolution, fixture 5 alone cannot prove the guard works,
and `ansible-lint` is at
`/home/armando.martires/.venvs/sigma-ansible/bin/ansible-lint` — absolute
path, not on `PATH`.

**Not done, and deliberately:** no spike has run, no ADR body is written, no
component is touched. `TASK-0026`, `0027`, `0028`, `0031`, `0032`, the three
ADR bodies and a checkpoint all remain.

**Two traps for the next session:**

- **`REVIEW-0009` is already reserved by S8's file.** S6's checkpoint must
  take the next free number rather than reusing it.
- **`ADR-0015`'s intended clause 1 is already refuted** by S7's pilot —
  `install.sh:105` symlinks a deployed skill into this repo's working tree,
  so an operator filling in a shipped `templates/` file would write one
  estate's production facts into the portable component. The shipped skill
  chose *derive, persist nothing*. Write the ADR against that evidence, not
  against the plan's intention.
