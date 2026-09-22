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

- [ ] The three required headings are present and the gate passes.
- [ ] `name` matches the directory; `description` is one line and not folded.
- [ ] Every step is numbered, names its actor, and states an Expected.
- [ ] `## Trigger` states what the loop is **not** for, and names both sibling
      loops as the alternatives.
- [ ] The human-in-session requirement is stated in all three tenses.
- [ ] The 2-attempt bound is stated **with its reason and its divergence from 3
      acknowledged**.
- [ ] Every failure path carries a bound or an escalation.
- [ ] Commit-without-push is stated, with the note that push is the operator's.
- [ ] No rule from `AGENTS.md` or from the skill is restated — only linked.
- [ ] `docs/registry.md` regenerated.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` then `git diff --exit-code docs/registry.md`

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

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `loops/unattended-run/loop.md` | Fourteen numbered steps with Expecteds; trigger with negatives and the three-tense human statement; exit conditions with bounds and the escalate-without-retry list |
| `docs/registry.md` | One new Loops row |
| `agents/` | Unchanged — the roles are 0063/0064 |

**Next task starts here**: `TASK-0062` writes `skills/unattended-ops/` to own
the method this loop links to. Record here every link the loop makes to a skill
reference that does not exist yet — those are `TASK-0062`'s required contents,
not suggestions.

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
