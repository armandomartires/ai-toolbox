---
name: ansible-change
description: Apply a change to Ansible content in a live estate through nine gates, cheapest and safest first, closing with a machine-checked change record. Run for any change to a playbook, role, inventory or group_vars that will reach real hosts.
---

# Ansible Change Loop

Takes one Ansible change from "believed correct" to "applied, verified, and
recorded". This loop owns the **sequence and its exit conditions** only. The
vocabulary it uses and the reasoning behind each gate live in the artifacts
linked below, which are **normative** for both. Where this loop mentions their
content — e.g. each gate's expected output, the field-to-gate mapping, the
`unknown` rule, the hazard classes — that mention is a deliberate **partial
summary, subordinate** to the linked artifact: it says only what its reader
needs at that point, it is never authoritative, and on any disagreement the
linked artifact wins. The list is illustrative, not a complete inventory of
this loop's restatements; treat **every** mention of linked content as
subordinate, including ones not named here.

- `skills/ansible-ops/SKILL.md` — the obligation set, why each gate exists,
  the Ansible-vs-Python boundary, Vault and log hygiene, the narrow-`forks`
  rationale. **Normative for what a term means**, and the tie-breaker on
  vocabulary. It does not define every term this loop uses: the nine record
  field names are settled by `templates/change-record.md`, and the fidelity
  verdicts by `references/check-mode-fidelity.md`. Where a term is defined in
  a more specific artifact below, that artifact is where to look first.
- `skills/ansible-ops/references/derivation.md` — where each answer comes
  from, and the `unknown` rule.
- `skills/ansible-ops/references/hazards.md` — hazard classes and the
  mounts exclusion.
- `skills/ansible-ops/references/check-mode-fidelity.md` — what a clean
  `--check` does and does not prove.
- `skills/ansible-ops/templates/change-record.md` — the record's schema.
- `AGENTS.md` — destructive changes, secrets, git rules.

If this loop and `skills/ansible-ops/` disagree on what a term means, the
skill wins. If this loop and `AGENTS.md` disagree, `AGENTS.md` wins. This
loop wins only on sequence and exit conditions.

**Inputs the loop requires before step 1:** the change itself, and **the path
where the change record will be written**. The record's location is the
estate's choice, not this loop's — a change with no record path is an
unanswerable obligation, which escalates without retrying rather than
defaulting to somewhere.

## Trigger
A change to Ansible content is believed correct and is intended to reach real
hosts. Run this before the change is applied, not after.

**Not for:** content still being drafted; a change that will never leave a
development sandbox; and not as a post-hoc write-up of a change already
applied — a record produced after the fact records nothing about gates that
were never performed. If the change is already live, that is an incident, not
this loop.

## Steps

Nine gates, **cheapest and safest first**. A gate with no recorded output is
indistinguishable afterwards from a gate that was skipped — which is why each
gate below states what it is expected to produce.

**Three gates produce no frontmatter field:** gate 3 (parse) produces none at
all; gate 7 (bounded apply) produces none of its own, because `hosts_limit`
holds the limit *derived* at gate 1 rather than evidence the apply honoured
it; and gate 8 (verify the effect) is recorded in the record's **body**. The
checker reads only the frontmatter, so it cannot detect any of the three being
skipped. All three rest on the operator's word; do not read a green checker as
covering them. Which field belongs to which gate is settled by the **Filled
at** column of `skills/ansible-ops/templates/change-record.md`.

1. **Derive the estate's answers to the obligation set.** By reading files,
   per `references/derivation.md`'s five roles. No script, no connection, no
   playbook run. Includes the **hazard-class assessment of every target** and
   which exclusion applies — that review belongs here, before the first
   connection, because the fact-gathering hazard fires *during* connection.
   Expected: an answer per role, each attributed to the file that filled it;
   `hosts_limit`, `modules_touched` and `gather_subset_reviewed` determined.
   `modules_touched` is derived here, by reading the change — it is what makes
   gate 5's coverage obligation a fixed set rather than one discovered as
   modules run. **Any role yielding `unknown` stops the loop here** — it is
   never replaced by a default.

2. **Lint the content.** Cheapest feedback, no target, no connection.
   Expected: lint ran to completion, and `lint_run` records **that** it ran.
   The loop does not gate on the outcome and no later step depends on it;
   any objection lint raised is a judgement for a human to record in the
   record's body.

3. **Syntax and parse check.** Confirm the play, its roles, and its includes
   parse, and that referenced variables and roles resolve.
   Expected: a clean parse. A play that cannot parse cannot be reviewed
   either, so a failure here is fixed before anything else — reviewing an
   unparseable play means reviewing something that never runs.

4. **Run check mode with diff, against the derived limit.** Read-only, and
   bounded by gate 1's `hosts_limit` rather than by the play's own pattern.
   Expected: a diff a human can read, task by task, plus the recorded fact
   that check mode ran and against what. `check_mode_run` is filled.
   Note explicitly: `changed=0` here is **not** evidence the target is
   already correct.

5. **Give a fidelity verdict per module touched.** For every module in
   `modules_touched`, derive `proven` or `not-applicable` from role 5 —
   module documentation at the version actually installed.
   Expected: `check_mode_fidelity` covers **every** module in
   `modules_touched`, with no entry left `unknown`. A module with no verdict
   is `unknown`, and `unknown` is not a pass.

