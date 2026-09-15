---
# The three lock fields. Left empty by step 4; filled by step 7 of
# loops/design-brief/ on acceptance only, then committed by git-ops.
# The COMMIT is the lock, not these fields.
status: accepted
accepted_by: armando.martires
accepted_on: 2026-09-15
---

# Design brief — `ansible-ops` skill and `ansible-change` loop

Produced by `loops/design-brief/` (TASK-0046, the S7 pilot). One brief
covering both components, because the skill settles the vocabulary the loop
references.

**Provenance:** step 2 generated four candidates via the `ideator`; step 3
critiqued all four via the read-only `critic`, returning **35 findings**;
this brief is step 4's proposal. Selection is recorded with reasons, and the
rejected alternatives are named so they are not re-proposed.

## Problem

An agent asked to change Ansible content in a real estate has **capability
without discipline**. The pinned `ansible` MCP server exposes ten tools, of
which the two relevant ones are a linter and a playbook executor; the
executor can run against live production but **cannot express inventory,
limit, `--check` or `--diff`** (F5, re-verified 2026-09-15 from the live tool
schema). There is no instruct layer stating what a safe change sequence is,
so the safe sequence is whatever the agent infers in the moment.

The concrete instance, read from a real file: an estate's `ansible.cfg`
documents a fact-gathering hazard that can hang a node in **uninterruptible
D-state** (default fact gathering collects `ansible_mounts`, which stats
`/etc/pve`; on a node with wedged pmxcfs that stat cannot be killed, not even
by `timeout`), records that the intended global fix **does not work**
(`gather_subset` is rejected as an unknown `[defaults]` key and silently
ignored in group_vars — it is a play keyword and per-module argument only,
with no global mechanism in ansible-core 2.20.8), and closes with
**"Tracked as unenforced until then."** Re-verified verbatim 2026-09-15.

Stated as the problem this design solves: **the knowledge required to change
Ansible content safely exists only as prose in one estate's config files and
in operators' heads, so it cannot be reliably reproduced by an agent or a new
operator, and nothing detects when a step is skipped.**

**Not** the problem: that the MCP server is missing five of seven
recommended capabilities. That was measured and accepted (ADR-0014's intended
shape).

## Constraints

Carried from step 1, human-confirmed. **Hard** = a real requirement;
**assumed** = nobody confirmed it, and ideation was free to challenge it.

| # | Constraint | Hard or assumed | Source |
|---|---|---|---|
| C1 | Ships as portable components in `ai-toolbox`; **no writes to any consuming repo** | **hard** | PLAN-0003 decision 5 (Option a) |
| C2 | `SIGMA-infrastructure` read as evidence, never modified; unpushed commits untouched | **hard** | S6 decision 3; S7 standing constraints |
| C3 | **No playbook run in any mode, including `--check`** | **hard** | TASK-0046 scope |
| C4 | `SKILL.md` passes every ADR-0003 frontmatter rule | **hard** | ADR-0003; `tests/validate.sh` |
| C5 | **No size budget invented** for any file | **hard** | ADR-0008 |
| C6 | `loop.md` carries `## Trigger`, `## Steps`, `## Exit conditions`, bounded retries, escalate-without-retry for destructive actions | **hard** | `validate.sh:196-213`; `loops/release-check/` precedent |
| C7 | Operational only — **must not become a third governance framework** | **hard** | ADR-0013 |
| C8 | **No claim may rest on an observed lint result** | **hard** | TASK-0046 step-3 decision (Option 2) |
| C9 | The graduated workflow is `--check --diff` + snapshot and rollback, **not staging promotion** | **hard** | F1 |
| C10 | Portable invariant core + per-project `templates/` | **assumed** | ADR-0015 intended clause 1 — ADR is `proposed` |
| C11 | The skill settles vocabulary the loop references | **assumed** | PLAN-0003 Phase 2 ordering |
| C12 | A clean `--check` is not proof; check-mode may be meaningless per module | **hard** | ADR-0015 context (`proxmox_storage` 2.0.0) |
| C13 | Both components usable by an estate that is not SIGMA | **hard** | C1; `AGENTS.md` portability requirement |

