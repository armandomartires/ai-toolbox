# Check-mode fidelity — a clean `--check` is not proof

Gate 4 runs the change in check mode with diff. Gate 5 exists because
**gate 4's output is only as trustworthy as the modules that produced it.**

## The claim `--check` actually supports

A check-mode run reports what **each module's check-mode code path** predicts
it would do. That is not the same claim as "this is what the apply would do".
The two coincide only when a module's check path evaluates everything its
apply path evaluates.

So a clean check run supports:

> No module's check-mode implementation predicted a change it was capable of
> predicting.

It does **not** support:

> The target is already in the desired state, and applying this change is a
> no-op.

The gap between those two sentences is where changes go wrong while looking
gated.

## `changed=0` does not mean the desired state was reached

`changed=0` is a statement about **module decisions**, not about host state.
It is produced identically by:

- a resource genuinely already in the desired state;
- a module that compares only a subset of the resource's fields and found
  that subset matching;
- a module whose check-mode path does not evaluate the attribute the change
  actually touches;
- a task that was skipped by a conditional, a tag selection, or a limit that
  excluded the host you cared about;
- a `command` or `shell` task with no idempotence contract at all, whose
  reported status reflects a hand-written `changed_when` rather than any
  comparison of state.

All five print the same number. Reading "already correct" out of it is
reading a conclusion the number cannot carry — which is why gate 8 verifies
**the effect** by reading resulting state, rather than trusting a summary
line or an exit code.

## The dated illustration

**`proxmox_storage`, version 2.0.0 — field-level drift is not detected.**
The module compares at a coarser granularity than the resource it manages,
so a storage definition that differs from the desired state in individual
fields can be reported as requiring no change. Check mode is clean; the
drift is real and still present afterwards.

**This is dated on purpose.** It is a snapshot of one module at one version,
recorded so the claim is concrete and falsifiable rather than a vague warning
about "some modules". Two consequences:

- **It may be fixed.** If a later version compares fields properly, this
  illustration is stale — and that is fine, because the *class* it
  illustrates (a module comparing less than it manages) is not version
  specific.
- **It must not be generalised into a verdict about other modules.** The
  observation covers what it covers.

## No fidelity verdicts ship with this skill

**This skill ships no list of modules and no per-module verdict.** No module
is shipped as `proven`, and **nothing above is a shipped verdict either** —
the `proxmox_storage 2.0.0` paragraph is one dated illustration of a class,
scoped to that module at that version and offered so the class is concrete.
It is not an entry in a verdict list, and it does not relieve anyone of
deriving `check_mode_fidelity` for `proxmox_storage` per change, at the
version actually installed. Reusing it as a standing verdict is the exact
staleness this section refuses.

Why nothing ships as `proven`:

- A verdict about a module's check-mode faithfulness is a claim about
  observed behaviour. Producing that evidence would require running plays,
  which was explicitly out of scope for the work that authored this
  component.
- A shipped verdict list would be trusted at exactly the moment nobody has
  time to re-derive it — and a stale `proven` is worse than no entry at all,
  because it converts an open question into an assurance.
- No claim in this repository may rest on an observed lint or run outcome
  that this repository cannot reproduce.

What ships instead is **the field and the rule**: every change states a
fidelity verdict per module touched, and the verdict is derived per change
from role 5 in `references/derivation.md` — the module's own documentation at
the version actually installed.

## The three legal verdicts

Three legal **outcomes of the derivation**, per module touched by the change —
which is not the same set as the values that can appear in a closed record.
`unknown` is a legal thing to *conclude* and an illegal thing to *record*: it
stops the change at gate 5, so a record that exists never carries it. That is
why `templates/change-record.md` offers only `proven` and `not-applicable` for
the `check_mode_fidelity` field and calls `unknown` not a pass. Two vocabularies,
one word, no disagreement: this file enumerates what gate 5 can determine, the
template enumerates what survives into the artifact.

| Verdict | Means | Consequence |
|---------|-------|-------------|
| `proven` | This module's check mode was established to evaluate what the change touches, for this version, and the evidence is stated | Gate 4's clean result may be relied on for this module |
| `not-applicable` | Check mode is irrelevant for this module in this change, as a **deliberate declaration with a reason** — not as a way of avoiding the question | Proceed, with the reason recorded |
| `unknown` | Nobody established it | **Stop.** Escalate without retrying |

**`unknown` is not a pass.** A retry cannot turn `unknown` into a verdict,
because the missing thing is evidence, not an attempt — the same run repeated
produces the same absence of knowledge. This is why
`check_mode_fidelity: unknown` is an escalate-without-retry condition in
`loops/ansible-change/loop.md` rather than something the retry bound
consumes.

## What to do when the verdict is not `proven`

- **Narrow the target.** One host, then read the result. A change whose
  effect cannot be predicted can still be observed on a single host before
  it reaches the rest.
- **Lower concurrency.** Fidelity you do not have is a reason to reduce
  blast radius, not to move faster because the check was clean.
- **Verify by reading state, not by re-running.** A second run agreeing with
  the first is two runs of the same blind spot.
- **Prefer a module you can reason about** over a shorter escape hatch —
  see the Ansible-vs-Python boundary in `SKILL.md`. A `command` task has no
  check-mode fidelity to assess at all.
