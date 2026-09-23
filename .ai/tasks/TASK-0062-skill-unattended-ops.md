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

  > **Amended at execution, 2026-09-23.** The checker **is** in scope after
  > all, and the brief was wrong to exclude it. `TASK-0061`'s handover section
  > *"What the loop links to in `skills/unattended-ops/` and does not yet
  > exist"* enumerates **five required contents**, and the fifth is *"the
  > binding-completeness checker — the script asserting that a binding
  > declares every numbered step of this loop and states no rule of its own"*.
  > Each of the five is a **live dangling reference** from
  > `loops/unattended-run/loop.md` today, and leaving one dangling was the
  > thing this task existed to stop. The **binding templates** (one per
  > client, `templates/bindings/<client>.md`) remain S10.1 as written; what
  > ships here is the **contract** (`templates/binding.md`) and the checker.
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

   > **Stale as written, 2026-09-23.** This task **does** ship a script, so the
   > rule applies directly and the "cannot trip" reasoning does not. The
   > confirmation performed instead is the stronger one: the gate was observed
   > **failing** on a deliberately injected positive claim before the negative
   > form was confirmed passing. Recorded in the execution log.
7. `scripts/sync-registry.sh`; `tests/validate.sh`; review; commit.

## Acceptance criteria

- [x] `name` matches the directory; `description` is one line with USE FOR /
      DO NOT USE FOR; `metadata.version` is semver.
- [x] Each of the five rules is stated **with the measurement that produced it**,
      dated.
- [x] The two role-blind and invisible-component lessons are recorded.
- [x] The verdict vocabulary defines all five verdicts and says when each
      applies, including why `raise-adhoc` returns a title only.
- [x] `evidence.md` states that the evidence file is the only admissible source,
      and that a "Pending" result is an unwritten test rather than a pass.
- [x] Both honest caveats — prompt-stated schemas, and the null refuter — are
      present.
- [x] `templates/binding.md` carries every slot and the `unknown`-is-a-stop rule.
- [x] A "What this skill is not" section is present and names `ADR-0013`.
- [x] No sequence or exit condition from the loop is restated.
- [x] `docs/registry.md` regenerated.
- [x] **Added at execution:** `scripts/check-binding.sh` exists, carries the
      **negative** wiring-claim form, and was observed failing for the right
      reason before it was observed passing.

## Mandatory validations

- [x] `tests/validate.sh` — `validate.sh: OK`, exit 0.
- [x] `scripts/sync-registry.sh` then `git diff --exit-code docs/registry.md`
      — the only diff against `HEAD` is one added Skills row; a second run
      produced no further change (idempotent).

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

*Verified 2026-09-23.*

| Artifact | End state |
|----------|-----------|
| `skills/unattended-ops/SKILL.md` | Five rules with measurements; the five verdicts; the evidence rule; division of labour; ownership line; "what this skill is not". **Verified.** |
| `skills/unattended-ops/references/` | Seven files as listed. **Verified.** |
| `skills/unattended-ops/templates/binding.md` | The binding contract: 20 slots, `unknown` is a stop. **Verified.** |
| `skills/unattended-ops/scripts/check-binding.sh` | The binding-completeness checker. Negative wiring form. **Verified.** |
| `skills/unattended-ops/fixtures/` | Two fixtures: the checker observed failing by name, then passing. **Verified.** |
| `docs/registry.md` | One new Skills row (`unattended-ops`). **Verified.** |
| `agents/`, `loops/`, `tests/`, narrative `.ai/` files | Untouched. **Verified.** |

### Two `ADR-0022` open questions, decided here

The ADR left both to this task, in its *"Not settled here"* list:

1. **Where the binding templates live inside the skill:**
   `skills/unattended-ops/templates/bindings/<client>.md`, one per client,
   with `templates/binding.md` as the contract they are copied from. This is
   `ADR-0022` clause 1.2's own wording (*"ships as a template under the owning
   skill's `templates/bindings/`"*) followed rather than reinterpreted. The
   directory does not exist yet; **S10.1 creates it**.