**C10 was and remains `assumed`.** The step-3 critique found that step 1's
original success criteria re-imported it as a hard *measurement*; those
criteria were rewritten (below) rather than the constraint promoted.

## Out of scope

- **The `gather_subset` guard implementation** (S6 TASK-0031). **B-011 stays
  open.** This design *names* the hazard; it ships no execution-time
  enforcement of it.
- S6 TASK-0026 (blast-radius correction, `navigator` disablement) — unrun;
  these components are authored knowing the wiring is uncorrected.
- A Python MCP server (ADR-0010 stays closed).
- Any hooks / `pre-commit` component category (ADR-0016, unrun TASK-0028).
- Fixing the four stale claims in the target repo (F3) — recorded, fixed
  nowhere.
- Ratifying ADR-0014 / ADR-0015. **Explicitly still owing.**
- **Candidate 4's generated per-estate runbook** — declined on C1 (below).

## How success is recognised

**Criteria 1 and 3 were rewritten 2026-09-15** on the critique's most
consequential finding (§5.7): as originally worded they presupposed a
hand-filled `templates/` set, which is C10's commitment — so they measured
candidate 1 with a test shaped like candidate 1 and scored candidate 2 as
failing where it is strongest. Criteria 2 and 4 were examined by the critic
and found sound; they are unchanged.

1. An operator or agent handed `skills/ansible-ops/` can state the safe
   change sequence and why each gate exists **without having read
   `SIGMA-infrastructure` specifically** — the portable knowledge is
   self-contained, regardless of how per-estate facts reach the reader.
2. `loops/ansible-change/loop.md`'s exit conditions name a specific
   condition under which the loop **stops rather than retries**, derived
   from a real hazard (F2), not invented.
3. An estate fact the design does not know is **visibly unknown and stops
   the loop, never silently defaulted** — whatever mechanism supplies it.
4. `tests/validate.sh` green; registry regenerated.

## Chosen approach

**Candidate 2 (derived, persisted nowhere) as the C10 answer, composed with
candidate 3 (enforced change record) as the enforcement layer.**

The critique established that candidate 3 **composes with** 1 or 2 rather
than competing, so step 4 is two decisions, not one.

### The load-bearing commitments

Two, one from each parent:

1. **No estate-specific fact is declared or persisted anywhere** (from
   candidate 2). The profile is *derived* by a read-only probe the loop runs
   at the start of every change. A derived value **cannot contradict** the
   thing it is derived from, so there is no per-estate artifact to drift —
   the F3 decay class is designed out rather than mitigated.
2. **Omission is enforced, not documented** (from candidate 3). Every change
   emits a change record whose schema this repo owns, and a shipped checker
   exits non-zero naming a field that is missing or `unknown`. A skipped gate
   is a machine-detected absence, not a rule someone was asked to follow.

### Why derived over declared

The critique's finding **1.2 (severe, verified)** decided this. Candidate 1's
cited precedent is **structurally inverted in deployment**: `install.sh`
defaults to `MODE="link"` and deploys with `ln -sfn`, so
`~/.claude/skills/ansible-ops/` is a **symlink into this repo's working
tree**. An operator filling in `templates/estate-profile.md` where they find
it would write one estate's production facts **into this repo's portable
component** — dirtying the tree and putting SIGMA's inventory names and
snapshot commands inside the artifact C13 requires be usable elsewhere.
Nothing mechanical prevents it: `validate.sh` checks skill *frontmatter*
only.

