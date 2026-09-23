# TASK-0076 — Ratify ADR-0022

## Objective

Record the human's ratification of
`.ai/decisions/0022-unattended-runs-and-the-narrowed-workflow-clause.md`:
status `Proposed` → **`Accepted`**, with what ratification covers and what it
does not, and update the live files that assert it is still pending.

**This task does not promote S9.** That is a separate decision.

## Minimal context

`ADR-0022` narrows **two clauses of an accepted ADR** (`ADR-0019` clauses 2.5
and 3), which is why it was authored `Proposed`: *"narrowing a stated
requirement is the human's call, not the agent's."* It was additionally
blocked on two spikes, because **F1 decided whether this repo's agent schema
needed changing at all**, and an ADR ratified ahead of F1 would have been
ratifying a guess.

Both gates are now cleared. `TASK-0055` and `TASK-0056` ran (2026-09-23);
`TASK-0057` reconciled the draft against what they found, making **six
corrections visibly** and adding **clause 5** — the only clause in the
document that exists because a claim was *falsified* rather than because a
design was chosen. **Human ratification given 2026-09-23.**

**What the evidence changed, and why it matters to what is being signed.** F1
was **falsified**: `opencode run --agent` cannot select a `subagent`-mode
role, and instead **falls back to the default agent** with normal-looking
stdout and exit 0. That does not weaken the case for this ADR — it *raises
the stakes on it*, because an unattended driver invoking the wrong agent is
invisible from stdout. Ratification is therefore of a document that is more
cautious than the draft was, not less.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/decisions/0022-*.md` | `TASK-0057` | `Proposed`; evidence stamp; `## Corrections made after the spikes`; five Decision clauses |
| `.ai/tasks/TASK-0055-*.md`, `TASK-0056-*.md` | spikes | `done`, verdicts recorded |
| `.ai/decisions/0021-*.md` | `TASK-0068` | `Accepted` — the ratification-block house style this task copies |
| `.ai/planning/SPRINT-CURRENT.md` | `TASK-0068` | step 2 of *"How to open the next sprint"* names settling `ADR-0022` |

**Verify the expected state; don't assume it.** Re-read the status line before
editing it — if it does not still say `Proposed`, something else has changed
it and this task should stop rather than overwrite.

## Scope

### Included

- `ADR-0022` status block: `Accepted`, dated, naming what ratification covers
  and what it does not, with the superseded `Proposed` text **preserved**
  rather than deleted (the `ADR-0021` precedent).
- The two open questions recorded **as open**, since offering them and having
  them not taken is only honest if they are then visible.
- Updating the **live** files that say it is pending: `CURRENT_STATE.md`,
  `SPRINT-CURRENT.md`, `ROADMAP.md`, `SPRINT-S9-unattended-runs.md`.
- `TODO.md`'s gate line.

### Not included

- **Promoting S9.** `SPRINT-CURRENT.md` lists four steps to open a sprint;
  this task does **step 2 only**. Steps 3 (a Phase 9 in `ROADMAP.md`) and 4
  (moving the sprint file) are a separate human decision, and that file is
  explicit that doing them piecemeal is how a phase has twice gone missing.
- Starting `TASK-0058`, `TASK-0060` or `TASK-0061`. Ratification unblocks
  them; it does not schedule them.
- **Editing `ADR-0019`.** `ADR-0022` narrows it by reference; `ADR-0019` is a
  dated record and stays as written.
- Rewriting the ADR's Context or its falsified claims. A decision record is
  dated, not a live status page — the rule `ADR-0021` applied to itself.
- Historical files that describe the ADR as `Proposed` **at the time they were
  written** (`TASK-0055`, `TASK-0057`, `TASK-0068`, `PLAN-0006`, `SPRINT-S8`).
  Those are records. Only live-state files are corrected.

## Likely files

- `.ai/decisions/0022-*.md`
- `.ai/context/CURRENT_STATE.md`, `.ai/planning/SPRINT-CURRENT.md`,
  `.ai/planning/ROADMAP.md`, `.ai/planning/sprints/SPRINT-S9-unattended-runs.md`
- `.ai/tasks/TODO.md`
- **No component file.**

## Execution plan

1. Re-read the ADR's status line and confirm it still reads `Proposed`.
2. Rewrite the status block: `Accepted`, what it covers, the open questions,
   and the preserved prior text.
3. Update the four live-state files; leave the historical ones.
4. `tests/validate.sh`; confirm no component file changed; commit; push.

## Acceptance criteria

