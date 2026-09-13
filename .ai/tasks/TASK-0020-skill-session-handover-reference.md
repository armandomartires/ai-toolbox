# TASK-0020 — Skill: add the session-handover reference; restore the conventions budget

## Objective
Give the `project-workflow` skill the session-boundary concept it has
never had, as a new load-on-demand
`templates/reference/session-handover.md`, reachable from
`00.CONVENTIONS.md`'s reference table — and bring that entry point back
under its own declared byte budget while adding the row.

## Inputs
| Artifact | Produced by | Expected state |
|---|---|---|
| `.ai/decisions/0012-handover-contract-resumability-invariant.md` | ADR-0012, this sprint | Accepted. Its Decision 2 is the content this task writes down. |
| `.ai/planning/plans/PLAN-0002-session-handover-contract.md` | PLAN-0002, this sprint | Phase 2 is this task; read its exit criteria before starting. |
| `skills/project-workflow/templates/00.CONVENTIONS.md` | pre-existing | **3087 bytes — already 15 over its declared ≲3 KB (3072) cap.** Verify by measuring, not by trusting this number. |
| `skills/project-workflow/templates/reference/size-budgets.md` | pre-existing | Lines 35-38 forbid raising a cap to fit existing content. Governs how the overage is paid. |
| `skills/project-workflow/templates/reference/` (6 files) | pre-existing | The load-on-demand tier this task adds a seventh file to. Read all six — the new file must not restate any of them. |
| `.ai/sessions/INDEX.md` | eleven prior sessions | Evidence for the rotation heuristic; `INDEX.md:15` is the counter-example to a hard one-task-one-session rule. |

## Minimal context
The skill presumes multi-session work in at least three places
(`00.CONVENTIONS.md:6`, `reference/size-budgets.md:6`, and the whole
existence of byte budgets for re-read files) but states no session
boundary rule, no cold-start read order, and no handover mechanism. The
presumption is load-bearing and unwritten.

`00.CONVENTIONS.md` is mandatory-read every session, which is exactly why
new prose cannot go there. It gets one table row; the substance goes to
`reference/`.

## Scope
### Included
- New `templates/reference/session-handover.md`: the resumability
  invariant, the cold-start read order, the rotation heuristic (with its
  numbers marked advisory), and the in-task subagent allowance.
- One row in `00.CONVENTIONS.md`'s "Reference (load on demand)" table.
- Whatever content move is needed to bring `00.CONVENTIONS.md` **under**
  3072 bytes with that row added.

### Not included
- **Touching the task template.** That is TASK-0021 — kept separate so
  the version bump and the deployed-copy re-sync happen once, against a
  finished shape.
- **Raising the 3 KB budget.** Explicitly forbidden by
  `reference/size-budgets.md:35-38`. If the file cannot fit, move content
  out; do not move the line.
- **Changing `SKILL.md`.** `metadata.version` bumps once, in TASK-0021,
  covering both skill-side changes. Two bumps for one logical change
  would make the version noisier, not more precise.
- **Adopting any of this in `ai-toolbox`'s own `.ai/`.** TASK-0022.
- Rewriting the six existing reference files beyond whatever content this
  task deliberately moves into them.

## Preconditions
- ADR-0012 accepted; PLAN-0002 written.
- Working tree clean; `tests/validate.sh` passing.

## Likely files
- `skills/project-workflow/templates/reference/session-handover.md` (new)
- `skills/project-workflow/templates/00.CONVENTIONS.md`
- possibly one existing `reference/*.md` file, as the destination for
  content moved out of the entry point

## Execution plan
1. Measure `00.CONVENTIONS.md` (`wc -c`) and record the starting number.
   Do not trust the 3087 in this file — re-measure.
2. Read all six existing `reference/` files first, so the new one links
   rather than restates. In particular `size-budgets.md` already explains
   *why* files are re-read every session; the new file must not re-explain
   it.
3. Write `session-handover.md`:
   - **The invariant**: a task must be startable cold from its own file
     plus the two index files. State it as the testable property.
   - **Cold-start read order**: entry point → `20.PLAN.md` (what is in
     flight) → the task file's `Inputs`. Name the order, since "read the
     docs" is not an order.
   - **Rotation heuristic**: sync durable files at ~60–70% context, hand
     off before ~80%. Marked advisory, with the reason — the numbers
     track today's context windows, not the convention.
   - **What a session closes with**: durable files updated, commit, push
     confirmed. Link `git-workflow.md`; do not restate it.
   - **Subagents**: sanctioned within a task for research and bulk
     mechanical work, main agent verifies. One line.
4. Add the reference-table row in `00.CONVENTIONS.md`.
5. Re-measure. If over 3072, move content out — the likeliest candidate
   is prose that a `reference/` file already owns — and re-measure again.
   Iterate until under, then state the final number in the file's own
   header the way the budget rule requires.
6. Run `tests/validate.sh`; confirm the skill still passes.

## Acceptance criteria
- [x] `templates/reference/session-handover.md` exists and states the
      resumability invariant, a named read order, and the advisory
      rotation heuristic.
