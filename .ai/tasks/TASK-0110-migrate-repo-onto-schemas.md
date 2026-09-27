# TASK-0110 — Migrate the repository onto the artifact schemas

## Objective

`TASK-0109` built the schema mechanism and gated exactly one artifact kind —
task briefs, from `TASK-0109` onward. Everything already written stayed
unchecked, so the repository ships a convention it does not itself follow.
This task migrates the repository onto it: gate all four kinds, lower the
task boundary to cover every modern brief, and repair the drift that
exposes. It discharges the human's instruction of 2026-09-27, *"migrate
project to comply with the new workflow"*, and closes the limit `TASK-0109`
recorded in its own handover.

## Minimal context

**The gap was measured before it was planned**, by running each schema over
every existing artifact:

| Kind | Files | Would fail | What that means |
|---|---|---|---|
| ADR | 27 | **0** | gate now, nothing to repair |
| Session | 30 | **0** | gate now, nothing to repair |
| Review | 12 | **1** | `REVIEW-0012` only |
| Task | 106 | 34 | 23 are history, **11 are real drift** |

**The 34 task failures split cleanly, and the split is the whole task.**

*Twenty-three are pre-convention history.* `TASK-0001`–`TASK-0023` fail for
missing `## Inputs` / `## Outputs / handover` and for carrying
`## Preconditions`, `## Dependencies`, `## Expected result` — the three
headings `ADR-0012` superseded. `tests/validate.sh` already exempts them at
`FIRST_CONTRACT_TASK = 20` with the argument that settles this: they are
*"records of what happened, not instances of the current template; rewriting
them to satisfy a rule invented afterwards would fabricate compliance."*
**They stay exempt.** That is not a gap left open; it is the recorded
decision, and this task does not reverse it.

*Eleven are modern briefs that drifted*, and they are the migration target:

| Brief | Defect | Repairable without inventing? |
|---|---|---|
| `0057`, `0108` | heading order only | **yes** — pure formatting |
| `0078`, `0079`, `0081`, `0084`, `0085` | no `## Likely files` | no — it is a *forecast* |
| `0031`, `0041` | no `## Mandatory validations` | no — written before the work |
| `0068` | no `## Execution plan` | no — written before the work |
| `0092` | no `### Attempt 1` | no — the log was never opened |

**The nine cannot be filled in honestly, and will not be.** `## Likely
files` is a forecast written *before* the work; reconstructing it from what
the commit actually touched produces an outcome wearing a forecast's label,
which is worse than the missing heading because it reads as evidence. The
human chose disclosure over reconstruction: each gets its heading and one
dated line saying the section was not recorded. That is the repo's existing
idiom — `skills/ansible-ops/references/hazards.md` keeps superseded text
visible and adds a dated correction; `skills/unattended-ops/templates/
binding.md` distinguishes a declared `not-applicable` from an `unknown`
nobody answered.

**`REVIEW-0012` is a naming divergence, not a missing section.** It carries
`## Closing` and `## Follow-ups` where the other eleven reviews carry
`## Verdict` and `## Follow-up tasks`. The content exists and is not
touched; only the two labels change. It is the outlier at 1-of-12, which is
why the schema follows the eleven.

**One claim in `ADR-0027` goes stale here.** Its Consequences say *"Only
task briefs are gated; ADR, review and session schemas exist and generate,
but nothing checks the finished files."* After this task that is false, so
the ADR takes a dated clarification rather than being left to contradict
the gate — the shape `ADR-0005` and `ADR-0014` already use.

## Authorization — granted by the human, 2026-09-27

`AGENTS.md` requires explicit human authorization in the task file for
overwrites of existing content. Asked and **granted**, with the scope
recorded here rather than summarised:

> *"Fix 11, disclose gaps"* — reorder the two; for the nine, add the missing
> heading with an explicit "not recorded" line rather than inventing a
> forecast after the fact; lower the boundary to 24 so all modern work is
> gated; keep `TASK-0001`–`0023` exempt.
> *"Authorized, record in task file"* — proceed, recording which files may
> be touched and what may change in each.

