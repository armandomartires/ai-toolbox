# ADR-0015 — Ansible knowledge is derived per change, not declared; and the graduated workflow is check-plus-snapshot

## Status
**Proposed**, 2026-09-14. Opened by `PLAN-0003` (sprint S6).
**Body written 2026-09-16** against evidence, per the human decision of the
same date: draft from spike evidence, leave `Proposed` for ratification.
**Still owes ratification.**

**The title changed when the body was written.** It read *"…is a portable core
plus per-project templates…"*, which names a mechanism this ADR now
**rejects**. Keeping it would have left the file asserting in its own title
the thing its body refutes.

**The filename still says `0015-ansible-knowledge-portable-core-plus-templates.md`
and is deliberately not renamed** — following `ADR-0017`'s precedent, which
retitled to *"(claim withdrawn)"* while keeping
`0017-ai-toolbox-owns-agent-tiers.md`. The identifier `ADR-0015` is what every
citation uses; renaming would break nothing in this repo but would erase the
trace that the *plan* proposed this mechanism. **A reader who arrives via the
filename is therefore reading the rejected shape's name — this paragraph is
the warning.**

Two things a reader needs before going further:

- **Its stated dependency, `TASK-0027`, is now `done`** — so the "do not write
  before the spike reports" condition is met. But `TASK-0027` lints; it says
  nothing about check-mode fidelity or about skill shape. **Most of this ADR
  rests on `TASK-0046`'s pilot instead**, which is the honest provenance and
  was not the planned one.
- **The component this ADR governs already shipped**, under an explicit
  **Option 2 waiver** (2026-09-15): `skills/ansible-ops/` and
  `loops/ansible-change/` were built from `PLAN-0003`'s F1–F7 evidence while
  this ADR was still a skeleton. So this is a decision written **after** its
  subject, and it records what was decided by construction rather than
  pre-authorising it. Stated plainly because the ordering is a deviation, not
  a norm.

## Context

### The per-project problem, unchanged
The highest-value content in the source analysis is explicitly per-project —
"**your** repository layout, **your** conventions", which files to inspect,
which changes need approval. But `ai-toolbox` ships portable components and
holds no Ansible content of its own, and the human's Option (a) decision
forbids writing into the consuming repo.

A skill that hardcodes one estate's inventory names is not portable. A skill
that says only "follow your conventions" is worthless. **The plan resolved
this by copying `skills/project-workflow/`'s shape: invariant core in
`SKILL.md`, blank forms in `templates/` for the consuming repo to fill in.**

### That resolution was tested and is REFUTED — the central correction
`install.sh:105` deploys skills with `ln -sfn`. **A deployed skill is a
symlink into this repo's working tree.** So an operator filling in a shipped
`templates/estate-profile.md` would be writing one estate's production facts —
inventory names, hostnames, escalation contacts — **into this repo's tracked
component**, and every other consumer of that skill would then read them.

The mechanism does not merely leak; it inverts the portability it was chosen
to provide. This is the **same** mechanism that invalidated the
"portable core plus per-project templates" shape elsewhere, and it is the
clearest instance in this repo of planning prose failing contact with a file
(lesson 7).

**Two qualifications, because the earlier statement of this overstated it:**

1. **`templates/` as a directory survives; only fill-in-place dies.**
   `skills/ansible-ops/templates/change-record.md` ships and holds **no estate
   facts** — nine placeholder fields for a *per-change* record, with the
   explicit instruction *"Copy this file to wherever your estate keeps
   records. **This skill does not say where**."* That is **copy-out**, not
   fill-in-place, and it is safe precisely because nothing is written back
   into the symlinked component.
2. **The refutation is of clause 1's mechanism, not of the whole plan.** The
   check-plus-snapshot decision and the check-mode caveat below were unaffected
   and shipped as planned.

### What the pilot chose instead: derive, persist nothing
`skills/ansible-ops/SKILL.md` states it directly:

> Nothing here is specific to one estate. Estate-specific answers are
> **derived per change, never declared and never stored**.

The skill carries an **obligation set** — eight questions that must be
answerable before a change applies — rather than a form to be filled once.
Obligation 7 is *"Where did each of the above answers come from?"*, which is
what replaces a stored estate profile: provenance per change, not a
declaration that decays.

Its legal outcomes are **a real answer, an explicit `not-applicable`, or a
stop**, and `unknown` is a stop everywhere. The stated reason is the failure
mode this ADR should be read against: *"There is no fourth outcome in which a
default is quietly substituted for an answer nobody has… because it produces
a change that looks fully gated."*

