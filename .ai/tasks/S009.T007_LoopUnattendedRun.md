# TASK-0061 — Author `loops/unattended-run/loop.md`

## Objective

Write the loop: the sequence of an unattended task run and its exit conditions,
client-agnostic, naming abstract roles and **linking** to the rules it enforces
rather than restating them.

Authored **before** the roles, so the roles are shaped by the sequence rather
than the reverse — the order S7 chose deliberately and recorded.

## Minimal context

This is the third loop in a family and must be distinguishable from the other
two at a glance, because the failure mode is a reader running the wrong one:

- `loops/design-brief/` — **requires a human in the session.** Converges on an
  accepted, locked brief.
- `loops/project-build/` — implements one locked brief, human present, stops
  before merge and push.
- **This loop** — **requires that no human is in the session**, and requires one
  before and after.

So its `## Trigger` must state the inverse of `design-brief`'s
*"Requires a human in the session… This loop cannot be run unattended"* with
equal force, and explain what happens to every point at which `project-build`
would stop and ask: it **parks the task, journals the question, takes the next
task**. That is `ADR-0022` clause 2, and it is a narrowing of `ADR-0019`
clause 2.5, not a departure from it.

The bound is **2**, not this repo's standing 3, and the loop must say why: a
retry here costs a full implement-plus-gate cycle that can run an hour with no
human to stop a bad third attempt, and 2 is the bound the live runs actually
used. `design-brief` set the precedent for justifying a bound in the loop file
rather than in an ADR, so the number has one owner.

`validate.sh` gates only that the three headings exist. The numbering, the
Expecteds and the bounds are **not** checked — which the guide states in its
Gated column, and which is exactly why they must be right by hand.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/decisions/0022-*.md` | `TASK-0057` | **`Accepted`.** All four clauses final |
| `loops/_template/loop.md` | pre-existing | the three required headings |
| `loops/design-brief/loop.md` | `TASK-0041` | the house style; the human-in-session statement to invert |
| `loops/project-build/loop.md` | `TASK-0044` | the interactive sibling; its step 7/8 commit-but-do-not-push shape |
| `loops/release-check/loop.md` | pre-existing | the exit-condition vocabulary — bounds, hard stops, escalate-without-retry |
| `docs/development/authoring-guide.md` | `TASK-0058` | the Loops gated schema |
| `.claude/workflows/arm-autopilot.js` (in `asset-management`) | A119 | **read-only reference** for the sequence. Not edited, not imported |
| `.ai/decisions/0019-*.md` | pre-existing | clauses 2.1–2.5, read in full |

**Verify the expected state; don't assume it.** ADR-0022 must read `Accepted`.

## Scope

### Included

- Frontmatter: `name: unattended-run` matching the directory, single-line
  `description`. **Not a folded or block scalar** — the gate rejects the bare
  sigil, and the failure is invisible in the registry.
- `## Trigger` — what starts it, what it is **not** for, and the
  human-in-session statement in all three tenses (before / during / after).
- `## Steps` — numbered, actor in parentheses, each with an **Expected**.
  Fourteen steps covering preflight, the per-task cycle, park cleanup,
  journalling, batched long gates, handover and stop.
- `## Exit conditions` — the success terminus; the 2-attempt bound with its
  stated divergence; `halt-run`; mechanical-failure retries bounded at 3 that
  **park the task and continue** rather than ending the run; dependency skip
  forward; and the escalate-without-retry list.
- A precedence chain, as both existing loops carry: `AGENTS.md` wins over the
  loop; `ADR-0022` wins over the loop.
- An explicit "never treat as authorization" clause: not an all-green gate set,
  not an empty refutation, not an `accept` verdict, not reaching the last step.

### Not included

- The roles. `TASK-0063` and `TASK-0064`.
- The method — the five rules, the verdict definitions, the evidence rule. Those
  are `skills/unattended-ops/`, and the loop **links** to them. A loop that
  copies them creates a second owner that will drift.
- Any binding. Any gate command. Any project-specific detail.
- Restating `AGENTS.md`'s rules.

