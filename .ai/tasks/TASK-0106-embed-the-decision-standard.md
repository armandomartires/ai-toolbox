# TASK-0106 — B-035: embed the adjudicator's decision standard in its prompt

## Objective

Close `B-035` (`ready` since 2026-09-25, raised by `TASK-0101` while closing
`B-029`) by the route the human chose on 2026-09-26: **the driver embeds the
two references' text in the prompt.** The alternative — accepting the
standard as body-plus-enum and retiring `verdicts.md`'s description — was
considered and declined.

## Minimal context

`skills/unattended-ops/references/verdicts.md` and `references/evidence.md`
are described as the standard the adjudicator applies. It cannot read either.
The OpenCode binding's adjudicator prompt
(`driver.py:step9_adjudicate`) carries **the enum and the return shape only**,
and `prompt()` affirmatively instructs every role *not* to open
`skills/unattended-ops/` — correctly, because all nine roles declare
`worktree-only`, emitted as `external_directory: deny` (`TASK-0098`), and
reads of the skill were **57 of the S10.7 pilot's 92 denials** (`B-029`,
`TASK-0101`).

So the gap is not an oversight to undo: the denial is right, and the fix must
put the text *into* the prompt rather than give the role a path.

**Nothing observable has broken.** The pilot's adjudicator decided both tasks
correctly without either reference. This closes a documentation-to-reality
gap, not a failure.

