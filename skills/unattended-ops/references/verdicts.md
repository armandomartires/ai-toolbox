# The five verdicts

The adjudicator returns **exactly one** of these, with reasoning and an
**overrides list** naming every finding downgraded from blocking to advisory,
with its reason. The enum is owned here and nowhere else: the loop's step 9
cites it deliberately without defining it, so there is one place to change if
it ever changes.

The verdict is judged **against the task file's own acceptance criteria**,
not against a sense of what would be nice, and on the evidence file plus the
diff — never on an agent's recollection (`references/evidence.md`).

---

## `accept`

Every acceptance criterion in the task file is **evidenced**, and the
refutation raised nothing that was not either answered or explicitly
overridden and named in the overrides list.

The only verdict that reaches the `closer`, which is the only role holding
git or tracker rights. An `accept` is **not an authorization**: it makes the
work ready for the human gate and does not pass it (`ADR-0019` clause 2.4,
`ADR-0022` clause 4.2).

**The misuse it attracts:** accepting on an all-green gate set when a
criterion has no evidence behind it. A gate proves what it ran; a criterion
is proved by evidence for *that criterion*. An unevidenced criterion is a
`retry` on attempt 1 and a `park` after.

---

## `retry`

The defect is in **how** the work was done, and is fixable inside the task
file's **existing** criteria — a missed step, a gate that failed on something
the plan can address, a claim the refuter falsified that the implementer can
substantiate.

**Attempt 1 only.** One attempt is one pass through the loop's per-task
cycle, and the bound is 2 (the loop owns the number and its justification).
The adjudicator's guidance is an input to the next plan and must be addressed
specifically, not re-run with a longer prompt.

**The misuse it attracts:** retrying a **closer refusal**. A refusal is the
boundary working; retrying it is asking a correct answer to change. It is
also not for a mechanical failure — a role erroring or a tool being
unavailable is a different bound entirely, and conflating the two either
burns the task's budget on a transient error or makes the acceptance path
unbounded.

---

## `park`

**The work cannot be *proven* tonight.** A stated reason, a named recovery,
and the run continues with the next task.

Park covers, among others: a genuine ambiguity the task file did not settle;
an unsatisfied dependency; a closer refusal; an attempt bound reached; a
mechanical failure past its retries; an unparseable or out-of-enum verdict;
and a discovered secret, which parks **immediately** and is named first in
the handover.

**A park is a success of the boundary, not a failure of the loop.** The work
is often sound and simply unprovable, which is why `park-steward` stashes it
under the run id and the reason rather than discarding it
(`references/park-and-recover.md`).

**The misuse it attracts:** parking as a soft `halt-run` — parking a task
whose *specification* is wrong, and then letting the next task in the queue
inherit the same wrong premise. If the finding is about what gets built, it
is `halt-run`.

---

## `raise-adhoc`

A finding **outside this task's scope** was discovered — usually while
establishing that something was already broken before the task began.

**It returns a title only.** Allocating an identifier is the human's step
(rule 4: nothing is invented), and a wrong identifier in a committed register
is worse than a note in a log. The handover states plainly that no identifier
was allocated.

This is not a fifth way of saying "done" or "not done": it is orthogonal, and
it is recorded **alongside** whatever happened to the task. The live run that
produced it had established by `git show HEAD:` that a gate failure predated
the task, declined `retry`, `park` and `halt-run` each for a stated reason,
and returned `raise-adhoc` with a title. That title became `A120`.

**The misuse it attracts:** using it to file the work the task was supposed
to do. If the task's own criteria are unmet, that is `retry` or `park`;
`raise-adhoc` is for what the task did not ask for.

---

## `halt-run`

**Fixing the task would require amending what is to be built rather than
how.** The run ends and the remaining queue is untouched.

**A discovery that changes *what* gets built is never an unattended run's to
make.** No retry, no next task — and the handover is still written, because a
halted run that leaves no handover is indistinguishable from a crashed one.

Also `halt-run`: a secret that reached a commit this run already made. The
remedy is a history rewrite, which is the human's.

**The misuse it attracts:** halting on a hard task. A task being difficult,
or its gates being slow, or its dependency being unmet, is a `park`. Halting
the run costs every other task in the queue their night.

---

## `park` versus `halt-run`, since this is the pair that gets confused

| | `park` | `halt-run` |
|---|---|---|
| Scope of the claim | **This task** cannot be proven | **The run's premise** is broken |
| Rest of the queue | Continues; independent tasks still close | Untouched; nothing else is attempted |
| What the human must do | Answer one question, or unblock one dependency | Decide **what** should be built, then re-queue |
| Handover | Written at the end as usual | Written anyway, and says the run halted |
| Uncommitted work | Stashed under the run id and reason | Stashed the same way; the run then stops |

The test: **ask whether the next task in the queue is affected.** If the
finding is local to this task, park. If acting on the finding means changing
the specification the queue was built from, halt.

---

## The decision order

Consider them in this order, and state a reason for each one declined — the
live run that closed nothing did exactly this, and its record of *why not*
each verdict is the reason its `raise-adhoc` was trustworthy:

1. Is the criteria set fully evidenced? → `accept`.
2. Does the run's premise need changing? → `halt-run`.
3. Is it fixable within these criteria, and is this attempt 1? → `retry`.
4. Otherwise → `park`, with the reason and the recovery.
5. Independently of 1–4: is there a finding outside this task's scope? →
   `raise-adhoc`, **title only**.

## When the verdict does not arrive

A null return, an unparseable return, or a value outside these five is
**treated as `park`, never as `accept`**. Reprompt **once**, journalling the
reprompt so the rate is measurable rather than folklore, then park. The
asymmetry is the point: an unknown verdict is an unknown, and the only safe
reading of an unknown is that the work is not proven.
`references/return-schemas.md`.
