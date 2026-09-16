# TASK-0031 — The `gather_subset` / `ansible_mounts` guard

## Objective
Implement the one enforcement in this sprint that does not depend on an
agent choosing to comply: a static check that refuses a play which gathers
facts against a Proxmox-class host without excluding `mounts`.

This is S6's highest-value deliverable. The rule is already written down,
its failure mode is already documented, and it is enforced by nothing.

## Minimal context

### The hazard, in the words of the file that documents it
`SIGMA-infrastructure/ansible.cfg:21-48` carries this, in capitals:

> THE MOST IMPORTANT RULE FOR THIS WORKSPACE IS NOT IN THIS FILE, AND
> CANNOT BE — READ THIS BEFORE WRITING ANY PLAYBOOK AGAINST A PVE NODE.

The mechanism: `ansible.builtin.setup`'s default fact gathering collects
`ansible_mounts`, which stats every mount point on the target — including
`/etc/pve`. On a node with wedged pmxcfs, that stat is an uninterruptible
D-state FUSE hang. **`timeout` cannot kill an uninterruptible D-state
wait.** It is the same hazard that previously "faked a live diagnosis for
~20 minutes" (that repo's KE-02), because every retry used the same broken
invocation.

### Why it cannot be fixed by configuration
The same comment records what was tried, empirically, and failed:

- `gather_subset` in `[defaults]` — `ansible-config validate` **rejects it
  outright** as an unknown key.
- `gather_subset` in inventory `group_vars` — **silently ignored** by
  implicit fact gathering; a live test confirmed `ansible_mounts` was still
  present.

It is a play-level keyword and a per-module argument, nothing more. There
is no global `ansible.cfg`, env-var, or inventory mechanism in ansible-core
2.20.8. So the fix **must** be repeated correctly in every play, forever —
which is precisely the class of rule that needs a machine check rather than
a documented intention.

The file's own conclusion:

> THE FIRST PLAYBOOK THAT TARGETS A PVE HOST MUST include one of:
> `gather_subset: "!mounts"` as a play-level keyword, or `module_defaults`
> scoped to the play. A code-review or CI check should confirm this before
> that playbook is trusted against a live node. **Tracked as unenforced
> until then.**

### Why this survives TASK-0028's outcome either way
Every enforcement example in the source analysis assumed hooks
intercepting agent actions. This check is **static** — it reads YAML and
decides — so it works as an `ansible-lint` rule or a `pre-commit` hook,
in CI, or as a standalone script, with no dependence on whether a client
hook can see an MCP tool call. That independence is why it is the
sprint's strongest item and why it is not blocked on ADR-0016.

### What the guard can and cannot prove
It proves **a keyword is present in a play that targets a PVE-class
host**. It does **not** prove a node cannot hang: the D-state hang is
documented but not reproducible on demand, so the guard is validated
against syntax, never against the hazard. The guard's own source must say
this. Per ADR-0009 (validation checks documentation completeness, never
runtime state) and the standing lesson that a check which cannot fail is
still trusted.

### The lesson this task is most likely to repeat
Standing lesson 8: *"Knowing 'a check that cannot fail is worse than no
check' does not prevent authoring one."* PLAN-0002 specified two deployment
checks that compared a symlink with its own target — written in the sprint
that cites this very lesson, by an agent that had just restated it. The
control is not knowing the rule. **It is running the check against a
deliberately broken input before trusting it.** Hence the fixture
requirements below, which are acceptance criteria rather than good
intentions.

### Four defects in this brief, corrected 2026-09-16 by `TASK-0052`
Found by opening the files this brief names, before executing it. **Two of
them would have produced the unfailable check lesson 8 describes** — in the
task written to avoid it.

- **D1 — target matching was designed against the wrong thing.** The Scope
  below originally identified "PVE-class" by **group name**
  (`pve_cluster`/`pve_voting`, made configurable). But the only playbook in
  the estate that targets a PVE node uses `hosts: sigsrvpve1` — a **bare
  hostname**. Group-name matching classifies it as *not* PVE-class and says
  nothing. Detection must resolve **host→group membership** from
  `inventory/production.yml`, which this brief never mentioned.
- **D2 — fixture 5 could not distinguish a working guard from a broken one,
  and it was an acceptance criterion.** "The two real playbooks → guard
  silent" is satisfied by a correct guard *and* by a D1-afflicted guard that
  recognises nothing at all. Both playbooks are `gather_facts: false`, so
  silence is the expected output either way. **Five green fixtures would
  have proven nothing about the estate this guard exists for.** Fixture 6
  below is the fix and is not optional.
- **D3 — the `module_defaults` form was specified in a way that
  over-accepts.** `capture_pve_baseline.yml:23` *has* a `module_defaults:`
  block — scoped to `group/community.proxmox.proxmox`, supplying API
  connection parameters, with **no `ansible.builtin.setup` entry**. A guard
  accepting the presence of the key rather than a `setup`-scoped
  `gather_subset` inside it passes dangerous code while appearing to
  implement the second accepted form. Fixture 7 covers this.
