# TASK-0054 — Ratify ADR-0014/0015/0016, close S6, promote S8

## Objective

Record the human's ratification of the three S6 ADRs, close sprint S6 on
`REVIEW-0010`, and promote S8 from re-queued to current.

## Minimal context

**The human ratified all three on 2026-09-22**, in answer to `REVIEW-0010`'s
ratification packet. That is the act `ADR-0014` described as *"a human act,
not more evidence"* and the only thing `REVIEW-0010` named as blocking
closure.

**Why promotion is mechanical, not a new decision.** `TASK-0052` recorded the
human decision *"finish S6 before S8"* — an ordering that presupposes S8
follows. S8 was promoted once (2026-09-16) and un-promoted the same day
*behind S6 specifically*, with all four briefs left `planned` and zero
components changed. Closing S6 without promoting S8 would leave
`SPRINT-CURRENT.md` holding a closed sprint, which is the false-present-tense
status defect `REVIEW-0008` had to sweep across four files.

**What is deliberately not rewritten.** Dated records stay as written —
completed task files, session logs, `REVIEW-0008`, `docs/design/ansible-ops-brief.md`
and the already-accepted ADRs. This is the same principle `TASK-0053` applied
four days ago and that `ADR-0006`'s own annotation states: *"an ADR is a dated
record rather than a live status page."* Only live status pages move.

