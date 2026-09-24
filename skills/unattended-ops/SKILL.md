---
name: unattended-ops
description: "The method behind the unattended-run loop - the harness's five rules and the measured failure each answers, the five verdicts, the evidence rule, how a gate command map is built, and what a per-client binding must supply. USE FOR: running or supporting loops/unattended-run/, writing or reviewing a binding, deciding whether a gate result may be quoted, choosing between accept, retry, park, raise-adhoc and halt-run. DO NOT USE FOR: a task whose design or scope is still open - that is loops/design-brief/; a single task with a human present - that is loops/project-build/; or governance and planning documentation, which is project-workflow and project-migration."
license: MIT
metadata:
  author: armando.martires
  version: "1.3.0"
---

# unattended-ops

The **method** for a run with nobody watching. `loops/unattended-run/loop.md`
owns the **sequence and its exit conditions**; this skill owns the **rules,
the vocabulary and the why**; a **binding** owns every client-specific
command. When the three appear to disagree: the loop wins on sequence and
exit conditions, this skill wins on what a term means, and a binding wins on
nothing at all — a binding that states a rule the loop and this skill do not
is a defect (`ADR-0022` clause 1.4), and `scripts/check-binding.sh` exists
for exactly that.

Nothing here is specific to one project. Gate commands, tracker paths,
worklists and commit shapes are **supplied per binding, never declared here**
— `templates/binding.md`.

## The five rules, and what each one cost to learn

These are not precautions. Each answers something **measured** in the sibling
repository `asset-management` (ad-hoc task **A119**) on **2026-09-21/22**,
across four live runs of the harness this skill generalises. The measurement
travels with the rule on purpose: a rule whose cost is not recorded is a rule
the next reader optimises away.

| # | Rule | The measurement that produced it |
|---|------|----------------------------------|
| 1 | **The tracker moves last, and only the closer moves it.** | An interrupted task leaves an untouched tracker and a dirty working tree — a `git status` to read, not an evening of unpicking. The ordering *is* the mechanism; nothing else enforces it. Still **unverified** as a property: `ADR-0022` **F9** is untested |
| 2 | **Gate commands come from a hardcoded map, never from a task file.** | **29 scripts** in one project open with a `-Run` guard and **exit 0 silently** without it; **3 more** have mandatory parameters that prompt and hang. Several task files' own Verification blocks omit exactly those switches. A gate read from the task it is verifying verifies nothing |
| 3 | **Long gates are batched and detached.** | One real build measured **68m10s, 70m23s and 72m44s**. An agent's shell call is capped at **ten minutes**. Three separate figures, not one rounded: the spread is what makes a single-sample timeout estimate useless |
| 4 | **Nothing is invented.** | No identifier, no glyph outside the legend, no figure that did not come out of the evidence file. The alternative to asking is parking, never guessing (`ADR-0022` clause 2.2) |
| 5 | **One writer.** | Refuse to start on a dirty tree. Learned when a **peer session was found mid-task** in the same checkout — the failure that later became this repo's own `ADR-0023` |

Detail, including the form each rule takes in a binding:
`references/five-rules.md`.

