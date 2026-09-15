# Hazard classes

A hazard here is **not** a change that fails. A change that fails is
ordinary and recoverable. A hazard is a property of the target that turns a
routine, apparently read-only action into damage that the tooling cannot
undo, retry out of, or in some cases even interrupt.

Hazards are stated as **classes**, because the list of specific instances is
never complete and an incomplete list read as complete is worse than a class
you can recognise. One class is worked through in full below.

## Why classes rather than a list

- A named instance tells you about one platform. A class tells you what to
  look for on a platform nobody has written up yet.
- Instances decay: versions change, defaults change, a fix lands. The class
  survives the fix.
- Every class here has the same shape: **an action believed safe, a target
  property that makes it unsafe, and no recovery path from within the
  tooling.** Recognising that shape is the transferable skill.

## The classes

| Class | The action believed safe | What makes it unsafe | Why the tooling cannot recover |
|-------|--------------------------|----------------------|-------------------------------|
| **1. Fact gathering that touches a wedged resource** | Collecting facts before the first task | Default fact collection enumerates mounted filesystems, which requires stat-ing each mount — including clustered or FUSE-backed ones that can be unresponsive | A blocked stat on such a mount is uninterruptible. Worked example below |
| **2. Non-idempotent escape hatches** | A `command` or `shell` task "that just reads something" | Shell semantics carry no idempotence contract; the same line can mutate state depending on arguments, environment, or the host's current state | Check mode does not intercept it faithfully, and `--diff` has nothing to show, so the gate that would have caught it produces silence |
| **3. Modules whose check mode is not faithful** | A clean `--check --diff` | The module's check-mode implementation does not evaluate everything its apply path evaluates | The evidence you would use to decide is the evidence that is missing. See `check-mode-fidelity.md` |
| **4. Concurrency multiplication** | Running against the group rather than one host | An unrecoverable per-host event repeats once per fork, in parallel | There is no rollback for "it happened on all of them at once". This is why `forks` is blast radius, not throughput |
| **5. Absent or unverified rollback** | Taking a snapshot | A snapshot the platform cannot actually take, or one whose restore has never been exercised | Discovered only when the restore is attempted — i.e. after it is needed |
| **6. State outside the play's model** | Changing a managed resource | A second authority (a cluster manager, an operator, another automation) also writes that resource | The apply succeeds and is then reverted or duplicated by the other authority, so verification of the effect must read state rather than trust the exit code |

## Worked example — class 1, fact gathering on a wedged clustered mount

Stated in mechanism, without naming any estate, host, or inventory file,
because the mechanism is what transfers.

**The mechanism.**

1. Default fact gathering collects mount information (`ansible_mounts`).
2. Collecting it requires stat-ing each mounted filesystem.
3. Some platforms expose configuration through a clustered, FUSE-backed
   filesystem — on Proxmox VE this is the `pmxcfs` mount at `/etc/pve`.
4. When that filesystem's daemon is wedged, a stat against the mount blocks
   in the kernel and **cannot be killed** — not by the connection dropping,
   not by a task timeout, **not even by `timeout`**. The process sits in
   uninterruptible D-state.
5. The result is a node made worse by an action whose intent was purely to
   read. Nothing later in the run recovers it.

**The fix that does not work.** The obvious global remedy — restricting fact
collection estate-wide via a `gather_subset` setting in the configuration
file's `[defaults]` section — **does not exist**. In `ansible-core 2.20.8`,
`gather_subset` is **rejected as an unknown `[defaults]` key**, and set in
`group_vars` it is **silently ignored**. It is a **play keyword and a
per-module argument only.** There is no global mechanism.

"Silently ignored" is the part that matters: an estate can carry a
`group_vars` entry that reads exactly like a fleet-wide guard, produce no
error, and provide no protection. The absence of a warning is not evidence
the setting took effect.

**What therefore has to happen per play.** Because the mechanism is
play-keyword and module-argument scoped:

- Disable or restrict fact gathering **on the play**, or pass an explicit
  subset **as a module argument** — every play, every time, for hazard-class
  targets.
- Excluding the mount-collection subset is the specific exclusion the change
  record's `gather_subset_reviewed` field refers to.
- A play that targets a hazard-class host **without** that exclusion is a
  stop, not a retry. Retrying it re-triggers the hazard; the second attempt
  is not more likely to succeed, it is more likely to wedge another node.

**Why this gate is first.** The hazard fires during fact gathering — before
the first task, before anything a later gate inspects. A review performed
after the first connection reviews a hazard that has already happened. This
is the whole reason the gate sequence in `SKILL.md` puts hazard-class review
inside gate 1.

## What this repository does not do

**This repository ships NO enforcement of any hazard class, including
class 1.**

There is no guard, no hook, no wrapper, no linting rule, and no runtime
check here that will stop a play from gathering facts against a hazard-class
host. The requirement is **tracked and unenforced** — `B-011` remains open.

Two further honest limits:

- `scripts/check-change-record.sh` **validates a record, not the act.** It
  proves the `gather_subset_reviewed` field is present, not blank, not a
  placeholder and not `unknown`. It never reads a playbook, never inspects a
  play's `hosts:`, and never looks at an actual `gather_subset` setting — only
  at the operator's written claim that the review happened. A record can be
  fully green for a change that wedged a node.
- **Nothing runs that checker either.** `tests/validate.sh`, the pre-commit
  hook and CI never invoke it; only step 9 of `loops/ansible-change/loop.md`
  does, by hand. So the unenforcement above is not limited to the hazard
  classes — the record check is unenforced in the same sense.
- The hazard is documented here **because documentation is what this
  component is**, not because documentation is sufficient. Anyone reading
  this file as coverage has misread it.
