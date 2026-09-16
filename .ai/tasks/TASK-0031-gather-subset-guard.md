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
- [x] The guard recognises **both** accepted fix forms (play keyword and
      `module_defaults`), demonstrated by fixtures 2 and 3
- [x] Fixture 1 (facts gathered, no exclusion) **is observed failing**,
      with a message naming the play and the missing exclusion
- [x] Fixture 4 (ambiguous `hosts:`) **is observed failing** as ambiguous,
      with a message distinguishable from fixture 1's
- [x] Fixture 5 (the two real playbooks) produces **no** finding — recorded
      as a false-positive regression check, **not** as evidence the guard
      works (D2)
- [x] **Fixture 6 (PVE node by bare hostname, `gather_facts: true`, no
      exclusion) is observed failing** — resolved through the inventory, not
      by group-name string match. **This is the criterion that proves the
      guard classifies the real estate** (D1, D2)
- [x] **Fixture 7 (`module_defaults` scoped to a non-`setup` target) is
      observed failing** — the guard must not accept the key alone (D3)
- [x] All **seven** results recorded verbatim in the execution log —
      observed, not asserted
- [x] "PVE-class" identification is configurable, not hardcoded to one
      estate's group names, **and** the inventory path is a parameter rather
      than a hardcoded `inventory/production.yml`
- [x] The guard's source states what it does not prove (a keyword's
      presence, not a node's safety)
- [x] Wiring documented for the recommended mechanism, in a documented home
- [x] **Not** added to `tests/validate.sh` — it stays offline, hermetic, and
      sub-second — measured, not assumed
- [x] **No file under `/home/armando.martires/SIGMA-infrastructure` is
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

**This section describes a verified state.** The task has run.