- [ ] `ADR-0022` reads **`Accepted — 2026-09-23`** and names who ratified it.
- [ ] The prior `Proposed` text is **preserved**, not deleted.
- [ ] What ratification does **not** cover is stated — specifically that it
      does not make the falsified F1 claim retroactively true, and does not
      promote S9.
- [ ] Both open questions are recorded as open.
- [ ] Every **live** file asserting `Proposed` is updated; every **historical**
      one is left alone, and this file says which are which.
- [ ] `tests/validate.sh` passes; no component file changed.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `git status --porcelain` — `.ai/` only

## Risks and rollback

- **Ratifying more than was asked.** The human said ratify the ADR; promoting
  the sprint is a different decision and `SPRINT-CURRENT.md` says so. Doing
  both here would be the agent making a call reserved for the human.
- **Erasing the record of what was wrong.** The ADR's falsified claims and
  corrections must survive ratification; `ADR-0021` kept its two overturned
  claims deliberately, and this file follows it.
- **Silently correcting a dated record.** Mitigated by splitting live-state
  from historical files explicitly, above.
- Rollback is `git revert` of one commit; nothing outside `.ai/` changes.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `.ai/decisions/0022-*.md` | `Accepted`, prior status preserved, open questions named |
| `SPRINT-CURRENT.md`, `ROADMAP.md`, `SPRINT-S9-*.md`, `CURRENT_STATE.md` | Gate recorded as cleared; sprint still **not promoted** |
| Component layer | **Unchanged** |

**Next task starts here**: `TASK-0058`, `TASK-0060` and `TASK-0061` are
**unblocked but unscheduled**. Promoting S9 remains a human decision and needs
`ROADMAP.md`'s Phase 9 written *in the same change*.

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
  1. **Checked the checkout first.** The IDE opened the ADR at
     `/home/armando.martires/AI_Workspaces/ai-toolbox/`, which is not the path
     this session works in. It resolves to a **symlink** onto
     `/mnt/c/Users/armando.martires/AI Workspaces/ai-toolbox` — same tree,
     same `HEAD`. Verified rather than assumed, because a second clone would
     have meant editing a copy the human was not reading.
  2. Re-read the status line and confirmed it still said `Proposed`.
  3. Rewrote the Status block per the `ADR-0021` house style: `Accepted`, what
     ratification covers, what it does **not**, the two open questions, and
     the **prior text preserved** in a superseded-status block quote.
  4. Updated the four **live-state** files; left the **historical** ones.
- Observations:
  - **Live files updated:** `SPRINT-CURRENT.md` (step 2 struck; its header
     claim that *"S9 cannot start yet"* rewritten), `ROADMAP.md`,
     `SPRINT-S9-unattended-runs.md` (rows 0055–0057 `done`, gate row
     **CLEARED**), `CURRENT_STATE.md` (five separate assertions),
     `TODO.md`.
  - **Historical files deliberately left as written**, each describing the ADR
     as `Proposed` *at the time it was written*: `TASK-0055`, `TASK-0057`,
     `TASK-0068`, `PLAN-0006`, and the archived `SPRINT-S8`. A decision record
     and a closed sprint are dated records, not live status pages — the rule
     `ADR-0021` applied to itself when its own claims were overturned.
  - **What was signed is more cautious than the draft.** F1's falsification
     added clause 5 and showed that an unattended driver invoking the wrong
     agent is invisible from stdout. Recorded in the Status block so a later
     reader does not assume ratification meant the evidence was reassuring.
  - **Three things carried past ratification**, all named in the ADR so none
     reads later as settled: whether `mode: all` is admitted (clause 5.2 makes
     `TASK-0058` decide it explicitly); whether
     `push-requires-confirmation` survives the vocabulary at all; and
     `isolation: worktree`, which is a **gap rather than a question** —
     `TASK-0056`'s attempt was confounded and all nine S9 roles declare
     `worktree-only`.
  - **S9 was not promoted, deliberately.** `SPRINT-CURRENT.md` lists four
     steps; this did step 2. Steps 3 and 4 are a separate decision, and that
     file warns that doing them piecemeal is how a phase has twice gone
     missing.
- Validation:
  - `tests/validate.sh` — **OK**
  - `git status --porcelain` — **`.ai/` only**; no component file changed
- Result: **done.** `ADR-0022` is `Accepted`. `TASK-0058`, `TASK-0060` and
  `TASK-0061` are unblocked and unscheduled.
- Commit: *pending — recorded in the follow-up commit*
- Push: *pending*
