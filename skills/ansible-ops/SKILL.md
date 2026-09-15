---
name: ansible-ops
description: "How to change Ansible content in a live estate safely - the obligation set that must be answerable before a change, the nine gates and why each exists, the Ansible-vs-Python boundary, Vault and log hygiene, and the narrow-forks rationale. USE FOR: planning or reviewing a change to a playbook, role, inventory or group_vars against real hosts; running loops/ansible-change/; deciding whether a --check run proved anything; filling or checking a change record. DO NOT USE FOR: writing application Python or a module from scratch, general Ansible tutorials, or governance and planning documentation - that is project-workflow and project-migration."
license: MIT
metadata:
  author: armando.martires
  version: "1.0.0"
---

# ansible-ops

An agent or operator asked to change Ansible content in a real estate has
**capability without discipline**: the tooling can reach production but
cannot, by itself, say what a safe sequence is. This skill is that sequence
and the reasoning behind it, stated so it can be reproduced without having
read any particular estate's configuration files.

`loops/ansible-change/loop.md` owns the **sequence as a runnable procedure**
and its exit conditions. This skill owns the **vocabulary and the why**. When
the two appear to disagree: the loop wins on sequence and exit conditions,
this skill wins on what a term means.

Nothing here is specific to one estate. Estate-specific answers are
**derived per change, never declared and never stored** —
`references/derivation.md`.

## The obligation set

These are the questions that must be **answerable before any change is
applied**. They are obligations, not a checklist: the point is not that
somebody ticked them, it is that an answer exists and is written down.

1. **Which hosts can this change reach?** Not which hosts you intend it to
   reach — which hosts the play, its pattern, and the limit you actually
   passed permit it to reach.
2. **Which modules does it invoke?** Each one is a separate question about
   check-mode fidelity (below).
3. **Was it run in check mode with diff, and against what?**
4. **For each module touched, does check mode mean anything?**
   `references/check-mode-fidelity.md`.
5. **Does a rollback path exist, and has it been verified to exist —** not
   assumed. A snapshot is only a rollback path if the platform can actually
   take one.
6. **Does any target host belong to a hazard class**, and has the relevant
   exclusion been applied? `references/hazards.md`.
7. **Where did each of the above answers come from?**
   `references/derivation.md`.
8. **Who approved it?**

**Being unable to answer one is itself the answer: the change does not
proceed.** An unanswerable obligation is not a warning to note and continue
past, and it is not resolved by supplying a plausible value. The legal
outcomes for any obligation are a real answer, an explicit
`not-applicable`, or a stop. `unknown` is a stop, everywhere, in every
field — see `templates/change-record.md`.

There is no fourth outcome in which a default is quietly substituted for an
answer nobody has. That substitution is the single failure mode this whole
skill exists to prevent, because it produces a change that *looks* fully
gated.

## The nine gates, and why each exists

Ordered **cheapest and safest first**, which is a claim about where the
irreversible step sits, not a monotonic property of all nine: **gates 1–5 are
read-only, and the one gate that changes the estate — gate 7 — is reached only
after all five of them plus a verified rollback path.** The order is not
monotonically widening past that point (gate 8 reads state, so it is narrower
than the apply it follows, and gate 9 only writes a file), and gate 9 has no
successor to be narrower than. What holds, and what the order exists for, is
that nothing irreversible happens until everything cheap has already passed.