2. **Whether the checker is gated: no.** `tests/validate.sh` must stay offline
   and hermetic (`ADR-0007`), it never executes a skill's script, and a real
   binding lives in a **consuming** repository, so there is nothing here for a
   gate to point at — the only binding-shaped files in this repo are a
   template and two fixtures, and the template is *designed* to be rejected.
   The cost — the rule is mechanically unenforced here — is stated in
   `references/five-rules.md` rather than left to be discovered, which is the
   same bargain `skills/ansible-ops/` made with its change-record checker.

### The division of labour `TASK-0063`/`TASK-0064` must match

`SKILL.md`'s table is the statement; reproduced here only as the handover the
brief asked for. The seam is **read-only versus acting**.

| Role | Acts? | Owns |
|------|-------|------|
| `preflight` | read-only | Whether the run may start, and whether every queued task is locked |
| `task-planner` | read-only | A step list derived from the task file; adds no requirement |
| `implementer` | writes files | The change in the working tree. No git, no tracker, no status row, no ticked criterion |
| `gate-runner` | runs gates | Running what the map names and reporting. A runner, not a judge |
| `refuter` | read-only | Falsifying the claim of completeness. Uncertain means `refuted: true` |
| `adjudicator` | read-only | One verdict, reasoning, and an overrides list |
| `closer` | git + tracker | The **only** role with git or tracker rights, only on `accept`, stages `git add -- <path>`, pushes nothing |
| `park-steward` | git stash | A clean tree behind a park, under the run id and reason. Never discards |
| `run-scribe` | writes files | The append-only journal **and** the re-derived handover |

`task-planner` and `adjudicator` are the two that port to Claude Code — the
two that only think. **Every driver-invoked role is `mode: primary`**
(`ADR-0022` clause 5.1).

**Next task starts here**: `TASK-0063` authors the four thinking roles against
the table above. If a role's boundary and this skill's description of it
disagree, that is `B-021`'s defect class reappearing — fix it in one of them
before the roles land, not at runtime.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context), in worktree `t0062` on branch
  `agent/t0062` (`ADR-0023`; another session was live in worktree `t0059`).
- Actions:
  - Read the input gate first: `loops/unattended-run/loop.md` and
    `TASK-0061`'s handover section, which enumerates the **five required
    contents** as live dangling references. Verified `ADR-0022` reads
    **`Accepted — 2026-09-23`** and read all five Decision clauses;
    `PLAN-0006`; the Skills section and the wiring-claim section of
    `docs/development/authoring-guide.md`; `skills/ansible-ops/` end to end
    for house style, including its script header and its change-record
    template; `skills/design-flow/SKILL.md` for the boundary-statement
    pattern; `skills/_template/SKILL.md` for the frontmatter shape; and
    `tests/validate.sh`'s wiring-claim pass.
  - Wrote `SKILL.md` lean: the five rules as a table with their measurements,
    the two later lessons, the five verdicts as a table, the evidence rule in
    one paragraph, the nine-role division of labour, the two honest caveats,
    a "What this skill is not" section, and a References table.
  - Wrote the seven references: `five-rules.md`, `gate-map.md`, `verdicts.md`,
    `evidence.md`, `return-schemas.md`, `long-gates.md`,
    `park-and-recover.md`.
  - Wrote `templates/binding.md`: 20 slots, each with why a run cannot derive
    it, the `unknown`-is-a-stop rule, the four inherited rules stated in their
    **inherited** form with the owner named, and a "does and does not prove"
    caveat.
  - Wrote `scripts/check-binding.sh` and two fixtures.
  - Ran `scripts/sync-registry.sh`, then `tests/validate.sh`.