- **D4 — `ansible-lint`'s location was wrong** in the Inputs table below;
  corrected in place.

**What D1–D3 have in common:** this brief was written from
`ansible.cfg:21-48`, which is accurate and emphatic about the hazard, without
opening the playbook the guard must classify. **The hazard was verified and
the subject was not.** D2 generalises past Ansible — it is a fixture-design
failure mode, and the reason it is recorded in `SPRINT-CURRENT.md` too.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `ADR-0016` | this sprint | **accepted**; category-or-not decided. Expected "no category", so this ships as a portable script plus documented wiring |
| TASK-0027 | this sprint | **done**; recommends `ansible-lint` custom rule vs `pre-commit`, and reports whether `-r <dir> -R` loads a custom rule at all |
| SIGMA `ansible.cfg:21-48` | pre-existing, read-only | The hazard, the failed fixes, and the "unenforced" admission. **Read, never modified** |
| SIGMA `playbooks/*.yml` | pre-existing, read-only | Two playbooks, **both `gather_facts: false`** — verified 2026-09-16. `capture_pve_baseline.yml:21` targets **`hosts: sigsrvpve1`, a bare hostname** (D1); `:23` carries a `module_defaults:` block scoped to `group/community.proxmox.proxmox` with **no `ansible.builtin.setup` entry** (D3); `report_pve_baseline_drift.yml:28` targets `localhost` |
| SIGMA `inventory/production.yml` | pre-existing, read-only | Group structure: `pve_cluster` → `pve_voting` → `sigsrvpve1/2/3/7`, plus a second child holding `sigsrvpve4/6`; also `domain_controllers`, `network_devices`. **This file is now load-bearing for the guard** — resolving `sigsrvpve1` to PVE-class requires it (D1) |
| `tests/validate.sh` | TASK-0023 | **732 lines and ~1150 ms as of 2026-09-16** — the "474 lines, ~0.37 s" in this row was true when written and has decayed twice over. Still offline and hermetic; **no longer sub-second**, per `REVIEW-0008` finding 1. Do not add to it without measuring on `/mnt/c`, never on `/tmp` |
| `ansible-lint` 26.8.0 | pre-existing | **Corrected 2026-09-16 (D4): there is no venv in `SIGMA-infrastructure`.** The binary is `/home/armando.martires/.venvs/sigma-ansible/bin/ansible-lint` and is **not on `PATH`** — use the absolute path. Version confirmed by running it: `ansible-lint 26.8.0 using ansible-core 2.20.8`. Rules-dir support is **TASK-0027's job to verify**, not established here |

**Verify the expected state; don't assume it.** TASK-0027's recommendation
determines this task's implementation shape; do not begin against a free
choice. Re-read `ansible.cfg:21-48` — the guard's correctness depends on
the exact accepted forms, and there are two (play keyword and
`module_defaults`).

## Scope

### Included
- A static check: for any play whose `hosts` resolves to a PVE-class
  target, require **one of** `gather_facts: false`, `gather_subset:
  "!mounts"` as a play keyword, or an equivalent `module_defaults` entry
  scoped to the play.
- **Loud failure on ambiguity.** `hosts:` can be a pattern, a variable, a
  group-of-groups, or a comma list. When the guard cannot determine whether
  a play targets a PVE host, it must say so and fail rather than pass
  silently. A guard that quietly ignores what it cannot parse is the
  unfailable-check trap in a new costume.
- Configurable identification of "PVE-class" — a group name, a pattern, or
  a declared list — so the guard is portable rather than hardcoded to one
  estate's group names.
- **Host→group resolution (D1).** A play's `hosts:` value may be a **bare
  hostname** that belongs to a PVE-class group only by inventory membership;
  the estate's one real PVE playbook is exactly this case. The guard must
  therefore read an inventory and resolve membership transitively through
  nested `children:`, not string-match `hosts:` against group names. The
  inventory path must be a parameter — a guard hardcoding one repo's
  `inventory/production.yml` is not portable.
- **`module_defaults` must be matched by its `setup` entry, not by its key
  (D3).** The accepted form is a `gather_subset` under
  `ansible.builtin.setup` (or a `group/*` entry that demonstrably includes
  `setup`). A `module_defaults:` block scoped to something else — the real
  playbook has one for `group/community.proxmox.proxmox` — must **not**
  satisfy the requirement.
- Documented wiring for `pre-commit` and for `ansible-lint -r … -R`,
  whichever TASK-0027 recommends as primary.
