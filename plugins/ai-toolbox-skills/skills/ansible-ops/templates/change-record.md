---
# THIS IS A TEMPLATE, NOT A RECORD. Every value below is a placeholder in
# <ANGLE BRACKETS> and is deliberately not a legal value, so this file fails
# scripts/check-change-record.sh if anyone points the checker at it. That
# failure is correct: a template is not evidence about a change.
hosts_limit: <FILL: the limit actually passed, verbatim>
modules_touched: <FILL: list of module names — or not-applicable with a reason>
check_mode_run: <FILL: yes | no | not-applicable — plus what it ran against>
check_mode_fidelity:
  # `unknown` IS a legal derivation outcome (references/check-mode-fidelity.md
  # names three verdicts) but is NOT a recordable value: it stops the change
  # before a record is closed. So only two verdicts can ever appear here.
  <FILL-module-name>: <FILL: proven | not-applicable>
snapshot_ref: <FILL: identifier of the snapshot taken, or not-applicable>
rollback_verified: <FILL: how the rollback path was verified to EXIST>
gather_subset_reviewed: <FILL: yes + the exclusion applied, or not-applicable>
lint_run: <FILL: yes | no — that it ran, nothing about the outcome>
approver: <FILL: who approved this change>
---

# Change record — `<FILL: short description of the change>`

## What this is

One record per change, written as the gates in
`skills/ansible-ops/SKILL.md` are performed and closed at gate 9. The **YAML
frontmatter above is the checked surface**: `scripts/check-change-record.sh`
reads it, and nothing else in this file.

Copy this file to wherever your estate keeps records. **This skill does not
say where** — that is deliberately the consuming estate's choice, and the
checker takes a path so it never needs to know. The record's path is an
input to `loops/ansible-change/loop.md`; a change with no record path is an
unanswerable obligation, not a change with a default location.

**Bounded on purpose:** per-change, ephemeral, no index, nothing aggregates
records, no status vocabulary beyond the field values below, no task IDs, no
sprint shape. A record schema is one index away from being a governance
framework, and this bound is the answer to that.

## The nine fields

Exactly these nine, no more. The **Filled at** column is the gate whose
performance produces the value, and it is the column the checker's complaint
points back to. It is numbered against the **nine gates** of
`loops/ansible-change/loop.md`, never against the eight obligations of
`SKILL.md` — the two sets are different lengths and confusing them misroutes
the remedy.

This column is the **only complete statement** of the field-to-gate mapping —
the only place where all nine fields are each paired with a gate. `SKILL.md`
and `loops/ansible-change/loop.md` restate parts of it on purpose: `loop.md`
names the fields each gate is expected to fill, because a step has to say what
it produces, and both files summarise the many-to-one and no-field-at-all
properties below. Those restatements are **subordinate**: where one disagrees
with this column, this column is right. Changing a **Filled at** value
therefore means re-checking them, not only this file.

| Field | Filled at | Also used at | What it records |
|-------|-----------|--------------|-----------------|
| `hosts_limit` | 1 | 4, 7 | The host limit **actually passed**, verbatim — not the intended scope described in prose |
| `modules_touched` | 1 | 5 | Every module the change invokes. Derived with the rest of the obligation set; it is the key set `check_mode_fidelity` must cover |
| `check_mode_run` | 4 | — | That check mode with diff was run, and what it ran against |
| `check_mode_fidelity` | 5 | — | **Per module**, one of `proven` or `not-applicable`. Gate 5 can also *derive* `unknown` — the third verdict in `references/check-mode-fidelity.md` — but `unknown` stops the change, so it never reaches a closed record |
| `snapshot_ref` | 6 | — | The identifier of the snapshot that was taken. Not "snapshots are enabled" — the reference to this change's snapshot |
| `rollback_verified` | 6 | — | How the rollback path was verified to **exist**. Never assume the safety net exists |
| `gather_subset_reviewed` | 1 | — | That hazard-class exposure was reviewed and which exclusion was applied — `references/hazards.md` |
| `lint_run` | 2 | — | **That lint ran. Nothing about its outcome** |
| `approver` | 9 | — | Who approved the change |

### The mapping is not one field per gate, and not every gate

Read the table in the direction the checker is used — **from a named field
back to a gate** — and two properties matter, because a remedy that assumes
otherwise goes to the wrong gate:

- **Three fields are filled at gate 1** (`hosts_limit`, `modules_touched`,
  `gather_subset_reviewed`) **and two at gate 6** (`snapshot_ref`,
  `rollback_verified`). So a complaint names a gate, not a unique field, and
  clearing several complaints can mean returning to one gate.
- **Gates 3, 7 and 8 fill no field.** Gate 3 (syntax and parse) leaves no
  trace at all. Gate 7 (bounded apply) leaves none of its own — `hosts_limit`
  records the limit that was *derived* at gate 1, not proof the apply honoured
  it. Gate 8 (verify the effect) is recorded in the **body**, which the
  checker never reads. A record can therefore be fully green for a change
  whose play was never parsed, whose apply ran unbounded, and whose effect was
  never verified. Those three gates rest on the operator's word; the checker
  does not stand behind them, and `SKILL.md`'s **second** load-bearing property
  of the gate order — the bullet beginning "Every record field maps back to a
  gate" — names the same three gates.

