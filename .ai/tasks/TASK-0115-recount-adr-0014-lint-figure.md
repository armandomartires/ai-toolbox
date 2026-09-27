# TASK-0115 — Re-run ADR-0014's "53 rules / 0 violations" under ansible-core 2.21.4

## Objective

Discharge `ADR-0014`'s standing evidence caveat by re-running the lint figure
it rests its "the linting capability is real and works" claim on, under the
version actually installed. The ADR states the figure "was observed under
2.20.8 and has **not** been re-run under 2.21.4", and that "a reader
re-checking that number should expect to re-run it first". `TASK-0108` closed
the *version-claim count* across this repo and explicitly left this
measurement. It is the last live item under `SPRINT-CURRENT.md`'s heading 6.

Now, because the subject has changed more than the version has — see below.

## Minimal context

**The figure and its scope.** `ADR-0014` records that `TASK-0027`'s binary
(`ansible-lint 26.8.0`, `ansible-core 2.20.8`) evaluated **53 rules** against
the target estate's **two** real playbooks under `profile: production` and
returned **0 failures, 0 warnings, exit 0**.

**The version moved, and less than expected.** Measured 2026-09-27 by running
the binary at `~/.venvs/sigma-ansible/bin/ansible-lint`:

```
ansible-lint 26.8.0 using ansible-core:2.21.4 ansible-compat:26.8.0
```

So `ansible-lint` is **unchanged at 26.8.0**; only `ansible-core` moved,
2.20.8 → 2.21.4. Since the rule *count* is `ansible-lint`'s, the naive
expectation is that 53 is still 53 — which is precisely why this needs running
rather than reasoning about. `ansible-lint 26.9.0` is available upstream and is
**not** installed here; nothing in this repo tracks it.

**The subject moved a great deal, and this is the finding that makes the task
worth doing.** Counted 2026-09-27 at
`/home/armando.martires/SIGMA-infrastructure`:

| | At `TASK-0027` (2026-09-14) | Now (2026-09-27) |
|---|---|---|
| Playbooks | **2** | **17** |
| Roles | not recorded | **19** |

A re-run is therefore not a formality against a frozen subject. The original
"0 violations" says nothing about the fifteen playbooks and nineteen roles
added since, and a re-run that reports the new number **without stating that
the denominator changed** would read as continuity when it is not.

**What a clean result does and does not license.** `ADR-0014` already fixes
this and the re-run must not widen it: a clean lint result "says the playbooks
satisfy 53 structural rules. It says nothing about whether the modules involved
implement check-mode meaningfully … and nothing about the `ansible_mounts`
hazard, which no built-in rule encodes." And the ADR's second qualification is
the sharper one: a custom rule outside the active profile is **loaded, listed
and never evaluated at exit 0** — `TASK-0027` needed four runs to see this, and
"the first was silent, which alone reads as 'custom rules don't work'". So an
exit 0 here is not by itself evidence that the estate's own rules ran.

**The estate is a separate repository and stays untouched.** `TASK-0027`'s
human decision was to copy to `/tmp/opencode/` and not lint in place, which
keeps the target repo clean but "degrades" the run — the degradation is
recorded there and must be reproduced or re-decided, not silently dropped.
`ansible-lint` can write with `--write`; that flag is never passed.

**One thing already known to be stale in the estate, and out of scope.**
`/home/armando.martires/SIGMA-infrastructure/ansible.cfg` still asserts that
`ansible-config validate` "rejects `gather_subset` as an unknown [defaults] key
outright", and still says "in ansible-core 2.20.8" and "It has five now"
playbooks. `TASK-0108` established that under 2.21.4 the key is accepted
**silently** — and corrected this repo's own copy of the claim in
`docs/design/ansible-ops-brief.md`. The estate's copy is in another repository
and is **not** this task's to fix; it is handed over.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/decisions/0014-accept-pinned-ansible-mcp-surface.md` | TASK-0054 | `Accepted`; caveat at lines 8–15; the 53-rule evidence at ~60–75 |
| `.ai/tasks/TASK-0027-spike-lint-real-playbooks.md` | TASK-0027 | `done`; records the `/tmp/opencode/` copy decision, the four-run custom-rule finding, and the vault-password degradation |
| `.ai/tasks/TASK-0108-ansible-core-version-recount.md` | TASK-0108 | `done`; live version `2.21.4`; ~38 dated records deliberately left |
| `~/.venvs/sigma-ansible/bin/ansible-lint` | pre-existing, outside this repo | `26.8.0` using `ansible-core 2.21.4` — confirmed by running it 2026-09-27. **Not on `PATH`** (`TASK-0052` D4) |
| `/home/armando.martires/SIGMA-infrastructure/` | pre-existing, separate repository | Present; **17** playbooks, **19** roles, `inventory/production.yml`, `ansible.cfg` with `vault_password_file = tools/vault_pass.sh`; clean tree at `2a6be9a` |
| `/tmp/opencode/` | pre-approved scratch | Writable; pre-approved for work outside the workspace |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

One re-measurement, the ADR caveat it discharges, and an honest statement of
what changed underneath it.

### Included

- Re-run the lint under `profile: production` on a `/tmp/opencode/` copy,
  reproducing `TASK-0027`'s method including its recorded degradations.
- Report **three** numbers, not one: rules evaluated, violations, exit code —
  and the playbook/role count they were measured against.
- State the 2 → 17 playbook change explicitly, so the new figure cannot be read
  as confirming the old one.