**One exception, and it is reasoned.** `ADR-0021:65` asserts *"ADR-0016 stays
`Proposed` (it is still blocked on `TASK-0028`, which is unrun and belongs to
parked sprint S6)"*. Three of those four claims are now false, and `ADR-0021`
is itself **`Proposed`** and belongs to the sprint about to become current —
so it will be read as live, not as history. It gets a dated annotation rather
than a rewrite, matching how `ADR-0006` was superseded.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/reviews/REVIEW-0010-…md` | TASK-0053's session, 2026-09-22 | 289 lines; verdict approve; closure blocked on ratification |
| `.ai/decisions/0014,0015,0016` | TASK-0027/0028 + body-writing session | Bodies written (122/196/157 lines), all `Proposed` |
| `.ai/planning/SPRINT-CURRENT.md` | TASK-0052 | S6, current, all seven tasks `done` |
| `.ai/planning/sprints/SPRINT-S8-…md` | TASK-0048…0051 | Re-queued, four briefs `planned`, ADR-0021 `Proposed` |
| `.ai/planning/ROADMAP.md` | TASK-0033 / TASK-0052 | Phase 6 current, 5/5 exit criteria met |
| Human ratification | human, 2026-09-22 | **"ratify"** — all three, no exceptions stated |

**Verify the expected state; don't assume it.** All rows re-read this session.

## Scope

### Included
- Flip `ADR-0014`, `ADR-0015`, `ADR-0016` to **Accepted — 2026-09-22**,
  preserving each Status block's existing narrative.
- Annotate `ADR-0021`'s stale parenthetical about ADR-0016.
- Archive S6 to `.ai/planning/sprints/SPRINT-S6-ansible-guardrails.md` with a
  closure header naming `REVIEW-0010`.
- Promote S8 into `SPRINT-CURRENT.md` with a promotion header.
- `ROADMAP.md` (Phase 6 complete, Phase 8 current), `CURRENT_STATE.md`,
  `.ai/tasks/TODO.md`.

### Not included
- **Executing any S8 work.** `TASK-0048…0051` stay `planned`. Promotion is a
  state change, not a start.
- **Ratifying `ADR-0021`.** It is S8's own ADR and owes its own ratification.
- **Rewriting dated records** — see above.
- **Backlog rescoping.** B-018…B-021 stay `ready`; closing a sprint does not
  re-scope items, the same rule that held them through two parks.
- Re-opening anything `REVIEW-0010` recorded as a follow-up.

## Likely files
`.ai/decisions/0014,0015,0016,0021`, `.ai/planning/SPRINT-CURRENT.md`,
`.ai/planning/sprints/SPRINT-S6-*`, `.ai/planning/sprints/SPRINT-S8-*`,
`.ai/planning/ROADMAP.md`, `.ai/context/CURRENT_STATE.md`,
`.ai/tasks/TODO.md`, this file.

## Execution plan
1. Ratify the three ADRs in place.
2. Annotate ADR-0021.
3. Archive S6 with a closure header; correct its ADR rows to `accepted`.
4. Promote S8 into `SPRINT-CURRENT.md`.
5. Update ROADMAP, CURRENT_STATE, TODO.
6. `tests/validate.sh`; `scripts/sync-registry.sh` (expect no diff).
7. Review diff, commit, push, record hash.

## Acceptance criteria
- [ ] All three ADRs read **Accepted — 2026-09-22**, ratified by the human,
      with their existing Status narrative preserved rather than replaced.
- [ ] No live status page still calls them `Proposed`.
- [ ] `SPRINT-CURRENT.md` holds **S8**; S6 is at
      `.ai/planning/sprints/SPRINT-S6-ansible-guardrails.md`, closed on
      `REVIEW-0010`.
- [ ] `ROADMAP.md` Phase 6 complete, Phase 8 current.
- [ ] `TASK-0048…0051` still `planned`; ADR-0021 still `Proposed`.
- [ ] B-018…B-021 still `ready`.
- [ ] Dated records unchanged.
- [ ] `tests/validate.sh` passes; tree clean after commit.

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (expect no diff — no component changed)

## Risks and rollback
- **Risk: promotion read as starting S8.** Mitigated by leaving all four
  briefs `planned` and saying so in the promotion header.
- **Risk: over-correcting into dated records**, erasing the trace that these
  ADRs were unratified for eight days. Mitigated by an acceptance criterion.
- **Risk: a fifth "four files disagree" defect.** Mitigated by grepping every
  live mention of the three ADRs' status before and after.
- Rollback: documentation-only, single commit, `git revert`.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `.ai/decisions/0014,0015,0016` | **Accepted — 2026-09-22**, ratified by the human. Each Status block keeps its prior narrative as an indented trail rather than replacing it. ADR-0014 carries the `ansible-core` 2.20.8→2.21.4 caveat; ADR-0015 records that ratification **retires the Option 2 waiver**; ADR-0016 records that what was ratified is the *ground*, not the conclusion |
| `.ai/decisions/0021-…md` | Still **`Proposed`** — unchanged. Two dated notes added where it asserted ADR-0016 was `Proposed`; the second is struck through, not deleted |
| `.ai/planning/SPRINT-CURRENT.md` | **S8**, promoted with a header stating that all four briefs remain `planned` and this is a state change, not a start |
| `.ai/planning/sprints/SPRINT-S6-ansible-guardrails.md` | S6, archived via `git mv`, with a closure header naming `REVIEW-0010`; its three ADR rows now read `accepted 2026-09-22` |
| `.ai/planning/ROADMAP.md` | Phase 6 **COMPLETE 2026-09-22**; Phase 8 **CURRENT**; three stale "proposed/outstanding" passages corrected or struck |
| `.ai/context/CURRENT_STATE.md` | New top section; **the checkpoint section written hours earlier the same day marked superseded** and its present tense corrected |
| `.ai/tasks/TODO.md` | S6 header reads CLOSED; two `proposed` claims corrected |
| Dated records | **Untouched — verified by `git diff --name-only`**: sessions, `REVIEW-0008`, `docs/design/`, TASK-0029/0030/0046 |
| `docs/registry.md` | Regenerated, **no diff** — no component changed |

**Next task starts here**: **S8 is current with nothing executed.**
`TASK-0048` (spike third-party extension surfaces) is the first brief and
`ADR-0021` owes its own ratification, which `TASK-0048` may falsify clauses
of. B-018…B-021 all `ready`. `REVIEW-0010`'s four follow-ups are open and are
**not** S8's, though the gate-budget one will be read against S8 because S8
adds a `mcp-servers/` entry.

**Deviation from the Plan: one, and it was additive.** The Plan forecast
correcting live status pages; it did not forecast that a section written
**earlier in the same session** would itself become a false present-tense
claim once ratification landed. `CURRENT_STATE.md`'s REVIEW-0010 section said
"are still `Proposed`" and "S6 stays current". Both were true when written
and false four hours later. Marked superseded rather than rewritten — the
same treatment `ADR-0006` got, applied at a four-hour interval instead of a
two-day one.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-22
- Updated: 2026-09-22

## Execution log
### Attempt 1
- Date: 2026-09-22
- Agent: Claude Opus 5 (1M context)
- Actions: Ratified the three ADRs in place; annotated `ADR-0021` twice;
  `git mv` S6 out to `sprints/` and S8 in to `SPRINT-CURRENT.md`, each with a
  new header and the prior state preserved; corrected `ROADMAP.md`,
  `CURRENT_STATE.md` and `TODO.md`; re-grepped every live mention of the
  three ADRs' status before and after.
- Observations:
  1. **The false-present-tense class struck inside a single session.** The
     deviation above is the fifth instance of the defect `REVIEW-0008` swept
     across four files — and the shortest-lived. It is not evidence the
     lesson failed; it is evidence the *interval* is irrelevant. Any
     status assertion is a claim about a moment.
  2. **`ADR-0021` was the only dated record that had to be annotated**, and
     the reason generalises: it is still `Proposed` **and** belongs to the
     sprint just promoted, so it will be read as live rather than as
     history. "Leave dated records alone" needs that carve-out — a record is
     only safely dated if nothing is about to read it as current.
  3. **Ratifying ADR-0015 retired a waiver silently.** `skills/ansible-ops/`
     and `loops/ansible-change/` shipped 2026-09-15 under an Option 2 waiver
     *because* the ADR was unratified. Nothing in the repo connected the
     waiver to the ratification that would end it; it is now recorded in
     ADR-0015's Status. Had this not been noticed, two components would have
     kept carrying a waiver for a condition that no longer held.
  4. **S8's promotion changed no content for the third time.** The file has
     now been planned, promoted, re-queued and promoted again with its body
     untouched — which is only cheap because "planning-only" was enforced.
- Validation: `tests/validate.sh` → **OK** (run after each edit group and
  via the pre-commit hook). `scripts/sync-registry.sh` → **no diff**.
  Acceptance criteria re-checked by grep: three ADRs `Accepted`, no live page
  saying `Proposed`, four S8 briefs still `planned`, `ADR-0021` still
  `Proposed`, B-018…B-021 still `ready`, dated records byte-identical.
- Result: **done.** All eight acceptance criteria met. Documentation and
  planning state only; no component, script or gate changed.
- Commit: recorded in the follow-up commit
- Push: recorded in the follow-up commit