| # | Gate | Why it exists — what skipping it costs |
|---|------|----------------------------------------|
| 1 | **Derive** the estate's answers to the obligation set | Everything downstream is conditional on facts about *this* estate. Deriving first means an unknown surfaces before anything has connected to a host. A derived answer also cannot contradict its source, which a stored profile eventually would |
| 2 | **Lint** the content | Cheapest possible feedback, no connection, no target. Records **that** it ran. It never certifies the change: a clean lint is a style and schema opinion, not evidence about hosts |
| 3 | **Syntax and parse check** | Catches an unparseable play, an undefined role, a broken include before any inventory is contacted. A play that cannot parse cannot be reviewed either — you would be reviewing something that never runs |
| 4 | **Check mode with diff, against a bounded target** | The first gate that touches hosts, and it is read-only. `--diff` is what turns "would change something" into "would change *this*", which is the only form a human can review. Gate 1's derived limit bounds it |
| 5 | **Fidelity verdict per module** | Gate 4's output is only as meaningful as the modules that produced it. Some modules do not implement check mode faithfully; for those, a clean diff is silence, not proof. Skipping this gate is how a clean `--check` gets mistaken for a guarantee |
| 6 | **Snapshot, and verify the rollback path exists** | Placed after check mode deliberately: check mode is read-only, so snapshotting before knowing a change is even needed costs storage on every run. Placed *before* apply necessarily: a rollback path you discover you lack after applying is not a rollback path |
| 7 | **Apply, bounded** | Narrowest limit that still accomplishes the change, lowest useful concurrency. The bound is what makes a wrong change a small wrong change |
| 8 | **Verify the effect, not the exit code** | A zero exit says the tool ran, not that the intended state was reached. `changed=0` in particular does not mean "already correct" — `references/check-mode-fidelity.md`. Verification reads the resulting state |
| 9 | **Close the record** | The record is the only artifact that carries the *reasoning* past the change — the snapshot from gate 6 outlives it too, but a snapshot is state, not an account of why anything was done. A gate whose result is never written down is indistinguishable afterwards from a gate that was skipped, which is what the record and its checker exist to make harder |

Two properties of this order are load-bearing:

- **Hazard-class review is part of gate 1, not a later gate.** Some hazards
  are triggered by the act of connecting and gathering facts, so a gate that
  reviews them after the first connection reviews a hazard that has already
  fired. `references/hazards.md`.
- **Every record field maps back to a gate — but not every gate leaves a
  field.** The direction that holds is field-to-gate: each of the nine fields
  names the gate whose performance fills it, so the checker's complaint about
  a field identifies a gate to return to. The converse is **false and must
  not be asserted**: gates 3, 7 and 8 fill no field — parse leaves no trace,
  the bounded apply leaves none of its own (`hosts_limit` records the limit
  *derived* at gate 1, not that the apply honoured it), and verification of
  effect goes in the record's body, which the checker never reads. Several
  fields also share a gate — **three are filled at gate 1** (`hosts_limit`,
  `modules_touched`, `gather_subset_reviewed`) **and two at gate 6**
  (`snapshot_ref`, `rollback_verified`). The one **complete** statement of the
  mapping — the only place all nine fields are each paired with a gate — is the
  **Filled at** column of `templates/change-record.md`; this paragraph and the
  summaries in `loops/ansible-change/loop.md` are deliberate partial
  restatements, **subordinate** to that column — each says only what its own
  reader needs at that point, and none of them is authoritative. Where they
  disagree with the column, the column is right; change the column and every
  restatement of it must be re-checked, this one included. What the arrangement
  costs is that a green record is silent about gates 3, 7 and 8, which
  `templates/change-record.md` says plainly rather than leaving to be
  discovered.

The graduated path is **check-with-diff, then snapshot and verified
rollback, then a bounded apply**. It is not staging promotion: an estate
with a single inventory has no staging to promote from, and pretending
otherwise invents a gate nobody can perform.

## The Ansible-vs-Python boundary

Ansible modules are **declarative and idempotent by contract**. Reaching for
a shell command, a raw script, or a hand-written Python step gives that up
silently: the step reports `changed` every run (or never), check mode
becomes meaningless for it, and `--diff` has nothing to show.

The boundary:

- **Prefer a module.** If a module exists for the resource, use it, even if
  the shell one-liner is shorter.
- **A command or shell task must be made explicitly conditional and
  explicitly check-mode-honest.** State what makes it idempotent, or state
  that it is not.
- **Reach for Python only when the work is genuinely not configuration** —
  a computation, a transformation, a parse. Even then it belongs in a filter
  or a module with documented arguments, not inlined into a play.
