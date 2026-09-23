# TASK-0081 — Close sprint S9 on REVIEW-0011

## Objective

Close S9: archive `SPRINT-CURRENT.md` to
`.ai/planning/sprints/SPRINT-S9-unattended-runs.md`, mark **Phase 9 COMPLETE**
in `ROADMAP.md` with its evidence, and leave `SPRINT-CURRENT.md` holding an
explicit no-sprint-open state.

## Minimal context

**Human decision to close, 2026-09-23.** `REVIEW-0011` recommended fixing exit
criterion 7 first rather than closing over a stated criterion; `TASK-0080` did
that, so **all seven criteria are met** and nothing stands against closure.

**The mechanism, confirmed from history rather than assumed.** `9e6a840`
(*"…close S8 on REVIEW-0009"*) cut `SPRINT-CURRENT.md` by 368 lines while
adding 307 to `sprints/SPRINT-S8-third-party-extensions.md`. So closure is the
mirror of promotion: the sprint's content **moves back** to `sprints/` and
`SPRINT-CURRENT.md` returns to a no-sprint state. One owner per fact,
throughout.

**`ADR-0022` is already ratified**, so unlike S6 and S8 this closure carries
no ratification packet. The gate was cleared before the sprint opened.

**What must not be lost in the move.** `SPRINT-CURRENT.md` currently carries
four *carried-forward* items that predate S9 and are not S9's to close, plus
the outcomes of the parallel tasks. The archive keeps them as the sprint's
record; the new `SPRINT-CURRENT.md` must restate whichever are **still open**,
or closing the sprint quietly drops them.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/planning/SPRINT-CURRENT.md` | `TASK-0077`, since amended | Sprint S9, all rows `done`, `REVIEW-0011` row `done` |
| `.ai/reviews/REVIEW-0011-*.md` | `REVIEW-0011`, `TASK-0080` | Criterion 7 annotated as met; seven follow-ups |
| `.ai/planning/ROADMAP.md` | `TASK-0077` | `## Phase 9 — … (OPEN 2026-09-23)` with seven exit criteria |
| `.ai/planning/BACKLOG.md` | this sprint | Only **`B-025`** still `ready` |

**Verify the expected state; don't assume it.** Re-read the backlog's open
rows rather than trusting this table — `B-024` and `B-026` were closed *during*
the sprint and a stale list would send someone to finished work.

## Scope

### Included

- `git mv` of `SPRINT-CURRENT.md` to `sprints/SPRINT-S9-unattended-runs.md`,
  with a closure header stating what closed it and on what evidence.
- A fresh `SPRINT-CURRENT.md`: no sprint open, **stated as a state rather than
  an oversight**, with the outstanding queue and the four steps to open the
  next one.
- `ROADMAP.md`: Phase 9 **COMPLETE**, with the exit criteria judged and the
  evidence named, in Phase 8's house style.
- `CURRENT_STATE.md`, `TODO.md`.

### Not included

- **Promoting S10.** A separate human decision, exactly as promoting S9 was.
  `SPRINT-S10` still allocates no task ids, deliberately.
- The three trailing-flag holes, `ADR-0023`'s ratification, `worktree-only`,
  `B-025` — all carried forward, none of them S9's to close.
- Editing `REVIEW-0011`. It is a dated record.

## Execution plan

1. Re-read the backlog's open rows.
2. `git mv` the sprint file; add its closure header.
3. Write the new `SPRINT-CURRENT.md`.
4. `ROADMAP.md` Phase 9 → COMPLETE with evidence.
5. `CURRENT_STATE.md`, `TODO.md`; `tests/validate.sh`; one commit; push.

## Acceptance criteria

- [ ] `sprints/SPRINT-S9-unattended-runs.md` exists and carries the closure.
- [ ] `SPRINT-CURRENT.md` holds a no-sprint-open state naming what is
      outstanding, and says the state is deliberate.
- [ ] Phase 9 reads **COMPLETE** with all seven criteria judged and evidenced.
- [ ] Every still-open item survives the move; no closed item is re-listed.
- [ ] Phase 9's completion and the archive are in **one commit**, the same
      control the promotion used.
- [ ] `tests/validate.sh` passes; no component file changed.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` (expect no diff)
- [ ] `git status --porcelain` — `.ai/` only

## Risks and rollback

- **Dropping a carried-forward item.** The specific way a closure loses work.
  Mitigated by re-reading the backlog and the review's follow-up table rather
  than copying the old file's list.
- **Re-listing something closed during the sprint.** Sends a session to
  finished work; mitigated the same way.
- **Splitting the commit**, so the roadmap and the sprint state disagree —
  the defect `ROADMAP.md` has suffered twice.
- Rollback is `git revert` of one commit, which restores both halves together.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `sprints/SPRINT-S9-unattended-runs.md` | The sprint's record, closed on `REVIEW-0011` |
| `SPRINT-CURRENT.md` | No sprint open; the outstanding queue |
| `ROADMAP.md` | Phase 9 COMPLETE, seven criteria evidenced |
| Component layer | **Unchanged** |

**Next task starts here**: nothing is scheduled. Promoting S10 is a human
decision, and `ADR-0023`'s ratification is the cheapest open item.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)
- Actions: re-read the backlog's open rows; `git mv` of the sprint file with a
  closure header; a fresh no-sprint `SPRINT-CURRENT.md`; Phase 9 marked
  COMPLETE with its seven criteria evidenced; records updated. **One commit.**
- Observations:
  - **`git mv` rather than copy-and-delete**, so the sprint's history follows
    the file. `git status` shows `RM` — the rename is recorded, not a new file
    beside a deletion.
  - **Only `B-025` was still `ready`**, re-read rather than copied from the
    old file's list. `B-024` and `B-026` closed *during* the sprint, and
    re-listing either would have sent a session to finished work — the
    specific way a closure loses time rather than work.
  - **Four of the carried-forward items are older than S9** and are restated
    in the new `SPRINT-CURRENT.md` rather than archived with the sprint:
    `worktree-only`, the `ansible-core` version count, `ansible-ops` never
    exercised live, and the untested shrink commitment. Archiving them with
    the sprint would have buried them in a closed file.
  - **The untested commitment has now been stated by three sprints and
    exercised by none.** S9 did not shrink either. Restated rather than
    retired, because retiring it as vindicated is exactly what three
    consecutive non-tests do not license.
  - **Phase 9 and the archive are in one commit**, the same control
    `TASK-0077` used for the promotion, and for the same reason: nothing
    mechanical enforces roadmap/sprint agreement and `ROADMAP.md` has had two
    phases go missing for want of it.
  - **No ratification packet**, unlike S6's and S8's closures. `ADR-0022` was
    ratified *before* the sprint opened, because its blocking spikes had to
    produce evidence first — and **F1 was falsified**, so what was signed is
    more cautious than the draft. That inversion is worth noticing: the
    gate cleared early precisely because it was taken seriously.
- Validation:
  - `tests/validate.sh` — **OK**
  - `scripts/sync-registry.sh` — no diff
  - `git status --porcelain` — `.ai/` only; no component file changed
- Result: **done.** Sprint S9 is closed. No sprint is open, stated as a state
  rather than an oversight.
- Commit: *pending — recorded in the follow-up commit*
- Push: *pending*
