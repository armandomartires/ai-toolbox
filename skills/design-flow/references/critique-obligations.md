# What a critique is obliged to examine

Step 3 of `loops/design-brief/` is adversarial review. Its failure mode is
returning "looks good" — recorded as a pass, indistinguishable from having
found nothing after looking hard.

The loop already fixes the structural half: an empty critique **must state
what was examined**, and `ADR-0019` clause 1.3 says a critique that finds
nothing is not evidence of convergence. This file supplies the other half —
the list, so that "examined and found nothing" is a claim with content.

## The obligations

Every candidate, every time. A critique that skips one of these says so
rather than omitting it silently.

1. **Cost of being wrong.** If this choice turns out mistaken, what has to
   be rewritten rather than adjusted? A candidate whose mistakes are cheap
   to reverse is stronger than one that merely looks safer.
2. **What it assumes about the world.** External state — a tool's behaviour,
   a file's contents, a service's availability, another team's plans. Each
   assumption gets marked **verified** or **unverified**. An unverified
   assumption about external state is the highest-yield thing a critique can
   surface, because it decays without anyone touching it.
3. **Where it creates a second owner of one fact.** Two places that must
   agree, with nothing forcing them to, will drift. Name the pair.
4. **What it makes unenforceable.** A rule the design states but no machine
   can check is a rule that will be violated silently. This is not
   automatically disqualifying — it must be *recorded* as unenforced rather
   than assumed to hold.
5. **What it forbids later.** Options this candidate closes off, and whether
   closing them is deliberate.
6. **Where it will be misread.** Which part a competent reader will
   misunderstand on first contact, and what they will do as a result. A
   design that is correct but reliably misread is a design with a defect.
7. **Whether the constraints it satisfies are the real ones.** A candidate
   can satisfy every stated constraint and still solve the wrong problem.
   The critique may challenge a constraint — flagging it for the human at
   step 6 rather than deciding it.
8. **What it costs to operate**, not just to build: who has to do something
   repeatedly, and what happens when they stop.

## Rules for the critic

- **Never fix.** Report. A critic that rewrites the candidate has removed
  the thing being reviewed, and the manager can no longer compare like with
  like. (Same rule `review` follows in `loops/project-build/`, and the
  reason it is read-only.)
- **Criticise each candidate on its own terms** before comparing. A critique
  that only ranks candidates hides the flaws they share — and shared flaws
  are the ones that survive convergence.
- **Distinguish "this is wrong" from "I would not have chosen this."** Only
  the first is a finding; the second is a preference, and labelling it as
  such is what makes the first credible.
- **Say what was examined and found sound.** That is what turns an empty
  critique into evidence rather than an absence of it.

## Reading an empty critique

If every obligation was examined and nothing was found, the honest report
is a list of the eight with what was checked under each — and it should be
treated as *one round's result*, never as convergence. Acceptance is the
human's, at step 6.

If a critique is empty **and** short, that is not a strong candidate; that
is a critique that did not do the work. The list above is how the difference
becomes visible.
