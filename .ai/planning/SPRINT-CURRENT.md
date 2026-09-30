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
   also stub-tested).

   **The Claude Code half is CLOSED 2026-09-28 by `TASK-0113`: it has now been
   run.** `REVIEW-0012` finding 4 is discharged. One task, one gate, a scratch
   repository, 13 agents, ~20 minutes, no errors — and it **parked**, against a
   pre-recorded prediction of `accept`. Verified from the scratch repository
   rather than from the run's report: `HEAD` unmoved, no commit, tracker
   untouched, tree clean, the change stashed, a 14 KB handover written.

   **It found what stubs cannot, which is the whole argument of `REVIEW-0012`
   finding 3.** The headline is `B-043` and it is **not client-specific**:
   `run-gate.sh`'s evidence line has no figure slot, so loop step 10's "copying
   every figure from the evidence file" is unsatisfiable — and `run-gate.sh` is
   the *OpenCode* binding's entry point, so both bindings carry it. Also
   `B-044` (no repo-root parameter — hit before the run could start) and
   `B-045` (a resume guard written with `--all` would read a parked task as
   closed).

   **The adjudicator parked rather than guess, and gave the reason**: accepting
   would hand an unsatisfiable instruction to the only role with git rights.
   That is the loop working, on a defect nobody had seen.

   **`B-043` is CLOSED 2026-09-30 by `TASK-0121`**, route B; the paragraph
   below is the routing as written on 2026-09-28. It was routed by `TASK-0121`, which
   sharpens it: both bindings already collect `figures[]` in the gate-runner
   and then **discard them** — the closer takes no gates parameter in either —
   so the figure never had a path to the role told to write it. The open part
   is the evidence standard's scope, costed there as three routes.

   **The OpenCode half of this item is unchanged** — bulk staging and the gate
   map are still stub-tested only.
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
7. **`skills/ansible-ops/` — all nine gates exercised once by `TASK-0116`
   (1-3 on 2026-09-28, 4-9 on 2026-09-30), `done`. What remains unexercised is
   a guest-level change with a real PVE snapshot.** Its closing item
   (`B-010`) was closed *with this limitation stated*; a closed item is not a
   claim of quality, and that still holds for gates 4-9.

   **Gates 1-3 ran against the real estate and the skill's instructions
   survived contact.** Gate 1 derived the hazard class (`sigsrvpve1` is a PVE
   node; the play's `gather_facts: false` is the exclusion, so `ansible_mounts`
   is never collected) and the bound (`--limit sigsrvpve1`); gate 2 lint exit
   0; gate 3 syntax/parse exit 0. The estate was verified untouched either
   side — `HEAD` unmoved, porcelain empty, every write-target checksum
   identical.

   **Gate 4 was blocked by the agent harness, not by the estate** — the Claude
   Code auto-mode classifier denied `ansible-playbook`, on a command that was
   read-only by construction. Raised as **`B-046`**; gate 5 reads gate 4's
   output so it is unreachable, and **gates 6-9 remain unauthorized** (the
   task file's Authorization section is unfilled, which `AGENTS.md` requires
   and conversational approval does not substitute for).

   **The record checker was exercised for real and behaved correctly**: run
   against the partial record it named five missing fields —
   `check_mode_run`, `check_mode_fidelity`, `snapshot_ref`,
   `rollback_verified`, `approver` — which map to exactly the four gates not
   reached. The field-to-gate routing works.

   **A measured correction, not a sweep:** the estate's health gate reports
   **6-of-6 quorum, ring `1.22c3`, all services active** — so the "3-of-4
   quorum with no verified margin" that `ansible.cfg` calls the current normal
   is false. Added to `B-039`. Also nearly got wrong and worth stating: `ping`
   reports every node unreachable because ICMP is filtered; TCP/22 is open.

   **2026-09-30, attempt 2: gates 4 and 5 ran.** The human granted one
   exact-match allow rule; behind it sat a second barrier — ansible-core
   2.21.4 refuses non-blocking stdio — cleared by redirecting to a file. Gate 4
   exit 0, `ok=18 changed=2 failed=0`, the two `changed` being the play's own
   predicted snapshot writes; estate verified untouched by checksum. Gate 5
   derived nine of ten verdicts from installed documentation;
   **`include_tasks` documents check-mode support `none` yet ran**, so role 5
   cannot answer for control-flow actions — `B-050`. `B-046` is now a
   documentation item with both parts measured. The checker names only gates
   6 and 9.

   **2026-09-30, attempt 3: gates 6-9 ran**, on the human's in-file
   authorization of the gentlest real mutation available: applying the same
   read-back play for real, which writes two files on the control node. The
   harness refused the agent every phase-2 action, so **the human ran gates
   6-8** and pasted the output (`B-046` extended). Gate 7 `ok=18 changed=2
   failed=0`. Gate 8, read from state: only `latest.json` modified plus one
   new baseline, identical to each other. The record checker returned `RECORD
   OK` for the first time. The estate result is left uncommitted for the
   human. Gate 6's snapshot was a git blob, so the estate's guest-snapshot
   procedure is still untested by this skill.
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

**Next free id: `TASK-0122`.** `TASK-0121` was written 2026-09-28, routing `B-043` — the evidence line's missing figure slot, `TASK-0113`'s headline finding and the only one of its three that is not client-specific. `TASK-0106`…`TASK-0110` ran post-S10 on the
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
