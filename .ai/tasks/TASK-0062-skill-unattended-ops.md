# TASK-0062 — Author `skills/unattended-ops/`

## Objective

Write the skill that owns the **method** the loop links to: the five rules and
the measured failure each answers, the verdict vocabulary, the evidence rule,
how to build a gate command map, and what a per-client binding must supply.

## Minimal context

The repo's core composition pattern: **the loop owns sequence and exit
conditions; the paired skill owns method and vocabulary**, and precedence is
stated in both directions. `skills/design-flow/` ↔ `loops/design-brief/` and
`skills/ansible-ops/` ↔ `loops/ansible-change/` are the two worked examples.

The five rules are not precautions. Each answers something measured in
`asset-management` on 2026-09-21/22, and the skill's job is to carry the
measurement with the rule — a rule whose cost is not recorded is a rule the next
reader will optimise away:

1. **The tracker moves last, and only the closer moves it.** An interrupted task
   leaves an untouched tracker and a dirty tree — a `git status` to read, not an
   evening of unpicking.
2. **Gate commands come from a hardcoded map, never a task file.** 29 scripts in
   one project open with a `-Run` guard and **exit 0 silently** without it;
   three more have mandatory parameters that prompt and hang. Several task files'
   own Verification blocks omit exactly those switches.
3. **Long gates are batched and detached.** A real build measured 68m10s, 70m23s
   and 72m44s; an agent's shell call is capped at ten minutes.
4. **Nothing is invented.** No id, no glyph outside the legend, no figure that
   did not come out of the evidence file.
5. **One writer.** Refuse to start on a dirty tree — learned when a peer session
   was found mid-task.

Two lessons from later runs belong here too, because both were bought
expensively: **role-blind gate lists are the only safe kind** (a `ui` module was
committed having only ever compiled the `data` workbook — it happened to be
clean, but that was luck), and **a form-like component can pass every gate
unread** if the gate list filters by extension.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `loops/unattended-run/loop.md` | `TASK-0061` | complete; its handover names every skill reference it links to |
| `skills/_template/SKILL.md` | pre-existing | frontmatter shape |
| `skills/design-flow/SKILL.md` | `TASK-0042` | the loop↔skill pairing, and its "Not a governance framework" section |
| `skills/ansible-ops/` | `TASK-0031` | the `references/` + `templates/` + unwired `scripts/` layout |
| `docs/development/authoring-guide.md` | `TASK-0058` | Skills schema; **the wiring-claim rule** |
| `.ai/decisions/0022-*.md` | `TASK-0057` | `Accepted`; clause 1.4 (a binding carries no rule of its own) |
| A119's task file (in `asset-management`) | pre-existing | **read-only** — the measurements and the four run reports |

**Verify the expected state; don't assume it.** Read the loop's handover section
first: the references it names are this task's required contents.

## Scope

### Included

- `SKILL.md` — frontmatter (`name: unattended-ops`, single-line `description`
  with the house `USE FOR:` / `DO NOT USE FOR:` clauses, `license`,
  `metadata.version`). Body: the five rules with their measurements; the division
  of labour across the nine roles; the ownership line stating that the loop owns
  sequence and this skill owns method; and a **"What this skill is not"** section
  — not enforcement, not a proof that a run is safe, and **not a third
  governance framework** (`ADR-0013`).
- `references/` — seven files: `five-rules.md`, `gate-map.md`, `verdicts.md`,
  `evidence.md`, `return-schemas.md`, `long-gates.md`, `park-and-recover.md`.
- `templates/binding.md` — the binding contract: one slot per thing a run cannot
  derive, every unfilled slot reading `unknown`, and **`unknown` is a stop**.
- Two honest caveats, stated rather than discovered:
  - **A prompt-stated schema is not an enforced schema.** The Claude Workflow
    runtime forces one; OpenCode does not. The rule every binding inherits: an
    unparseable or out-of-enum verdict is treated as `park`, **never** `accept`.
  - **A null refuter fails closed.** `arm-autopilot.js` lets a refuter returning
    nothing flow into the adjudicator as an absence of objections. Every binding
    must synthesise `refuted: true`.

### Not included

- The binding templates themselves and `scripts/check-binding.sh`. **S10**,
  S10.1. Keeping them out here keeps this task reviewable as prose.
- Restating the loop's sequence or its exit conditions.
- Restating `AGENTS.md`.
- Any project-specific gate command, tracker path or worklist.

## Likely files

- `skills/unattended-ops/SKILL.md` and `references/*.md`
- `skills/unattended-ops/templates/binding.md`
- `docs/registry.md` (generated)
- This task file

## Execution plan

1. Read the loop's handover and list every reference it names.
2. Read `skills/design-flow/SKILL.md` for voice and for the boundary-statement
   pattern.
3. Write `SKILL.md` lean; push detail into `references/`.
4. Write the seven references. `evidence.md` and `gate-map.md` carry the
   measurements — quote figures with their dates, and name the stale figures
   they supersede, because the stale ones are still written down elsewhere.
5. Write `templates/binding.md` with the `unknown`-is-a-stop rule.
6. **Check every claim the skill makes about this repository.** The wiring-claim
   rule applies to `skills/*/scripts/*`; this task ships no script, so it cannot
   trip — confirm that rather than assume it, and record the confirmation.
7. `scripts/sync-registry.sh`; `tests/validate.sh`; review; commit.

## Acceptance criteria

- [ ] `name` matches the directory; `description` is one line with USE FOR /
      DO NOT USE FOR; `metadata.version` is semver.
- [ ] Each of the five rules is stated **with the measurement that produced it**,
      dated.
- [ ] The two role-blind and invisible-component lessons are recorded.
- [ ] The verdict vocabulary defines all five verdicts and says when each
      applies, including why `raise-adhoc` returns a title only.
- [ ] `evidence.md` states that the evidence file is the only admissible source,
      and that a "Pending" result is an unwritten test rather than a pass.
- [ ] Both honest caveats — prompt-stated schemas, and the null refuter — are
      present.
- [ ] `templates/binding.md` carries every slot and the `unknown`-is-a-stop rule.
- [ ] A "What this skill is not" section is present and names `ADR-0013`.
- [ ] No sequence or exit condition from the loop is restated.
- [ ] `docs/registry.md` regenerated.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` then `git diff --exit-code docs/registry.md`

## Risks and rollback

- **Twelve false self-claims.** `TASK-0046` found exactly that in one new skill,
  and it is the origin of the wiring-claim rule. Every claim this skill makes
  about the repo must be checked against the repo.
- **Becoming a third governance framework.** `ADR-0013` forbids it; the explicit
  "what this is not" section is the control.
- **Copying the loop's steps in.** Creates a second owner of the sequence.
- **Quoting a stale measurement.** The ~70-minute build figure supersedes a
  21–24 minute figure still recorded in the source project's changelog. Quote
  the measured one and name the superseded one, or a later reader will average
  them.
- Rollback: delete the directory and regenerate the registry.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `skills/unattended-ops/SKILL.md` | Five rules with measurements; division of labour; ownership line; "what this is not" |
| `skills/unattended-ops/references/` | Seven files as listed |
| `skills/unattended-ops/templates/binding.md` | The binding contract, `unknown` is a stop |
| `docs/registry.md` | One new Skills row |

**Next task starts here**: `TASK-0063` authors the four thinking roles. Record
here the exact division of labour the skill states, because the roles must match
it — if a role's boundary and this skill's description of it disagree, that is
`B-021`'s defect class reappearing.

## Status
- Status: planned
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

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