- **Fixture proofs**, as deliverables, not as a step someone may skip.
  **Seven, not five** — 6 and 7 added 2026-09-16 for D2 and D3:
  1. A play gathering facts against a PVE **group** with no exclusion →
     guard **fails**, with the right message.
  2. A play with `gather_subset: "!mounts"` → guard **passes**.
  3. A play with the `module_defaults` form correctly scoped to
     `ansible.builtin.setup` → guard **passes** (the second accepted form; a
     guard that only recognises the first would reject correct code).
  4. A play with an ambiguous `hosts:` (variable or unresolvable pattern)
     → guard **fails loudly** as ambiguous, distinguishable from case 1.
  5. The two real playbooks (`gather_facts: false`) → guard **silent**.
     **This case proves nothing on its own** (D2) — it is satisfied equally
     by a correct guard and by one that classifies nothing. It is retained
     as a regression check against false positives, and is **not** evidence
     the guard works.
  6. **(D2 — the case that makes fixture 5 meaningful.)** A play targeting
     a PVE node by **bare hostname** (`hosts: sigsrvpve1`, resolved through
     the inventory) with `gather_facts: true` and no exclusion → guard
     **fails**. This is the estate's real shape. If 6 passes silently the
     guard is broken **and fixtures 1–5 would all still be green.**
  7. **(D3.)** A play with a `module_defaults:` block scoped to something
     other than `setup` — mirroring
     `capture_pve_baseline.yml`'s `group/community.proxmox.proxmox` — and
     `gather_facts: true` → guard **fails**. A guard that matches the
     `module_defaults` key rather than its `setup` entry passes this and is
     wrong in the dangerous direction.
- A statement in the guard's own source of what it does not prove.

### Not included
- **Installing the guard into `SIGMA-infrastructure`.** Option (a). The
  wiring is documented; adoption is that repo's sprint.
- Adding this to `tests/validate.sh`'s mandatory path unless it stays
  offline, hermetic and sub-second. It validates *other* repos' content, so
  it likely belongs as its own harness under `tests/`. Decide with
  evidence, and never at the cost of the gate's three properties.
- Reproducing the D-state hang. Not reproducible on demand; out of scope
  and stated as such.
- Detecting the hazard at runtime. Static only.
- A `hooks/` component category, unless ADR-0016 said yes.

## Likely files
- a guard script — location depends on TASK-0027's recommendation
  (`tests/`, or a `scripts/`-adjacent path, or a rule directory shipped
  inside `skills/ansible-ops/`)
- fixture files for the five proof cases
- `docs/development/authoring-guide.md` or `docs/operations/runbook.md` —
  the wiring instructions need one documented home
- `skills/ansible-ops/references/` — likely cross-reference
- `.ai/context/CURRENT_STATE.md`
- `docs/registry.md` **only** if the guard ships inside a component

## Execution plan
1. Read TASK-0027's recommendation and ADR-0016's decision. Fix the
   implementation shape before writing code.
2. Re-read `ansible.cfg:21-48` and enumerate every accepted form of the
   fix. Getting this wrong in either direction is a defect: a guard that
   misses a form blocks correct code; one that over-accepts passes
   dangerous code.
3. Decide how "PVE-class" is identified, and make it configurable. **This
   must include host→group resolution through nested `children:` (D1)**, not
   only group-name matching, or fixture 6 cannot pass.
4. Write the **seven** fixtures **first**. Fixtures before implementation
   makes it harder to write a check that happens to pass everything —
   **and write 6 before 5**, since 5 is the one that gives false comfort.
5. Implement the guard.
6. Run against all seven fixtures. Confirm: 1 fails, 2 passes, 3 passes,
   4 fails-as-ambiguous, 5 silent, **6 fails, 7 fails**. Record the actual
   output of each. **If 6 or 7 passes, the guard is broken in the dangerous
   direction regardless of the other five.**
7. Confirm case 1's and case 4's messages are **distinguishable** — an
   operator must be able to tell "you forgot the exclusion" from "I could
   not tell what this play targets."
8. Write the wiring documentation.
9. Add the "what this does not prove" statement to the guard's source.
10. `bash tests/validate.sh`. If the guard was added to the gate, time it
    and confirm the sub-second, offline, hermetic properties hold.
11. If the guard ships inside a component, `bash scripts/sync-registry.sh`.
12. Update `.ai/context/CURRENT_STATE.md`.

## Acceptance criteria
- [ ] The guard recognises **both** accepted fix forms (play keyword and
      `module_defaults`), demonstrated by fixtures 2 and 3
- [ ] Fixture 1 (facts gathered, no exclusion) **is observed failing**,
      with a message naming the play and the missing exclusion
- [ ] Fixture 4 (ambiguous `hosts:`) **is observed failing** as ambiguous,
      with a message distinguishable from fixture 1's
- [ ] Fixture 5 (the two real playbooks) produces **no** finding — recorded
      as a false-positive regression check, **not** as evidence the guard
      works (D2)