### The staging problem — the sprint's other central correction
The analysis's worked example was
`ansible-lint → --syntax-check → --check --diff -l staging → -l staging →
verify → approval for production`. **Two of those six steps cannot exist in
the estate this was written for.** Re-verified 2026-09-15 and again
2026-09-16: one inventory (`ansible.cfg:8` → `inventory/production.yml`), one
6-node PVE cluster at 3-of-4 quorum, one DC holding all seven FSMO roles, and
CI with no route to the management network and no credentials.

There is no staging inventory and no plausible way to build one. **Authoring
from the source text would have produced a runbook gating on an inventory
that does not exist.**

What *does* exist is snapshot discipline: take a snapshot before changing a
guest, **check first that the platform can actually take one**, verify, delete
on success, roll back on failure — and remember a snapshot is not a backup.

### The check-mode problem
`community.proxmox.proxmox_storage` 2.0.0 has **no field-level drift
detection** for any storage type. Check mode confirms a storage *name* exists
and never compares declared config against live values; there is no `update`
path. A playbook using it reports "already present, zero changes" whether or
not the declaration is correct.

So "use `--check --diff` where supported" needs a qualifier the source
analysis lacked. `references/check-mode-fidelity.md` states it as the
distinction between two sentences — a clean check run supports *"no module's
check-mode implementation predicted a change it was capable of predicting"*
and **not** *"the target is already in the desired state"*. **The gap between
those two is where changes go wrong while looking gated.**

### Constraint from ADR-0013
The two shipped skills scaffold two deliberately different governance
frameworks and must not be "aligned". `ansible-ops` is **operational, not
governance**. The shipped record template enforces this in its own text:
per-change, ephemeral, no index, no status vocabulary, no task IDs — *"A
record schema is one index away from being a governance framework."*

## Decision

1. **Estate-specific knowledge is DERIVED PER CHANGE, never declared and
   never stored in the component.** This **replaces** the intended
   "portable core plus per-project `templates/`" mechanism, which is refuted
   by `install.sh:105`'s symlink deployment. The portable core carries the
   *obligation set* and the reasoning; each answer is derived at change time
   with its provenance recorded.
2. **`templates/` remains legitimate for copy-out artifacts that hold no
   estate facts.** `templates/change-record.md` is the worked example: a
   per-change record, copied to wherever the estate keeps records, with the
   skill deliberately not saying where. **The forbidden pattern is
   fill-in-place inside the deployed component**, not the directory.
3. **The graduated workflow is `--check --diff` plus snapshot and rollback,
   not staging promotion.** Where a non-production inventory exists, use it;
   the skill must not *presume* one, and must not present its absence as a
   deficiency to be fixed — for this estate it is a structural fact.
4. **A clean `--check` is not proof.** The skill states the caveat with
   `proxmox_storage` as the worked example and generalises it: `changed=1`
   does not mean the desired state was reached, and `changed=0` does not mean
   it already was. Establishing that check mode is meaningful may require
   reading module source.
5. **`ansible-ops` is operational, not governance** (`ADR-0013`), and the
   record schema is bounded to keep it that way.
6. **An unanswerable obligation is a stop, not a warning.** `unknown` is a
   stop in every field. No default may be substituted for an answer nobody
   has.

## Consequences

- **The skill is honest about being incomplete without per-change
  derivation.** That is a feature: the alternative is a component that
  pretends to know an estate it has never seen. Under the *rejected* shape it
  would have been worse than incomplete — it would have been **confidently
  wrong for every consumer except the first**.
- **Drift moves rather than disappearing.** The plan's forecast was
  *"`templates/` is where drift will happen"*; under derive-per-change there
  is nothing to go stale, but the cost is paid **on every change** instead of
  once. That is a real, recurring cost and the right trade only because a
  stale declaration is silently wrong while a re-derivation is merely
  laborious.
- **Snapshot discipline becomes the primary safety net**, which makes safety
  platform-dependent in a way a staging gate would not be. The skill must
  express "if the platform supports snapshots, **and verify that it does**"
  rather than assuming Proxmox.
- **The check-mode caveat makes the workflow more expensive**, sometimes
  requiring module source to be read. That cost is real and worth stating,
  because the alternative is false confidence.
- **This decision was exercised before it was ratified**, via the Option 2
  waiver — which is how its central clause came to be refuted by evidence
  rather than shipped as written. **Read that as the argument for the
  waiver's ordering, not against it:** had the ADR been ratified first, the
  symlink defect would have been enshrined in an accepted decision instead of
  caught during construction.
- **The plan's own limitation still stands**: under Option (a) the skill is
  authored *from* the target repo and **never executed *in* it**, so it
  remains unexercised in its intended estate. `TASK-0046` exercised the
  *loops that produced it*, which is a different claim. `TASK-0031`'s guard
  is the one deliverable that will be validated against real playbook
  content.
- **Ratification still owed**, and specifically owed on clause 1: it reverses
  the mechanism the plan approved, so it is a substantive change rather than
  a restatement.