## Three rules that make this record mean something

**1. `unknown` is fatal in *any* field.** Not only in
`check_mode_fidelity`. The checker exits non-zero naming the field, whichever
field it is. `snapshot_ref: unknown` is not a lesser problem than
`check_mode_fidelity: unknown` — it means nobody knows whether a rollback
exists, which is exactly the assumption that turns a change into an outage.

The value is judged **after** the record is parsed as YAML, so the rule
survives the spellings the checker's header enumerates — but **not every
possible spelling**: the anchor, tag and escape forms listed there as known
gaps (`&a unknown`, `!!str unknown`, `"unkno\x77n"`) still pass, because
closing them needs a real YAML parser and this repository ships none. Do not
restore an "every spelling" claim without closing them. A trailing comment
(`snapshot_ref: unknown  # admin unreachable`), a flow sequence
(`[unknown]`), a flow mapping, a block or folded scalar, and any casing all
decode to the same fatal answer. A `#` inside a quoted string stays data, so
a legitimate identifier like `"snap#0001"` is untouched.

**2. `not-applicable` is the explicit legal alternative.** When a field
genuinely does not apply to this change, write `not-applicable` **with the
reason** in the body below. It is a deliberate declaration by a person, and
that is what distinguishes it from `unknown`, which means nobody knows. A
blank, a placeholder, or an omitted field is treated as missing — not as
`not-applicable`.

The distinction is the whole mechanism. If `not-applicable` gets used as a
polite spelling of `unknown`, this record becomes decoration.

**3. `check_mode_fidelity` must cover every module in `modules_touched`.**
The checker cross-references the two fields and exits non-zero naming any
module that carries no verdict, because a module nobody assessed is `unknown`
by omission — and the unassessed module is precisely the one likely to behave
differently under `--check`. Presence of both fields was never the question.
`modules_touched: not-applicable` names no module and so creates no coverage
obligation.

### `lint_run` asserts nothing about the outcome

`lint_run` records **that** the linter ran. It does not record, imply, or
depend on what the linter said. No decision anywhere in this skill rests on
an observed lint result: a clean lint is a style and schema opinion, and
role 4 in `references/derivation.md` exists precisely because a linter's
exclusion list is a list of things nobody is checking.

`lint_run: yes` alongside a change that lint objected to is not a
contradiction — it is an honest record plus a judgement that belongs in the
body, stated by a person.

## Body — the reasoning the frontmatter cannot hold

The frontmatter is machine-checked; the body is where the reasoning lives.
The checker never reads any of it, which means it is also the only place
where an omission goes undetected. Write it anyway.

### Derivation

For each role in `references/derivation.md`, which file filled it and what
the answer was. **A role with no file yields `unknown`, and `unknown` stops
the change.**

1. Config that declares the inventory: `<FILL>`
2. The inventory itself: `<FILL>`
3. The estate's stated change-safety procedure: `<FILL>`
4. Lint configuration and its exclusions: `<FILL>`
5. Module documentation for check-mode behaviour, at the installed version:
   `<FILL>`

### Reasons for every `not-applicable`

One line each, naming the field. A `not-applicable` with no reason here is
an `unknown` in disguise.

`<FILL>`

### Hazard-class review

Which targets were assessed as hazard-class, and the exclusion applied.
`<FILL>`

### Verification of effect

What state was **read** after the apply — gate 8. Not the exit code, not the
`changed=` count. `<FILL>`

### Deviations

Anything performed out of order, skipped, or done differently from the gate
sequence, and why. `<FILL>`

## What a complete record does and does not prove

A record that passes the checker proves **its nine fields are present, none is
blank or a placeholder, none is declared twice, none says `unknown`, no tenth
field was added, and every module in `modules_touched` carries a verdict**.
That is all. (The converse does not hold as a shortcut: a record can have all
nine fields with nothing saying `unknown` and still be rejected — for a
duplicate, a blank, a placeholder, a tenth field, or an uncovered module.)

It does not prove the gates were performed honestly, that the snapshot is
restorable, that check mode meant anything, or that a node cannot hang. The
checker validates a record, not the act. This caveat is part of the artifact
and is not to be softened.

**Nor is the checker wired to anything.** No gate in this repository runs it —
not `tests/validate.sh`, not the pre-commit hook, not CI. It runs when step 9
of `loops/ansible-change/loop.md` runs it, by hand.

It is also **silent about three gates by construction**, not merely
untrustworthy about them: gates 3, 7 and 8 fill no frontmatter field, so no
possible checker output distinguishes a change whose play was never parsed,
whose apply ran wider than the derived limit, and whose effect was never read
from one where all three were done properly.
