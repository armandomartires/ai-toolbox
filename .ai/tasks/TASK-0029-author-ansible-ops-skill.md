# TASK-0029 — Author the `ansible-ops` skill

## Objective
Ship `skills/ansible-ops/`: the instruct layer the `ansible` MCP server has
never had. A portable invariant core (rules true in any Ansible estate)
plus `templates/` for the per-project facts that cannot be portable.

## Minimal context

### The gap this closes
MCP exposes capability; it does not teach workflow. An agent with the
`ansible` server can call `ansible_lint` and (until TASK-0026) execute a
playbook, but nothing tells it which inventory is safe, whether a change
preview is required, when approval is needed, or how to verify that a
reported change actually achieved the intended state. That is the whole
argument for a skill, and it is sound.

### The correction that shapes this skill
The human-supplied analysis proposed this required workflow:

```
ansible-lint
ansible-playbook --syntax-check
ansible-playbook --check --diff -l staging
ansible-playbook -l staging
verify state
request approval for production
```

**Two of those six steps cannot exist in the estate this was written for.**
`SIGMA-infrastructure` has exactly one inventory (`inventory/production.yml`,
wired at `ansible.cfg:8`) managing one 6-node PVE cluster at 3-of-4 quorum
with no verified margin, plus a single domain controller holding all seven
FSMO roles. There is no staging inventory and no plausible way to build
one — `ci.yml:3-10` records the deliberate corollary that CI has no route
to the estate and no credentials.

So the skill's graduated workflow is **`--check --diff` plus snapshot and
rollback**, which is already that repo's `AGENTS.md` "Change safety"
section: take a snapshot, verify the change, delete the snapshot if it
succeeded, roll back if it failed — after first checking that a snapshot is
even possible, because "a snapshot is only a rollback path if the platform
can actually take one."

Writing this skill from the source text would have produced a runbook
gating on an inventory that does not exist. Recording that here because the
next person to read the source analysis will be tempted the same way.

### A second correction: `--check` is not proof
`community.proxmox.proxmox_storage` 2.0.0 (the newest on Galaxy) has **no
field-level drift detection for any storage type**: check-mode confirms a
storage *name* exists and never compares declared config against live
values, and there is no `update` path at all. A playbook using it reports
"already present, zero changes" regardless of whether the declaration is
correct — false confidence, not a parity proof. That repo's `S001.T006` is
blocked on exactly this, having read the installed module source before
writing a playbook.

The skill must therefore say that a clean `--check` is evidence only to the
extent that the modules involved actually implement check-mode meaningfully
— and that verifying this requires reading the module, not trusting the
exit code. This generalises the standing lesson: `changed=1` does not mean
the desired state was reached, and `changed=0` does not mean it already
was.

### Where the per-project boundary falls
The highest-value content in the source analysis is explicitly
per-project — "**your** repository layout, **your** conventions". But this
repo ships portable components and holds no Ansible content of its own, and
Option (a) forbids writing into the consuming repo. Resolution (ADR-0015):
a portable invariant core in `SKILL.md`, plus `templates/` that a consuming
repo fills in. This is exactly the pattern `skills/project-workflow/`
already uses — `SKILL.md` plus `templates/` the consumer scaffolds from.

### What this skill must not become
ADR-0013 records that the two shipped skills scaffold two *deliberately
different* governance frameworks, and that they must not be "aligned".
`ansible-ops` is **operational, not governance**. It must not grow a
`.ai/`-shaped opinion, a task-file convention, or a third framework.

### No invented size budget
ADR-0008 and `docs/development/authoring-guide.md:17-21` are explicit: no
line or byte budget for `SKILL.md` is defined anywhere, and inventing one
would make the gate the author of a requirement rather than its enforcer.
Keep `SKILL.md` lean by judgment, push detail to `references/`, and **do
not** state a budget in the file. To add one, define it in the authoring
guide first, in bytes, with a rationale.

## Inputs

