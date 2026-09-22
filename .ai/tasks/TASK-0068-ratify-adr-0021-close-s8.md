# TASK-0068 — Ratify ADR-0021 and close sprint S8

## Objective

Record the human's ratification of `ADR-0021` and close sprint S8 on
`REVIEW-0009`.

## Minimal context

**The human ratified `ADR-0021` as written on 2026-09-23**, answering
`REVIEW-0009`'s ratification packet. That was the only thing the checkpoint
named as blocking closure, and the only sprint-level acceptance criterion in
`PLAN-0005` still unmet.

**"As written" was a choice among four**, and the alternatives matter to the
record: ratify as written, ratify with clause 5 tightened, reject
(precedented by `ADR-0017`), or hold. The clause-5 amendment came from
`REVIEW-0009`'s finding 2 — that a *labelled* limitation is not a
*contained* one. Ratifying as written leaves that finding **open as a
follow-up rather than resolved by the ratification**, and this task must not
quietly implement an amendment the human declined to make.

**No sprint is promoted to replace S8.** `ROADMAP.md` has no Phase 9
section, and adding one here would be a planning decision disguised as
bookkeeping. **S9 and S10 do exist as plans** (`PLAN-0006`, written
concurrently with this closure) but are queued in `sprints/`, and S9 rests on
`ADR-0022`, which is `Proposed` and blocked on its own two spikes.
The repo has been in this state before — `TODO.md` carries a *"Post-S4 (no
sprint open)"* section. `SPRINT-CURRENT.md` must say so plainly rather than
keep holding a closed sprint, which is the false-present-tense defect
`REVIEW-0008` had to sweep across four files.

**What is deliberately not rewritten.** Dated records stay as written:
completed task files, `REVIEW-0009` itself, and the `ADR-0021` Context
section whose two falsified claims already carry dated notes. Ratification
accepts the **Decision** clauses; it does not retroactively make the Context
correct, and editing it would destroy the evidence that the spike worked.

**One live status page must move.** `docs/development/authoring-guide.md`
carries a dated blockquote stating `ADR-0021` is `Proposed`. That was
correct when `TASK-0051` wrote it and is false the moment ratification is
recorded. It is a normative document, so it gets corrected, not annotated.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| Human ratification | human, 2026-09-23 | **"ratify as written"** — no clause amended, no exception stated |
| `.ai/reviews/REVIEW-0009-…md` | this session | 344 lines; verdict approve; closure blocked on ratification; packet clause-by-clause |
| `.ai/decisions/0021-…md` | PLAN-0005 | `Proposed`, 2026-09-16; Context carries dated notes on its two falsified claims |
| `.ai/planning/SPRINT-CURRENT.md` | TASK-0052 / TASK-0054 | S8, current, all four briefs `done`, checkpoint written |
| `.ai/planning/ROADMAP.md` | TASK-0033 et al. | Phase 8 "CURRENT 2026-09-22, not started"; seven exit criteria |
| `.ai/planning/BACKLOG.md` | various | `B-019` still `ready`; B-020/B-022 closed; B-023 raised |
| `docs/development/authoring-guide.md` | TASK-0051 | carries the `Proposed` blockquote |

**Verify the expected state; don't assume it.** All rows re-read this
session.

## Scope

### Included

- Flip `ADR-0021` to **Accepted — 2026-09-23**, preserving its Status
  block's existing narrative and its dated Context notes.
- Correct the authoring guide's `Proposed` blockquote.
- Archive S8 to `.ai/planning/sprints/SPRINT-S8-third-party-extensions.md`
  with a closure header naming `REVIEW-0009`.
- Put `SPRINT-CURRENT.md` into an explicit **no sprint open** state.
- Close `B-019` — S8's own backlog item, delivered.
- `ROADMAP.md` Phase 8 complete with its seven exit criteria judged;
  `CURRENT_STATE.md`; `.ai/tasks/TODO.md`.

### Not included

- **Any clause-5 amendment.** The human ratified as written;
  `REVIEW-0009`'s follow-up 2 stays open.
- **Promoting or inventing a Phase 9 / sprint S9.** No plan exists.
- Rewriting `ADR-0021`'s Context, `REVIEW-0009`, or any completed task file.
- The other four `REVIEW-0009` follow-ups, and the two inherited from
  `REVIEW-0010`. All stay open and are listed at closure.

## Likely files

`.ai/decisions/0021-*.md`, `.ai/planning/SPRINT-CURRENT.md`,
`.ai/planning/sprints/SPRINT-S8-third-party-extensions.md` (new),
`.ai/planning/ROADMAP.md`, `.ai/planning/BACKLOG.md`,
`docs/development/authoring-guide.md`, `.ai/context/CURRENT_STATE.md`,
`.ai/tasks/TODO.md`, this file.

No component, script or registry change. `scripts/sync-registry.sh` is not
expected to be needed.

## Acceptance criteria

- [x] `ADR-0021` reads **Accepted — 2026-09-23**; its narrative and dated
      Context notes are preserved, not rewritten.
- [x] The authoring guide no longer claims the rule is `Proposed`.
- [x] S8 is archived with a closure header naming `REVIEW-0009`.
- [x] `SPRINT-CURRENT.md` states plainly that **no sprint is open** — it
      does not hold a closed sprint.
- [x] `B-019` is closed; `B-018`, `B-021` and `B-023` remain open and are
      named as such.
- [x] `ROADMAP.md` Phase 8 is complete, with each of its seven exit
      criteria judged rather than asserted in bulk.
