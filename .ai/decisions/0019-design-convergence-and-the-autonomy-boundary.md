# ADR-0019 — Design convergence is human acceptance; autonomy stops at the merge gate

## Status
**Accepted — 2026-09-15.** Ratified by the human on the date it was
proposed. Opened by `PLAN-0004` (sprint S7).

**Not blocked on a spike**, unlike ADR-0017 and ADR-0018. This decision
rests on rules already written in this repo and on one vendor constraint
quoted from live documentation, so it needed ratification rather than
evidence. It was `proposed` rather than `accepted` at authoring time
because it **narrows a stated requirement**, and narrowing a requirement is
the human's call, not the agent's.

**Correction made at ratification.** The proposed text said "Two clauses"
in both this section and the Decision heading, while containing **three** —
clause 3 (rejecting dynamic workflows) was added during drafting and the
count was never updated. Corrected in place rather than silently, because a
decision that miscounts its own clauses invites a reader to assume the third
is commentary rather than normative. It is normative: clause 3 is the reason
`loops/design-brief/` and `loops/project-build/` are built on portable
primitives at all.

This is lesson 7 in miniature — a claim decaying between being written and
being acted on, inside a single document, over four days.

## Context

The requirement, as put to this repo, had four parts. Two of them need a
decision before anything is authored, because a loop's
`## Exit conditions` section cannot be written without them.

### Requirement 1 — "ideate and discuss the brief until we reach a design"

An iterate-until-satisfied loop has no natural stopping point. Left
unstated, it resolves one of two ways, and both are bad: it runs forever,
or it stops when the model judges the design good enough. The second is
worse than the first, because it looks like success.

This repo already has the mechanism for this and already knows why.
`docs/development/authoring-guide.md` states that a loop's exit conditions
**are the point** — *"A loop without them is an unbounded instruction — the
shape that has an agent retrying a failing action forever."*
`validate.sh:193-213` enforces the section's presence, and
`loops/release-check/loop.md` demonstrates the vocabulary: retries bounded
at 3, hard stops, and escalate-without-retry for destructive actions.

What is missing is the *criterion*, not the mechanism.

### Requirement 3 — "manage the full implementation cycles without human intervention"

Taken literally, this contradicts four rules in `AGENTS.md`:

1. **"Destructive changes: Deletions, overwrites, history rewrites, and
   force-pushes require explicit human authorization in the task file."**
   Not in a conversation — in the file.
2. **Pushing needs `GITHUB_TOKEN` from the environment** (ADR-0009), and it
   must never appear in a tracked file or the remote URL. An agent cannot
   provision its own push credential without violating that.
3. **"Ambiguity policy: If requirements are significantly ambiguous or
   risky, stop and ask the human."** An autonomous loop that never asks has
   either no ambiguity or a policy violation, and real work has ambiguity.
4. **"Definition of done"** requires *"the diff is reviewed"*. Unqualified
   — and a review by the agent that wrote the diff is the weakest possible
   reading of a rule that exists to catch that agent's errors.

The source analysis reached the same conclusion independently, recommending
*"at least one review/deploy gate that's either human or a very constrained
governance agent."* And `agent-tiers` already encodes half of it:
`git push` is `ask`, never `allow`, and `models.jsonc` explains why
`git-ops` is deliberately not on the cheapest model tier — *"a hallucinated
`git reset --hard` or a malformed commit has real blast radius."*

So the boundary is not a new constraint being imposed. It is a constraint
already present in four places, which the requirement's wording would
quietly contradict if left unaddressed.

### The rejected mechanism

`PLAN-0004` proposed building on Claude Code dynamic workflows. Their own
constraints table, read 2026-09-15, rules them out for requirement 1:

> **No mid-run user input** — Only agent permission prompts can pause a
> run. For sign-off between stages, run each stage as its own workflow

An interactive design stage is mid-run user input by definition. The
vendor's own remedy — one workflow per stage — returns orchestration to the
session between stages, which is where it would have been anyway.

They are also a **Claude-Code-only JavaScript runtime**, so a component
built on them is unportable by construction, which `AGENTS.md` forbids.
Two further properties confirm the fit is wrong rather than merely
imperfect: `Date.now()` and `Math.random()` **throw** inside a workflow
script, and a script containing `import()` fails before the run starts.

The portable primitive set is therefore **primary agent + subagents +
skills + loops** — all four present in both clients, and three of the four
already carrying plumbing and enforcement in this repo.

## Decision

**Ratified 2026-09-15. Three clauses, all normative.**

### Clause 1 — Design convergence is explicit human acceptance, bounded

1. The design loop's terminating condition is **the human accepting a
   named artifact**: a brief file at a stated path, in a stated state. Not
   a model's self-assessment, not a score, not an agent's agreement with
   its own critic.
2. The loop carries a **hard iteration cap**. On reaching it without
   acceptance, the loop **escalates and stops** — it does not loop again
   with a longer prompt. The cap's value is set in `TASK-0041` against the
   `release-check` precedent (3) and stated in the loop file, not here, so
   the number has one owner.
3. **A critique round that finds nothing is not evidence of convergence.**
   It is one round's result. Acceptance is the human's, and the loop must
   not treat an empty critique as a proxy for it.