- [x] It restates nothing already owned by another `reference/` file —
      verified by reading all six, not assumed. One real overlap was
      found and removed (see log).
- [x] `00.CONVENTIONS.md` links to it from the reference table (L68).
- [x] `00.CONVENTIONS.md` is **≤ 3072 bytes, measured** — 3060, down
      from 3087.
- [x] The rotation percentages are labelled advisory where they appear,
      not stated as rules (L50, L59).
- [x] `tests/validate.sh` passes.

## Mandatory validations
- [x] `tests/validate.sh` — OK
- [x] `00.CONVENTIONS.md` size: **3087 → 3060 bytes**, cap 3072, 12 bytes
      headroom
- [x] `scripts/sync-registry.sh` — **no diff**, confirmed by
      `git diff --name-only docs/registry.md` returning empty

## Risks and rollback
- **Risk: the new file duplicates `size-budgets.md`.** Both concern
  "files re-read every session" and the overlap is genuine. Mitigation:
  `size-budgets.md` owns *why the index files are small*;
  `session-handover.md` owns *how a session starts and ends*. Cross-link
  once; if a sentence could sit in either, it belongs in the one that
  already has it.
- **Risk: the budget is restored by deleting something load-bearing.**
  Mitigation: content is *moved* to `reference/`, never dropped. Confirm
  every moved sentence has a destination before removing it, per
  `size-budgets.md:28-30` ("nothing is deleted outright").
- **Risk: the file becomes a context-engineering essay.** It is a
  reference file for an agent mid-task, not a rationale document —
  the rationale is ADR-0012's job. Keep it to the same scale as its six
  siblings (29–51 lines).
- Rollback: the new file is additive and the conventions edit is small;
  revert the commit.

## Dependencies
ADR-0012 (the decision), PLAN-0002 (the sequencing). Blocks TASK-0021.

## Outputs / handover
| Artifact | End state |
|---|---|
| `skills/project-workflow/templates/reference/session-handover.md` | New, 2990 bytes / 67 lines. The skill's only statement of the session boundary, read order, and rotation heuristic. |
| `skills/project-workflow/templates/00.CONVENTIONS.md` | Reference-table row added (L68); **3060 bytes**, 12 under cap. Budget restated as the exact `≤3072 bytes` — it previously read the ambiguous "≲3 KB". |
| existing `reference/*.md` | **Unchanged.** No file needed to receive moved content: the sentence removed from the entry point was already owned by `skill-maintenance.md`. |
| `skills/project-workflow/SKILL.md` | **Unchanged — still `3.0.0`.** By design; TASK-0021 performs the single bump for both tasks. |

**Next task starts here**: TASK-0021 edits
`templates/tasks/0000_TEMPLATE.md` to add the `Inputs` / `Outputs`
sections, then bumps `SKILL.md` `metadata.version` to `3.1.0` — the
single bump covering both this task's and its own changes — and re-runs
`scripts/install.sh`. The version is still `3.0.0` when TASK-0021 begins;
that is expected, not an omission by this task.

Two notes TASK-0021 should carry, from what this task hit:

1. **The entry point has only 12 bytes of headroom.** TASK-0021 is not
   planned to touch `00.CONVENTIONS.md`, but if it does, re-measure —
   the budget is now an exact number (`≤3072`) and is genuinely tight.
2. **The OpenCode deployment is a symlink, so `diff -rq` can never
   detect drift there — and TASK-0021's plan is built on the assumption
   that it can.** Verified this task:
   `~/.config/opencode/skills/project-workflow` is a `SymbolicLink`, and
   both it and the repo path canonicalize (`readlink -f`) to the
   identical directory. It already serves this task's uncommitted edits.
   This is ADR-0002's symlink-first install working as designed
   (`install.sh link`).

   Consequences TASK-0021 must absorb rather than rediscover:
   - Its precondition "`diff -rq` clean before starting" is **vacuously
     true** and proves nothing. A check that cannot fail is worse than no
     check — this repo's own lesson 1, and it is currently written into
     TASK-0021's Mandatory validations.
   - Its planned proof "grep the deployed copy for `3.1.0`" is likewise
     vacuous: the deployed copy *is* the repo file, so the grep passes
     the instant the repo is edited, whether or not `install.sh` ever
     runs.
   - **A real check must target a client installed with `copy`, not
     `link`.** Claude Code's deployment shape needs checking first
     (`configs/*/README.md`, `scripts/install.sh`); if every client here
     is symlinked, then the honest record is that drift is structurally
     impossible on this machine and the verification step should say so
     rather than perform a test that cannot fail.
   - REVIEW-0002's three-copies-claiming-`2.1.0` defect was real, but it
     was cross-*repo* drift, not repo-vs-deployed. The mitigation
     TASK-0021 inherited does not address the defect that actually
     occurred.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13

## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode
- Actions:
  - Measured the baseline first, as the Inputs table required: **3087
    bytes**, confirming the 15-byte overage rather than trusting the
    number the plan carried.
  - Read all six existing `reference/` files before writing, then wrote
    `session-handover.md`: the invariant, a 5-step read order, the
    end-of-session sequence, one-task-per-session as default-not-rule with
    the advisory rotation heuristic, and the subagent limits.
  - Added the reference-table row to `00.CONVENTIONS.md`.
  - Paid the overage by removing the provenance sentence ("Project-agnostic
    template copied via the `project-workflow` skill") — **moved, not
    deleted**: `reference/skill-maintenance.md` already owns that fact in
    its first paragraph, verified before removing it.
- Observations:
  - **The budget was ambiguous, not just exceeded.** The header said
    "≲3 KB", which reads as either 3000 or 3072 depending on the reader.
    A budget whose target is ambiguous cannot be enforced or even checked
    consistently — the likeliest reason nobody noticed the overage for
    four sprints. Changed to the exact `≤3072 bytes`. This was not in the
    plan; it is a defect the plan's own measuring step exposed.
  - **The row cost 92 bytes, not the ~50 I had assumed** — the table row
    plus the removed sentence had to net out, so the trim was doing more
    work than "pay back 15 bytes" implied. Measuring after each edit
    rather than at the end is what caught this.
  - **Found and removed a genuine three-way duplication.** My first draft
    restated "a failed push means the task is not done" inline while also
    linking `git-workflow.md` — making three copies of one rule across
    `00.CONVENTIONS.md:61`, `git-workflow.md:8`, and the new file.
    Reduced to a bare link. Worth recording because I wrote the
    one-owner-per-fact violation *while implementing the task that cites
    that rule* — the pull toward restating a rule for the reader's
    convenience is strong even when the rule forbidding it is in view.
  - **First draft ran 87 lines against the 29–51 scale of its siblings**
    (the plan's own stated risk: "keep it to the same scale"). Rewrote to
    67 lines / 2990 bytes. The excess was exactly the failure mode the
    risk named — explaining *why* rotation matters, which is ADR-0012's
    job, in a file meant to tell an agent what to do mid-task.
  - `layout-declaration.md` is 84 lines, so 67 is within the family's
    actual range even though above the 51 the plan cited.
  - Checked four candidate overlaps deliberately (push rule,
    every-session re-read, subagent guidance, `in flight` phrasing).
    Only the push rule was a real duplication; `size-budgets.md` retains
    sole ownership of *why* index files stay small, while the new file
    owns *how a session starts and ends*.
  - **Wrote a false handover claim, then caught it by verifying — the
    single most useful thing this task did.** My first version of the
    handover note stated that the deployed skill copy was "now stale" and
    warned TASK-0021 that its `diff -rq` precondition would fail. Before
    committing I checked, and the opposite is true:
    `~/.config/opencode/skills/project-workflow` is a **symlink** whose
    `readlink -f` is byte-identical to the repo path (ADR-0002,
    `install.sh link`). It was already serving my uncommitted edits.
    The note would have sent TASK-0021 chasing drift that cannot exist.
  - **That discovery invalidates two of TASK-0021's planned checks**, both
    of which I wrote in the previous session and neither of which can
    fail: `diff -rq` between a symlink and its target is vacuously clean,
    and grepping the "deployed" copy for `3.1.0` reads the repo file
    itself. Recorded in the handover so TASK-0021 replaces them rather
    than performing them and recording a false pass — precisely
    `CURRENT_STATE.md` lesson 1, which I reproduced while implementing the
    sprint that exists to cite it.
  - The read-order step I wrote ("**verify that declared state rather than
    assuming it** … a stale `Inputs` table is the one failure this
    convention cannot catch for you") is what prompted the check. The
    guidance caught a defect in the very task that authored it, which is
    the only real evidence available this early that the convention does
    something.
- Validation:
  - `tests/validate.sh` — OK, unchanged behaviour.
  - Size: 3087 → **3060** bytes, 12 under the 3072 cap. Measured with
    `(Get-Item …).Length` at every step, never estimated.
  - `session-handover.md`: 2990 bytes, 67 lines.
  - `scripts/sync-registry.sh` — regenerated, **no diff** (confirmed via
    `git diff --name-only`, not assumed from the description being
    unchanged).
  - Grepped the finished file to confirm the advisory labelling (L50,
    L59) and the conventions link (L68) rather than trusting the edit.
  - Verified the deployment shape empirically: `LinkType` =
    `SymbolicLink`, `readlink -f` identical on both sides, target repo
    `HEAD` = `1f5544e` (same repo, reached via a symlinked
    `~/AI_Workspaces` → `/mnt/c/.../AI Workspaces`).
- Result: success. The skill now states a session boundary, a read order,
  and a handover rule for the first time. Three defects surfaced beyond
  the task's scope: the ambiguous budget target (fixed), a self-inflicted
  three-way duplication (fixed), and **two unfailable checks in
  TASK-0021's plan** (recorded in the handover for TASK-0021 to replace —
  not fixed here, because rewriting the next task's Mandatory validations
  from inside this one would bundle two units of work in one commit).
- Commit: see below
- Push: to `origin master`