- [ ] **Fixture 6 (PVE node by bare hostname, `gather_facts: true`, no
      exclusion) is observed failing** — resolved through the inventory, not
      by group-name string match. **This is the criterion that proves the
      guard classifies the real estate** (D1, D2)
- [ ] **Fixture 7 (`module_defaults` scoped to a non-`setup` target) is
      observed failing** — the guard must not accept the key alone (D3)
- [ ] All **seven** results recorded verbatim in the execution log —
      observed, not asserted
- [ ] "PVE-class" identification is configurable, not hardcoded to one
      estate's group names, **and** the inventory path is a parameter rather
      than a hardcoded `inventory/production.yml`
- [ ] The guard's source states what it does not prove (a keyword's
      presence, not a node's safety)
- [ ] Wiring documented for the recommended mechanism, in a documented home
- [ ] If added to `tests/validate.sh`: still offline, hermetic, and
      sub-second — measured, not assumed
- [ ] **No file under `/home/armando.martires/SIGMA-infrastructure` is
      modified**

## Risks and rollback
- **Risk: authoring an unfailable check.** The named, repeated failure mode
  of this repo (lesson 8, **now three times** — this brief's own original
  fixture set was the third instance, found by `TASK-0052` before it ran).
  Mitigated by fixtures-first and by making the seven observed results
  acceptance criteria rather than steps. **The specific trap already sprung
  once here:** a fixture set can be complete-looking and still be blind to
  the estate's real shape, because every case shares one wrong assumption
  about how targets are identified.
- **Risk: the guard passes fixtures 1–5 and is still useless (D1/D2).** The
  original five fixtures were all satisfiable by a guard that resolves no
  hostnames at all. Fixture 6 is the only case that fails in that scenario,
  which is why it is an acceptance criterion and not a nice-to-have.
- **Risk: silent ambiguity.** `hosts: "{{ target_group }}"` cannot be
  resolved statically. If the guard passes such a play, it provides false
  assurance on exactly the plays most likely to be doing something unusual.
  Fixture 4 exists for this and is not optional.
- **Risk: over-strictness blocking correct code.** Rejecting the
  `module_defaults` form — which `ansible.cfg` explicitly endorses — would
  make the guard an obstacle and get it disabled. Fixture 3 exists for this.
- **Risk: weakening the commit gate.** Adding a check that reads other
  repos' files, or needs the network, would break the hermetic property
  three sprints of work depend on. Prefer a separate harness.
- **Risk: mistaking this for safety.** The guard prevents one documented
  mechanism of one hazard. It does not make running playbooks against a
  3-of-4-quorum cluster safe. Say so.
- **Risk: the group-name assumption.** `pve_cluster`/`pve_voting` are one
  estate's names and could change; that repo's own inventory comments
  record a previous three-way split that collapsed. Configurability is the
  mitigation.
- **Rollback:** a new script plus fixtures. `git revert`; if it was wired
  into `validate.sh`, confirm the gate is green after reverting.

## Outputs / handover

**Intended end state — this task has not run.** A plan, not a state. The
handover check detects omission rather than correctness (ADR-0012 Decision
3) and cannot tell the difference; this sentence does.

| Artifact | Intended end state |
|----------|-------------------|
| The guard script | Implements both accepted forms; resolves host→group membership from a parameterised inventory; fails loudly on ambiguity; states its own limits |
| Seven fixtures | Committed, each with its recorded observed result |
| Wiring documentation | `pre-commit` and/or `ansible-lint -r … -R`, in a documented home |
| `tests/validate.sh` | Either unchanged, or extended with the three properties measured and intact |
| `.ai/context/CURRENT_STATE.md` | Records the guard, and that it proves syntax rather than safety |
| `SIGMA-infrastructure` | **Untouched** — the guard is available to it, not installed in it |

**Next task starts here**: a documented-but-unenforced safety rule is now
mechanically checkable by any repo that wires it in. TASK-0032 records the
evidence trail — including that the repo which motivated this guard does
not yet run it, and why that was the right call.

Deviation to record: if the guard cannot distinguish fixture 1 from
fixture 4 in practice, that is a finding, not a formatting problem —
report it rather than merging the two messages. And if `ansible-lint`'s
rule API turns out not to support what TASK-0027 predicted, record the
gap rather than silently falling back.

**This brief was amended 2026-09-16 by `TASK-0052` (D1–D4).** Anyone who
read it before that has the old shape: group-name matching, five fixtures,
`module_defaults` matched by key, and a wrong `ansible-lint` path. If the
host→group resolution D1 requires turns out to be substantially more
machinery than a group-name match, **that is a finding for this task, not a
reason to restore the broken matcher.**

## Status
- Status: planned
- Owner: agent
- Created: 2026-09-14
- Updated: 2026-09-14

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
