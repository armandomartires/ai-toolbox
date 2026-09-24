# The five rules, in full

Each rule is stated with the failure it answers, the measurement that
produced it, and **the form it takes in a binding** — because a rule a
binding cannot express is a rule that will be believed rather than enforced.

All five come from four live runs of the harness in `asset-management`
(ad-hoc task **A119**), **2026-09-21/22**. Three tasks closed with commits
(`S026.T001` → `00a9660`, `S025.T001` → `ee183f9`, `S025.T002` → `ba18cc1`),
one parked correctly, and one run **closed nothing and was right to**. That
last run is the one worth remembering: it found `A120`, a role map missing
one entry, which had made a gate exit 1 on an **untouched tree** — and so
check nothing at all — for two stages.

---

## Rule 1 — the tracker moves last, and only the closer moves it

**The failure.** A run interrupted between "the work is done" and "the
bookkeeping is done" leaves a tracker that says a task is finished and a
repository that says it is not. Every later reader trusts the tracker.

**The measurement.** Across the four runs, an interrupted task left an
**untouched tracker and a dirty working tree** — recoverable by reading
`git status`, rather than by reconstructing which of several half-ticked rows
was real.

**Why the ordering is the whole mechanism.** Nothing else enforces it. The
closer is the only role in the run holding git or tracker rights, and it runs
only after an `accept`, so an interruption at any earlier point cannot have
moved the tracker — there was no role in the run that could.

**One window is irreducible**: between `git commit` returning and the journal
line reaching disk. A binding closes it **on resume**, with a
`git log --grep <task id>` guard, in practice rather than in theory. Say so
rather than implying otherwise.

**Still unverified.** `ADR-0022` **F9** — *"a run interrupted at any point
between the gate step and the close step leaves the tracker untouched"* — is
**untested**. It would be falsified by a ticked tracker row with no commit
behind it, and if it fails, the ordering argument fails with it.

**In a binding.** Exactly one role is granted tracker-write and git-write.
Every other role's boundary denies both explicitly — never by prompting; see
rule 5's note on `ask`.

---

## Rule 2 — gate commands come from a hardcoded map, never from a task file

**The failure.** A verification command taken from the artifact being
verified. The task file says how to check the task; the check is then as
reliable as the claim it is checking.

**The measurement.** In one project, **29 scripts** open with a `-Run` guard
and **exit 0 silently** when it is absent — no output, no error, no work.
**Three more** have mandatory parameters that prompt and, with no TTY, hang.
Several task files' own Verification blocks **omit exactly those switches**.
A green from any of them is a green from a script that did nothing.

**In a binding.** The gate map is part of the binding, keyed by task kind,
and the driver invokes it from its own shell. `references/gate-map.md` has
the construction rules.

**This repo makes rule 2 structural rather than instructed.** The original
hands a command string to an agent and asks it not to "correct" a switch. A
driver has a shell and no ten-minute call cap, so the *driver* runs the gate
and hands the agent only the evidence to read. **No agent in the run ever
sees a verification command string**, so the failure is unreachable rather
than forbidden.

---

## Rule 3 — long gates are batched and detached

**The failure.** A gate longer than the client's shell-call cap cannot be run
inside one agent call, and an agent that tries gets a timeout it will read as
a failure of the gate.

**The measurement.** One real build measured **68m10s, 70m23s and 72m44s** on
three separate occasions. An agent's shell call is capped at **ten minutes**.

**A stale figure this supersedes, named so nobody averages the two.** The
source project's own changelog still records a **21–24 minute** build for the
same work. That figure is older and smaller; the three above were measured on
the build as it is now. **Quote the ~70-minute figures.** A reader who finds
both and splits the difference gets a timeout that is wrong in the direction
that costs the most.

**In a binding.** One detaching gate entry point, polled in bounded calls;
long gates batched once per group the run actually touched, run **one at a
time**, after the per-task cycle. `references/long-gates.md`. `ADR-0022`
**F7** — that one detaching entry point keeps every agent shell call inside
the cap — is **untested**; if it fails, rule 3 does not generalise and a
binding needs a second mechanism.

---

## Rule 4 — nothing is invented

**The failure.** An agent with no addressee for a question supplies a
plausible value instead. The output is well-formed, and the invention is
indistinguishable from a fact for everyone downstream.

**The rule.** No identifier is allocated. No glyph outside the legend is
written. **No figure that did not come out of the evidence file reaches a
task file.** A `raise-adhoc` returns a title only, for the same reason: a
wrong identifier in a committed register is worse than a note in a log.

**This is why parking exists.** Unattended, every question is unanswerable in
the moment; the alternative to asking is **parking, never guessing**
(`ADR-0022` clause 2.2). The human's answer is still required — only its
timing moves.

**In a binding.** Nothing in the run allocates an identifier, widens its own
scope, or selects its own work. A binding that generates a task id, a ticket
number or a next-free anything is stating a rule this skill does not.

---

## Rule 5 — one writer

**The failure.** Two sessions in one checkout. A git index has no locking
between them, so one session commits the other's half-finished work — and the
result is a **green** commit that no gate can detect.

**The measurement.** A peer session was found mid-task in the same checkout.
This repository then hit the same failure **twice on 2026-09-23** before the
decision existed, which is `ADR-0023`.

**In a binding.** Preflight refuses to start on a dirty tree, naming the
path, and **does not work out whose it is and does not clean it**. A preflight
halt is never retried.

**Why the boundary is a denial and never a prompt.** Observed against
`opencode 1.18.31` on 2026-09-23 (`TASK-0055`): a permission term set to
`ask` in a headless run **auto-denies immediately** — exit 0, no hang — and
reports *"The user rejected permission to use this specific tool call"*
**with no user present**. Unattended, every `ask` is a `deny` carrying a false
attribution: a run log records a human decision that never happened, and
nobody reading it later can tell it from a real one. So boundaries are
declared as explicit denials (`ADR-0022` clause 4.1), and a term like
`push-requires-confirmation` is **meaningless in an unattended run**.

---

## Why the checker is not gated, and what that costs

`scripts/check-binding.sh` is **not run by anything in this repository**, and
that is a decision rather than an omission. Two reasons:

1. **The mandatory gate must stay offline and hermetic** (`ADR-0007`).
   `tests/validate.sh` checks this repo's own component files; it does not
   execute a skill's script, and `skills/ansible-ops/scripts/` already ships
   an unwired checker for the same reason.
2. **A binding lives in a consuming repository.** There is nothing here for a
   gate to point at — the binding templates under `templates/bindings/`
   (the OpenCode one ships, `TASK-0086`) are themselves templates, whose
   consumer slots are placeholders by design and which a checker is
   *expected* to reject.

**What it costs:** the binding-completeness rule is mechanically unenforced
in this repository. It fires when somebody runs it against a real binding,
which is the same bargain `skills/ansible-ops/` made with its change-record
checker, stated rather than discovered.
