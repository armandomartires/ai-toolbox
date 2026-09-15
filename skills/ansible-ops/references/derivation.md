# Derivation — where each answer comes from

The obligation set in `SKILL.md` asks estate-specific questions. This file
says where the answers come from, **without knowing anything about your
estate**.

**Seven of the eight, not all eight.** The roles below feed obligations 1, 2,
4, 5, 6, 7 and 8. **Obligation 3** — "was it run in check mode with diff, and
against what?" — is answered by *performing gate 4*, not by reading an estate
file, so no role feeds it and none should be invented to. Check the **Feeds**
column against that list if you change either.

Two rules govern everything below.

1. **Addressed by role, never by path.** A role is *what a file does*, not
   where it lives or what it is called. Two estates that both have a
   "config that declares the inventory" may put it in different places,
   under different names, in different formats — the role is the same, and
   the role is what this file names. A path written down here would be one
   estate's layout wearing a portable-looking label, and it would be wrong
   for the next estate while looking authoritative.
2. **Derived per change, stored nowhere.** The derivation is performed at
   the start of every change, by reading files. Nothing is persisted. A
   derived answer cannot contradict the thing it was derived from; a stored
   one can, and eventually will, with no signal that it has.

## How derivation is performed

**By reading files — an agent or operator procedure, not a program.** No
probe script ships with this skill. Nothing here runs a playbook, in any
mode, including `--check`; nothing here connects to a host.

The procedure per role: identify a file in the estate that fills the role,
read it, extract the answer, and record the answer together with the role
it came from. If no file in the estate fills the role, the answer is
`unknown` — see the rule at the end of this file.

**This procedure is heuristic, and deliberately so.** It recognises roles by
what a file does, so an estate laid out unlike anything the roles anticipate
will yield `unknown` for several roles at once. That output is *correct*
even when it is abundant: an honest pile of `unknown` beats a confident
wrong answer, because the pile stops the change and the wrong answer does
not. Do not tune the procedure toward fewer `unknown`s by guessing.

## The five roles

| # | Role | What it answers | Feeds |
|---|------|-----------------|-------|
| 1 | **The config that declares the inventory** — the file that tells the tooling which inventory is authoritative, plus its global defaults (concurrency, connection settings, and any documented caveats the estate wrote down for itself) | Which inventory is in play at all; the default `forks`; whether the estate has recorded a known hazard or a known-ineffective fix in its own words | Obligations 1, 6, 7; the narrow-`forks` decision |
| 2 | **The inventory itself** — whatever the role-1 config points at | Which hosts and groups exist, so "which hosts can this change reach" has a denominator; whether more than one inventory exists at all, which decides whether a staging gate is even expressible | Obligation 1; gate 4's limit; gate 7's bound |
| 3 | **The estate's stated change-safety procedure** — wherever the estate has written down how it expects changes to be made: snapshot mechanism, rollback steps, approval expectations, maintenance windows | Whether a rollback path exists and how it is taken; who approves; what the estate itself considers a safe sequence | Obligations 5, 8; gates 6 and 9 |
| 4 | **The lint configuration and its exclusions** — the file that configures the linter, including everything it has been told to skip | What lint will and will not look at, which is what makes `lint_run` an honest record of *coverage* rather than an implied endorsement. A rule in the exclusion list is a rule nobody is checking | Gate 2; the `lint_run` field |
| 5 | **Module documentation for check-mode behaviour** — the authoritative documentation for each module the change invokes, at the version actually installed | Whether check mode is faithful for that module, partially faithful, or meaningless — per module, at that version | Obligations 2 and 4; gate 5; the `check_mode_fidelity` field |

Notes on the role set:

- **Role 5 is per-module and per-version, not per-estate.** The same module
  at two versions can have two different answers, which is why the version
  actually installed is part of the role and not an afterthought.
- **There is deliberately no vault or secrets role.** Secret hygiene is
  invariant guidance that holds in every estate — it lives in `SKILL.md` and
  is not a fact to be derived. Deriving a "vault role" would mean reading
  toward secret material in order to describe it, which is the opposite of
  the hygiene rule.
- **A role may be filled by several files, or one file may fill several
  roles.** Neither is a problem. Record which file filled which role, so
  the answer can be re-derived and disputed.

## The `unknown` rule

**A role with no file in this estate yields `unknown`.**

**`unknown` is never silently replaced by a default.** Not by a value from
another estate, not by a documentation example, not by a "usual" value, not
by the most likely value, not by a value inferred from an adjacent role.

Substituting a default is **illegitimate, and this is what makes it
visible**:

- **An `unknown` recorded as `unknown` stops the change** — that is its
  entire purpose, and stopping is the design working, not failing.
- **A substituted default is indistinguishable from a real answer** in the
  record. That is exactly why it is forbidden: it defeats every downstream
  check while leaving the record looking complete. A blank is safer than a
  plausible guess, because the blank triggers the stop.
- **`unknown` is not a pass in any field** of the change record — see
  `templates/change-record.md`. The checker exits non-zero and names the
  field. There is no field where writing `unknown` gets a change through —
  verified against all nine. Two caveats on how far that goes: the checker
  recognises the spellings its header enumerates and **not** the anchor, tag
  and escape forms listed there as known gaps; and **nothing in this
  repository runs the checker** — only step 9 of `loops/ansible-change/loop.md`
  does. The rule is the operator's to honour, not the tooling's to impose.
- **If a role genuinely does not apply to this change, say so explicitly:**
  `not-applicable`, as a deliberate declaration, with the reason. That is a
  legal answer. `unknown` means "nobody knows"; `not-applicable` means
  "somebody decided this does not apply, and here is why". Blurring them
  turns the second into a laundry route for the first.
- **The unverifiable case is the dangerous one.** If the rollback role
  yields `unknown`, the honest reading is *there may be no rollback path* —
  never *assume the safety net exists*. A snapshot is a rollback path only
  if the platform can actually take one.

An agent under time pressure filling in an `unknown` because the change
otherwise cannot proceed has not unblocked the change. It has removed the
only mechanism that would have caught what it did not know.

## Known limit

Whether role-based addressing survives an estate laid out unlike the one
this scheme was derived from is **untested**. There was a single evidence
estate available, and running against it was out of scope, so the scheme's
portability is reasoned rather than demonstrated. If a role does not fit
your estate, the correct response is to record `unknown` for it and raise
the mismatch — not to bend the role until something fits.