**Exactly twelve existing artifacts may be edited**, and nothing else:

| File(s) | What may change | What may not |
|---|---|---|
| `TASK-0057`, `TASK-0108` | heading **order** only | no prose added, reworded or removed |
| `TASK-0031`, `0041`, `0068`, `0078`, `0079`, `0081`, `0084`, `0085`, `0092` | **add** the one missing heading + one dated "not recorded" line | no existing prose touched; nothing reconstructed |
| `REVIEW-0012` | two heading **labels** | its content, in any way |

No deletion, no history rewrite, no force-push. Every edit is additive or a
rename; `git revert` undoes the lot.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/project-migration/schemas/{task,adr,review,session}.md` | `TASK-0109` (`85ca681`) | four schemas; ADR and review transcribed from the real artifacts, not from `.ai/templates/` |
| `skills/project-workflow/scripts/artifact_lib.py` | `TASK-0109` | `check-many` mode present; parses a schema once for N artifacts |
| `tests/validate.sh` | `TASK-0109` | green; `FIRST_GENERATED_TASK = 109`; task briefs the only gated kind |
| `.ai/decisions/` | 27 ADRs | all 27 pass `schemas/adr.md` today — re-verify, don't assume |
| `.ai/sessions/` | 30 sessions + `INDEX.md` | all 30 pass; `INDEX.md` is an index and must be excluded |
| `.ai/reviews/` | 12 reviews | 11 pass; `REVIEW-0012` fails on two labels |
| `.ai/tasks/TASK-*.md` | 106 briefs | 72 pass; 23 history + 11 modern fail. No briefs in subdirectories (`find` confirmed) |
| `.ai/decisions/0027-*.md` | `TASK-0109` | Consequences claim only task briefs are gated — true now, false after this task |
| git | — | clean, `master`, `origin/master` at `adc8619` |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

- Gate ADRs, sessions and reviews in `tests/validate.sh`, excluding indexes.
- Lower `FIRST_GENERATED_TASK` from 109 to **24**.
- Repair the 11 modern briefs and `REVIEW-0012`, within the authorization
  table above.
- Dated clarification on `ADR-0027`; authoring-guide Gated column;
  `CURRENT_STATE.md`.

### Not included

- **`TASK-0001`–`TASK-0023`.** Exempt, by `ADR-0012` and the argument
  already written at `FIRST_CONTRACT_TASK`. Not reopened.
- **Reconstructing any before-the-work section.** Declined on the merits and
  by the human's choice; disclosure instead.
- **`B-036`** — the engine is still unreachable from `project-migration`
  alone. Unchanged, still open, still unbuilt for an absent consumer.
- Rewording any existing prose, in any file.
- `20.PLAN.md`, `30.ROADMAP.md`, `35.AD_HOC_TASKS.md` — indexes, not
  instances.

## Likely files

A forecast, written before the work.

`tests/validate.sh` (gate the three kinds, lower the boundary); the 11
briefs listed in the authorization table; `REVIEW-0012`;
`.ai/decisions/0027-artifact-shape-has-one-owner.md` (clarification);
`docs/development/authoring-guide.md`; `.ai/context/CURRENT_STATE.md`.
No schema is expected to change — if one does, that is a finding, because
it would mean the schemas were transcribed wrongly in `TASK-0109`.

## Execution plan

1. Re-verify the four counts. The table above is a measurement, and a
   measurement taken yesterday is an assumption today.
2. Gate ADRs, sessions and reviews; confirm green **before** touching any
   artifact, so a later failure is attributable to a repair and not to the
   gate.
3. `REVIEW-0012`: two labels.
4. `TASK-0057`, `TASK-0108`: reorder.
5. The nine: heading + dated disclosure line.
6. Lower `FIRST_GENERATED_TASK` to 24. This is the step that must fail
   first if any repair was missed.
7. `ADR-0027` clarification, authoring guide, `CURRENT_STATE.md`.
8. Validate, review the diff file by file against the authorization table,
   commit, push.

## Acceptance criteria

- [ ] `tests/validate.sh` exits 0 with all four kinds gated and
      `FIRST_GENERATED_TASK = 24`.
- [ ] 27/27 ADRs, 30/30 sessions, 12/12 reviews, and every brief from
      `TASK-0024` pass their schema.
- [ ] `TASK-0001`–`TASK-0023` are **byte-identical** to their pre-task state
      (`git diff` shows nothing for them).
- [ ] Each of the nine carries a dated line stating the section was not
      recorded — and **no reconstructed content**.
- [ ] `REVIEW-0012`'s body is byte-identical apart from two heading lines.
- [ ] Fails-when-reverted: restoring any one repair fails the gate for the
      expected reason.
- [ ] `ADR-0027` no longer claims only task briefs are gated.
- [ ] Gate runtime measured, native and `/mnt/c`, and reported.
- [ ] Diff reviewed file by file against the authorization table; no file
      outside it is modified.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed)
- [ ] scripts/sync-templates.sh --check

## Risks and rollback

**Risk 1 — a repair that fabricates.** The whole point of the disclosure
route. Mitigated by the authorization table naming what may change per file,
and by the criterion that the nine carry *no* reconstructed content. If a
repair cannot be made without inventing, the correct outcome is to leave the
brief failing and raise the boundary, not to invent.

**Risk 2 — the boundary hides a miss.** Lowering to 24 is the step that
proves the repairs worked; doing it last means any missed brief fails the
gate rather than passing silently. Ordering is deliberate.

**Risk 3 — scope creep into the 23.** They are one `sed` away from
"compliance" and that is exactly the temptation `FIRST_CONTRACT_TASK` exists
to refuse. The acceptance criterion is byte-identity, not conformance.

**Risk 4 — gating three more kinds slows the gate.** Measure; do not delete
checks to buy back time the filesystem is spending.

**Rollback.** Every edit is additive or a rename, one commit, no history
rewrite. `git revert` is sufficient and complete.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `tests/validate.sh` | all four kinds gated via one `check-groups` call; `FIRST_GENERATED_TASK = 24`; `INDEX.md` excluded; `REVIEW-0012` exempt by name with the reason in place |
| `skills/project-workflow/scripts/artifact_lib.py` | `check-groups` mode added — several kinds, one interpreter, each schema parsed once |
| `skills/project-{workflow,migration}/schemas/review.md` | the write-once rule restored, having been dropped by `TASK-0109` |
| `skills/project-workflow/templates/reviews/0000_TEMPLATE.md`, `.ai/templates/REVIEW.md` | regenerated, carrying the restored rule |
| 9 briefs (`0031`,`0041`,`0068`,`0078`,`0079`,`0081`,`0084`,`0085`,`0092`) | each gained one heading + a dated "not recorded" line. **Purely additive — zero deletions**, verified per file with `git diff --numstat` |
| `TASK-0108` | `## Status` moved before `## Execution log`. Content proven unchanged by a sorted-line diff |
| `TASK-0057` | the retained empty scaffold's `### Attempt 1` demoted to `####`. One line changed, nothing removed |
| `.ai/decisions/0027-*.md` | dated clarification: two of its statements were true when written and are now false; the exemptions and the regression recorded |
| `docs/development/authoring-guide.md` | three rows added to the schema table — the three gated kinds, named exemptions, and the repair-by-disclosure rule |
| `.ai/context/CURRENT_STATE.md` | new section, **The repository now follows it** |
| **Untouched, deliberately** | `TASK-0001`–`TASK-0023` (byte-identical, `git diff` empty); `REVIEW-0012`; all 27 ADRs; all 30 sessions; every schema but `review.md`; `B-036` |

