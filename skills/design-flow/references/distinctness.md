# The distinctness requirement

Step 2 of `loops/design-brief/` must produce **alternatives**, not variants.
Three flavours of one approach look like three options, collapse the
critique into comparing near-identical candidates, and produce the
*appearance* of having considered alternatives without the substance.

## The test

Two candidates are distinct if they differ in at least one **load-bearing
commitment**: something that, changed later, would require *rewriting* work
rather than *adjusting* it.

Load-bearing, in practice:

- **Where a fact lives** — which component owns it, and therefore who has
  to change when it changes.
- **Whether a value is derived or declared.** A derived value cannot
  contradict the thing it is derived from; a declared one can. (This repo's
  own instance: MCP server shape is derived from which marker file is
  present, never self-declared — `ADR-0005`.)
- **What the unit of deployment is** — one artifact linked everywhere, or
  one generated per target. This decides whether drift is possible at all.
- **Where a boundary sits** — what is inside the thing being built versus
  supplied by something else.
- **What is enforced versus documented.** A rule a machine checks and a rule
  a human is asked to follow are different designs, not different rigour.

Not load-bearing: names, file layout, ordering of steps, parameter values,
which library, how something is phrased. Changing any of these is an
adjustment.

## Applying it

State, for each candidate, **which load-bearing commitment it makes
differently from the others.** One sentence. If two candidates cannot be
separated that way, they are one candidate and should be reported as one.

A useful forcing question: *what would have to be thrown away if we changed
our mind about this?* Two candidates whose answers are the same are the same
candidate.

## When the requirement cannot be met

If a second attempt still yields only variants, **the constraint set from
step 1 is probably over-specified** — it has narrowed the space to a single
real approach, and the remaining freedom is cosmetic.

That is a finding about the constraints, not a failure of the ideator, and
the loop's exit conditions say to escalate rather than retry. The useful
report names **which constraint** eliminates the alternatives, so the human
can decide whether it is a real requirement or an assumption that arrived
wearing a requirement's clothes.

Note that this is a legitimate and cheap outcome: discovering that the
design is forced is worth knowing, and it is better established in step 2
than assumed in step 4.