> **WAIVED, and the task ran anyway — read this before trusting the first
> two rows.** Added 2026-09-16 by `REVIEW-0008` finding 8b.
>
> This table's **"Expected state"** column is what the task expected, not
> what it got. The `ADR-0014`/`ADR-0015` rows below say **accepted**; both
> are still **`proposed`**, and both still are today.
>
> The task was executed regardless, by **human decision (Option 2,
> 2026-09-15)**: the components were built from `PLAN-0003`'s recorded F1–F7
> evidence instead of from ratified ADRs. The binding consequence was that
> the design could make **no claim resting on an observed lint result**,
> because `TASK-0027` is unrun.
>
> **The waiver lived only in `.ai/context/CURRENT_STATE.md`** until this
> note, so a cold reader of this file saw `done` above an unmet precondition
> with nothing explaining it — a hole in the ADR-0012 invariant that a task
> be startable cold from its own file. Step 1 of the Plan below ("Confirm
> ADR-0014 and ADR-0015 are accepted") was therefore **never satisfiable**
> as written; it is left unedited as the record of what was expected.
>
> Also corrected by REVIEW-0008: ADR-0015's *intended* clause 1 (a consuming
> repo fills a shipped `templates/` with estate facts) is **refuted** — a
> deployed skill is a symlink into this repo (`install.sh:105`). What shipped
> is a copy-out per-change record holding no estate facts, so `templates/`
> itself survives; only that clause's mechanism does not.

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `ADR-0015` | this sprint | **accepted**; records portable-core-plus-templates and check+snapshot-not-staging — **NOT MET: still `proposed`, waived by Option 2, and its intended clause 1 is refuted** |
| `ADR-0014` | this sprint | **accepted**; records the accepted MCP surface, so the skill does not reference absent tools — **NOT MET: still `proposed`, waived by Option 2** |
| TASK-0026 | this sprint | **done**; `ansible_navigator` disabled, so the skill's "identify inventory and limit" invariant does not contradict an enabled tool lacking those parameters — **NOT MET: still `planned`** (B-013 stays open) |
| TASK-0027 | this sprint | **done**; observed lint behaviour under `profile: production`, so lint claims rest on evidence — **NOT MET: still `planned`**, which is why the shipped skill may make no claim resting on an observed lint result |
| `skills/_template/` | pre-existing | `SKILL.md` + `assets/`, `references/`, `scripts/` — the shape to copy from |
| `skills/project-workflow/` | TASK-0003, TASK-0020…0022 | `metadata.version: 3.2.0`; the `SKILL.md`-plus-`templates/` pattern to mirror |
| `docs/development/authoring-guide.md` | pre-existing | `:8-15` frontmatter rules; `:17-21` no size budget; `:4` no README.md inside skill folders |
| `tests/validate.sh` | TASK-0012, TASK-0023 | `:21-106` skill frontmatter checks: delimiters, name==directory, single-line description, non-empty license, semver |
| `PLAN-0003` findings F1–F5 | this session | Written; F1 (no staging), F5 (2-of-7 surface) bind this skill's content directly |
| `AGENTS.md` (SIGMA), `ansible.cfg` (SIGMA) | pre-existing, read-only | The evidence for the invariants. **Read, never modified** |

**Verify the expected state; don't assume it.** Both ADRs must be accepted
before this starts — writing the skill against a proposed decision is how a
component ends up encoding a shape that then changes. Re-read
`authoring-guide.md:8-15` rather than trusting this table's summary of it.

## Scope

### Included
- `skills/ansible-ops/SKILL.md` with compliant frontmatter: `name:
  ansible-ops` (must equal the directory), single-line `description`,
  `license: MIT`, `metadata.author`, `metadata.version: 1.0.0`.
- The portable invariant core. Derived from the source analysis's seven
  rules, corrected by the findings:
  1. Identify the inventory and the limit before any execution; never rely
     on a default inventory being the intended one.
  2. Lint and syntax-check before applying new content.
  3. Use `--check --diff` where supported — **and establish that the
     modules involved implement check-mode meaningfully** before treating a
     clean result as evidence.
  4. Snapshot before a change where the platform supports it; verify the
     snapshot is actually possible first; verify the change; then delete
     the snapshot. A snapshot is not a backup.
  5. Prefer idempotent modules over `shell`, `command`, or `raw`.
  6. After execution, verify the intended state **by an independent
     method**. `changed=1` is not proof.
  7. Never print, log, or commit secrets — noting that a
     `vault_password_file` makes decryption transparent and invisible, and
     that a configured `log_path` is a real leak surface.
