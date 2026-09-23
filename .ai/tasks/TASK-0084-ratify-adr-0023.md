# TASK-0084 — Ratify ADR-0023

## Objective

Record the human's ratification of `ADR-0023` (one worktree per agent
session): status `Proposed` → **`Accepted`**, and update `AGENTS.md`'s git
rule **in the same change**, since clause 2 is the one that changes it.

## Minimal context

`ADR-0023` was authored `Proposed` by `TASK-0070` and said exactly where the
signature was needed: *"the mechanism (clauses 1, 3, 4) is already built and
safe to use; **clause 2 is what needs a signature**, because it is the one a
reader could mistake for the repo having quietly acquired a branching
workflow."*

Clause 2 stops work going straight onto `master` and lands it by
`git push origin HEAD:master` from a session branch. `AGENTS.md` states the
rule it changes, so the two must move together or the repo describes a
workflow it no longer follows.

**Human ratification given 2026-09-23, as written.**

### The evidence, which did not exist when the ADR was proposed

`TASK-0070` built the mechanism and proved the gate fires inside a worktree.
It could not show the mechanism *used*, because nothing had used it. **Sprint
S9 did**, unplanned:

| | |
|---|---|
| Concurrent sessions | **Five** — `TASK-0058`/`0060`/`0061` in parallel, then `TASK-0059`/`0062` |
| Landing | Serially by rebase; `master` stayed linear, one commit per task |
| Index collisions | **None** |
| Conflicts | **One**, between a task changing the registry's Agents section and a task adding a Loops row — **resolved cleanly on rebase** |
| The failure it was written for | Twice on 2026-09-23 **before** the mechanism existed; **not once since** |

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/decisions/0023-*.md` | `TASK-0070` | `Proposed`; five Decision clauses; the note naming clause 2 as the signature |
| `AGENTS.md` | pre-existing | Git rules describing `ADR-0023` as **`Proposed`** |
| `.ai/decisions/0021-*.md`, `0022-*.md` | `TASK-0068`, `TASK-0076` | `Accepted` — the ratification-block house style this copies |

**Verify the expected state; don't assume it.** Re-read the status line before
editing it; if it no longer says `Proposed`, stop rather than overwrite.

## Scope

### Included

- `ADR-0023` status block: `Accepted`, dated, what ratification covers and
  what it does **not**, with the prior `Proposed` text **preserved**.
- `AGENTS.md`'s git rule, **in the same change**.
- `SPRINT-CURRENT.md` and `CURRENT_STATE.md`, which both list this as an open
  decision.

### Not included

- **Adding any check.** Clause 5 says nothing enforces this and the repo does
  not pretend otherwise; that clause is ratified *as part of* the decision,
  not despite it. Where a human points a session is not observable here.
- Promoting S10.
- `docs/operations/runbook.md` — it already documents the procedure and does
  not describe the ADR's status.

## Execution plan

1. Re-read the status line and the clauses.
2. Rewrite the status block; preserve the prior text.
3. Update `AGENTS.md`'s git rule in the same commit.
4. Clear the item from `SPRINT-CURRENT.md` and `CURRENT_STATE.md`.
5. `tests/validate.sh`; one commit; push.

## Acceptance criteria

- [ ] `ADR-0023` reads **`Accepted — 2026-09-23`** and names who ratified it.
- [ ] The prior `Proposed` text is **preserved**, not deleted.
- [ ] `AGENTS.md` no longer calls it `Proposed`, and says `master` still takes
      one commit per task — so a reader cannot mistake this for a branching
      workflow, which is the misreading the ADR named.
- [ ] Clause 5's no-check stance is recorded as ratified, not as a gap.
- [ ] The ADR and `AGENTS.md` move in **one commit**.
- [ ] `tests/validate.sh` passes; no component file changed.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `git status --porcelain`

## Risks and rollback

- **Ratifying more than was asked.** Clause 2 is the signature; the others
  come with it, and the status block says so explicitly rather than leaving a
  reader to infer the scope.
- **Leaving `AGENTS.md` behind**, so the stated rule and the decision
  disagree — the exact defect this repo keeps finding. Mitigated by the single
  commit.
- **Reading this as a branching workflow.** Mitigated by stating in `AGENTS.md`
  that `master` still takes one commit per task and stays linear.
- Rollback is `git revert` of one commit.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `.ai/decisions/0023-*.md` | `Accepted`; prior status preserved; scope stated |
| `AGENTS.md` | Git rule cites `Accepted`; no branching-workflow misreading |
| `SPRINT-CURRENT.md`, `CURRENT_STATE.md` | Item cleared |
| Component layer | **Unchanged** |

**Next task starts here**: nothing is scheduled. Promoting S10 is a human
decision and now rests on two ratified ADRs.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)
- Actions: status block rewritten per the `ADR-0021`/`ADR-0022` house style,
  prior text preserved in a superseded block quote; `AGENTS.md`'s git rule
  updated in the same commit; the item cleared from both live-state files.
- Observations:
  - **The ADR told me where the signature was**, and the status block now
    says so: clause 2 is what was signed, the rest came with it.
  - **`AGENTS.md` gained a sentence the ADR asked for**: `master` still takes
    one commit per task and stays linear, the rebase being an added step
    rather than a process. That is the misreading `TASK-0070` predicted, and
    the cheapest place to prevent it is the file people actually read.
  - **Clause 5 is ratified as part of the decision, not despite it.** It says
    nothing enforces any of this. Offering to "fix" that with a check was
    considered and declined at the point the decision was made — where a
    human points a session is not observable from inside the repo, and a
    check that cannot fail is this repo's most-repeated lesson.
  - **What ratification does not claim**, and the status block says so: the
    Consequences section already records that only one of the two observed
    collisions is fixed outright. That limitation survives the signature.
  - **The evidence post-dates the proposal**, which is the honest shape here.
    `TASK-0070` could prove the gate fires in a worktree but not that the
    mechanism worked in anger; S9 ran five concurrent sessions and produced
    exactly one conflict, which rebase resolved.
- Validation:
  - `tests/validate.sh` — **OK**
  - `git status --porcelain` — `.ai/` and `AGENTS.md` only; no component file
- Result: **done.** `ADR-0023` is `Accepted` and `AGENTS.md` agrees with it.
- Commit: `60ec36e`. Pre-commit hook ran `tests/validate.sh`: OK. **Verified atomic:** the ADR and `AGENTS.md` are in the same commit.
- Push: **confirmed** — `origin/master` `3a3faa2..60ec36e`.