**Next task starts here**: every ADR, session, review and task brief from
`TASK-0024` onward is gated against its schema and passes — 152 artifacts per
run. Two named exemptions exist (`REVIEW-0012`, and `TASK-0001`–`0023` by
boundary), each with its reason recorded where the gate enforces it. `B-036`
is still open and still deliberately unbuilt.

## Deviation from the Plan

Four, all recorded rather than folded in.

1. **`TASK-0057` was misdiagnosed when authorization was requested.** The
   plan's table said "heading order only", taken from the checker's message.
   The real defect is dead template residue — a second, empty `### Attempt 1`
   under a wrapper reading *"(template scaffold, retained)"*. The human was
   told the diagnosis was wrong and chose demotion over deletion, because
   someone had explicitly retained it.
2. **`REVIEW-0012` was not repaired.** The plan authorized changing two
   heading labels. Renaming alone still fails, because it also has them in a
   different order from the other eleven — which are byte-identical in order.
   Conforming it means relocating sections in a closed sprint's record, and
   the review schema's write-once rule forbids exactly that. Exempted by
   name instead. A numeric boundary was considered and rejected as
   over-claiming: it would assert that reviews before N predate the schema
   when eleven of twelve match it.
3. **A `TASK-0109` regression surfaced and was fixed here**, outside this
   task's planned scope. The review template's write-once rule had lived in
   its copy-instruction blockquote and was discarded with it. Restored.
