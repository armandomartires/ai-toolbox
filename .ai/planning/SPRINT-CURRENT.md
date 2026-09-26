# No sprint is open

**S10 closed 2026-09-26 on `REVIEW-0012`** (`TASK-0105`), after `TASK-0104`
discharged its one remaining deliverable (S10.4, the Bionic finding).
Archived to `.ai/planning/sprints/SPRINT-S10-unattended-bindings.md`.
`ROADMAP.md`'s **Phase 10 is COMPLETE**, marked in the same commit as this
file's move — the atomic control this repo has used for every promotion and
closure since `TASK-0077`, since nothing mechanical enforces roadmap/sprint
agreement.

**Opening the next sprint is a human decision.** Nothing below is scheduled;
it is listed so closing S10 did not quietly drop anything still open.

**Two of the items below were taken up on 2026-09-26 on the human's routing,
with no sprint opened** — the `Post-S4`/`Post-S5` shape. Item 4 (`B-035`) is
closed; item 2 is measured but still open. Item 3 (`B-025`) was left
untouched: it is `waiting` by the human's own choice, and closing it would
mean inventing the second case it waits for.

## Known limitations, not decisions

1. **`git add -- .` cannot be closed at the glob layer**, and is a stated
   limitation rather than an open fix. `TASK-0083` closed the other two
   trailing-flag holes — `--amend` into `no-force-push`, `--no-verify` into
   the new `no-bypass` — and **verified all of it against the client**. The
   bulk-stage form is 12 characters and so is the allow it must beat; an
   equal-length deny **lost**, observed, and any longer pattern also matches
   legitimate dotfile paths like `.ai/tasks/x.md`. The deny was **removed
   rather than shipped non-firing**, and the rule lives in `git-ops`'s and
   `closer`'s bodies, labelled as weaker than a gate. `TASK-0097`/`TASK-0098`
   now catch the *result* at the binding layer for OpenCode, stub-tested
   only; the underlying glob hole is unchanged. Reopen only if OpenCode's
   matcher changes.

## Carried forward, still open

2. **`worktree-only` has no settled Claude Code emission.** Still open, but
   **no longer unmeasured** — `TASK-0107`, 2026-09-26, ran the experiment
   `TASK-0056` was confounded on, this time with denial reporting required of
   the probe: `DENIALS: NONE`, so confinement and refusal are distinguishable.
   **A worktree-isolated subagent's commit does not reach the real tree**
   (`master` unmoved, commit not an ancestor, file absent — checked from the
   main checkout). That question is answered and **it does not settle the
   term**: `worktree-only` denies *access* outside the worktree, and what was
   measured is *effect-isolation*. `ADR-0018` clause 8.2 stands, the term
   table still reads "no per-agent equivalent", and all nine roles still
   declare the term. **The next measurement is named in the ADR**: can such a
   subagent read and write the main checkout by absolute path? Until that is
   run, this stays open.
3. **`B-025`** — no vocabulary term for *"may call only this MCP server"*.
   **`waiting`** since 2026-09-25 (was `ready`; the human's choice to leave it
   open). Waiting on a **second** role that wants it: one instance is a case,
   two is a vocabulary.
4. **`B-035` — CLOSED 2026-09-26 by `TASK-0106`** (`d50d220`). The human
   chose the first route: **the driver embeds the two references' text in the
   prompt**. It ships as a generated sibling file of `driver.py`, because the
   driver is a template a consuming repository copies out and the references
   would otherwise be at no known relative path; `tests/validate.sh` fails on
   drift from the two sources, so the copy cannot become a second owner.
   **The Claude Code binding has the same gap and was deliberately left** —
   whether its roles can read the skill turns on item 2 above, which
   `TASK-0107` has now measured but not settled. Re-raise there, not here.
5. **S10's own criterion 3 gaps.** Two declared boundaries the OpenCode
   binding does not enforce: bulk staging (`git add -- .` /
   `git add -- "."`, closed structurally by `TASK-0097` but **stub-tested
   only**) and a role reading the gate map (`B-030`, closed by `TASK-0098`,
   also stub-tested). **The Claude Code binding has never been exercised
   against a real run** — stub-proven only, `REVIEW-0012` finding 4.
6. **`ansible-core`'s version is recorded in several places and has moved.**
   `REVIEW-0010` said nine; a count on 2026-09-23 found **five**, so
   `TASK-0069`'s sweep reduced but did not close it. Re-count before acting.
7. **`skills/ansible-ops/` has never been exercised against a live estate.**
   Its closing item (`B-010`) was closed *with this limitation stated* — a
   closed item is not a claim of quality.
8. **An untested commitment, stated a third time.** *"If a sprint shrinks, the
   honest cut is a product, never the spike"* has now been stated by three
   sprints and exercised by none. Neither S9 nor S10 shrank either. It
   should be restated in the next plan that risks shrinking, not retired as
   vindicated.
9. **`ADR-0022` F7 and F9 are untested.** F7 — whether routing every gate
   through one detaching entry point keeps each agent shell call inside the
   client's cap — every pilot gate took 1–3 s, too short to test the claim.
   F9 — whether a run interrupted between the gate step and the close step
   leaves the tracker untouched — the one pilot interruption came before any
   close, so the window it names is still unobserved.

**Closed before or during S10, and not to be re-raised:** `B-018`, `B-021`,
`B-023`, `B-024`, `B-026`, `B-027`, `B-028`, `B-029`, `B-030`, `B-031`,
`B-032`, `B-033`, `B-034`.

## Task numbering

**Next free id: `TASK-0106`.** S10 ran `TASK-0086`…`TASK-0105`, with three
of its briefs (`TASK-0055`, `TASK-0056` — S9's spikes — and `ADR-0022`
itself) predating it, and `TASK-0068`/`TASK-0069` belonging to S8, run
concurrently while S9/S10 were being planned. Take an id when a brief is
written, not before — `.ai/tasks/` is the source of truth for what is free.
