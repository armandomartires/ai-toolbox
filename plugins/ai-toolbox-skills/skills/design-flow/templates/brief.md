---
# The three lock fields. Left empty by step 4; filled by step 7 of
# loops/design-brief/ on acceptance only, then committed by git-ops.
# The COMMIT is the lock, not these fields — a field can be flipped by the
# next agent to open this file; a commit cannot be altered without a
# visible history rewrite.
status:        # empty | accepted
accepted_by:   # who accepted it — a person, never an agent
accepted_on:   # YYYY-MM-DD
---

# Design brief — <title>

## Problem

<!-- Stated as a problem, not a solution. From step 1, human-confirmed. -->

## Constraints

<!-- Each marked hard (a real requirement) or assumed (nobody confirmed it).
     The distinction is load-bearing: it is what lets ideation escalate
     usefully when the constraint set turns out over-specified. -->

| Constraint | Hard or assumed | Source |
|------------|-----------------|--------|
|            |                 |        |

## Out of scope

<!-- From step 1, plus anything the critique raised that this brief
     declines. Cheaper to state here than to defend repeatedly. -->

## How success is recognised

<!-- The observation that would settle it. Not a feeling. -->

## Chosen approach

<!-- What is being built, and the load-bearing commitment that makes it the
     choice — usually the same commitment that distinguished it from the
     alternatives. -->

## Rejected alternatives

<!-- Not a courtesy. A brief recording only the winner invites the discarded
     options to be re-proposed by the next reader. -->

| Alternative | Load-bearing difference | Why rejected |
|-------------|------------------------|--------------|
|             |                        |              |

## Assumptions

<!-- From step 1 and from the critique's obligation 2. An unverified
     assumption about external state decays without anyone touching it, so
     the marking matters more than the wording. -->

| Assumption | Verified or unverified | If wrong |
|------------|------------------------|----------|
|            |                        |          |

## Accepted costs

<!-- What the critique found that this design accepts anyway, and why. A
     known accepted cost is a decision; an unrecorded one is a defect
     waiting to be discovered. -->

## Open questions

<!-- Anything deliberately left for implementation to decide. Naming a gap
     is not the same as leaving one silently — and the production stage
     reads this brief without editing it, so an unnamed gap becomes an
     implementation guess. -->
