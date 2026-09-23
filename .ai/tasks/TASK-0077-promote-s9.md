# TASK-0077 — Promote sprint S9, and add Phase 9 in the same change

## Objective

Do steps **3 and 4** of `SPRINT-CURRENT.md`'s *"How to open the next
sprint"*: add a **Phase 9** section to `.ai/planning/ROADMAP.md` and move
`sprints/SPRINT-S9-unattended-runs.md` into `SPRINT-CURRENT.md` — **in one
commit**, because that file is explicit that doing them separately is how a
phase goes missing.

## Minimal context

Steps 1 and 2 are done: `PLAN-0006` wrote the plan, and `TASK-0076` recorded
the human's ratification of `ADR-0022` (`Accepted`, 2026-09-23). **Human
decision to promote given 2026-09-23.**

**Why the two steps are one commit.** `ROADMAP.md` carries its own warning:
*"this file has had two phases go missing after the fact, both diagnosed as
needing a mechanism, and no mechanism was ever added."* No mechanism exists
now either — `tests/validate.sh` has no check for roadmap/sprint agreement and
is not getting one, because it is a judgment call. **The atomic commit is the
only control**, so it is the control this task uses.

**The mechanism, confirmed from history rather than assumed.** Promotion
**moves** the queued file into `SPRINT-CURRENT.md`; the queued copy stops
existing. Closure archives it back to `sprints/`. `3f513d7` (*"…close S6 on
REVIEW-0010; promote S8"*) deleted 215 lines of
`sprints/SPRINT-S8-third-party-extensions.md` while rewriting
`SPRINT-CURRENT.md`, and `9e6a840` re-added that path at closure. One owner
per fact, applied to sprint state.

**S9's file has stale claims that promotion must fix, not inherit.** It was
written before `TASK-0071`, `TASK-0074`, `TASK-0075` and `TASK-0076` existed:

| Claim in the file | Now |
|---|---|
| *"there is no sprint open to displace… this file does not promote itself"* | It is being promoted; the block is spent |
| *"Six of the ten capability terms"* | **Seven of the eleven** — `TASK-0071` added `test-allowlist` |
| `TASK-0059` owes *"the `delegates_to` cross-client check"* | **Already built** by `TASK-0075`; only `B-024` remains |
| *"`B-021` is **not** closed by this sprint"* | True but for a new reason — **`TASK-0071` closed it** outside the sprint |
| `worktree-only` *"still open"* | Still open, and now with evidence: `TASK-0056` tried and was **confounded** |

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/planning/sprints/SPRINT-S9-unattended-runs.md` | `PLAN-0006` | 91 lines; task table with 0055–0057 `done` and the gate `CLEARED` |
| `.ai/planning/SPRINT-CURRENT.md` | `TASK-0068`, `TASK-0076` | *"No sprint is open"*; step 2 struck |
| `.ai/planning/ROADMAP.md` | pre-existing | Phases 1–8; **no Phase 9**; the note saying whoever promotes adds it here |
| `.ai/decisions/0022-*.md` | `TASK-0076` | **`Accepted`** |
| `.ai/tasks/TASK-0058…0064` | `PLAN-0006` | all seven exist, `planned` |

**Verify the expected state; don't assume it.** Step 4 requires confirming the
task briefs exist **before any code is written** — count them rather than
trusting the table.

## Scope

### Included

- `ROADMAP.md`: a Phase 9 section in the house style of Phases 6–8, with exit
  criteria stated **before** the work so the checkpoint can be judged against
  them rather than against what the sprint produced.
- `SPRINT-CURRENT.md`: becomes S9, with the five stale claims above corrected
  and the **still-open** items from the no-sprint queue carried forward.
- `git rm` of the queued sprint file.
- `CURRENT_STATE.md`, `TODO.md`.

### Not included

- **Starting any S9 task.** Promotion opens the sprint; it does not begin
  `TASK-0058`.
- Rewriting `PLAN-0006` or the ADRs. Dated records.
- `SPRINT-S10-unattended-bindings.md`. Still queued, still allocating no ids.
- Any component file. **Zero** are touched.

## Likely files

- `.ai/planning/ROADMAP.md`, `.ai/planning/SPRINT-CURRENT.md`
- `.ai/planning/sprints/SPRINT-S9-unattended-runs.md` *(deleted)*
- `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`

## Execution plan

1. Count the S9 task briefs on disk. Stop if any is missing.
2. Write Phase 9 into `ROADMAP.md`.
3. Rewrite `SPRINT-CURRENT.md` as S9, correcting the five stale claims and
   carrying forward what is still open.
4. `git rm` the queued file.
5. `tests/validate.sh`; confirm no component file changed; **one commit**; push.

## Acceptance criteria

- [ ] All seven outstanding S9 briefs (`TASK-0058`…`0064`) confirmed present
      **by counting them**, not by reading the table.
- [ ] `ROADMAP.md` has a Phase 9 with exit criteria written **before** the work.
- [ ] `SPRINT-CURRENT.md` is S9, and none of the five stale claims survives.
- [ ] `sprints/SPRINT-S9-unattended-runs.md` no longer exists.
- [ ] Phase 9 and the promotion are in **one commit**.
- [ ] Still-open items from the no-sprint queue are carried forward, and
      closed ones are not.
- [ ] No component file changed; `tests/validate.sh` passes.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `git status --porcelain` — `.ai/` only
- [ ] `git show --stat` on the commit — Phase 9 and the move together

## Risks and rollback

- **Splitting the commit.** The one failure this task exists to prevent.
- **Inheriting the stale claims.** A promoted sprint file is read as current;
  the "six of the ten" and the already-built `delegates_to` check would both
  mislead the next session into redoing or misjudging work.
- **Carrying forward a closed item.** `B-018`, `B-021`, `B-023`, `B-027` and
  `B-028` all closed 2026-09-23. Re-listing one as outstanding would send a
  session to work already done.
- Rollback is `git revert` of one commit, which restores both halves together
  — the same property that makes the atomic commit the control.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `.ai/planning/ROADMAP.md` | Phase 9, exit criteria pre-stated |
| `.ai/planning/SPRINT-CURRENT.md` | Sprint S9, **open**, stale claims corrected |
| `sprints/SPRINT-S9-unattended-runs.md` | **Deleted** — its content now lives in `SPRINT-CURRENT.md` |
| Component layer | **Unchanged** |

**Next task starts here**: `TASK-0058` and `TASK-0060` are the two front doors
— both depend only on the cleared gate, and `TASK-0061` sits on a third front.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)
- Actions:
  1. **Counted the briefs before anything else** — step 4's precondition.
     `TASK-0058`…`0064`: **7 of 7 present**, all `planned`. Counted, not
     inferred from the sprint table.
  2. **Confirmed the promotion mechanism from history rather than assuming
     it.** `git show --stat 3f513d7` (*"…promote S8"*) **deleted 215 lines**
     of `sprints/SPRINT-S8-third-party-extensions.md` while rewriting
     `SPRINT-CURRENT.md`, and `9e6a840` re-added that path at closure. So
     promotion **moves** the file; it does not copy it.
  3. Wrote **Phase 9** into `ROADMAP.md` with seven exit criteria stated
     **before** the work, and replaced the old *"no Phase 9 exists"* note.
  4. Rewrote `SPRINT-CURRENT.md` as S9, correcting the five stale claims.
  5. `git rm` of the queued file. `CURRENT_STATE.md` and `TODO.md` updated.
- Observations:
  - **The five stale claims are the substance of this task, not bookkeeping.**
    A promoted sprint file is read as current, so *"six of the ten capability
    terms"* would have misled `TASK-0058` about the vocabulary it is editing,
    and `TASK-0059`'s row would have sent someone to build a `delegates_to`
    check that `TASK-0075` already built and proved firing on a real defect.
  - **`TASK-0059` is now genuinely smaller**, and the sprint file says so
    rather than leaving its author to discover it: only `B-024` remains, plus
    re-reading the existing check against whatever `TASK-0058` decides about
    `mode`.
  - **Phase 9 records what the sprint does *not* do**, because S9 completing
    will look like "unattended runs work" and will not be: without a binding
    — all of which are S10 — nothing executes the portable core.
  - **Exit criterion 1 was already met at promotion** (`ADR-0022` ratified).
    Stated plainly rather than quietly ticked, since a criterion satisfied
    before a sprint opens is worth a reader noticing.
  - **The atomic commit is the control and nothing else is.** `validate.sh`
    has no roadmap/sprint agreement check, and `ROADMAP.md` has had two
    phases go missing for want of one. Verifiable with `git show --stat`.
- Validation:
  - `tests/validate.sh` — **OK**
  - `git status --porcelain` — **`.ai/` only**; no component file touched
  - Phase 9 and the sprint move are in **one commit**
- Result: **done.** Sprint S9 is **open**. `TASK-0058`, `TASK-0060` and
  `TASK-0061` are ready and unstarted.
- Commit: *pending — recorded in the follow-up commit*
- Push: *pending*