6. **Snapshot, and verify the rollback path exists.** After check mode
   deliberately: `--check` is read-only, so snapshotting before knowing a
   change is needed costs storage every run. Before apply necessarily: a
   rollback path discovered to be absent after applying is not a rollback
   path.
   Expected: `snapshot_ref` names this change's snapshot, and
   `rollback_verified` records **how the path was verified to exist** — not
   that snapshots are configured, and never an assumption that the safety net
   exists.

7. **Apply, bounded.** Narrowest limit that still accomplishes the change,
   lowest useful concurrency. Widen only deliberately, per change, with the
   reason recorded — concurrency is blast radius, not throughput.
   Expected: the apply completes within the derived limit, with per-host
   output legible in order.

8. **Verify the effect, not the exit code.** Read the resulting state
   directly: read the file, query the resource, inspect the service. A zero
   exit says the tool ran; a `changed=` count says what modules decided.
   Expected: observed state matches intent, recorded in the record's body. A
   second run agreeing with the first is not verification — it is two runs of
   the same blind spot.

9. **Close the record, then check it.** Record the approval in `approver`,
   fill every remaining field, then run
   `bash skills/ansible-ops/scripts/check-change-record.sh <record-path>`.
   Expected: `RECORD OK` and exit 0, with **no field named**. A non-zero exit
   names the field, and the field names the gate that was skipped — go back
   to that gate rather than editing the field. Which gate a field belongs to
   is settled by the **Filled at** column of
   `skills/ansible-ops/templates/change-record.md` — the one complete
   statement of the mapping, which overrides any summary of it here.
   The checker is read-only. It proves the nine fields are present, none blank
   or a placeholder, none duplicated, none `unknown`, no tenth field present,
   and every module in `modules_touched` carrying a verdict — so a non-zero
   exit is not always an `unknown`; read the message. It does not prove the
   gates were performed honestly, that the snapshot is restorable, or that a
   node cannot hang. **Nothing in `ai-toolbox` runs it for you** —
   `tests/validate.sh`, the pre-commit hook and CI never do; this step is the
   only thing that invokes it.

## Exit conditions

- **Success:** gates 1–9 all met their expected outputs, gate 9's checker
  exited 0 naming no field, and the record exists at the agreed path. The
  change is applied, verified by observed state, and recorded.

- **Failure — a gate's expected output is not met:** fix the cause and
  **restart from the gate whose expected output failed**, then continue
  forward through the remaining gates. **Bound: 3 attempts per gate.** After
  a third failure at the same gate, stop and escalate to the human with what
  was tried and what the failure actually said. Repeated identical failure
  means the diagnosis is wrong, not that the fix needs another pass.

- **Failure — the checker names a field at gate 9:** the named field
  identifies the skipped gate, via the **Filled at** column of
  `skills/ansible-ops/templates/change-record.md` — that table is the only
  **complete** statement of the field-to-gate mapping, and every mention of the
  mapping in this loop is a partial summary **subordinate** to it. Return to
  **that gate** and perform it. Note that the mapping is many-to-one: three
  fields are filled at gate 1 and two at gate 6, so several complaints can
  resolve to one gate. Do **not** fill the field to
  satisfy the checker: a field edited to make the checker pass is the exact
  substitution `references/derivation.md` forbids, and it defeats every
  downstream check while leaving the record looking complete. Same bound: 3
  attempts.

- **Failure — gate 8 shows observed state not matching intent:** do not
  re-apply hoping for a different result. Roll back using the verified path
  from gate 6, then restart from gate 1 — the derivation was wrong about
  something. Bound: 3 attempts, then escalate.

- **Escalate WITHOUT retrying — an obligation cannot be answered.** Any role
  in the obligation set yielding `unknown`, including a missing record path.
  A retry re-derives the same absence of knowledge; what is missing is
  evidence, not an attempt. Never substitute a default.

- **Escalate WITHOUT retrying — `check_mode_fidelity: unknown`** for any
  module touched. `unknown` is not a pass, and re-running check mode against
  a module whose check path is unassessed produces the same unassessed result
  with more confidence attached to it.

- **Escalate WITHOUT retrying — the required action is destructive.** A
  deletion, an overwrite of human changes, a history rewrite, a force-push,
  or a change whose failure mode is not reversible by the gate-6 rollback
  path. `AGENTS.md` requires explicit human authorization first, and no
  number of retries substitutes for it.

- **Escalate WITHOUT retrying — a play targets a hazard-class host without
  the mounts exclusion.** This is hazard class 1, worked through in
  `references/hazards.md` — documented from evidence read read-only, **not
  reproduced by running anything**, per `SKILL.md`'s "not exercised against a
  real estate": a blocked stat on a wedged clustered mount is
  **uninterruptible — not even `timeout` recovers it**, and there is no
  global mechanism to prevent it, so the exclusion must be present on the
  play or as a module argument. Retrying re-triggers the hazard; the second
  attempt does not succeed, it wedges another node. This repository ships
  **no enforcement** of this condition (`B-011` open) — the stop is this
  loop's, performed by whoever runs it.

- **Failure — a secret appears in the record, in output, or in the diff:**
  stop immediately. Do not commit, do not paste the output anywhere durable.
  Remove the secret, then restart from gate 1. A record never carries secret
  material; it records that a gate was performed, never what was used to
  perform it.
