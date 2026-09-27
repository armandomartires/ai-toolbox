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

2. **`worktree-only` is NOT enforced on Claude Code — measured 2026-09-27
   (`TASK-0111`), and the question `ADR-0018` named is now closed.** A
   worktree-isolated subagent **read and wrote the main checkout by absolute
   path**, with `DENIALS: NONE`: it created a file in the main working tree
   and appended to tracked `LICENSE` (md5 `85da8b3a…` → `994f2c99…`), both
   verified from the main checkout rather than from the probe's report. This
   **confirms** clause 8.2 instead of overturning it — emission for a role
   declaring `worktree-only` must still fail loudly, and the reason is now
   that the confinement demonstrably does not exist, not that no key was
   found. `TASK-0107`'s earlier result stands and measured a different
   property (effect-isolation: a commit does not reach the real tree). All
   nine roles still declare the term and the term table still reads "no
   per-agent equivalent", now annotated as measured.

   **What remains open under this heading is the emission itself**, which is a
   decision rather than a measurement: whether those roles' Claude Code
   emission stays refused, or the term is redefined, or the roles stop
   declaring it. Nothing is unmeasured any more.

   Noted in passing, because it could mislead: the harness raised a classifier
   warning about the probe **after** the writes had landed. Detection is not
   denial.

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
6. **`ansible-core`'s version — RE-COUNTED AND CLOSED 2026-09-26 by
   `TASK-0108`.** The instruction was "re-count before acting", and the count
   is why this closes rather than sweeping again: nine at `REVIEW-0010`, five
   on 2026-09-23, **three** live claims today, in two files. The other **~38
   mentions are dated records** — task logs, reviews, sessions, archived
   sprints, an ADR's evidence section — and are **correct as written**; a
   bulk replace would have destroyed them and made the repo claim things were
   observed that were not. `hazards.md` and `ADR-0014` were already correct
   and were not touched.

   **The live version is `2.21.4`, confirmed by running the binary on
   2026-09-26**, unchanged since `TASK-0069`.

   **What the count actually found was not a version number.**
   `docs/design/ansible-ops-brief.md` asserted `gather_subset` in
   `ansible.cfg` is *"rejected as an unknown `[defaults]` key"*. Under 2.21.4
   it is accepted **silently** — exit 0, no warning, mounts still collected —
   which is **worse**, because the brief promises a diagnostic the operator
   no longer gets. Corrected in `TASK-0069`'s shape: accepted text preserved,
   dated correction added.

   **That measurement is now done — `TASK-0115`, 2026-09-27 — and this
   heading closes.** `ADR-0014`'s caveat is discharged: **53 rules, 15 tags,
   0 failures, 0 warnings, exit 0** under `ansible-core` 2.21.4. The count
   did not move, which is the expected result rather than a reassuring one —
   the rule set is `ansible-lint`'s and `ansible-lint` never moved. **What
   moved is the subject**: 2 playbooks then, **17 playbooks and 19 roles**
   now, 202 files of 204 processed, so the clean result covers roughly eight
   times the content. Backed by two controls, because exit 0 alone proves
   nothing: the silent-no-op trap **still reproduces** under 2.21.4 (a custom
   rule loaded, listed `53 → 54`, never evaluated, exit 0; enabled by name it
   fired 17 times), and a deliberately injected violation **was caught**
   (exit 2), so the zero is measured rather than silent.

   Still noted and not acted on: `ansible-lint` **26.9.0** is available
   upstream and the binary prints an upgrade notice every run; nothing here
   tracks it, and it was deliberately not installed inside the task that
   re-measured — changing the tool in that run would make the delta
   unattributable. Raised instead: **`B-039`**, three now-false claims in the
   estate's own `ansible.cfg`, which this repository cannot fix.
7. **`skills/ansible-ops/` has never been exercised against a live estate.**
   Its closing item (`B-010`) was closed *with this limitation stated* — a
   closed item is not a claim of quality.
8. **An untested commitment, stated a third time.** *"If a sprint shrinks, the
   honest cut is a product, never the spike"* has now been stated by three
   sprints and exercised by none. Neither S9 nor S10 shrank either. It
   should be restated in the next plan that risks shrinking, not retired as
   vindicated.
9. **`ADR-0022` F7 and F9 — BOTH SETTLED 2026-09-27 by `TASK-0114`. This
   heading closes.** Neither could ever have been answered by running the loop
   normally, which is why they needed a task: every pilot gate took 1–3 s, and
   the one pilot interruption came before any close.

   **F7 — CONFIRMED.** A 720 s synthetic gate, 120 s past the ten-minute cap,
   driven through `run-gate.sh`: `start` returned in **0 s**, then 12 polls of
   **max 61 s**. Longest agent-side call **61 s against a 600 s cap**. It
   generalises structurally rather than by luck — the per-call maximum is set
   by `wait`'s own 60 s bound, **not** by the gate's length, so the real
   68–72 minute build yields the same ceiling and merely more polls.

   **F9 — CONFIRMED, and its falsifier turns out to be structurally
   unreachable.** Two interruptions of a real driver against a real repository,
   placed by pidfile rather than raced. Between gate and close: tracker
   untouched, no commit. In the irreducible window (after `git commit` returned,
   before the journal write): tracker ticked **and** the commit present — and
   that is the point, because the closer stages the tracker *into the same
   commit*, so "a ticked tracker row with no commit behind it" cannot occur.
   **What diverges in that window is the journal, not the tracker**, which the
   ADR's wording implied was the thing at risk. `git log --grep <taskId>` found
   the commit, so the guard the ADR names as its practical mitigation was
   observed working. Both runs wrote a handover and exited 1.

   Stated limit: the model was stubbed, so the closer's *judgement* is modelled
   while its disk effects — edit, stage, commit — were real. **F8 is now the
   only falsifier still open**, and only for Bionic (S10.4).

**Closed before or during S10, and not to be re-raised:** `B-018`, `B-021`,
`B-023`, `B-024`, `B-026`, `B-027`, `B-028`, `B-029`, `B-030`, `B-031`,
`B-032`, `B-033`, `B-034`.

## Task numbering

**Next free id: `TASK-0121`.** `TASK-0106`…`TASK-0110` ran post-S10 on the
human's routing, and `TASK-0111`…`TASK-0118` were written 2026-09-27 as briefs
for the queue above, and `TASK-0119`/`TASK-0120` the same day from a skill-integration
review that found `ai-project-scaffold.sh` still owns artifact shape (`B-040`,
`B-041`, `B-042`) — not a queue item, which is why they are not listed above. This counter read `TASK-0106` until then — stale, and
harmless only because the instruction beside it is the one to follow.
S10 ran `TASK-0086`…`TASK-0105`, with three of its briefs (`TASK-0055`,
`TASK-0056` — S9's spikes — and `ADR-0022` itself) predating it, and
`TASK-0068`/`TASK-0069` belonging to S8, run concurrently while S9/S10 were
being planned. Take an id when a brief is written, not before —
`.ai/tasks/` is the source of truth for what is free.