- `templates/` for per-project facts: inventory names and which (if any) is
  non-production; escalation model; module preferences and forbidden
  patterns; the snapshot/rollback procedure for the platform in use;
  fact-gathering hazards; which changes require human approval.
- `references/` for the detail that would bloat `SKILL.md`.
- Registry regenerated so the skill appears in `docs/registry.md`.

### Not included
- **Any per-project content for a specific estate.** No node names, IPs,
  cluster facts, or credentials. The templates are blank forms; filling one
  in is the consuming repo's work.
- Deploying to a consuming repo. Option (a).
- The loop (TASK-0030) or the guard (TASK-0031).
- Any hook or client configuration.
- A size budget in `SKILL.md`.
- A README.md inside the skill folder — forbidden by
  `authoring-guide.md:4`.

## Likely files
- `skills/ansible-ops/SKILL.md`
- `skills/ansible-ops/templates/` — several files, count decided while
  writing rather than pre-committed here
- `skills/ansible-ops/references/` — likewise
- `docs/registry.md` (generated — **must be regenerated, not hand-edited**)
- `.ai/context/CURRENT_STATE.md`
- possibly `docs/development/authoring-guide.md`, **only** if authoring this
  skill reveals a genuine gap in the guide. Not a licence to add a budget

## Execution plan
1. Confirm ADR-0014 and ADR-0015 are accepted, and TASK-0026/0027 done.
   Stop if any is not — this task is scoped against their outcomes.
2. Re-read `authoring-guide.md:8-15` and `validate.sh:21-106`. Write the
   frontmatter to the rules as they actually are.
3. Copy the shape from `skills/_template/`; drop the parts that do not
   apply. Do not carry `assets/` across unless something needs it.
4. Draft `SKILL.md`: purpose, when to invoke, the invariant core, pointers
   to `templates/` and `references/`. Lean by judgment.
5. Draft `templates/` as blank forms with guidance comments, mirroring how
   `skills/project-workflow/templates/` reads.
6. Draft `references/` for the detail: the check-mode caveat with the
   `proxmox_storage` example, secret-handling specifics, the
   fact-gathering hazard class, why staging may not exist.
7. `bash tests/validate.sh`; confirm OK.
8. **Prove the frontmatter checks bite against this new skill**: break
   `name` so it no longer equals the directory, confirm the specific
   failure, restore. Then break `description` into two lines, confirm,
   restore. A check never seen to fail on *this* file has not been
   validated for it.
9. `bash scripts/sync-registry.sh`; confirm exactly one new Skills row,
   correctly escaped, no `_template` row.
10. Update `.ai/context/CURRENT_STATE.md`.

## Acceptance criteria
- [ ] `skills/ansible-ops/SKILL.md` exists and passes every frontmatter
      rule in `authoring-guide.md:8-15`
- [ ] `name` equals the directory name; `description` is a single line;
      `metadata.version` is `1.0.0` and valid semver
- [ ] **No size budget is stated** anywhere in the skill
- [ ] No `README.md` inside the skill folder
- [ ] The invariant core contains all seven rules, with the staging
      correction and the check-mode caveat present and explained
- [ ] `templates/` contains **no** estate-specific facts — verified by
      reading, not by intent
- [ ] The frontmatter checks were **observed failing** against this skill's
      own file (name mismatch and multi-line description), then restored
- [ ] `docs/registry.md` regenerated with exactly one new row
- [ ] `tests/validate.sh` OK
- [ ] `SIGMA-infrastructure` untouched

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — **required here**

## Risks and rollback
- **Risk: writing a generic Ansible tutorial.** The value is in the
  invariants and the corrections, not in restating upstream documentation.
  If a sentence would be equally true in any blog post, it probably belongs
  in `references/` or nowhere.
- **Risk: leaking estate facts into a portable component.** A node name or
  IP in `templates/` would make the skill non-portable *and* publish
  infrastructure detail. Read the diff specifically for this.
- **Risk: becoming a third governance framework.** ADR-0013. Operational
  content only.