- [x] No clause of `ADR-0021` was amended.
- [x] `tests/validate.sh` passes.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh — expected not required; run as a control.

## Risks and rollback

- **Implementing the amendment the human declined.** The clause-5 change
  was offered and not chosen. Mitigation: it is listed in Not included and
  stays a follow-up.
- **Leaving a closed sprint in `SPRINT-CURRENT.md`.** The exact defect
  `REVIEW-0008` swept across four files. Mitigation: an explicit no-sprint
  state.
- **Editing `ADR-0021`'s Context to match reality.** It would erase the
  record that two of its claims were falsified — which is the sprint's main
  evidence that the spike was load-bearing. Mitigation: Status only.
- Rollback: revert the commit. No component, machine or client state is
  involved.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `.ai/decisions/0021-…md` | **Accepted — 2026-09-23**; Context and its dated notes untouched |
| `docs/development/authoring-guide.md` | The `Proposed` blockquote replaced with the ratification |
| `.ai/planning/sprints/SPRINT-S8-third-party-extensions.md` | New; S8 archived with a closure header naming `REVIEW-0009` |
| `.ai/planning/SPRINT-CURRENT.md` | **No sprint open**, stated explicitly, with what would have to happen to open one |
| `.ai/planning/BACKLOG.md` | `B-019` closed; three open items named |
| `.ai/planning/ROADMAP.md` | Phase 8 complete; seven exit criteria judged individually |

**Next work starts here**: **no sprint is open, and opening one is a human
decision.** Five `REVIEW-0009` follow-ups are outstanding (two stale gate
claims; the clause-5 question the human declined to settle today; `B-023`'s
`configs/`-per-server rule; and carrying the untested *"cut a product, never
the spike"* commitment forward), plus two inherited from `REVIEW-0010`
(`ansible-core` recorded in nine places has moved; `skills/ansible-ops/`
unexercised against a live estate). Three backlog items are `ready`:
**B-018**, **B-021**, **B-023**.

## Status

- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log

### Attempt 1

- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)
- Actions: Ratification recorded on `ADR-0021` (Status block only). Guide's
  status blockquote corrected. S8 archived to `sprints/` with a closure
  header; `SPRINT-CURRENT.md` replaced with an explicit no-sprint-open
  state. `B-019` closed. `ROADMAP.md` Phase 8 marked complete with its seven
  exit criteria judged one by one. `CURRENT_STATE.md` and `TODO.md` updated.
- Observations: **Four of the seven roadmap exit criteria were already
  verifiable mechanically** from `REVIEW-0009`'s evidence rather than from
  any log — no `plugins/` directory, the three scripts byte-identical across
  the sprint, nothing vendored, and the manifest observed failing when
  broken. The remaining three rest on the review's reading.
  **One inconsistency corrected in passing**: `ROADMAP.md`'s Phase 8
  paragraph predicted the archive path
  `sprints/SPRINT-S8-third-party-extensions.md`, and that paragraph had
  already been wrong twice in opposite directions about where the file
  lives. Archiving to exactly that path makes the prediction true rather
  than adding a third correction.
- **Deviation — this task was renumbered mid-flight, from `TASK-0055` to
  `TASK-0068`.** A **concurrent planning session** wrote `PLAN-0006`
  (unattended task runs), `ADR-0022`, `SPRINT-S9-unattended-runs.md` and
  `SPRINT-S10-unattended-bindings.md` into this working tree **while this
  closure was being written** — timestamps 00:41–00:44 on 2026-09-23, after
  this session began. `PLAN-0006` reserves **TASK-0055…TASK-0067**, so the
  number this task originally took was already claimed by S9's first spike.
  Renumbered to **TASK-0068**, above the reserved range, and every reference
  updated.

  Caught at `git add -A`, by reading the staged file list rather than
  trusting it — three files appeared that this session had not written. They
  were **unstaged and left untracked**; this commit contains only this
  session's own paths. Two consequences recorded rather than smoothed:

  - **Four of this task's status claims were false when written.** *"No
    Phase 9 exists"* was true at 00:21 and false by 00:44. Corrected in
    `SPRINT-CURRENT.md`, `ROADMAP.md`, the S8 archive header,
    `CURRENT_STATE.md` and `TODO.md` — the precise truth is that
    `ROADMAP.md` has no Phase 9 *section* while S9 and S10 exist as *queued
    plans*, and that promoting S9 remains a human decision because
    `ADR-0022` is `Proposed` and blocked on its own spikes.
  - **S9's file carries two claims that this session's work falsified**: it
    states `ADR-0021` is still `Proposed` and `REVIEW-0009` unwritten. Both
    were true when written and are now false. **Left for its author to
    correct**, with a pointer added to `SPRINT-CURRENT.md`, rather than
    edited from here — it is someone else's in-progress plan, and editing
    another session's draft mid-write is how two records start disagreeing.
- Validation: `tests/validate.sh` → **OK**. `scripts/sync-registry.sh` run
  as a control — `docs/registry.md` unchanged.
- Result: **done.** S8 closed on `REVIEW-0009`. No clause amended; the
  clause-5 question stays open as a follow-up, which is what ratifying *as
  written* means.
- Commit: `9e6a840` — "Ratify ADR-0021 as written; close S8 on
  REVIEW-0009". Pre-commit hook ran `tests/validate.sh` → OK. **Nine paths
  staged explicitly by name**, never `git add -A`, so the concurrent
  session's six files stayed untracked.
- Push: **confirmed** to `origin` (`c559e28..9e6a840`); branch in sync,
  `git remote -v` token-free.
