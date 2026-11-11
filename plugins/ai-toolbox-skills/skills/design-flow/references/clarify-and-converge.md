# Clarifying (step 1) and converging (step 4)

The two steps the manager owns alone. Step 1 decides what the loop is
solving; step 4 decides what gets built.

## Step 1 — clarify

Establish four things, and get the human to confirm them:

- **The problem**, stated as a problem rather than a solution. "We need a
  queue" is a solution; "work is lost when the worker restarts" is a
  problem. Ideation against a solution-shaped statement produces variants
  of that solution — the step-2 failure mode, caused here.
- **The constraints**, each marked **hard** (a real requirement) or
  **assumed** (nobody has confirmed it). This distinction is what lets step
  2 escalate usefully when the constraint set is over-specified.
- **What is explicitly out of scope.** Cheaper to state now than to defend
  in every critique.
- **How success would be recognised** — the observation that would settle
  it, not a feeling.

Also agreed here: **the brief's path.** Step 4 writes to it and step 7
commits it; both need it fixed in advance.

### Ask, or assume and record?

**Ask** when the answer changes which approaches are viable, when getting it
wrong would be expensive to reverse, or when it is a genuine constraint
rather than a detail. `AGENTS.md`'s ambiguity policy applies: significantly
ambiguous or risky means stop and ask.

**Assume and record** when the answer narrows detail rather than approach,
or when a reasonable default exists. Write the assumption down **as an
assumption** — it travels to step 6 and gets presented with the brief, which
is where the human catches a wrong one cheaply.

The failure to avoid is asking about everything. A clarify step that returns
twenty questions has moved the design work back to the human, which is the
opposite of the point.

## Step 4 — converge

Select one candidate, or a stated combination, and write the brief.

The brief contains, at minimum:

1. **The problem statement and the constraint list** from step 1, including
   which constraints were assumed.
2. **The chosen approach**, and the load-bearing commitment that makes it
   the choice (see `distinctness.md` — the commitment that distinguished it
   is usually the reason it won).
3. **The rejected alternatives, with reasons.** Not a courtesy: a brief
   recording only the winner invites the discarded options to be re-proposed
   by the next reader, and the reasons are the cheapest defence against
   re-litigating a settled decision.
4. **The assumptions**, marked verified or unverified, carried from step 1
   and from the critique's obligation 2.
5. **Anything the critique found and the design accepts anyway**, with why.
   A known, accepted cost is a design decision; an unrecorded one is a
   defect waiting to be discovered.
6. **What is deliberately not being built**, from step 1's out-of-scope list
   plus anything the critique raised and the brief declines.
7. **The three lock fields** — `status`, `accepted_by`, `accepted_on` —
   present and empty, so step 7 has somewhere to write. See
   `templates/brief.md`.

### Combining candidates

Allowed, but state it. A combination inherits the assumptions and costs of
**both** parents, and the critique evaluated them separately — so a
combination is, strictly, a candidate nobody critiqued. Either say so
plainly in the brief, or return to step 3 with the combination as a new
candidate. The second is more honest and usually cheap.

### What convergence is not

Not the critique running out of findings, not all candidates surviving, not
the manager being satisfied. Step 4 produces a **proposal**; acceptance
happens at step 6 and is the human's alone (`ADR-0019` clause 1.1).

The loop owns that boundary. This skill does not restate its exit
conditions, and a method that says "continue until the critique is
satisfied" has replaced the ADR's criterion with a model's judgement — the
exact substitution the ADR exists to prevent.