- **Never parse structured data with a text tool.** Structured input gets a
  structured parser. A grep over YAML or JSON matches prose that merely
  mentions a key, and the failure is silent.

Every command or shell task added to a play makes gate 5's verdict harder
to give and gate 8's verification more necessary.

## Vault and log hygiene

- **A secret's value never appears in a task name, a `debug` message, a
  registered variable that is later printed, a template rendered into a
  world-readable path, or a change record.** Names and meanings, never
  values.
- **Mark tasks that handle secrets `no_log`** — and remember that this
  hides the failure output too, which is a debugging cost accepted
  deliberately rather than an oversight to work around by removing it.
- **A vault password never lands in a file the repository tracks**, in a
  command line recorded in shell history, or in a CI log.
- **Verbose output is a disclosure surface.** Raising verbosity to diagnose
  a failure can print variable contents; do it knowingly, and do not paste
  the result anywhere durable without reading it first.
- **The change record is not a place to prove you had the credential.** It
  records that a gate was performed, never the material used to perform it.

## The narrow-`forks` rationale

`forks` is not a performance dial in this context; it is **blast-radius
control**.

- Concurrency determines **how many hosts a mistake reaches before anyone
  can stop it**. A high fork count converts a bad change on one host into a
  bad change on every host in one pass.
- **A narrow fork count keeps failure legible.** Serialised or
  low-concurrency output can be read in order; heavily interleaved output
  from many hosts is where the first failure gets lost.
- **Some hazard classes are unrecoverable per host** (a wedged mount, an
  uninterruptible stat). Concurrency multiplies an unrecoverable event by
  the fork count. Nothing downstream recovers from that, which is why the
  narrow value is the default rather than the exception.
- **Widen deliberately, per change, with a reason** — and only after gate 4
  has shown what the change actually does.

## What this skill is not

- **Not enforcement.** Where this skill names a hazard, it names it. This
  repository ships **no execution-time guard** for the fact-gathering
  hazard class, and `references/hazards.md` says so plainly rather than
  implying coverage.
- **Not a proof that a change is safe.** `scripts/check-change-record.sh`
  proves a *field is present and not `unknown`*. It cannot prove a node
  will not hang.
- **Not wired to any gate in this repository.** Nothing runs that checker:
  `tests/validate.sh`, `.githooks/pre-commit` and CI never execute it, and
  never read a change record or either fixture. The only caller is step 9 of
  `loops/ansible-change/loop.md`, performed by whoever runs the loop. The
  class of defect this skill documents is therefore mechanically unenforced
  here, exactly as `references/hazards.md` says of the hazard classes.
- **Not exercised against a real estate.** These components were authored
  from evidence read read-only; no playbook was run in any mode, including
  `--check`, to produce them. Treat the first real use as the first test.
- **Not a governance framework.** It ships one per-change record and a
  checker. No index, no task IDs, no sprint shape, no status vocabulary
  beyond the record's own field values. That layer is `project-workflow`
  and `project-migration`; do not add a third.

## References

| File | What it settles |
|------|-----------------|
| `references/derivation.md` | Where the estate-specific obligations' answers come from — obligations 1, 2, 4, 5, 6, 7 and 8, addressed by file **role**, never by path; and the rule that a role with no file yields `unknown`. **Not obligation 3**, which is answered by performing gate 4, not by reading a file |
| `references/hazards.md` | Hazard classes, with the fact-gathering hazard as the worked example; and what this repo does *not* enforce |
| `references/check-mode-fidelity.md` | Why a clean `--check` is not proof, and why `changed=0` is not "already correct" |
| `templates/change-record.md` | The record. Its YAML frontmatter is the checked surface |
| `scripts/check-change-record.sh` | Read-only checker: exits non-zero naming any field it rejects, on the seven conditions its header enumerates. Nothing in this repository runs it |
| `fixtures/` | The checker observed failing for the right reason, then observed passing |

## Maintaining

Content changes bump `metadata.version` above (`ADR-0003`). If a gate's
rationale here and the loop's step list ever disagree, that is a defect in
one of them, not a judgement call to make at runtime — fix it before the
next change.