Reinforced by finding **1.4/1.5**: candidate 1's entire detection story
reduces to one literal string match (`TODO(estate):`) performed by an agent
reading prose in a repo this design **may not write to**. A profile filled
with a *plausible guess* defeats that detection **while looking filled** —
strictly worse than a blank, because the blank triggers the stop. ADR-0015's
own quoted rule ("a snapshot is only a rollback path if the platform can
actually take one — never assume the safety net exists") forbids exactly the
assumption candidate 1's template invites.

Candidate 2 is also the strongest on criterion 1 and C13: its `SKILL.md` is
readable with zero knowledge of any estate, because it contains no estate's
facts at all.

### Why the enforcement layer is taken

Without candidate 3, this design's detection is **structural but weak**: an
unanswered obligation halts the loop, so an omission is caught at the moment
it would occur — but a change made *without running the loop* leaves no trace
of its absence. Candidate 3 supplies the after-the-fact record, and is the
only candidate that ships something **observed failing before it is
trusted** (`loops/release-check/`'s own rule).

### What gets built

- **`skills/ansible-ops/SKILL.md`** — ADR-0003 frontmatter (C4). The
  invariants as an **obligation set**: the questions answerable before any
  change is applied, and what being unable to answer one means. The gate
  sequence and *why each gate exists*; the Ansible-vs-Python boundary; Vault
  and log hygiene; the narrow-`forks` rationale. No estate's facts. No size
  budget stated (C5).
- **`skills/ansible-ops/references/derivation.md`** — where each answer comes
  from, addressed **by file role, never by path** (this is what keeps it
  portable and what makes it survive the F3 decay class). Explicit rule: a
  role with no file in this estate yields **`unknown`**, and `unknown` is
  never silently replaced by a default.
- **`skills/ansible-ops/references/hazards.md`** — hazard *classes*, with F2
  as a named worked example: default fact gathering can stat a wedged
  clustered/FUSE mount; no global `gather_subset` mechanism exists in
  ansible-core 2.20.8; **this repo ships no enforcement** (B-011 open).
- **`skills/ansible-ops/references/check-mode-fidelity.md`** — C12: a clean
  `--check` is not proof, with the `proxmox_storage` field-level-drift gap as
  the dated illustration, and the generalisation that `changed=0` does not
  mean the desired state was reached.
- **`skills/ansible-ops/templates/change-record.md`** — the record. YAML
  frontmatter is the checked surface: `hosts_limit`, `modules_touched`,
  `check_mode_run`, `check_mode_fidelity` per module
  (`proven` | `unknown` | `not-applicable`, where **`unknown` is not a
  pass** — C12 made unskippable), `snapshot_ref`, `rollback_verified`,
  `gather_subset_reviewed`, `lint_run` (records *that* it ran and asserts
  nothing about the outcome — C8), `approver`.
- **`skills/ansible-ops/scripts/check-change-record.sh`** — Bash + `python3`
  for the frontmatter parse (never grep structured data). **Read-only and
  idempotent**: takes a record path, writes nothing, exits non-zero naming
  the missing or `unknown` field.
- **`skills/ansible-ops/fixtures/`** — a deliberately incomplete record and a
  complete one, so the checker is **observed failing for the right reason and
  then observed passing** before it is trusted. Ships with the honest caveat:
  this proves a *field is present*, not that a node cannot hang.
- **`loops/ansible-change/loop.md`** — `## Trigger`, `## Steps` (each gate
  with its expected output, `release-check` style), `## Exit conditions` with
  **bounded retries (3)** and **escalate-without-retry** for: an unanswerable
  obligation, `check_mode_fidelity: unknown`, a destructive action, and a
  play targeting a hazard-class host without the mounts exclusion.

## Rejected alternatives

| Alternative | Load-bearing difference | Why rejected |
|---|---|---|
| **Candidate 1 — declared estate profile** (the C10 shape) | Per-estate facts **declared** by hand into a shipped template, so the fact has two homes and can drift | Critique **1.2 (severe, verified)**: `install.sh` symlinks skills into this repo's tree, so filling the template writes one estate's production facts into the portable component — violating C13 in spirit, with nothing mechanical preventing it. Plus **1.4/1.5**: detection reduces to one string match in a repo we may not write to, and a plausibly-guessed field defeats it while looking filled. **C10 therefore fails on evidence, not on preference** |
| **Candidate 4 — generated per-estate runbook** | Unit of deployment is **one generated artifact per estate**, with staleness detectable by regeneration | **Not admissible under C1** (hard): it generates an artifact into a consuming repo. Human decision 2026-09-15. Its migration cost also lands on parties who did not choose the commitment (critique 1.1) |
| **"Derive once, then commit the generated profile"** | A stored derivation | Not a distinct candidate: its throwaway answer is identical to candidate 1's. **A stored derivation is a declaration with extra steps** |
| **One component instead of two** (fold the loop into the skill) | Where the skill/loop boundary sits | Violates C4 and C6 — a single artifact cannot satisfy both the skill frontmatter schema and the loop's three mandatory sections. Checked by the ideator and confirmed by the critic |

## Assumptions

| Assumption | Verified or unverified | If wrong |
|---|---|---|
| F1 — one inventory, staging promotion unavailable | **verified 2026-09-15**: `inventory/production.yml` is the only inventory; `ansible.cfg:8` wires it | C9's premise fails; a staging gate would become expressible |
| F2 — `ansible_mounts` D-state hazard, no global fix, unenforced | **verified verbatim 2026-09-15**, `ansible.cfg:19-48` | `hazards.md`'s worked example is wrong; the hazard class survives |
| F5 — MCP executor cannot express the safe workflow | **verified 2026-09-15** from the live tool schema | The executor might become a usable execution path |
| Both playbooks are `gather_facts: false` | **verified 2026-09-15** | They would be positive rather than negative fixtures |
| F3, F4, F6, F7 | **unverified** — the brief rests on none of them | — |
| C10 is roughly right | **tested and found wrong** for this design (critique 1.2) | ADR-0015's intended clause 1 needs rewriting before ratification |
| The derivation probe is cheap enough to repeat every change | **unverified** | If wrong, the fix is caching — which reintroduces a stored artifact and collapses this into candidate 1 |
| `unknown` will not be quietly substituted with a default by an agent under pressure | **unverified — this design lives or dies on it** | `derivation.md` must make the substitution *visibly illegitimate*; the record's `unknown`-is-not-a-pass rule is the backstop |

## Accepted costs

Found by the critique, accepted anyway, with reasons:

1. **No execution-time enforcement of the F2 hazard.** Shared by all four
   candidates; caused by the TASK-0031 exclusion and C3, not by this choice.
   B-011 stays open, and the design says so rather than implying coverage.
2. **The checker validates a record, not the act.** It proves a field is
   present, not that a node cannot hang — the same limit PLAN-0003 records
   for the guard. Shipped with that caveat stated, not softened.
3. **The derivation probe is heuristic.** An estate whose layout differs from
   the probe's expectations yields `unknown`, which is correct but abundant.
   Accepted because abundant-and-correct beats confident-and-wrong.
4. **No profile persists to be reviewed or approved before a change.**
   Candidate 1's real advantage, given up deliberately. The change record
   partially compensates, after the fact rather than before.
5. **This design is unexercised against a real estate** (C3). PLAN-0003's own
   "a skill nobody executes is scaffolding" — the **third** instance of the
   pattern. The checker's fixtures are the only part observed working.
6. **A record schema is one index away from a governance framework** (C7).
   Bounded explicitly: per-change, ephemeral, no index, no sprint shape, no
   `.ai/`-shaped opinion.
7. **`templates/` and `scripts/` are outside the authoring guide's documented
   skill vocabulary.** Nothing breaks (`validate.sh` and `sync-registry.sh`
   ignore them), but the guide is silently outrun. Noted, not fixed here.

## Open questions

Named rather than left silent, because the production loop reads this brief
**without editing it** — an unnamed gap becomes an implementation guess.

1. **Where does the operator keep the change record?** Deliberately the
   consuming estate's choice, so C1 holds. The checker takes a path.
2. **Which module classes get a `check_mode_fidelity` verdict shipped?**
   None are shipped as `proven`; the design ships the *field* and the rule
   that `unknown` is not a pass. Whether a starter list of known-unreliable
   modules is worth shipping is left open — C8 and C3 limit what can be
   claimed without testing.
3. **Does `derivation.md`'s by-file-role addressing survive an estate that
   uses a wholly different layout?** Untestable here: one evidence estate,
   and C3 forbids exercising it.
4. **ADR-0014 and ADR-0015 remain unratified**, and ADR-0015's intended
   clause 1 is now contradicted by this brief's evidence. Rewriting it is
   **not** in this design's scope; the contradiction is recorded so
   ratification cannot quietly proceed as if unexamined.
