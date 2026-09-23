# What each role returns, and why the schema is not enforced

A driver dispatches on what a role returns. That makes each return a
**contract**, and it makes the honesty of this page more important than its
completeness: **a prompt-stated schema is not an enforced schema.**

## The caveat first, because everything below depends on it

The Claude Code Workflow runtime forces a return shape. **OpenCode does
not** — a role is asked, in its prompt, to return a shape, and usually does.

So every binding inherits one rule:

> **An unparseable or out-of-enum return is treated as the safe value, never
> as the permissive one.** For the adjudicator that means **`park`, never
> `accept`**. For the refuter it means **`refuted: true`, never an absence of
> objections.**

Reprompt **once** for an unparseable verdict, **journal the reprompt**, then
park. The journal line is what makes the frequency measurable rather than
folklore — `ADR-0022` **F3** (*"a prompt-stated return schema is honoured
often enough to drive control flow"*) is **untested**, and the reprompt rate
is the measurement that would settle it.

**Extraction is structural, not prose-parsed.** Against
`opencode 1.18.31`, `--format json` emits newline-delimited JSON with
`type` ∈ {`step_start`, `text`, `tool_use`, `step_finish`}; the final message
is at `part.text` where `type == "text"`, and **a denied tool call is a
`tool_use` with `part.state.status == "error"`**, so a refusal is
structurally distinguishable from a failure (`TASK-0055`, 2026-09-23). One
extraction function, with raw stdout as the fallback. Re-verify rather than
cite: both clients' surfaces moved three times in four days during
`TASK-0036`.

## The returns

Shapes, not field names — a binding picks the encoding its client can parse.
What is normative is **which facts each return must carry** and **what the
driver does when one is missing**.

| Role | Must carry | Missing or unparseable → |
|------|-----------|--------------------------|
| `preflight` | Branch, short HEAD, verbatim `git status --porcelain`, and a verdict of `proceed` or `halt` naming any dirty path | `halt`. A preflight halt is **never retried** |
| `task-planner` | The exact files to change, what is reused and from where, the order, and how each step will be verified | Mechanical failure: retry the step, then park the task |
| `implementer` | The exact list of files changed; or an explicit `blocked` with a reason; and **every unsatisfied acceptance criterion, reported rather than dropped** | Treat as `blocked`; park the task |
| `gate-runner` | Per gate: state, exit code, elapsed time, the verbatim evidence line, and any figure the criteria want | The gate **did not run** (`references/evidence.md`) |
| `refuter` | Unevidenced criteria, unevidenced or undeclared changes, breached invariants, and a `refuted` flag — **true when any list is non-empty, and true by default when uncertain** | **`refuted: true`, synthesised by the driver.** Not a mechanical failure, and **not retried** |
| `adjudicator` | Exactly one of the five verdicts, reasoning, and an **overrides list** naming every finding downgraded to advisory with its reason | Reprompt once, journal it, then **`park`** |
| `closer` | The commit hash, a clean tree, and nothing pushed; or an explicit refusal naming what it found | Park. **Do not retry the close and do not commit** |
| `park-steward` | An empty `git status --porcelain`, the named stash entry, and the paths captured | Mechanical failure; if it cannot be made clean, the run cannot safely continue |
| `run-scribe` | One appended line per event, never truncated, never rewritten | Mechanical failure: the run's record is the one thing nothing else can reconstruct |

## The null refuter, specifically

In the original harness (`arm-autopilot.js`) a refuter returning nothing
flowed into the adjudicator **as an absence of objections**. A silent refuter
is not a clean bill of health, and this is the one defect the port fixes
rather than inherits.

**The driver synthesises `refuted: true`.** Three properties, each
deliberate:

1. It is **the driver's** job, not the role's. A role that has failed to
   return cannot be relied on to return a default.
2. It is **not a mechanical failure**, so it is not retried. Re-asking a
   silent refuter until it speaks is a way of converting an objection into a
   pass.
3. The cycle **continues to adjudication** carrying it. The adjudicator may
   override it — and if it does, that override is named in the overrides
   list, which is the audit trail for a decision nobody watched being made.

## Why the asymmetry is not paranoia

A false green and a false alarm are not symmetric here. A false alarm costs a
park: the work is stashed, a question goes into the handover, and a human
answers it in the morning. A false green costs a commit that everything
downstream trusts, made by a filter the human believes stood in front of the
gate. **A run with nobody watching can only be trusted in the direction of
refusing.**