## Likely files

- `loops/unattended-run/loop.md`
- `docs/registry.md` (generated)
- This task file

## Execution plan

1. Confirm ADR-0022 reads `Accepted`. Stop if not.
2. Re-read both sibling loops for voice and structure.
3. Read `arm-autopilot.js`'s control flow for the sequence — **the sequence
   only**. Its prompts are a binding's business.
4. Draft the three sections. Write the Expecteds first: a step whose expected
   output cannot be stated is a step that cannot be judged done.
5. Check every step against `ADR-0019` clauses 2.1–2.5 and `ADR-0022`'s four
   clauses. Anything that conflicts is a defect in the step, not in the ADR.
6. `scripts/sync-registry.sh`; confirm the Loops section gains one row.
7. `tests/validate.sh`; review the diff; commit.

## Acceptance criteria

- [x] The three required headings are present and the gate passes.
- [x] `name` matches the directory; `description` is one line and not folded.
- [x] Every step is numbered, names its actor, and states an Expected.
- [x] `## Trigger` states what the loop is **not** for, and names both sibling
      loops as the alternatives.
- [x] The human-in-session requirement is stated in all three tenses.
- [x] The 2-attempt bound is stated **with its reason and its divergence from 3
      acknowledged**.
- [x] Every failure path carries a bound or an escalation.
- [x] Commit-without-push is stated, with the note that push is the operator's.
- [x] No rule from `AGENTS.md` or from the skill is restated — only linked.
- [x] `docs/registry.md` regenerated.

## Mandatory validations

- [x] `tests/validate.sh` — `validate.sh: OK`, exit 0.
- [x] `scripts/sync-registry.sh` then `git diff --exit-code docs/registry.md`
      — the script is idempotent; a second run produced no further change, and
      the only diff against `HEAD` is the one new Loops row.

## Risks and rollback

- **A placeholder exit condition passing the gate.** `ADR-0019`'s own stated
  fear: the gate checks the heading, not the content, so a placeholder in a file
  the gate marked green is precisely the check-that-cannot-fail shape.
- **Restating rules instead of linking.** The guide names the consequence: a
  second owner that drifts.
- **Copying `arm-autopilot.js`'s prompts into the loop.** They are a binding's
  content and are Claude-Code-shaped. `ADR-0022` clause 1.4 forbids the reverse
  direction too.
- **Describing the harness as fully autonomous.** It is not; push is the human's.
- Rollback: delete the directory and regenerate the registry.

## Outputs / handover

*Verified 2026-09-23.*

| Artifact | End state |
|----------|-----------|
| `loops/unattended-run/loop.md` | Fourteen numbered steps with Expecteds; trigger with negatives and the three-tense human statement; exit conditions with bounds and the escalate-without-retry list. **Verified.** |
| `docs/registry.md` | One new Loops row (`unattended-run`). **Verified.** |
| `agents/` | Unchanged — the roles are 0063/0064. **Verified.** |

**Next task starts here**: `TASK-0062` writes `skills/unattended-ops/` to own
the method this loop links to.

### What the loop links to in `skills/unattended-ops/` and does not yet exist

These are `TASK-0062`'s **required contents**, not suggestions. Each is a live
dangling reference from `loops/unattended-run/loop.md` today:

1. **The harness's five rules.** Named in the loop's header list, defined
   nowhere in this repo. `ADR-0022` describes two of them in passing (rule 2,
   the gate-command boundary made structural; rule 3, the detaching gate entry
   point behind `F7`) but does not enumerate all five.
2. **The five verdict definitions** — `accept`, `retry`, `park`,
   `raise-adhoc`, `halt-run`. Step 9 requires *"exactly one of the five
   verdicts defined in `skills/unattended-ops/`"* and deliberately does not
   define them, so the enum has one owner. Until the skill lands, step 9 cites
   an enum that exists only in `ADR-0022`'s Context section and in
   `asset-management`'s `ADJUDICATION_SCHEMA`.