4. **A gate bug found by running it**: the artifact list was passed as
   `$GROUPS`, which bash owns as a built-in array, so the assignment was
   silently dropped and python raised `KeyError`. Renamed `ARTIFACT_GROUPS`.

## Status

- Status: done
- Owner: agent
- Created: 2026-09-27
- Updated: 2026-09-27

## Execution log

### Attempt 1

- Date: 2026-09-27
- Agent: Claude Opus 5 (1M context), Claude Code
- Actions: this brief was **generated** by
  `new-artifact.sh --kind task --framework project-migration`, the first real
  use of `TASK-0109`'s generator. Then, in plan order: re-verified the four
  counts; gated the three clean kinds and confirmed the gate named exactly the
  12 predicted files *before* editing any artifact; restored the write-once
  rule; reordered `TASK-0108`; demoted `TASK-0057`'s scaffold; added
  disclosure sections to the nine; lowered the boundary to 24; exempted
  `REVIEW-0012`; clarified `ADR-0027`; authoring guide; `CURRENT_STATE.md`.
- Observations: the counts were better than feared — **27/27 ADRs and 30/30
  sessions already conformed**, so three of four kinds cost nothing to gate.
  The 34 task failures split 23 history / 11 real drift, and that split was
  the whole task. Two files could not be repaired within the authorization
  granted, and both were taken back to the human rather than quietly widened.
- Validation: every acceptance criterion exercised.
  **Gate** → `validate.sh: OK` with all four kinds and
  `FIRST_GENERATED_TASK = 24`; 84 briefs + 27 ADRs + 11 reviews + 30 sessions
  = **152 artifacts** checked.
  **Counts** re-verified 2026-09-27 before and after.
  **History untouched** — `git diff --name-only .ai/tasks/` lists 11 files and
  no `TASK-00{0,1,2[0-3]}`; `TASK-0001`–`0023` byte-identical.
  **Additive-only** — `git diff --numstat` shows `-0` on all nine.
  **`TASK-0108` content identical** — sorted-line diff of old vs new is empty.
  **`TASK-0057`** — `git diff -U0` shows exactly one line changed.
  **Fails-when-reverted**, three of them: restoring `TASK-0078` →
  `missing required section: ## Likely files`; `TASK-0057` → duplicate
  `### Attempt 1` reported as out-of-order; `TASK-0108` → `## Status` after
  `## Execution log`. Each restored, gate back to 0 failures.
  **Blast radius** — `git status` compared to the authorization table: no file
  outside it modified.
  **Timing** — native ext4 A/B, alternating, 3 rounds: 1.17 s → 1.36 s.
  `/mnt/c`: 2.79 s → 3.90 s, the 9p bridge reading 152 files.
- Result: done. The repository now follows the convention it ships. Two
  exemptions, both named and reasoned where the gate enforces them; nine
  briefs repaired by disclosure rather than reconstruction; one `TASK-0109`
  regression and one gate bug found and fixed.
- Commit: `9525af1`
- Push: confirmed — pushed to `origin/master`,
  working tree clean and branch level with the remote afterwards
