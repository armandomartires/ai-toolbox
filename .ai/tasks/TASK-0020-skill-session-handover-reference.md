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
- [ ] `templates/reference/session-handover.md` exists and states the
      resumability invariant, a named read order, and the advisory
      rotation heuristic.
- [ ] It restates nothing already owned by another `reference/` file —
      verified by reading all six, not assumed.
- [ ] `00.CONVENTIONS.md` links to it from the reference table.
- [ ] `00.CONVENTIONS.md` is **≤ 3072 bytes, measured** — and lower than
      its starting size, since it started over.
- [ ] The rotation percentages are labelled advisory where they appear,
      not stated as rules.
- [ ] `tests/validate.sh` passes.

## Mandatory validations
- [ ] `tests/validate.sh`
- [ ] `wc -c skills/project-workflow/templates/00.CONVENTIONS.md` — the
      number recorded in the execution log, not described as "fine"
- [ ] `scripts/sync-registry.sh` — the skill's `description` is unchanged,
      so expect **no diff**; confirm that rather than assuming it

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
| `skills/project-workflow/templates/reference/session-handover.md` | New. The skill's only statement of the session boundary, read order, and rotation heuristic. |
| `skills/project-workflow/templates/00.CONVENTIONS.md` | One row added to the reference table; **under 3072 bytes**, with the measured size in its header. |
| possibly one existing `reference/*.md` | Gains any content moved out of the entry point. |

**Next task starts here**: TASK-0021 edits
`templates/tasks/0000_TEMPLATE.md` to add the `Inputs` / `Outputs`
sections, then bumps `SKILL.md` `metadata.version` to `3.1.0` — the
single bump covering both this task's and its own changes — and re-runs
`scripts/install.sh`. The version is still `3.0.0` when TASK-0021 begins;
that is expected, not an omission by this task.

## Status
- Status: planned   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13

## Execution log
### Attempt 1
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
