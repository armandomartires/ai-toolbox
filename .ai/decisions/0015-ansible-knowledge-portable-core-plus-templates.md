# ADR-0015 — Ansible knowledge is a portable core plus per-project templates, and the graduated workflow is check-plus-snapshot

## Status
**Proposed**, 2026-09-14. Opened by `PLAN-0003` (sprint S6).

Depends on TASK-0027. Two decisions in one ADR because they are the same
question seen from two sides: what can a portable component assert about an
estate it has never seen?

## Context

To be completed when this ADR is written. Evidence gathered at plan time,
to be **re-verified** before restatement (lesson 7):

### The per-project problem
The highest-value content in the human-supplied analysis is explicitly
per-project — "**your** repository layout, **your** conventions", which
files to inspect first, which changes require approval. But `ai-toolbox`
ships portable components and holds no Ansible content of its own, and the
human's Option (a) decision forbids writing into the consuming repo.

A skill that hardcodes one estate's inventory names is not portable. A
skill that says only "follow your conventions" is worthless. The resolution
is the pattern `skills/project-workflow/` already uses: `SKILL.md` carries
the invariant core, `templates/` carries blank forms the consuming repo
fills in.

### The staging problem — the sprint's central correction
The analysis's worked example was:

```
ansible-lint → --syntax-check → --check --diff -l staging
             → -l staging → verify → approval for production
```

**Two of those six steps cannot exist in the estate this was written for.**
`SIGMA-infrastructure` has exactly one inventory
(`inventory/production.yml`, wired at `ansible.cfg:8`) managing one 6-node
PVE cluster at 3-of-4 quorum with no verified margin, plus a single domain
controller holding all seven FSMO roles. `ci.yml:3-10` records the
deliberate corollary: CI has no route to `192.168.88.0/24` and no
credentials, and its `tests/` is fixture-only for that reason.

There is no staging inventory and no plausible way to build one. Authoring
the skill from the source text would have produced a runbook gating on an
inventory that does not exist.

What *does* exist is that repo's `AGENTS.md` "Change safety": take a
snapshot before changing a guest, **check first that the platform can
actually take one** ("a snapshot is only a rollback path if the platform
can actually take one — never assume the safety net exists"), verify the
change, delete the snapshot if it succeeded, roll back if it failed, and
remember that a snapshot is not a backup.

### The check-mode problem
`community.proxmox.proxmox_storage` 2.0.0 — the newest on Galaxy — has no
field-level drift detection for any storage type. Check-mode confirms a
storage *name* exists and never compares declared config against live
values; there is no `update` path. A playbook using it reports "already
present, zero changes" whether or not the declaration is correct. That
repo's `S001.T006` is blocked on precisely this, having read the installed
module source before writing a playbook.

So "use `--check --diff` where supported" needs a qualifier that the source
analysis did not have: a clean `--check` is evidence only to the extent
that the modules involved implement check-mode meaningfully, and
establishing that means reading the module rather than trusting the exit
code.

### Constraint from ADR-0013
The two shipped skills scaffold two deliberately different governance
frameworks and must not be "aligned". `ansible-ops` is **operational, not
governance** — it must not become a third framework.

## Decision

To be written. Intended shape:

1. **Portable invariant core in `SKILL.md`; per-project facts in
   `templates/`.** Mirrors `skills/project-workflow/`. The core states
   rules true in any estate; the templates are blank forms for inventory
   names, escalation model, module preferences, snapshot procedure,
   fact-gathering hazards, and which changes need approval.
2. **The graduated workflow is `--check --diff` plus snapshot and rollback,
   not staging promotion.** Where a non-production inventory exists, use
   it; the skill must not *presume* one, and must not present its absence
   as a deficiency to be fixed — for this estate it is a structural fact.
3. **A clean `--check` is not proof.** The skill states the check-mode
   caveat with the `proxmox_storage` case as the worked example, and
   generalises it: `changed=1` does not mean the desired state was reached,
   and `changed=0` does not mean it already was.
4. **`ansible-ops` is operational, not governance** (ADR-0013).

## Consequences

To be written. Expected:

- The skill is honest about being incomplete without its templates filled
  in. That is a feature, not a hedge — the alternative is a component that
  pretends to know an estate it has never seen.
- **Snapshot discipline becomes the primary safety net**, which makes it
  platform-dependent in a way a staging gate would not be. The skill must
  express "if the platform supports snapshots, and verify that it does"
  rather than assuming Proxmox.
- The check-mode caveat makes the workflow more expensive: establishing
  that check-mode is meaningful may require reading module source. That
  cost is real and worth stating, because the alternative is false
  confidence — the specific failure `S001.T006` avoided by reading first.
- **`templates/` is where drift will happen.** A consuming repo fills them
  in once and the estate changes afterwards. The skill should say how the
  templates get re-verified, not assume they stay true.
- Under Option (a) this decision is **never exercised in S6**: the skill is
  authored from the target repo and never run there. That limitation is
  recorded in `PLAN-0003`, `SPRINT-CURRENT.md` and TASK-0032, and belongs
  in this ADR's consequences too.