- **Risk: encoding the unverified.** Every claim about Ansible behaviour
  should be traceable to something read — a module's source, a config file,
  a documented finding — not to plausibility. F1–F5 are all traceable;
  new claims added while drafting may not be.
- **Risk: the skill is never executed** (the sprint's stated limitation).
  Do not compensate by writing more confidently. If something is untested,
  the skill should say so.
- **Rollback:** new directory plus a regenerated registry. `git revert`,
  then re-run `sync-registry.sh`.

## Outputs / handover

**Intended end state — this task has not run.** A plan, not a state.
`validate.sh:402` requires this section non-empty for briefs ≥ 0020 and
detects omission rather than correctness (ADR-0012 Decision 3), so it
cannot distinguish the two; this sentence does.

| Artifact | Intended end state |
|----------|-------------------|
| `skills/ansible-ops/SKILL.md` | Compliant frontmatter, `version: 1.0.0`, invariant core, no size budget |
| `skills/ansible-ops/templates/` | Blank per-project forms, zero estate facts |
| `skills/ansible-ops/references/` | The check-mode caveat, secret handling, fact-gathering hazards, the no-staging case |
| `docs/registry.md` | Regenerated; one new Skills row |
| `.ai/context/CURRENT_STATE.md` | Records a third live skill and the unexercised limitation |
| `SIGMA-infrastructure` | **Untouched** |

**Next task starts here**: the skill's vocabulary exists, so TASK-0030 can
write `loops/ansible-change/` referencing its invariants by name instead of
restating them — the `release-check` pattern, where the loop owns the
sequence and links the rules rather than duplicating them.

Deviation to record: if the invariant core ends up with more or fewer than
seven rules, say which and why. TASK-0030 and TASK-0032 are both scoped
against seven, and S5 saw a four-section merge become three once the files
were measured.

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

`skills/ansible-ops/` exists and was produced **through** S7's two new loops
rather than by executing this brief directly — that was the point of the
pilot (S7 decision 3: the loops are exercised by producing real,
already-scoped components).

**What shipped:** `SKILL.md`, `references/derivation.md`,
`references/hazards.md`, `references/check-mode-fidelity.md`,
`templates/change-record.md`, `scripts/check-change-record.sh`, and
`fixtures/{complete,incomplete}-record.md`.

**Two things this brief planned that the pilot decided differently, on
evidence — read these before citing this brief again:**

1. **The core-plus-`templates/` shape (ADR-0015's intended clause 1) was
   rejected.** It was carried into the design as an *assumed* constraint, and
   the design loop's critique found (severe, verified) that `install.sh`
   deploys skills with `ln -sfn` — so a deployed skill is a symlink into this
   repo's working tree, and an operator filling in a shipped
   `estate-profile.md` would write one estate's production facts into the
   portable component. The shipped design **derives per-estate facts and
   persists none**. **ADR-0015 must be rewritten before ratification**, not
   merely cited.
   **Corrected 2026-09-16 by `REVIEW-0008` (the finding stands; two words in
   it do not):** *"rewritten"* is wrong — ADR-0015 has **no body to
   rewrite**, since all three of its sections say *"to be written"* and its
   dependency `TASK-0027` is `planned`. It must be **written**, spike first.
   And the rejection is of clause 1's *mechanism* — a consumer filling a
   template with **estate facts** — not of `templates/` itself: what shipped
   is `templates/change-record.md`, a per-change record holding no estate
   facts, which says *"Copy this file to wherever your estate keeps
   records."*
2. **No claim rests on an observed lint result.** `TASK-0027` is still unrun
   (human decision: Option 2), so `lint_run` records only *that* lint ran.

**Not delivered:** the `gather_subset` guard. B-011 and TASK-0031 stay open,
and the shipped skill states plainly that it ships no enforcement rather than
implying coverage.

- Validation: `tests/validate.sh` green; `scripts/sync-registry.sh`
  regenerated and `ansible-ops` appears in `docs/registry.md`
- Result: **delivered as a by-product of TASK-0046**
- Commit: recorded in TASK-0046's log
- Push: awaited human authorization, per ADR-0019 clause 2.2