| Artifact | End state |
|----------|-----------|
| `skills/ansible-ops/scripts/gather_subset_guard.py` | The rule (`gather-subset-mounts`). Both accepted forms; `module_defaults` matched by its **`setup` entry**, not by the key; host→group resolution through nested `children:` from a parameterised inventory; ambiguity fails loudly with a distinct message; four limits stated in its own docstring |
| `skills/ansible-ops/fixtures/gather-subset/` | **Seven fixtures + a fixture inventory**, written *before* the implementation. Each carries its expected verdict and why it exists; 5a carries the D2 caveat that it proves nothing alone |
| `tests/gather-subset-guard.sh` | The **fires-proof**: 10 checks, PASS/FAIL/**SKIP**, including a negative control that reproduces the `enable_list` silent-no-op trap. Manual; **not** wired into the gate |
| `docs/operations/runbook.md` | Wiring procedure — copy, `enable_list` (**mandatory**), env-var configuration, prove-it-fires, and what it does/does not prove |
| `skills/ansible-ops/references/hazards.md` | *"Ships NO enforcement… no linting rule"* was **true when written and false once the guard landed**; replaced, with the supersession visible and four limits attached |
| `tests/validate.sh` | **Unchanged.** Measured anyway: 1111/1108/1073 ms on `/mnt/c` vs `~1150 ms` before, so the gate is untouched by this task |
| `docs/registry.md` | **Unchanged** — no new component; the guard ships inside an existing skill |
| `SIGMA-infrastructure` | **Untouched.** Read as evidence, mutated only in a `/tmp` copy. `git status` empty, `HEAD` `d4e2dd1`, `[ahead 42]`, playbook still `gather_facts: false` |

**Deviations from the Execution plan, recorded:**

1. **`TASK-0027`'s "declarative wiring" recommendation was WRONG and had to be
   replaced.** Per-rule config under `rules:` in `.ansible-lint` is a **fatal**
   error for a custom rule (`additionalProperties: false`, exit 3, nothing
   linted), so `get_config()` is unreachable by any legal config. Configuration
   is by environment variable, and the loss of reviewability is recorded rather
   than hidden. `enable_list` remains legal, so *enabling* is still
   declarative.
2. **Fixture 4 had to be rewritten** — `hosts: "{{ undefined }}"` never reaches
   this rule, because the unskippable `syntax-check` fails the file first. Now
   a wildcard pattern. **The ambiguity branch was unreachable by the case it
   was written for**, which a passing suite would not have revealed.
3. **My harness had the defect it was built to prevent.** Matching on the rule
   ID rather than its messages reported *"fired but wrong message"* for four
   fixtures while the rule had not run at all — the ID appears in
   `ansible-lint`'s own error text. A `config_ok` pre-flight now aborts if the
   config is rejected.
4. **The decisive evidence is outside the fixture set**: the real playbook, in
   a copy, flipped to `gather_facts: true`, producing `MISSING EXCLUSION`
   naming `sigsrvpve1` resolved through the real inventory. Fixture 5's silence
   only means something because of that run.
5. **This brief has no `## Mandatory validations` section**, unlike its
   siblings; `validate.sh` does not require one, so its absence is invisible to
   the gate. Both validations were run and are recorded under Validation.

**Next task starts here**: `B-011` is closeable — a documented-but-unenforced
safety rule is now mechanically checkable, with a fires-proof, by any repo that
wires it in. **`TASK-0032`** records the target-repo evidence trail, including
that the repo which motivated the guard **does not run it**, and why that was
the right call under Option (a).

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
- Status: done
- Owner: agent
- Created: 2026-09-14
- Updated: 2026-09-16

## Execution log
### Attempt 1
- Date: 2026-09-16
- Agent: opencode (claude-opus-5)
- Actions: Re-read `ansible.cfg:21-48` and enumerated both accepted fix forms.
  Wrote the **seven fixtures plus a fixture inventory first**, before any
  implementation. Implemented the rule against the **installed** API. Wrote
  `tests/gather-subset-guard.sh` as the fires-proof, ran it, **found two real
  defects and one wrong fixture**, fixed all three, re-ran to 10/10. Verified
  the guard against the real estate's playbooks read-only, both silent and
  firing. Corrected a now-false claim in the shipped skill. Documented wiring.

- Observations:

  **1. All seven fixtures produce their expected verdict, plus three
  harness-level checks — 10 of 10.** Verbatim final run:

  ```
  Fixtures that MUST fire:
    PASS  f1-group-no-exclusion.yml -> fired, hazard group, no exclusion
    PASS  f4-ambiguous-hosts.yml -> fired, unresolvable wildcard pattern, reported as ambiguous
    PASS  f6-bare-hostname-no-exclusion.yml -> fired, BARE HOSTNAME resolved through inventory (D1/D2)
    PASS  f7-module-defaults-wrong-scope.yml -> fired, module_defaults scoped to a non-setup target (D3)

  Fixtures that MUST stay silent:
    PASS  f2-play-keyword-exclusion.yml -> silent, play-keyword exclusion accepted
    PASS  f3-module-defaults-exclusion.yml -> silent, module_defaults scoped to setup accepted
    PASS  f5a-facts-disabled-bare-host.yml -> silent, gather_facts: false on a hazard host
    PASS  f5b-localhost-facts-enabled.yml -> silent, localhost with facts is not hazard-class

  Message distinguishability (fixture 1 vs fixture 4):
    PASS  the two findings do not share a message

  Negative control -- rule NOT enabled (must go silent):
    PASS  silent without enable_list -- the trap is real and reproduced,
          which is why enable_list is a wiring REQUIREMENT not advice

  gather-subset-guard: PASS (10 checks)
  ```

  **2. THE DECISIVE PROOF is not in the fixtures — it is the real playbook,
  mutated in a copy.** Fixture 5's inadequacy (D2) was that silence proves
  nothing. So the guard was run against `SIGMA-infrastructure`'s **actual**
  `playbooks/` and `inventory/production.yml` in a `/tmp` copy: **silent**, as
  required. Then `capture_pve_baseline.yml`'s `gather_facts: false` was flipped
  to `true` **in that copy only**, and the guard produced:

  ```
  gather-subset-mounts: MISSING EXCLUSION: this play gathers facts against
  hazard-class target 'sigsrvpve1' without excluding `mounts`.
  playbooks/capture_pve_baseline.yml:20:3
  ```

  It resolved the **real** bare hostname through the **real** nested inventory
  (`pve_cluster` → `pve_voting` → `sigsrvpve1`). **That is what makes the
  silence on the unmodified playbook meaningful rather than inert** — the
  precise gap `TASK-0052` D1/D2 identified. `SIGMA-infrastructure` itself was
  never written to; verified after (`git status` empty, `HEAD` `d4e2dd1`,
  `[ahead 42]`, and its playbook still `gather_facts: false`).

  **3. DEFECT FOUND — per-rule configuration in `.ansible-lint` is
  IMPOSSIBLE for a custom rule, and `TASK-0027`'s recommendation was wrong
  about it.** The rule was first written to read
  `hazard_groups`/`inventory` via `get_config()`, and the harness configured
  them under `rules:` — the form `TASK-0027` called the "declarative wiring
  tiebreaker". It is **rejected**:

  ```
  Invalid configuration file .../.ansible-lint.
  $.rules['gather-subset-mounts'] Additional properties are not allowed
  ('hazard_groups' was unexpected).
  ```

  **Exit 3, nothing linted.** The config schema's `$defs.rule` sets
  `additionalProperties: false` and permits exactly one key, `exclude_paths`.
  So `AnsibleLintRule.get_config()` exists, reads `options.rules[<id>]`, and
  **the schema forbids ever populating it** — an API reachable only by an
  illegal config. Switched to environment variables
  (`GATHER_SUBSET_GUARD_HAZARD_GROUPS`, `GATHER_SUBSET_GUARD_INVENTORY`).
  `enable_list` **is** a legal top-level key, so *enabling* stays declarative;
  only *configuring* cannot be. **Recorded as a downgrade, not smoothed over:**
  rule configuration now lives outside the committed lint config and is not
  reviewable alongside it. That is upstream's constraint.

  **4. DEFECT FOUND IN MY OWN HARNESS — it matched the rule ID, which appears
  in `ansible-lint`'s error output too.** With the broken config above, every
  fixture "failed" — but the four fire-cases were reported as *"fired but
  WRONG MESSAGE"* rather than *"did not fire"*, because
  `$.rules['gather-subset-mounts']` in the **error text** matched an ID-only
  grep. **A careless reading would have concluded the rule fires and merely
  words things badly, when it had not run at all.** Fixed to match on the
  rule's own messages (`MISSING EXCLUSION`, `AMBIGUOUS TARGET`), and a
  `config_ok` pre-flight now aborts if `ansible-lint` rejects the config, so
  the harness cannot silently test nothing. **This is TASK-0042's lesson
  arriving in a new place: match on the check's own message, never on a string
  that also appears in unrelated output.**

  **5. Fixture 4 was the WRONG FIXTURE, and the reason is the guard's
  ceiling.** As written it used `hosts: "{{ target_group }}"`, the obvious
  ambiguous case. The guard never saw it: `ansible-lint` runs `syntax-check`
  first, it is **unskippable** (*"Rule 'syntax-check' is unskippable, you
  cannot use it in 'skip_list' or 'warn_list'"*), and it fails the file with
  `Error processing keyword 'hosts': 'target_group' is undefined`. The play is
  still caught — by a different rule, with a different message — but **not by
  this guard.** Changed the fixture to a **wildcard pattern**
  (`hosts: "fixturepve*"`), which is syntactically valid and still not
  statically resolvable; the ambiguity branch then fires with its distinct
  message. Recorded in the fixture, the rule, the runbook and `hazards.md`
  rather than worked around. **A branch that cannot be reached by the case it
  was written for is not proven by a passing suite.**

  **6. A shipped false claim was created by this task and corrected in the
  same change.** `references/hazards.md` said *"This repository ships NO
  enforcement of any hazard class… no guard, no hook, no wrapper, no linting
  rule"*. True when written; **false the moment the guard landed** — the
  self-describing-artifact class `TASK-0046` diagnosed. Replaced with what is
  now true (class 1 has an available guard; classes 2–6 do not), with the
  supersession visible rather than overwritten, and with four verified limits
  attached.

  **7. The guard's silence is discriminating in three separate ways**, which
  is what stops it being an unfailable check: it stays silent on
  `gather_facts: false` (5a), on a non-hazard target that *does* gather facts
  (5b — deliberately stronger than the real playbook it mirrors), and on both
  accepted exclusion forms (2, 3) — while firing on the same host when the
  exclusion is absent (6). Fixture 5b matters most of those: a guard treating
  "cannot confirm safe" as "hazardous" would fire on every `localhost` play in
  every repo that wired it in, and be disabled within a week.

  **8. The mandatory gate is unaffected, measured rather than assumed.**
  `tests/validate.sh` runs **1111 / 1108 / 1073 ms** on `/mnt/c` (9p) after
  this change, against `~1150 ms` recorded by `REVIEW-0008` before it. The
  guard and its harness are **outside** the gate, so the sub-second question is
  untouched by this task. Measured on `/mnt/c` deliberately — timing it on
  `/tmp` (ext4) understates by ~40% and would have compared filesystems, not
  changes (`REVIEW-0008` finding 1).

- Validation: `bash tests/gather-subset-guard.sh` → **`PASS (10 checks)`**,
  including a negative control proving the `enable_list` trap reproduces.
  `bash tests/validate.sh` → **`validate.sh: OK`** throughout.
  `bash scripts/sync-registry.sh` → **no diff** (the guard ships inside an
  existing skill; no new component, and `description` unchanged).
  **`SIGMA-infrastructure` untouched**: `git status` empty before and after,
  `HEAD` `d4e2dd1`, `[ahead 42]`, and `capture_pve_baseline.yml` still
  `gather_facts: false` — every mutation was in a `/tmp/opencode/` copy.
- Result: **Done.** A rule that was written down in another repository's
  `ansible.cfg` as *"Tracked as unenforced until then"* is now mechanically
  checkable by any repo that wires it in, with its own fires-proof, and with
  its four limits stated in the artifact rather than only in this log.
- Commit: `ba59062` — one logical change: the rule, seven fixtures plus a
  fixture inventory, the fires-proof harness, the wiring procedure, the
  hazards.md correction, and the governance updates closing B-011. The
  pre-commit hook ran the gate and passed.
- Push: **confirmed.** `a969867..ba59062 master -> master`, verified by
  `git fetch` + `git log origin/master` showing `ba59062` at the tip.