3. **The evidence rule** — that the run's evidence file is the only admissible
   source for a figure, and that a gate nobody read there did not run. Steps 7,
   8 and 10 all depend on it.
4. **The binding contract** — what a binding must supply, and that every
   unfilled slot reads `unknown`, which is a stop (`PLAN-0006`).
5. **The binding-completeness checker** — the script asserting that a binding
   declares every numbered step of this loop and states no rule of its own
   (`ADR-0022` clause 1.4, and its Consequences: *"the skill ships a checker
   asserting a binding declares every numbered step"*). Note `ADR-0022` leaves
   **where the binding templates live inside the skill** and **whether the
   checker is gated** open, and requires the checker to carry the negative
   wiring-claim form or `validate.sh`'s wiring-claim check fails the commit.

### What the loop names in `agents/` and does not yet exist

`TASK-0063` and `TASK-0064` own these. The loop names **nine** roles, matching
`ADR-0022`'s and `PLAN-0006`'s count, and says so in the file so a tenth is a
divergence to reconcile rather than an addition to absorb:

`preflight`, `task-planner`, `implementer`, `gate-runner`, `refuter`,
`adjudicator`, `closer`, `park-steward`, `run-scribe`.

Three of these names are fixed by `ADR-0022` itself (`task-planner`,
`adjudicator`, `gate-runner`); the other six are set here, by the loop, which
is the point of authoring the loop first. `run-scribe` owns **both** the
append-only journal (step 12) and the re-derived handover (step 14) so the
record and its summary have one owner — the choice that keeps the count at
nine rather than ten.

Two constraints the roles inherit from this loop rather than from the ADR:
`closer` is the **only** role with git or tracker rights and runs only after an
`accept`; and every role the driver invokes must be selectable as a *primary*
agent (`ADR-0022` clause 5.1), which the loop makes a **preflight check**
rather than an assumption.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context), in worktree `t0061` on branch `agent/t0061`
  (`ADR-0023`; two other sessions were live in sibling worktrees).
- Actions:
  - Verified the input gate: `.ai/decisions/0022-*.md` reads
    **`Accepted — 2026-09-23`**, ratified as written, with a fifth Decision
    clause added after the spikes. Gate cleared.
  - Read both sibling loops (`design-brief`, `project-build`) and
    `release-check` for voice, structure and exit-condition vocabulary; the
    Loops section of `docs/development/authoring-guide.md` for the gated
    schema; `loops/_template/loop.md`; `ADR-0019` clauses 1–3 in full;
    `PLAN-0006`.
  - Read `asset-management/.claude/workflows/arm-autopilot.js` **read-only**,
    for its control flow only — preflight, the `while (attempt < 2)` cycle,
    `parkCleanup`, `journal`, the batched stage gates, the handover. Its
    prompts were not copied; they are a binding's content and are
    Claude-Code-shaped (`ADR-0022` clause 1.4).
  - Wrote `loops/unattended-run/loop.md`: frontmatter, a header link list, a
    provenance section, `## Trigger`, fourteen numbered steps each naming an
    actor and stating an Expected, and `## Exit conditions`.
  - Ran `scripts/sync-registry.sh`, then `tests/validate.sh`.