4. Once accepted, the brief is **locked**: the production stage reads it
   and does not edit it. A change to a locked brief re-enters the design
   loop rather than being amended in place during implementation.

### Clause 2 — Autonomy is bounded by a mandatory pre-merge gate

1. The production stage runs **autonomously within a locked plan**:
   implement, test, fix-loop, review and document without asking.
2. It **stops before** merge and push. Those require the human, per
   `AGENTS.md`'s destructive-change rule and ADR-0009's credential rule.
3. The fix loop is **bounded** and reports unresolved failures rather than
   looping. `agent-tiers`' existing bound is 3 `qa-test` iterations, with a
   `review` rejection explicitly *not* counted against that cap — a
   distinction worth preserving rather than re-deriving.
4. **A read-only review agent is not a substitute for the human gate.** It
   is a filter in front of it. `review` being unable to edit makes its
   verdict trustworthy about what it read; it does not make it an
   authorization.
5. The ambiguity policy still applies inside the autonomous stretch: a
   genuinely ambiguous requirement **stops the loop**. "Autonomous" means
   not asking about decisions the locked brief already settled, not
   inventing answers to ones it did not.

### Clause 3 — Dynamic workflows are rejected, with the reason recorded

Not to be re-raised without new vendor documentation. The two grounds are
independent: they cannot accept mid-run user input, and they are
single-client. Either alone is disqualifying for a component in this repo.
Recorded because the feature is prominent, well-marketed, and genuinely
good at the fan-out problems it is built for — which is exactly why the
next reader will propose it again.

## Consequences

- **Both loops can now be written**, because both have a terminating
  condition that is a fact about the world rather than a judgement by the
  agent running the loop.
- **The delivered system is narrower than the requirement asked for**, and
  deliberately so. The honest description is: *fully autonomous through
  implementation, testing and documentation, with a human gate before merge
  and push.* Anyone describing it as end-to-end autonomous production is
  overstating it — the same class of overstatement B-012 records this repo
  making about its own blast radius.
- **The human becomes a required participant in two places**, which is a
  throughput limit by design. Someone will eventually want the gate
  removed for a low-risk change class. That is a future ADR with its own
  evidence, not a configuration flag added quietly.
- **A locked brief needs a lock mechanism**, and this ADR does not supply
  one. `TASK-0041` and `TASK-0042` must decide what "locked" means
  concretely — a status field, a path convention, a frontmatter key — and
  nothing here enforces it. Naming the gap rather than implying it is
  handled.
- **Rejecting workflows forgoes real capability.** Fan-out across hundreds
  of files, adversarial cross-checking at scale, and resumable background
  runs are genuinely useful and are now unavailable to these loops. The
  trade is portability and interactivity, taken knowingly.
- **This ADR constrains two loops that do not exist yet.** It is written
  before them on purpose: `validate.sh` requires
  `## Exit conditions` non-empty, so a loop authored without a settled
  criterion would get a placeholder — and a placeholder exit condition in a
  file the gate has marked green is precisely the "check that cannot fail"
  shape lesson 8 records this repo authoring twice while knowing better.

## What ratification unblocks, and what it does not

Recorded at ratification so the next session does not have to re-derive it.

**Unblocked.** `TASK-0041` (`loops/design-brief/`) and `TASK-0044`
(`loops/project-build/`) each open with a hard gate requiring this ADR to be
`Accepted`; both gates are now satisfied. Neither task depends on a spike,
so **`TASK-0041` is the first S7 task after `TASK-0033` that can start
immediately** — ahead of Phase 1 and Phase 2 in the numbering, though not in
the plan's phase order.

**Still blocked, and deliberately.** `TASK-0043` (design roles) needs
`TASK-0040`, which needs `TASK-0037`, which needs **ADR-0018** — still
proposed and still blocked on `TASK-0036`. So the design *sequence* and its
*method* can be authored now, while the *roles* that execute them cannot.
That is the intended order: the loop is authored first so the roles are
shaped by the sequence rather than the reverse.

> **Superseded in part, 2026-09-15.** The paragraph above is left as
> written because it records the state at *this* ADR's ratification, and an
> ADR is a dated record rather than a live status page. For the current
> state: `TASK-0036` is done and **ADR-0018 is accepted**, so the chain
> described here is unblocked down to `TASK-0037`, which is now the
> critical path. `TASK-0043` is still blocked, but on `TASK-0040` rather
> than on a proposed decision. Annotated rather than rewritten, so the
> claim and its correction are both visible — the same handling this
> ADR used for its own clause miscount.

The practical consequence is that S7 can proceed along two independent
fronts — Phase 3's first two tasks, and Phase 1's two spikes — which suits
`ADR-0012`'s Decision 2: one task per session is the default, not a rule.

**Not settled by this ADR, and named again because it is the likeliest thing
to be assumed handled:** the **lock mechanism**. Clause 1.4 requires a
brief to be locked; nothing here says what locked *is*. `TASK-0041` decides
it concretely and `TASK-0042` builds the brief template around that
decision. A reader who takes "locked" as self-evident will produce a loop
whose terminating condition cannot be checked.
