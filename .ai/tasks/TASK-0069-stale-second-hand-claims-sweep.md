# TASK-0069 — Sweep stale second-hand claims: the gate's cost and the drifted Ansible toolchain

## Objective

Close two checkpoint follow-ups that have each survived more than one
review by correcting the **live** claims behind them — and, where a claim
turns out to be load-bearing rather than cosmetic, **re-verify it** under
the current toolchain instead of renumbering it.

1. `REVIEW-0009` follow-up 1 — two second-hand statements about how long
   `tests/validate.sh` takes, both wrong on both filesystems.
2. `REVIEW-0010` follow-up (inherited, **unactioned at two checkpoints**) —
   `ansible-core` has moved 2.20.8 → 2.21.4 while the repo records 2.20.8.

## Minimal context

### These are both the repo's most-repeated defect class

*A claim one artifact makes about another that the other falsifies.* The
repo has hit it repeatedly — twelve times inside `skills/ansible-ops/`
(`TASK-0046`), in the authoring guide's own section preambles, in
`smoke-mcp.sh`'s FAIL message (`B-022`). Both follow-ups here are the same
shape, which is why they are one task rather than two.

### The version follow-up's framing is probably wrong, and that is the interesting part

`REVIEW-0010` recorded *"an `ansible-core` version recorded in nine places
that has moved"*. **A count of occurrences is not a count of defects.**
This repo's convention is explicit that **dated records must not be
rewritten** — `ADR-0006`'s annotation (*"an ADR is a dated record rather
than a live status page"*), applied by `TASK-0053`, `TASK-0054` and
`TASK-0068`. A task log that says *"confirmed by running it: `ansible-core
2.20.8`"* was **true when written** and is evidence, not drift.

So the work is a **classification** before it is an edit, and the expected
finding is that the nine collapse to very few. That is the inverse of
`B-012`, where an item's own statement **under**-counted its defect by two
locations. Either direction is the same lesson: **grep, then judge; do not
trust the number in the item.**

### One of the nine is load-bearing, and renumbering it would be the real failure

`skills/ansible-ops/references/hazards.md:52-57` does not merely mention a
version. It makes a **normative, version-scoped behavioural claim** that
`B-011`'s entire guard rests on:

> *"restricting fact collection estate-wide via a `gather_subset` setting in
> the configuration file's `[defaults]` section — **does not exist**. In
> `ansible-core 2.20.8`, `gather_subset` is **rejected as an unknown
> `[defaults]` key**, and set in `group_vars` it is **silently ignored**."*

If 2.21.4 changed this, `skills/ansible-ops/` gives wrong safety guidance
and `gather_subset_guard.py` guards a premise that no longer holds.
**Editing the version number without re-running the behaviour would be
exactly the defect this task exists to remove** — replacing a stale claim
with a fresher-looking unverified one.

### The gate-cost claims, and the one that is already right

`tests/validate.sh:306-314` carries a **careful, correct** cost comment
that names its surfaces (~540 ms native, ~1000 ms on `/mnt/c`) and warns
*"measure on a native path before concluding a check is expensive"*.
`REVIEW-0009` reproduced both numbers. **It is not in scope to change.**

The two that are wrong are second-hand restatements elsewhere:

| Location | Claim | Measured (`REVIEW-0009`, 5 runs each) |
|---|---|---|
| `tests/smoke-mcp.sh:10` | *"fast, offline and hermetic (~0.4s)"* | **572 ms** ext4 / **1008 ms** `/mnt/c` |
| `docs/operations/runbook.md:60` | *"offline, sub-second"* | true natively, **false** on `/mnt/c` — no surface named |

`smoke-mcp.sh` is the sharper one: S8 edited that file **twice** without
noticing, and it is the file whose header is otherwise unusually careful.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `REVIEW-0009` follow-ups 1 and 5 | TASK-0068's session | Written 2026-09-23; both name exact file:line locations |
| `tests/validate.sh:306-314` | TASK-0046 era | Cost comment **correct and surface-scoped** — reference, not a target |
| `tests/smoke-mcp.sh:10` | TASK-0009 | `~0.4s` claim, untouched by S8's two edits |
| `docs/operations/runbook.md:60` | TASK-0016 | `sub-second`, no surface named |
| `skills/ansible-ops/references/hazards.md:52-57` | TASK-0046 pilot | The `gather_subset` claim, scoped to `ansible-core 2.20.8` |
| `~/.venvs/sigma-ansible/bin/` | that estate | **`ansible-lint 26.8.0`, `ansible-core 2.21.4`** — re-confirmed by running it, 2026-09-23 |
| `docs/design/ansible-ops-brief.md` | TASK-0046 | `status: accepted`, locked 2026-09-15 — **a dated artifact; do not rewrite** |
| `.ai/decisions/0014-*.md:11-13` | TASK-0054 | **Already carries a dated drift note** — needs nothing |

**Verify the expected state; don't assume it.** All rows re-read or re-run
this session.

## Scope

### Included

- Correct the two gate-cost claims so each **names the surface** it
  measured, matching `validate.sh`'s own convention.
- **Re-run** the `gather_subset` behaviour under `ansible-core 2.21.4`,
  both halves (`ansible.cfg [defaults]` and `group_vars`), and correct
  `hazards.md` to what is observed — with the version it was observed under.
- Classify every remaining `2.20.8` occurrence **live vs dated**, change
  only the live ones, and record the classification so the next reader does
  not re-do it.
- Record the result of the classification honestly, including if it
  contradicts `REVIEW-0010`'s "nine places" framing.

### Not included

- **Editing `validate.sh`'s cost comment.** It is correct.
- **Rewriting any dated record** — task logs, session logs, archived
  sprints, `PLAN-0003`, `ADR-0014`'s body, or the locked design brief.
- **Upgrading `ansible-lint`** (26.8.0 → 26.9.0 is available). Bumping a
  toolchain in another estate is not this repo's call and is not a
  documentation fix.
- **Re-running `TASK-0027`'s "53 rules / 0 violations" count** under 2.21.4.
  `ADR-0014` already states the decision does not rest on it.
- Anything touching `agents/`, the capability vocabulary, or `mcp-servers/`
  — a concurrent session is planning S9/S10 there.

## Likely files

Forecast, written before the work:

- `tests/smoke-mcp.sh` (one comment line)
- `docs/operations/runbook.md` (one line)
- `skills/ansible-ops/references/hazards.md` (the claim, re-verified)
- `.ai/tasks/TASK-0069-*.md`, `.ai/context/CURRENT_STATE.md`

No component is added; `docs/registry.md` is not expected to change.
`scripts/sync-registry.sh` run as a control only.

## Execution plan

1. Re-confirm the installed toolchain by running it, not by citing it.
2. **Re-run both halves of the `gather_subset` claim under 2.21.4.** The
   `ansible.cfg` half: does a run error, warn, or proceed? The `group_vars`
   half: is `ansible_mounts` still collected despite `!all,!min`? Record
   verbatim.
3. Correct `hazards.md` to the observed behaviour, stamped with the version
   observed. If the hazard is **worse** than stated, say so plainly — a
   safety document that understates is the failure mode that matters.
4. Correct the two gate-cost claims, each naming its surface.
5. Grep every remaining `2.20.8`, classify live vs dated, and change only
   live ones. Record the classification.
6. `tests/validate.sh`; `tests/smoke-mcp.sh` to confirm the edited comment
   did not break its `--help` line range (`TASK-0049` shifted it once).
7. `scripts/sync-registry.sh` as a control.

## Acceptance criteria

- [x] `tests/smoke-mcp.sh` and `docs/operations/runbook.md` each state the
      gate's cost **with the surface named**, and the numbers match
      `validate.sh`'s own comment rather than contradicting it. Both now
      point at that comment as the owner of the numbers.
- [x] `tests/validate.sh`'s cost comment is **unchanged**.
- [x] The `gather_subset` claim in `hazards.md` was **re-run under 2.21.4**,
      both halves, and the file records observed behaviour with that version
      stamped — not a renumbered version of the old claim.
- [x] If the observed behaviour differs from the recorded claim, the
      difference is stated, including whether the hazard is worse. **It is
      worse**, and the file says so in a blockquote.
- [x] Every remaining `2.20.8` occurrence is classified live or dated, and
      no dated record was rewritten. **Fifteen occurrences, one live.**
- [x] `tests/smoke-mcp.sh --help` still prints its header with no shell code
      leaking (the line-range trap from `TASK-0049`). **It did shift again,
      by two lines; range corrected and re-verified.**
- [x] `tests/validate.sh` passes.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/smoke-mcp.sh --help (line-range regression check)
- [x] scripts/sync-registry.sh — expected not required; run as a control.

## Risks and rollback

- **Replacing a stale claim with an unverified fresher one.** The single
  worst outcome, and the reason step 2 runs before step 3. Mitigation: no
  version number changes in `hazards.md` without a recorded run.
- **Rewriting dated records to look tidy.** Would destroy evidence, exactly
  as `TASK-0068` refused to do for `ADR-0021`'s falsified claims.
  Mitigation: classification precedes editing, and the Not-included list is
  explicit.
- **Shifting `smoke-mcp.sh`'s header line count again**, breaking `--help`.
  `TASK-0049` hit this. Mitigation: it is an acceptance criterion.
- **Colliding with the concurrent S9/S10 session.** Mitigation: nothing here
  touches `agents/`, the vocabulary or `mcp-servers/`; stage files by name.
- Rollback: revert the commit. No component, machine or client state
  changes; the Ansible probes run in `/tmp` against `localhost`.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `tests/smoke-mcp.sh` | Gate-cost claim corrected and surface-scoped; `--help` range verified |
| `docs/operations/runbook.md` | Same claim corrected, surface named |
| `skills/ansible-ops/references/hazards.md` | `gather_subset` claim **re-verified under 2.21.4** and restated to observed behaviour |
| `tests/validate.sh` | **Deliberately unchanged** — its comment is correct |
| Dated records | **Deliberately unchanged**, listed in the log |

**Next task starts here**: both `REVIEW-0009` follow-up 1 and
`REVIEW-0010`'s version follow-up are closed or re-scoped with evidence.
Still open and untouched: `B-018`, `B-021`, `B-023`, the `ADR-0021`
clause-5 question the human declined at ratification, and
`skills/ansible-ops/` still unexercised against a live estate.

## Status

- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log

### Attempt 1

- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)

#### The version follow-up's framing was wrong in both directions

`REVIEW-0010` said *"recorded in nine places."* Classified by grepping and
then judging each file:

| Class | Count | Verdict |
|---|---|---|
| **Dated records** — task logs, session log, archived sprint, `PLAN-0003`, `REVIEW-0010`, `ADR-0014` body, the **locked** design brief (`status: accepted`, 2026-09-15) | 12 | **Must not be rewritten.** Each was true when written and is evidence |
| **Dated records embedded in live files** — `ROADMAP.md:323`, `TODO.md:132`, `CURRENT_STATE.md:931` | 3 | Left alone. They narrate what a past task confirmed by running it |
| **Already correct** — `CURRENT_STATE.md:364-366`, `ADR-0014:11-13` | 2 | Both already state the drift explicitly |
| **Live defect** | **1** | `skills/ansible-ops/references/hazards.md` |

**Fifteen occurrences, one defect.** The follow-up **under-counted the
occurrences by six and over-counted the defects by fourteen**. That is the
mirror of `B-012`, where an item's own scope under-counted its defect by two
locations — same lesson from the opposite side: **an occurrence count is not
a defect count, and neither is trustworthy until you open the files.**

The "nine" figure itself was a live false claim in `CURRENT_STATE.md:420`
and is corrected there.

#### The one live defect was not a stale number — it was an understated hazard

`hazards.md` did not merely mention 2.20.8. It made a behavioural claim that
`B-011`'s guard depends on. Re-run against **`ansible-core 2.21.4`**
(confirmed by running `ansible --version`), both halves, in `/tmp` against
`localhost`:

| Route | Observed under 2.21.4 |
|---|---|
| `ansible.cfg` → `[defaults] gather_subset` | Playbook **exit 0**, **zero** occurrences of `gather_subset` in the output — no error, no warning — and `ansible_mounts` still collected |
| `group_vars` → `gather_subset` | Same: no error, no warning, `ansible_mounts` still collected |
| `ansible-config list` | **No** `gather_subset` setting exists at all; only `DEFAULT_GATHERING` |

Both probes set `!all,!min`, and `ansible_mounts is defined` came back
**True** either way — so neither spelling took effect.

**The substantive claim holds: there is no global mechanism, and B-011's
guard rests on a premise that is still true.** That is the reassuring half,
and it is worth stating because a drifted toolchain could have invalidated
S6's highest-value deliverable.

**The wording was wrong, and wrong in the dangerous direction.** The file
said the `ansible.cfg` route is *"rejected as an unknown `[defaults]` key"*
— which would at least warn you. **At run time under 2.21.4 it does not
warn at all.** So both ways of writing the guard fail *silently*, where the
file implied one of them would tell you. A safety document that understates
its hazard is the failure mode that matters, and this one did.

**One usable mitigation was found while probing** and is now in the file:
`ansible-config validate --format ini` **does** report it —
`[ERROR]: Found unknown key 'gather_subset' in section 'defaults'` — but it
is opt-in, nothing runs it, and **it catches the `ansible.cfg` spelling
only**. There is no equivalent for the `group_vars` spelling, which is the
one an estate is likelier to write. Recorded as narrowing the blind spot
rather than closing it.

**This is why the task re-ran instead of re-dating.** Changing `2.20.8` to
`2.21.4` in that sentence would have produced a *fresher, still-false,
now-unverifiable* claim — precisely the defect the sweep exists to remove.

#### The gate-cost claims

Both corrected to name their surface, and both now point at
`tests/validate.sh:306-314` as the **owner** of the numbers rather than
restating them as independent facts — which is what made them drift.

| File | Was | Now |
|---|---|---|
| `tests/smoke-mcp.sh:10` | *"(~0.4s)"* | ~570 ms native / ~1000 ms on `/mnt/c`, citing `validate.sh`'s comment |
| `docs/operations/runbook.md:60` | *"offline, sub-second"* | sub-second **on a native filesystem**; ~1000 ms on `/mnt/c`, with the bridge named as the cause |

`tests/validate.sh`'s own comment is **unchanged**, as scoped — it was
already correct and surface-aware.

**The `--help` line-range trap fired again**, exactly as the brief
predicted: the header grew by two lines, so `sed -n '2,28p'` became
`'2,30p'`. Verified by running `--help` and confirming no shell code leaks.
`TASK-0049` hit this same trap; it is now two-for-two, and a better fix
would be a sentinel rather than a hard-coded range — **not** done here,
because it is a change to a shared test file beyond this task's scope.

#### A coordination hazard, recorded because it affected how this was committed

A **concurrent session** is working in this same working tree on
`PLAN-0006`/S9/S10. During this task it wrote a large new section into
`.ai/context/CURRENT_STATE.md`, modified `.ai/planning/BACKLOG.md`
(raising B-024…B-026), and **staged sixteen of its own files** — a commit
in preparation.

Two consequences, both handled rather than worked around silently:

- **This task's one-line `CURRENT_STATE.md` correction is inside that
  session's staged snapshot.** An attempt to stage only this task's hunk
  (`git apply --cached`) failed *because the index already held their
  version*. The correction is self-attributing (*"Corrected 2026-09-23 by
  `TASK-0069`"*), so it is left to land with their commit rather than
  fought over. **It is therefore not in this task's commit** — stated here
  so the record and the commit agree.
- **This task committed with a path-limited commit**
  (`git commit -- <paths>`), which commits the working-tree state of the
  named paths only and **leaves their sixteen staged entries intact**. A
  plain `git commit` would have swept their unfinished work into this
  task's commit.

**Two agent sessions sharing one working tree and one git index is not
safe**, and this is the second time in two tasks it has changed what this
session did — `TASK-0068` had to renumber for the same reason. Worth a
human decision about worktrees or sequencing; raised in the handover rather
than decided here.

- Validation: `tests/validate.sh` → **OK**.
  `tests/smoke-mcp.sh --help` → header prints, **no shell code leaked**.
  `scripts/sync-registry.sh` → `docs/registry.md` unchanged, as forecast.
- Result: **done.** All seven acceptance criteria met. The headline is that
  the follow-up's framing was wrong: fifteen occurrences, one defect, and
  that defect was a **safety claim understating its own hazard** rather than
  the version number the follow-up named.
- Commit: `231bd54` — "Re-verify the gather_subset hazard under 2.21.4; fix
  two gate-cost claims". Pre-commit hook ran `tests/validate.sh` → OK.
  **Four paths, via `git commit -m … -- <paths>`.** The separation worked:
  the concurrent session's sixteen files landed independently as `48d64c9`
  ("[docs] Plan an unattended-run harness"), and this commit touched none of
  them. That commit carries this task's `CURRENT_STATE.md` correction, as
  anticipated above.
- Push: **confirmed** to `origin` (`48d64c9..231bd54`); branch in sync,
  `git remote -v` token-free.