- Observations:
  - **Two ADR facts are structural in the loop rather than described by it.**
    The null refuter is made to **fail closed** at step 8 — the driver
    synthesises `refuted: true` on a null, empty or unparseable return and
    passes it on as an objection — and this is explicitly *not* a mechanical
    failure and *not* retried, so it cannot be silently re-rolled into a pass.
    The `ask`-auto-denies finding is placed in `## Trigger`'s "during" tense,
    as the reason asking is not merely useless unattended but actively
    misleading: it records a human decision that never happened. The loop
    therefore states that boundaries are declared as explicit denials, never
    as prompts, and never uses the word "confirm" for an unattended step.
  - **Three bounds exist and are deliberately not merged**: 2 acceptance
    attempts per task, 3 mechanical retries of a failing step, 1 reprompt of an
    unparseable adjudicator verdict. The 2 is stated with its reason and with
    its divergence from this repo's standing 3 acknowledged in the loop file,
    per `design-brief`'s precedent that the number has one owner.
  - **A mechanical failure parks the task and continues the run**; it does not
    end the run. Only `halt-run`, a preflight halt, and a secret already
    committed this run end it. `halt-run` still runs step 14, because a halted
    run with no handover is indistinguishable from a crashed one.
  - **`git add -- <path>` is written into step 10 as a command *form***, with
    the reason (`git add ./sub/file` is denied for want of the `--`), because a
    role told only "stage what you changed" will be blocked doing the right
    thing and may conclude staging is broken.
  - **Preflight checks the two silent failures**, since neither is visible once
    the run is under way: an unresolvable model (hangs with no output, no
    error, no exit) and a non-primary role (silently replaced by the default
    agent, well-formed output, exit 0).
  - **Deliberately not in the loop.** The five rules, the five verdict
    definitions, the evidence rule, the binding contract and its checker —
    all `skills/unattended-ops/` (`TASK-0062`), linked not restated. The roles'
    permission maps and `mode:` values — `TASK-0063`/`TASK-0064`. Any gate
    command, any worklist, any tracker path, any commit-message shape — a
    binding's. `AGENTS.md`'s rules are cited, never copied.
  - **Nothing stale found in the brief.** Its one forecast that needed
    resolving was the role count: `ADR-0022` and `PLAN-0006` both say nine, and
    the sequence as written naturally wanted ten, so journalling and the
    handover were given to a single `run-scribe`. Recorded in Outputs rather than
    silently absorbed.
  - The registry conflict the brief predicted is real but not mine to resolve:
    this commit adds one Loops row; another session is changing the Agents
    section of the same generated file in parallel.
- Validation:
  - `bash tests/validate.sh` → `validate.sh: OK`, exit 0.
  - `bash scripts/sync-registry.sh` → `Registry written to docs/registry.md`;
    diff against `HEAD` is exactly one added Loops row; a second run produced
    no further change (idempotent).
  - Secret scan of the diff: nothing found. No command, credential, path
    outside this repo, or client-specific string was introduced.
  - No new validation was added, so `release-check` step 2 (prove a new check
    bites) does not apply.
- Result: acceptance criteria met; `loops/unattended-run/loop.md` and the
  regenerated `docs/registry.md` are the whole change. `agents/` untouched.
- Commit: `ed18c52` — *Add loops/unattended-run for ADR-0022 unattended task
  runs*. Recorded in a follow-up commit rather than by amending, because an
  amend changes the hash it is trying to record: `loops/release-check/` step 8
  says *"write the resulting hash back into the task file and amend"*, and an
  amend that rewrites the commit invalidates the figure just written. This
  repo's own recent history already uses the follow-up form (*"Record TASK-0077
  commit hash and confirmed push"*), so the practice is followed rather than
  the literal wording. **A defect in step 8 worth raising**, noted here rather
  than fixed, since `loops/release-check/loop.md` is outside this task's scope.

### Correction applied at landing (main session, 2026-09-23)

The loop named the ninth role **`scribe`**, while `PLAN-0006`,
`SPRINT-CURRENT.md` and **`TASK-0064`'s own brief** all name it
**`run-scribe`**. Left as written, `TASK-0064` would have authored
`agents/run-scribe/` while this loop cited a role that does not exist — a
claim an artifact makes about its own wiring, falsified by the artifact, which
is the defect class `TASK-0046` found twelve times and `TASK-0075` gated for
`delegates_to`.

Renamed to `run-scribe` here rather than renaming it in three planning
documents, because the planned name is the one the unwritten task will follow.
The consolidation this role represents — journal and handover are two acts
given to one role, so the count stays nine — is **unchanged and still worth
`TASK-0063`/`TASK-0064`'s attention**, as the report flagged.

- Push: **not pushed, deliberately.** This work was done in worktree `t0061`
  on `agent/t0061` under `ADR-0023`; the operator lands all three concurrent
  branches serially by rebase and pushes from `master`. Recorded as a stated
  handover step rather than a missing one.