- Observations:
  - **The checker reads the step numbers from `loop.md`, not from a copy.**
    A checker holding its own copy of "fourteen" would be the second owner of
    the sequence that `ADR-0022` says to avoid. It parses `^\d+\. ` under
    `## Steps`, so a loop that gains a step is followed without editing the
    script — and a loop that numbers a step twice is reported as a
    `LOOP DEFECT` rather than worked around.
  - **Extra slots are allowed, deliberately differing from
    `check-change-record.sh`**, which rejects a tenth field. A change record
    is one fixed schema; a binding is per-client, and a closed list across
    three clients would force `not-applicable` noise on every client-specific
    setting. An extra slot is still checked for blank, placeholder and
    `unknown`. Recorded in the script header.
  - **The uncited-rule check judges a paragraph, not a sentence**, and matches
    the *form* of a rule (a modal verb) rather than its meaning. Both
    directions of the ceiling are stated in the header, because this is the
    same accepted limit the wiring-claim check documents: a check that guesses
    at meaning fires on correct text and gets deleted.
  - **The brief's step 6 was stale** and is annotated in place rather than
    rewritten: it reasoned that the wiring-claim rule "cannot trip" because
    the task ships no script. It does ship one.
  - **Nothing stale or wrong found in the loop.** All five of its dangling
    references now resolve, and no sequence, bound or exit condition from it
    is restated here — the attempt bound, the mechanical-retry bound and the
    reprompt bound are all referred to as "the loop's" without repeating the
    numbers, so each number keeps one owner.
  - **One stale figure carried deliberately, with its supersession named.**
    `references/five-rules.md` and `references/long-gates.md` both quote the
    measured **68m10s / 70m23s / 72m44s** build and both name the **21–24
    minute** figure still in the source project's changelog as superseded, so
    a later reader cannot average the two.
  - **`templates/bindings/` is named but not created.** It would be an empty
    directory git does not track, and S10.1 owns its contents.
- Validation:
  - `bash tests/validate.sh` → `validate.sh: OK`, exit 0.
  - `bash scripts/sync-registry.sh` → `Registry written to docs/registry.md`;
    diff against `HEAD` is exactly one added Skills row; a second run produced
    no further change (idempotent).
  - **The wiring-claim gate was proved to bite on this script**, not assumed
    to. A positive claim (*"This script is run from `tests/validate.sh` on
    every commit"*) was appended to `check-binding.sh`; `validate.sh` then
    printed `FALSE WIRING CLAIM: skills/unattended-ops/scripts/
    check-binding.sh:578 …` and exited **1**. The file was restored and the
    gate returned `validate.sh: OK`, exit 0. The shipped header carries the
    negative form, as `skills/ansible-ops/scripts/check-change-record.sh`
    does.
  - **The binding checker was proved to fail before it was trusted to pass.**
    `fixtures/incomplete-binding.md` → exit 1, naming **eleven** distinct
    defects: `MISSING SLOT: handover_path`, `DUPLICATE SLOT: task_cap`,
    `UNKNOWN SLOT: model`, `EMPTY SLOT: tracker_path`, two `PLACEHOLDER SLOT`s
    (`commit_shape`, `stash_namespace`), `UNDECLARED STEP: 12/13/14`,
    `PHANTOM STEP: 15`, and one `UNCITED RULE`. Then
    `fixtures/complete-binding.md` → exit 0,
    *"20 slots answered, all 14 loop steps declared, no uncited rule"*.
    `templates/binding.md` is rejected too, which is correct: a template is
    not a declaration about a run.
  - Idempotence and read-only-ness confirmed: the checker run three times
    left `git status --porcelain` showing only the new untracked directory.
  - Secret scan of the new files: nothing found. No credential, no path
    outside this repo, no client-specific command string.
  - No new validation was added to `tests/validate.sh` (out of scope by
    instruction), so `release-check` step 2 applies to the skill's own checker
    instead, and it was performed as recorded above.
- Result: acceptance criteria met. `skills/unattended-ops/` (12 files) and the
  regenerated `docs/registry.md` are the whole change, plus this task file.
- Commit: `<recorded below>`
- Push: **not pushed, and not rebased, deliberately.** Work was done in
  worktree `t0062` on `agent/t0062` under `ADR-0023`; the operator lands the
  concurrent branches serially and pushes from `master`. Recorded as a stated
  handover step rather than a missing one.