**The constraint that decides the design:** `driver.py` is a template. Its own
docstring says *"a consuming repository copies this directory"* and runs it
from that repository's root — so after the copy, the skill's `references/`
are at **no known relative path**, and may not be present at all. A runtime
read of `skills/unattended-ops/references/*.md` works here and breaks in
every consumer. Equally, `driver.py` "carries NO RULE OF ITS OWN"
(`ADR-0022` clause 1.2), so the embedded text must be the references
**verbatim**, never a paraphrase — a paraphrase would make the driver an
owner of the standard.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/unattended-ops/references/verdicts.md` | S10 | 153 lines; owns the five-verdict enum and each verdict's definition |
| `skills/unattended-ops/references/evidence.md` | S10 | 86 lines; owns the evidence rule, rule 4's only mechanism |
| `.../bindings/opencode/driver.py` | `TASK-0086`+ | `step9_adjudicate` passes enum + return shape; `prompt()` forbids opening the skill |
| `.../bindings/opencode/binding.md` | `TASK-0086`+ | Says "Three files"; rule-4 row calls invention control "Partly ... prompt-level" |
| `tests/validate.sh` | many | 1325 lines; the mandatory gate. `validate.sh: OK` at `7a59f8c` |
| `docs/registry.md` + `scripts/sync-registry.sh` | `TASK-0011` | **The precedent being followed**: a derived artifact kept honest by a staleness check |

## Scope

### Included
- A generated `decision-standard.md` in the OpenCode binding directory,
  concatenating both references verbatim.
- `driver.py` reads it and embeds it in the adjudicator prompt only.
- A staleness check in `tests/validate.sh`.
- Tests; `binding.md` updated to match reality.

### Not included
- **The Claude Code binding has the same shape** (`unattended-run.js`
  step9Adjudicate carries `VERDICT_SCHEMA` and the enum, no standard). It is
  **deliberately left** to `TASK-0107`: whether *its* roles can read the skill
  turns on the `worktree-only` question `ADR-0018` clause 7 leaves open, and
  answering that first avoids building a workaround for a denial that may not
  exist on that client. Recorded, not dropped.
- No change to the verdict logic, the enum, or either reference's text.

## Likely files

- `skills/unattended-ops/templates/bindings/opencode/decision-standard.md` (new, generated)
- `skills/unattended-ops/templates/bindings/opencode/driver.py`
- `skills/unattended-ops/templates/bindings/opencode/binding.md`
- `skills/unattended-ops/templates/bindings/opencode/tests/test_driver.py`
- `scripts/sync-decision-standard.sh` (new)
- `tests/validate.sh`

## Execution plan

1. `scripts/sync-decision-standard.sh` concatenates the two references,
   verbatim, under a generated-file header naming both sources, and writes
   `decision-standard.md` into the OpenCode binding directory. Travels with
   the directory copy, so no new `<FILL:>` slot and no consumer burden.
2. `driver.py` loads it **relative to `__file__`** — the file is a sibling,
   so the path survives the copy — and **refuses to start** if it is missing
   or empty. A driver that silently prompts without the standard is the
   `ADR-0009` failure this repo already refuses: a check that quietly does
   nothing is worse than none.
3. `step9_adjudicate` embeds the text, labelled as the standard being applied
   and as owned by the skill. The adjudicator only; no other role's prompt
   changes, and `prompt()`'s do-not-open-the-skill instruction stays.
4. `tests/validate.sh`: fail if `decision-standard.md` is absent, or does not
   match a fresh concatenation of the two references. This is what stops the
   copy from becoming a second owner.
5. Tests: the prompt contains both references' text; the driver refuses when
   the file is absent.
6. `binding.md`: "Three files" → four, with the new file's purpose; rule 4's
   row updated to say the standard is now *in* the adjudicator's prompt.

## Acceptance criteria

1. The adjudicator's step-9 prompt contains the full text of both references.
2. The embedded text is **byte-identical** to the references; no paraphrase.
3. The driver refuses to start, loudly, when `decision-standard.md` is absent.
4. `tests/validate.sh` fails when the generated file drifts from its sources.
5. The binding's own tests pass; `tests/validate.sh: OK`.
6. `binding.md` describes the file count and rule-4 strength as they are.
7. No other role's prompt changes; `prompt()`'s skill denial is intact.

## Mandatory validations

- `bash tests/validate.sh`
- `python3 -m pytest skills/unattended-ops/templates/bindings/opencode/tests/ -q`
- Red-then-green on criteria 3 and 4: break each, observe the right failure,
  restore. A check that passes both ways is testing the wrong thing.

## Risks and rollback

- **Prompt size.** ~239 lines of markdown enter one role's prompt. Accepted:
  it is the standard that role applies, and the adjudicator is called once per
  attempt, not per round.
- **A second copy of the references.** Mitigated by criterion 4 — the copy is
  generated and gate-checked, the `docs/registry.md` pattern. Without that
  check this task would create exactly the drift `B-035` complains about.
- Rollback: revert the commit; the run harness returns to body-plus-enum.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `.../bindings/opencode/decision-standard.md` | New, generated: both references concatenated verbatim under a header naming them. Travels with the directory copy a consumer makes |
| `scripts/sync-decision-standard.sh` | New. Writes the above; `STANDARD_OUT` redirects it to a scratch path so the gate can generate-and-compare without rewriting the tracked file |
| `.../bindings/opencode/driver.py` | `decision_standard()` reads the sibling file and raises `Halt` if missing or empty; `main()` calls it **before any role runs**; `step9_adjudicate` embeds the text between explicit delimiters. No other prompt changed |
| `tests/validate.sh` | Fails when the generated file is missing or differs from a fresh generation. Compares with `cmp` against a scratch copy, **not** `git diff` — the git form passes vacuously on an untracked file |
| `.../bindings/opencode/binding.md` | File count corrected to four; rule-4 row records the standard now reaching the adjudicator |
| Claude Code binding | **Deliberately unchanged.** Same shape, but its fix depends on `TASK-0107`'s clause-7 answer |

**Next task starts here**: the OpenCode adjudicator is prompted with the
standard it is documented to apply, and drift is gate-checked. The Claude
Code binding still carries enum-and-schema only, by decision, pending
`TASK-0107`.

**Deviation from the Plan.** Step 4 was written as a `git diff` staleness
check and implemented that way first. The gate then showed it could not
fail: `decision-standard.md` was untracked, so `git diff --quiet` reported
no change regardless of content. Replaced with a generate-to-scratch-and-`cmp`
comparison, which is independent of whether the file is tracked.

## Status
- Status: **done**
- Owner: agent
- Created: 2026-09-26
- Completed: 2026-09-26
- Commit: `d50d220` — *Embed the adjudicator's decision standard in its prompt (TASK-0106)*
- Push: **confirmed** to `origin/master`, `7a59f8c..d50d220`, verified by comparing `git rev-parse HEAD` against `ls-remote` — both `d50d22021f5ea0e0d875870f4598d24118700165`, not by exit code

## Execution log

### Attempt 1

All seven acceptance criteria met.

**Validations, run and quoted:**
- `bash tests/validate.sh` → `validate.sh: OK`
- `python3 -m unittest discover -s .../opencode/tests` → `Ran 39 tests in
  212.787s / OK` (36 pre-existing, 3 added)

**Red-then-green, criterion 4** (the staleness check fails on drift):
appended a line to `decision-standard.md` → `STANDARD: ... is stale against
references/verdicts.md and references/evidence.md`, `validate.sh` exit `1`.
Removed the file → `STANDARD: missing ...`. Restored → exit `0`.

**Red-then-green, criterion 3** (the driver refuses without the standard):
`REFUSED: decision standard unreadable at ...; it is generated by
scripts/sync-decision-standard.sh and must be copied beside driver.py`, and
`self.invocations() == []` — no role ran.

**Red-then-green, criterion 1** (the embed reaches the prompt): reverted
step 9 to its genuine pre-change form → `AssertionError: '--- BEGIN DECISION
STANDARD ---' not found in 'You are the adjudicator role of ...'`, the run
otherwise completing normally.

**Two defects found in my own work, both recorded rather than quietly fixed:**

1. **The staleness check could not fail.** Written first with
   `git diff --quiet`, which reports no change for an **untracked** file —
   and `decision-standard.md` was new. It would have passed vacuously for as
   long as the file went uncommitted, which is precisely this repository's
   most-repeated lesson recurring inside the task that cites it. Replaced
   with generate-to-scratch-and-`cmp`, independent of tracking. Recorded as
   a deviation under Outputs / handover.
2. **The first red proof was invalid.** Hand-reverting the embed broke
   `driver.py`, so the test errored with `IndexError` before the adjudicator
   was invoked — a failure for the wrong reason, which proves nothing about
   the assertion. Redone against the real pre-change step 9.

**Deliberately not done:** the Claude Code binding's identical gap, left to
`TASK-0107` for the reason given under Scope / Not included.
