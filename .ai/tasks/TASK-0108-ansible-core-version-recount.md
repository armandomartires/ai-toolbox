# TASK-0108 — Re-count the `ansible-core` version claims, then act on the count

## Objective

Discharge `SPRINT-CURRENT.md` item 6, whose own instruction is **"Re-count
before acting."** `REVIEW-0010` said the stale version was recorded in
**nine** places; a count on 2026-09-23 found **five**, so `TASK-0069`'s sweep
reduced it without closing it. This task re-counts against the tree as it is
today, and corrects only what the count shows is actually wrong.

## Minimal context

**The live fact, verified by running the binary on 2026-09-26** rather than
cited: `/home/armando.martires/.venvs/sigma-ansible/bin/ansible-lint` reports
`ansible-lint 26.8.0 using ansible-core:2.21.4`. Unchanged since
`TASK-0069`'s 2026-09-23 check. (The binary also reports that `ansible-lint`
**26.9.0** is available upstream and not installed — noted, not acted on;
nothing in this repo claims to track it.)

**The distinction the whole task turns on.** Most `2.20.8` mentions are
**dated records of what was observed at the time** — task logs, reviews,
session notes, archived sprints, an ADR's evidence section. Those are correct
as written and **must not be re-dated**; rewriting history to look current is
precisely the defect this repo avoids. Only a claim that reads as **currently
true** is stale.

`TASK-0069` established the correct repair shape in
`skills/ansible-ops/references/hazards.md`: keep the superseded text visible,
add a dated correction, and **re-run the behaviour rather than re-date the
claim**.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| Live `ansible-lint` binary | that estate | `26.8.0` / `ansible-core 2.21.4`, run 2026-09-26 |
| `skills/ansible-ops/references/hazards.md` | `TASK-0069` | **Already correct** — re-verified against 2.21.4, with the old claim quoted as superseded |
| `.ai/decisions/0014-*.md` | `TASK-0054` | **Already correct** — the move is an explicit caveat at the top; line 60 is dated evidence |
| `docs/design/ansible-ops-brief.md` | `TASK-0046` | `status: accepted` 2026-09-15; carries the claim `TASK-0069` **disproved** |
| `.ai/planning/ROADMAP.md:186` | Phase 6 | States the follow-up as "recorded **nine** times" |

## The re-count

Every `ansible-core` mention in the tree was classified. **~45 mentions;
three are live claims that are wrong.**

| Class | Count | Disposition |
|---|---|---|
| Dated records (task logs, reviews, sessions, archived sprints, `CURRENT_STATE` dated sections, `PLAN-0003`, `ROADMAP`/`TODO` D4 deviation notes) | ~38 | **Correct as written. Not touched.** |
| `hazards.md` — re-verified against 2.21.4, old claim quoted as superseded | 2 | **Already fixed by `TASK-0069`.** Not touched |
| `ADR-0014` — caveat at the top, dated evidence below | 2 | **Already correct.** Not touched |
| **`docs/design/ansible-ops-brief.md`** — two live claims | **2** | **Stale; one is disproved, not merely old** |
| **`ROADMAP.md:186`** — "recorded nine times" | **1** | **Stale count** |

**So the trajectory is nine (`REVIEW-0010`) → five (2026-09-23) → three
today**, and the remaining three sit in only two files.

**The one that matters is not a version number.** The brief asserts
`gather_subset` in `ansible.cfg` is *"rejected as an unknown `[defaults]`
key"*. `TASK-0069` re-ran both halves under 2.21.4 and found it is **silently
accepted** — no error, no warning, exit 0, and mounts still collected. That
is **worse** than the brief describes: the brief promises the operator a
diagnostic that no longer appears. A reader trusting it would write an
`ansible.cfg` guard and believe a rejection would tell them if it failed.

## Scope

### Included
- The three live claims above, repaired in the `TASK-0069` shape.
- `SPRINT-CURRENT.md` item 6 updated with the count and its disposition.

### Not included
- **No dated record is re-dated or rewritten.** ~38 mentions deliberately
  untouched; that is the finding, not an omission.
