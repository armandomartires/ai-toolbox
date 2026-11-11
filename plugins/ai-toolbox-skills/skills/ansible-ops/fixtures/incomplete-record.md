---
hosts_limit: one-host-in-a-single-group
modules_touched:
  - a_config_module
  - a_service_module
check_mode_run: "yes — against the limit above, with --diff"
check_mode_fidelity:
  a_config_module: proven
  a_service_module: not-applicable
snapshot_ref: unknown
rollback_verified: unknown
gather_subset_reviewed: "yes — mount collection excluded on the play"
lint_run: "yes"
---

# Fixture — the NEGATIVE case, deliberately incomplete

**This is a fixture, not a record.** It exists so
`scripts/check-change-record.sh` is **observed failing for the right reason**
before it is trusted. A check never seen to fail has not been validated.

## The three defects it carries, on purpose

1. **`snapshot_ref: unknown`** — the central rule: `unknown` is fatal in
   **any** field, not only in `check_mode_fidelity`. This is the defect that
   matters most, because the narrow reading of the rule would let this record
   through while nobody knows whether a rollback exists.
2. **`rollback_verified: unknown`** — a second field, so the checker is seen
   to report **every** offending field rather than stopping at the first. One
   fixed field must not turn into a green record.
3. **`approver` is absent entirely** — the missing-field path, distinct from
   the `unknown` path. An omitted field is missing; it is never read as an
   implicit `not-applicable`.

Note what is **not** wrong here: `check_mode_fidelity` is fully populated and
legal, and `a_service_module: not-applicable` is the explicit legal
alternative to `unknown`. The record still fails. That is the point — a
record can satisfy the one field the rule is most often associated with and
still be unacceptable.

## Expected checker behaviour

Non-zero exit, naming `snapshot_ref`, `rollback_verified`, and `approver` —
three problem lines, one per defect, and no others.

Naming them is the requirement. A bare non-zero status would not tell an
operator which gate was skipped, and the field name is the only thing that
does.

**Nothing re-runs this.** No gate in `ai-toolbox` executes the checker or reads
this file — `tests/validate.sh`, the pre-commit hook and CI all ignore it. This
fixture is a record of an observation an author made by hand, not a test a
suite repeats. If the checker regresses, nothing here will notice.

## The honest caveat

Passing the checker proves **a field is present, not blank, not a placeholder,
not duplicated, and not `unknown`** — and that every module in
`modules_touched` carries a verdict. It does not prove that a node cannot hang,
that the snapshot is restorable, or that any gate was performed honestly. The
checker validates a record, not the act.
