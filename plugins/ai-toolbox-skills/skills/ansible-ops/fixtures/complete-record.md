---
hosts_limit: one-host-in-a-single-group
modules_touched:
  - a_config_module
  - a_service_module
check_mode_run: "yes — against the limit above, with --diff"
check_mode_fidelity:
  a_config_module: proven
  a_service_module: not-applicable
snapshot_ref: snapshot-identifier-returned-by-the-platform
rollback_verified: "yes — the platform was confirmed able to take and list this snapshot before apply"
gather_subset_reviewed: "yes — mount collection excluded on the play"
lint_run: "yes"
approver: a-named-human
---

# Fixture — the POSITIVE case, complete

**This is a fixture, not a record.** It exists so
`scripts/check-change-record.sh` is **observed passing** immediately after
being observed failing on `incomplete-record.md`. A check that fails
unconditionally is worse than none, so the pass is as necessary as the
failure.

## Why every value here is deliberately generic

No hostname, no inventory filename, no real snapshot identifier, no estate
name. The values are role-shaped placeholders that are nonetheless **legal**,
which is the distinction from `templates/change-record.md`: the template's
`<FILL: ...>` placeholders are deliberately illegal and make the template
fail the checker, while these are legal values that happen to be generic.

## What differs from the negative fixture

Exactly the three defects, fixed:

| Field | Negative fixture | Here |
|-------|------------------|------|
| `snapshot_ref` | `unknown` | a snapshot identifier |
| `rollback_verified` | `unknown` | how the rollback path was verified to exist |
| `approver` | absent | present |

`check_mode_fidelity` is unchanged between the two fixtures, which
demonstrates that it was never the thing failing the negative case. The rule
under test is `unknown` being fatal **anywhere**.

## Expected checker behaviour

Exit 0, printing `RECORD OK` and the caveat.

**Nothing re-runs this.** No gate in `ai-toolbox` executes the checker or reads
this file — `tests/validate.sh`, the pre-commit hook and CI all ignore it. Like
the negative fixture, it records an observation made by hand, not a test a
suite repeats.

## The honest caveat

This record passes because its **nine fields are present, none blank, none a
placeholder, none duplicated, none says `unknown`, no tenth field is present,
and both modules carry a verdict**. Nothing here proves a node cannot hang,
that this snapshot could actually be restored, that check mode meant anything
for either module, or that any gate was performed honestly. The checker
validates a record, not the act — and this fixture in particular describes no
real change at all.