- `hazards.md` and `ADR-0014` — already correct, verified, left alone.
- Upgrading `ansible-lint` to 26.9.0, or re-running the "53 rules" figure
  under 2.21.4 (`ADR-0014`'s standing caveat). Both are separate decisions
  and neither is this task's.
- `B-011`'s unenforced guard — unchanged and still open.

## Likely files

- `docs/design/ansible-ops-brief.md`
- `.ai/planning/ROADMAP.md`
- `.ai/planning/SPRINT-CURRENT.md`
- `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`

## Execution plan

1. Verify the live version by running the binary. **Done** — `2.21.4`.
2. Classify every mention; record the count above.
3. `ansible-ops-brief.md`: correct both claims **in the `TASK-0069` shape** —
   the accepted text stays visible, a dated note records what re-running
   showed. The brief is `status: accepted`; it is corrected, not rewritten.
4. `ROADMAP.md:186`: replace the stale "nine" with the current count and
   point at this task.
5. Update `SPRINT-CURRENT.md` item 6.

## Acceptance criteria

1. The live version is established by running the binary, and the figure is
   quoted from that run.
2. Every mention is classified; the count is recorded with its reasoning.
3. The three live claims are corrected; **no dated record is altered**.
4. The disproved `gather_subset` claim is corrected by pointing at
   `TASK-0069`'s re-run, not by re-dating it.
5. `tests/validate.sh: OK`; tree clean; committed and pushed with the hash
   recorded.

## Mandatory validations

- `bash tests/validate.sh`
- `grep -rn "ansible-core 2.20.8"` re-run afterwards; every surviving hit is
  a dated record, checked one by one.

## Risks and rollback

- **The real risk is over-correction**: a bulk find-and-replace of `2.20.8`
  would destroy ~38 accurate historical records and make the repo claim
  things were observed that were not. Mitigated by classifying before
  editing, and by the post-check above being a *reading* of every surviving
  hit rather than a count.
- Rollback: revert the commit; the claims return to stale.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `docs/design/ansible-ops-brief.md` | Both claims corrected with a dated note; accepted text preserved |
| `.ai/planning/ROADMAP.md` | Follow-up states the current count, not "nine" |
| `.ai/planning/SPRINT-CURRENT.md` | Item 6 carries the count and disposition |
| ~38 dated records | **Deliberately unchanged** |

**Next task starts here**: the version-drift item is counted and its live
claims corrected. What remains under it is not a version number but
`ADR-0014`'s standing caveat — the "53 rules / 0 violations" figure has still
never been re-run under 2.21.4 — and that is a measurement, not a sweep.

## Execution log

### Attempt 1

All five acceptance criteria met.

**Criterion 1.** Ran
`/home/armando.martires/.venvs/sigma-ansible/bin/ansible-lint --version`:
`ansible-lint 26.8.0 using ansible-core:2.21.4 ansible-compat:26.8.0
ruamel-yaml:0.19.1`. The same run reports `26.9.0` available upstream.

**Criterion 2.** ~45 mentions classified; the table under "The re-count"
records the count and the reasoning.

**Criterion 3.** Three live claims corrected — two in
`docs/design/ansible-ops-brief.md`, one in `ROADMAP.md:186`. Post-check run
as specified: every surviving `2.20.8` hit was **read**, not counted, and
each is a dated record, an already-caveated ADR evidence line, a quoted
superseded claim, or this task file's own validation command.

**Criterion 4.** The disproved claim was corrected by pointing at
`TASK-0069`'s re-run and preserving the accepted text, not by re-dating it.

**Criterion 5.** `validate.sh: OK`; tree clean.

**The finding worth carrying forward.** The item was framed as a version
number recorded too many times. Re-counting showed the version spread was
mostly *correct history*, and the one genuine defect was a **behavioural**
claim: the brief promises that a misconfigured `gather_subset` is rejected,
and it no longer is. Counting the version would never have surfaced that;
reading the claims did.

## Status
- Status: **done**
- Owner: agent
- Created: 2026-09-26
- Completed: 2026-09-26
- Commit: `8d2fad0` — *Re-count the ansible-core version claims and correct three (TASK-0108)*
- Push: **confirmed** to `origin/master`, `52c8767..8d2fad0`, verified by comparing `git rev-parse HEAD` against `ls-remote` — both `8d2fad0e5bfef9732464552abcfb9d68d7ba5e7b`, not by exit code
