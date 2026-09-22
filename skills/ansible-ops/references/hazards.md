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
file's `[defaults]` section — **does not exist**. It is a **play keyword and
a per-module argument only.** There is no global mechanism: `ansible-config
list` defines no `gather_subset` setting at all, only `DEFAULT_GATHERING`.

**Both ways of writing it down fail, and both fail silently at run time.**
Re-verified against `ansible-core 2.21.4` on 2026-09-23:

| Where you write it | What a playbook run does |
|---|---|
| `ansible.cfg` → `[defaults] gather_subset` | Runs, **exit 0, no error and no warning**, and mounts are still collected |
| `group_vars` → `gather_subset` | Runs, **no error and no warning**, and mounts are still collected |

In both cases `ansible_mounts` was still gathered despite `!all,!min`.

> **This is worse than an earlier version of this file stated.** It recorded
> the `ansible.cfg` route as *"rejected as an unknown `[defaults]` key"* under
> `ansible-core 2.20.8` — which would at least have told you. At run time
> under 2.21.4 it does not: the setting is as silent as the `group_vars` one.
> Corrected by re-running both halves rather than by re-dating the old claim
> (`TASK-0069`).

**The silence is the hazard.** An estate can carry an `ansible.cfg` stanza
*or* a `group_vars` entry that reads exactly like a fleet-wide guard, produce
no error, and provide no protection. **The absence of a warning is not
evidence the setting took effect** — and there is no run-time signal that
would tell you otherwise.

**One opt-in check does report it**, and it is worth wiring into review
because nothing runs it for you:

```bash
ansible-config validate --format ini
# [ERROR]: Found unknown key 'gather_subset' in section 'defaults' in 'ansible.cfg'
```

It catches the `ansible.cfg` spelling only. **No equivalent exists for the
`group_vars` spelling**, which is the one an estate is more likely to write,
so this narrows the blind spot rather than closing it.

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

## What this repository does and does not do

> **UPDATED 2026-09-16 (TASK-0031). The paragraph that stood here said this
> repository ships "no guard, no hook, no wrapper, no linting rule" for any
> hazard class. That is now FALSE for class 1** and has been replaced. It was
> true when written; it became a false claim a component makes about itself —
> the class `TASK-0046` diagnosed — the moment the guard landed. Recorded
> rather than quietly overwritten, because the failure mode is the point.

**Class 1 now has enforcement available. No other class does.**

`skills/ansible-ops/scripts/gather_subset_guard.py` is a custom
`ansible-lint` rule (`gather-subset-mounts`) that refuses a play gathering
facts against a hazard-class host without excluding `mounts`. It recognises
both accepted forms — the `gather_subset: "!mounts"` play keyword and a
`module_defaults` entry scoped to `ansible.builtin.setup` — resolves a **bare
hostname** to its class through the inventory, and fails **loudly on an
unresolvable target** rather than passing it. Wiring: `docs/operations/runbook.md`.

**Four limits on that, each verified rather than assumed:**

- **It proves a keyword is present, not that a node is safe.** The hazard is
  not reproducible on demand, so the rule is validated against **syntax**.
  Fixture proofs live in `fixtures/gather-subset/`; the harness is
  `tests/gather-subset-guard.sh`.
- **Nothing in this repository runs it**, deliberately. It lints *other*
  repositories' content, and the mandatory gate must stay offline and hermetic
  (ADR-0009). Adoption is the consuming repo's act.
- **It can be installed and inert.** A custom rule absent from the active
  profile and from `enable_list` is loaded, listed, and **never evaluated at
  exit 0**. So a passing lint run is not evidence the rule ran — which is why
  the wiring instructions treat `enable_list` as mandatory and the harness
  keeps a negative control that reproduces the silence.
- **It cannot see an undefined-variable target.** `hosts: "{{ undefined }}"`
  is failed first by the unskippable built-in `syntax-check`, before any
  custom rule is evaluated. That play is still caught, by a different rule
  with a different message — but not by this guard.

**Classes 2–6 remain unenforced**, and `B-011` covers class 1 only.

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