- A deliberate control for the silent-custom-rule trap: confirm that what ran
  is what was expected to run, by the method `TASK-0027` arrived at after four
  attempts.
- Replace `ADR-0014`'s caveat with a dated result, preserving the original
  2.20.8 text rather than overwriting it — the `TASK-0069`/`TASK-0108` shape.
- Record, without acting, whether `ansible-lint 26.9.0` matters.

### Not included

- **No write to `/home/armando.martires/SIGMA-infrastructure/`.** It is a
  separate repository with its own governance. Never pass `--write`.
- **No fix to the estate's `ansible.cfg`**, including its now-false
  `gather_subset` rejection claim and its stale playbook count. Handed over.
- **No upgrade of `ansible-lint`** to 26.9.0. Changing the tool in the same run
  that re-measures it makes the delta unattributable.
- **No change to `ADR-0014`'s decision**, only to its evidence. The ADR says in
  as many words that it "does not rest on the count".
- **Nothing about `skills/ansible-ops/` being unexercised** — that is
  `TASK-0116`.
- **No re-run of `TASK-0031`'s `gather_subset` guard** against the fifteen new
  playbooks. If the count suggests it should happen, raise it; a guard re-run is
  a different measurement with a different blast radius.

## Likely files

- `.ai/decisions/0014-accept-pinned-ansible-mcp-surface.md` — caveat replaced
  with a dated result
- `.ai/tasks/TASK-0115-recount-adr-0014-lint-figure.md` — this file
- `.ai/planning/SPRINT-CURRENT.md` — heading 6's remaining item closed
- `.ai/context/CURRENT_STATE.md` — a dated section
- `.ai/planning/BACKLOG.md` — likely one item, for the fifteen unlinted-at-the-
  time playbooks or for the estate's stale `ansible.cfg`
- Scratch, not committed: `/tmp/opencode/ansible-lint-recount/`

## Execution plan

1. Record the binary's version by running it, not by citing this brief. Record
   the estate's `git rev-parse HEAD` and `git status --porcelain`.
2. Count playbooks and roles in the estate and record both numbers.
3. Copy `playbooks/`, `roles/`, `inventory/production.yml`, `ansible.cfg` and
   whatever `TASK-0027` found necessary into a fresh
   `/tmp/opencode/ansible-lint-recount/`. Record what was copied.
4. Re-read `TASK-0027`'s degradation notes — the vault password file in
   particular — and reproduce or consciously re-decide each. Record which.
5. Run the lint under `profile: production`. Capture full stdout, stderr and
   the exit code.
6. Extract the rule count, violation count and exit code. If the rule count is
   not 53, that is the headline and it gets investigated before anything else.
7. Run the control for the silent-rule trap: establish positively that the
   rules believed to be active were evaluated, not merely listed.
8. Re-verify the estate is untouched: `git status --porcelain` empty, `HEAD`
   unmoved from step 1.
9. Update `ADR-0014`: original text preserved, dated result appended, caveat
   marked discharged.
10. Raise backlog items for anything found and deliberately not fixed.

## Acceptance criteria

- [ ] The re-run's rules-evaluated, violations and exit code are all recorded,
      with the command and its raw output.
- [ ] The playbook and role counts at measurement time are recorded beside the
      figure, and the 2 → 17 change is stated in the ADR, not only here.
- [ ] The binary's version line is pasted from an actual run.
- [ ] Step 7's control is recorded and shows positively that the expected rules
      were *evaluated* — a bare exit 0 does not satisfy this criterion.
- [ ] Every degradation from `TASK-0027`'s method is either reproduced or
      re-decided in writing; none is silently dropped.
- [ ] `ADR-0014`'s original 2.20.8 evidence text is still present, and the new
      result is additive and dated.
- [ ] The estate repository's `git status --porcelain` is empty and its `HEAD`
      is unchanged, both pasted.
- [ ] `ansible-lint 26.9.0` has a recorded disposition, even if it is "not
      adopted, no action".

## Mandatory validations

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed)
- [ ] `git -C /home/armando.martires/SIGMA-infrastructure status --porcelain` empty, before and after

## Risks and rollback

- **Writing to the live estate.** `ansible-lint --write` reformats in place.
  Mitigated by linting only the `/tmp/opencode/` copy, never passing `--write`,
  and by step 8's verification — the same three controls `TASK-0027` used.
- **Reading exit 0 as "the estate's rules ran".** The documented trap: a rule
  outside the active profile is loaded, listed and never evaluated, at exit 0.
  Step 7 is the whole defence; without it the run is worth little.
- **Reporting the new figure as confirmation of the old.** The denominator went
  from 2 playbooks to 17. Guarded by the second acceptance criterion.
- **Decrypting vault content into a world-readable `/tmp`.** `TASK-0027`
  recorded a vault-password degradation for this reason. Step 4 must re-decide
  it deliberately; if any decryption happens, `/tmp/opencode/` permissions are
  checked and the copy is removed afterwards.
- **Scope drift into fixing the estate.** Two known-stale claims are sitting
  there. They are listed in "Not included" precisely because they are tempting.
- **Rollback:** `git revert` the documentation commit; delete the scratch tree.
  The estate is never written to, so there is nothing to roll back there — and
  step 8 proves it rather than assuming it.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          | what it now contains, plus anything deliberately *not* changed |

**Next task starts here**: one line naming the state the next task picks
up from — not a prediction of what that task will be. Record any
deviation from the Plan here too: the next task may have been scoped
against the original.

## Status

- Status: ready   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-27
- Updated: 2026-09-27

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