**Rule 2 is structural here, not instructed.** `arm-autopilot.js` hands a
gate command string to an agent and asks it not to "correct" a switch. A
driver has a shell and no ten-minute call cap, so the **driver** invokes the
gate from its own map and hands the agent only the evidence to read. No agent
in the run ever sees a verification command string, and rule 2's failure
becomes unreachable rather than forbidden (`ADR-0022`, *"two things the port
makes better than the original"*).

### Two lessons from later runs, bought just as expensively

- **Role-blind gate lists are the only safe kind.** A `ui` module was
  committed having only ever compiled the `data` workbook. It happened to be
  clean — that was luck, and luck is not a gate. A gate list that maps
  *this task's* files to *this task's* gates is how the map ends up with a
  missing entry; the entry it is missing is the one nobody notices.
- **A form-like component can pass every gate unread** if the gate list
  filters by extension. The gate set ran, exited 0, and had opened none of
  the files the task changed. `references/gate-map.md` states both as
  construction rules rather than as warnings.

## The five verdicts

The adjudicator returns **exactly one**. The enum has **one owner — this
skill** — because the loop's step 9 cites it and deliberately does not define
it.

| Verdict | When it applies |
|---------|-----------------|
| `accept` | Every acceptance criterion in the task file is evidenced, and the refutation raised nothing that was not answered or explicitly overridden. The only verdict that reaches the closer |
| `retry` | The defect is in **how** the work was done and is fixable inside the task file's existing criteria. **Attempt 1 only** |
| `park` | The work cannot be **proven** tonight. A stated reason and a named recovery; the run continues with the next task |
| `raise-adhoc` | A finding outside this task's scope. Returns a **title only** — allocating an identifier is the human's step (rule 4), and a wrong identifier in a committed register is worse than a note in a log |
| `halt-run` | Fixing the task would require amending **what** is to be built rather than **how**. The run ends; the remaining queue is untouched |

`park` is about **this task**; `halt-run` is about **the run**. Definitions,
the decision order, and what each verdict may and may not be used to smuggle:
`references/verdicts.md`.

## The evidence rule

**The run's evidence file is the only admissible source for a figure, and a
gate nobody read there did not run.** Not the agent's recollection, not the
gate's exit code, not a summary of the log. Figures are quoted **verbatim
from the gate's own output** — not paraphrased and not rounded — and a result
reading *Pending* is an **unwritten test**, not a pass.

This is what the closer copies from and what the refuter checks against;
`references/evidence.md` states it in full, including why a skip is a third
outcome rather than a quiet pass.

## Division of labour

Nine roles. The seam is **read-only versus acting**, and every hard boundary
decision lives on the acting side. **This table is the skill's statement of
each role's job**; the roles themselves are authored in `agents/`
(`TASK-0063`, `TASK-0064`) — if a role's boundary and
this description disagree, that is a defect in one of them, not a judgement
call at runtime.

| Role | Acts? | Owns |
|------|-------|------|
| `preflight` | read-only | Whether the run may start at all, and whether every queued task is locked |
| `task-planner` | read-only | A step list derived from the task file. Scope comes from the task file; a plan that adds a requirement is out of scope, not an improvement |
| `implementer` | writes files | The change, in the working tree. **No git, no tracker, no status row, no ticked criterion** |
| `gate-runner` | runs gates | **Reporting** each gate from the evidence file, per task and again in batch — and starting them itself only where the driver has no shell (`ADR-0025`). A runner, not a judge |
| `refuter` | read-only | Trying to **falsify the claim of completeness**. Uncertain means `refuted: true` |
| `adjudicator` | read-only | One verdict, with reasoning and an **overrides list** |
| `closer` | git + tracker | The **only** role with git or tracker rights, and only on `accept`. Stages with `git add -- <path>`, commits, reports the hash, pushes nothing |
| `park-steward` | git stash | Leaving a clean tree behind a park, under the run id and the reason. Never discards |
| `run-scribe` | writes files | The append-only journal **and** the re-derived handover, so the record and its summary have one owner |

Two of the nine port to Claude Code — `task-planner` and `adjudicator`, **the
two that only think**. The other seven need per-agent *command* boundaries,
which Claude Code has no expression for (`ADR-0022` Consequences,
`ADR-0018` clause 8.3). **This harness is OpenCode-first, and that is not a
temporary state.** Under Claude Code and Bionic the same method runs with
prompt-level rules that are **weaker by construction** — not equivalent, and
not to be described as equivalent.

## Two honest caveats

1. **A prompt-stated schema is not an enforced schema.** The Claude Code
   Workflow runtime forces a return shape; OpenCode does not. The rule every
   binding inherits: an **unparseable or out-of-enum verdict is treated as
   `park`, never as `accept`**, and every reprompt is journalled so the rate
   is measurable rather than folklore (`ADR-0022` **F3**, untested).
   `references/return-schemas.md`.
2. **A null refuter fails closed here, and failed open in the original.** In
   `arm-autopilot.js` a refuter returning nothing flowed into the adjudicator
   as an absence of objections. A silent refuter is not a clean bill of
   health. **The driver synthesises `refuted: true`** on a null, empty or
   unparseable return; it is not left to the role, and it is not retried.

## What this skill is not

- **Not enforcement.** It states the rules; only a binding on a client with
  per-agent command boundaries can *enforce* one, and only some of them. On
  every other client these are prompt-level rules and the difference is
  stated rather than glossed.
- **Not a proof that a run was safe.** `scripts/check-binding.sh` proves a
  binding *declares every step and phrases no uncited rule*. It cannot prove
  the binding implements a step correctly, that a gate was honest, or that an
  `accept` deserved to be one.
- **Not wired to any gate in this repository.** Nothing runs that checker:
  `tests/validate.sh`, `.githooks/pre-commit` and CI never execute it, and
  never read a binding or either fixture. The mandatory gate is offline and
  hermetic (`ADR-0007`) and a binding lives in a consuming repository, so
  there is nothing here for a gate to check. The decision and its cost are in
  `references/five-rules.md`.
- **Not an authorization.** An all-green gate set, an empty refutation, an
  `accept`, a clean handover and reaching the last step are what make work
  **ready** for the human gate; none of them passes it. **Merge and push
  remain the human's** (`ADR-0019` clauses 2.2 and 2.4, `ADR-0022`
  clause 4.2). Anyone describing this as end-to-end autonomous production is
  overstating it.
- **Not exercised in this repository.** The four live runs behind these rules
  happened in `asset-management`, against a Claude Code workflow. Nothing
  here has yet driven a run from this repo's own artifacts; treat the first
  binding's pilot as the first test (`PLAN-0006`, S10). The OpenCode
  binding's tests run against a **stub** `opencode`, and the Claude Code
  binding's against a **stub** Workflow runtime — models of the clients, not
  the clients.
- **Not a governance framework.** It ships the binding contract, two
  client bindings (`templates/bindings/opencode/` and
  `templates/bindings/claude-code/`) and a checker. No index, no task IDs, no sprint shape, no status vocabulary
  beyond the five verdicts and a binding's slot values. That layer is
  `project-workflow` and `project-migration`, which are two deliberately
  divergent frameworks — `ADR-0013`; do not add a third.

## References

| File | What it settles |
|------|-----------------|
| `references/five-rules.md` | Each rule in full, the measurement behind it, and the form it takes in a binding |
| `references/gate-map.md` | How a gate command map is built: role-blind, content-blind, one entry per task kind, and the switches that make a script lie |
| `references/verdicts.md` | The five verdicts, the order they are considered in, and the misuse each one attracts |
| `references/evidence.md` | The evidence file as the only admissible source; verbatim figures; `Pending` and skip as distinct non-passes |
| `references/return-schemas.md` | What each role returns, why a prompt-stated schema is not enforced, and the park-not-accept asymmetry |
| `references/long-gates.md` | Rule 3 in practice: the ten-minute call cap, the detaching entry point, batching, and the one retry |
| `references/park-and-recover.md` | What a park must leave behind so the next task starts clean, and what a human needs to finish it |
| `templates/binding.md` | The binding contract: one slot per thing a run cannot derive, and `unknown` is a stop |
| `templates/bindings/opencode/` | The OpenCode binding: `driver.py`, the `run-gate.sh` entry point, `binding.md`, and hermetic tests against a stub `opencode`. Nothing in this repository runs those tests |
| `templates/bindings/claude-code/` | The Claude Code binding: the `unattended-run.js` Workflow template, `binding.md`, and tests against a stub Workflow runtime. **Weaker by construction** than the OpenCode one — its binding says where. Nothing in this repository runs those tests |
| `scripts/check-binding.sh` | Read-only checker: a binding declares every numbered step of the loop and states no uncited rule. Nothing in this repository runs it |
| `fixtures/` | The checker observed failing for the right reason, then observed passing |

## Maintaining

Content changes bump `metadata.version` above (`ADR-0003`). If a rule here
and the loop's step list ever disagree, that is a defect in one of them, not
a judgement call to make at runtime — fix it before the next run. If the
loop's step **count** changes, `scripts/check-binding.sh` reads the step
numbers from `loop.md` rather than holding its own copy, so it follows
automatically; the fixtures do not, and must be re-checked.
