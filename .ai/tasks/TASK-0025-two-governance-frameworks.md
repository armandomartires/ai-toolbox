# TASK-0025 — Close B-009: the two skills scaffold different frameworks, by design

## Objective
Resolve B-009 by deciding it rather than implementing its literal wording.
B-009 asks whether `project-migration` should be changed to emit
`NNNN-*.md` like `project-workflow`. Investigation says the premise is
false: the two skills scaffold **two different governance layouts**, not
one layout spelled two ways. Record that in an ADR and make each skill
state its own scope, so the divergence stops reading as a defect.

## Minimal context
B-009 was raised by TASK-0024 after a link sweep flagged
`skills/project-migration/scripts/ai-project-scaffold.sh` emitting
`.ai/decisions/ADR-0001-repo-structure.md`. Framed as "diverging from
`project-workflow`'s `NNNN-*`", it looked like an unfinished migration —
the same shape as B-008, which had just been closed by finishing one.

**It is not the same shape.** Comparing what each skill actually creates:

| | `project-workflow` | `project-migration` |
|---|---|---|
| Entry | `00.CONVENTIONS.md` | `AGENTS.md` + `.ai/README.md` |
| Plan | `20.PLAN.md` | `planning/SPRINT-CURRENT.md` |
| Roadmap | `30.ROADMAP.md` | `planning/ROADMAP.md` |
| Backlog | `35.AD_HOC_TASKS.md` | `planning/BACKLOG.md` |
| Context | — | `context/{CURRENT_STATE,PROJECT_MAP,GLOSSARY}.md` |
| Sessions | — | `sessions/INDEX.md` |
| Templates | `reference/` (6 files) | `templates/{TASK,PLAN,SESSION,ADR,REVIEW}.md` |
| Task IDs | `S###.T###_Name.md` | `TASK-####-*.md` |
| ADR files | `NNNN-title.md` | `ADR-NNNN-*.md` |

Only the last row was in B-009. It is the smallest of nine differences,
and **this repo runs `project-migration`'s layout**, not
`project-workflow`'s: `.ai/context/`, `.ai/planning/`, `.ai/sessions/`,
`.ai/templates/`, `TASK-0024-*.md`. `.ai-layout.json` declares
`{"root": ".ai/", "entrypoint": "AGENTS.md"}` — i.e. explicitly *not*
`00.CONVENTIONS.md`, which is why ADR-0004 needed the declaration
mechanism at all.

So "align the two" is not a rename. It would mean choosing one framework
and abandoning the other — a large, breaking decision that B-009's `low`
priority and one-line description do not license.

**TASK-0024 already avoided the trap once** by logging B-009 instead of
absorbing it. This task's job is to finish that thought, not to reopen it.

## Inputs
| Artifact | Produced by | Expected state |
|---|---|---|
| `.ai/planning/BACKLOG.md` | TASK-0024 | B-009 `open`, the only open item. |
| `skills/project-migration/scripts/ai-project-scaffold.sh` | TASK-0001 | 17688 bytes. Emits the `context/planning/sessions/templates` layout incl. `ADR-0001-repo-structure.md`. **Not to be changed by this task.** |
| `skills/project-migration/SKILL.md` | TASK-0001 | `1.0.0`. Describes migrating a live repo; never mentions `project-workflow`. |
| `skills/project-workflow/templates/` | TASK-0020/0021 | `3.1.0`. Scaffolds `00.CONVENTIONS.md` + `20/30/35` + `reference/`. |
| `.ai/decisions/0001-repo-structure.md` | S1 | Accepted: this repo uses the `context/planning/tasks/sessions/decisions` framework — i.e. `project-migration`'s. |
| `.ai/decisions/0004-project-workflow-canonical-source.md` | TASK-0003 | Accepted. Records that `ai-toolbox` wants `entrypoint: AGENTS.md` and no `00.CONVENTIONS.md`. |
| `.ai-layout.json` | TASK-0003 | `{"root": ".ai/", "entrypoint": "AGENTS.md"}` — the declaration that lets this repo use the skill without adopting its file layout. |
| `tests/validate.sh` | TASK-0023 | Passing. Does not read `.ai/decisions/` filenames or either skill's scaffold. |

## Scope
### Included
- **ADR-0013** recording that the two skills serve different purposes and
  are not to be unified, with the nine-way comparison as evidence.
- A short scope line in each skill's `SKILL.md` naming the other and
  saying which to use when — so the next reader does not re-raise B-009.
- Close B-009 in `BACKLOG.md` as **resolved by decision, not
  implemented**.
- Version bumps for whichever `SKILL.md` files change (ADR-0003).

### Not included
- **Changing `ai-project-scaffold.sh`.** Its `ADR-NNNN-*` naming is
  internally consistent with the framework it scaffolds, and that
  framework is the one this repo runs.
- **Unifying the two frameworks.** Out of scope by an order of magnitude;
  if ever wanted it needs its own plan, not a backlog line.
- **Renaming this repo's `.ai/` files** to `project-workflow`'s scheme.
  ADR-0001 and `.ai-layout.json` both settle this.
- **Retro-editing TASK-0024 or B-009's original wording.** The record of
  a premise being wrong is worth more than a tidy backlog.
- A `validate.sh` check for scaffold naming. Inventing a requirement
  (ADR-0008's refusal).

## Likely files
<!-- A forecast, written BEFORE the work. -->
- `.ai/decisions/0013-two-governance-frameworks.md` (new)
- `skills/project-migration/SKILL.md`,
  `skills/project-workflow/SKILL.md`
- `.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`,
  `.ai/context/CURRENT_STATE.md`

## Execution plan
1. Re-verify the nine-way difference table against both skills as they
   stand — the table is the ADR's evidence, so a stale row would
   undermine the decision.
2. Write ADR-0013: the decision, the evidence, the rejected alternatives
   (unify on either scheme; change only the ADR filenames).
3. Add one scope line to each `SKILL.md`; bump each changed skill's
   `metadata.version` **minor** (documentation clarification, no
   behaviour change).
4. Close B-009 with the reasoning, mirroring how ADR-0011 closed B-001 as
   superseded.
5. `validate.sh`, `sync-registry.sh` — the registry indexes skill
   `description`s; if a description changes the registry **must**
   regenerate, so check rather than assume.
6. `install.sh` to redeploy, and confirm both clients see the new
   versions.

## Acceptance criteria
- [x] ADR-0013 states the decision, carries the nine-row comparison as
      evidence, and names four rejected alternatives.
- [x] Each `SKILL.md` names the other skill, both layouts, and says pick
      one per project.
- [x] Neither skill's *behaviour* changed — `git status` shows nothing
      under `scripts/`, `templates/`, or `references/`.
- [x] Versions bumped: `project-migration` → `1.1.0`,
      `project-workflow` → `3.2.0` (minor; documentation clarification,
      no behaviour change).
- [x] B-009 closed as decided-not-implemented, with the false premise
      recorded in both `BACKLOG.md` and ADR-0013's Provenance.
- [x] Registry: **no** description changed (checked by diffing for
      `^[+-]description:` *before* regenerating), so no diff — confirmed.
- [x] `tests/validate.sh` passes.

## Mandatory validations
- [x] `tests/validate.sh` — OK (and it correctly failed mid-task on this
      file's empty `Outputs / handover`)
- [x] `scripts/sync-registry.sh` — **no diff**, as predicted from the
      unchanged descriptions
- [x] `scripts/install.sh` + deployed versions confirmed at `1.1.0` /
      `3.2.0`
- [x] `git status --porcelain skills/` filtered for
      `scripts/|templates/|references/` — **empty**

## Risks and rollback
- **Risk: this is a decision to do nothing, which is easy to dress up as
  work.** Mitigation: the ADR must carry the evidence table, so a future
  reader can check the reasoning rather than trust it. If the comparison
  is wrong, the decision is wrong and should be reversible on that basis.
- **Risk: the scope lines drift into duplicating each skill's
  description.** Mitigation: one line each, pointing at the *other*
  skill — a fact neither currently owns.
- **Risk: `project-workflow`'s `SKILL.md` has 12 bytes of headroom
  pressure nearby.** That budget is on `00.CONVENTIONS.md`, not
  `SKILL.md` — confirm which file the cap applies to before editing.
- Rollback: revert; documentation-only change.

## Outputs / handover
| Artifact | End state |
|---|---|
| `.ai/decisions/0013-two-governance-frameworks.md` | New. Records the nine-way comparison as evidence, the decision not to unify, and four rejected alternatives. |
| `skills/project-migration/SKILL.md` | `1.0.0` → **`1.1.0`**. Gains a "Not `project-workflow`" paragraph naming both layouts and saying pick one per project. |
| `skills/project-workflow/SKILL.md` | `3.1.0` → **`3.2.0`**. Gains the mirror-image "Not `project-migration`" note. |
| `.ai/planning/BACKLOG.md` | B-009 **done**; **backlog empty** (B-001…B-009 all closed). Notes that 3 of 9 items were closed by scoping, not building. |
| Both skills' `scripts/`, `templates/`, `references/` | **Untouched** — verified by `git status`. No behaviour changed. |
| `docs/registry.md` | Unchanged — neither `description:` line was edited, confirmed by diff before regenerating. |

**Next task starts here**: **the backlog is empty and nothing is in
flight.** Phases 1–5 are complete with no outstanding criteria, and
`SPRINT-CURRENT.md` holds no open sprint.

There is therefore **no obvious next task**, and that is a real state
rather than a gap to fill. Per `AGENTS.md`'s ambiguity policy and the
caution standing since S4, **confirm scope with the human before starting
anything** — do not revive a closed item for want of work. Three of the
nine backlog items turned out to be assumptions rather than defects; a
fourth invented now would be worse.

The one genuinely open question is not a task: **REVIEW-0007 finding 8**
records that S5's cold-start benefit is untested, because every task so
far has run in the session that planned it. The next task started after a
real session gap should record whether its `Inputs` table sufficed. That
cannot be scheduled — it just needs doing when the gap happens.

## Status notes
No deviation from the plan. The investigation preceding the brief changed
the *task*, not the plan: B-009 was scoped as a possible rename and
became a decision once the nine-way difference was measured. That
reframing is recorded in ADR-0013's Context rather than here, since it is
the decision's rationale rather than an execution note.

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
  - Scoped B-009 by listing what each skill actually creates, before
    writing the brief. That comparison changed the task from a rename
    into a decision.
  - Re-verified all nine table rows against both skills (plan step 1) —
    the table is the ADR's evidence, so a stale row would undermine it.
  - Wrote ADR-0013; added a scope note to each `SKILL.md`; bumped both
    versions; closed B-009.
- Observations:
  - **B-009's title encoded a false premise, and the title was mine.**
    "Diverging from `project-workflow`'s `NNNN-*`" presumes a shared
    convention. There isn't one: nine structural differences, of which
    the ADR filename is the smallest. I wrote that item one task earlier,
    from a single grep hit, without listing what either skill scaffolds.
  - **The literal fix would have made things worse.** Changing
    `ai-project-scaffold.sh` to emit `NNNN-*.md` aligns 1 of 9
    differences and yields a scaffold belonging to neither framework —
    `context/`, `sessions/`, `TASK-####` from one; ADR naming from the
    other. It would also desynchronise the scaffold from the
    `.ai/templates/ADR.md` it emits in the same run. A partial alignment
    destroys the signal that these are separate systems while fixing
    nothing.
  - **The decisive evidence was that this repo runs `project-migration`'s
    framework, not `project-workflow`'s.** `.ai/context/`,
    `.ai/planning/`, `.ai/sessions/`, `TASK-0025-*.md` — and
    `.ai-layout.json` declaring `entrypoint: AGENTS.md` precisely so this
    repo can maintain `project-workflow` without adopting its layout
    (ADR-0004). B-009 proposed changing the scaffold that produced the
    very structure I was working in.
  - **Third item closed by scoping rather than building** — after B-001
    (superseded) and B-002 (split). The pattern is now strong enough to
    state as an expectation in `BACKLOG.md`: an item written before it was
    scoped is as likely to dissolve as to be built.
  - Checked for a `description:` change *before* regenerating the
    registry, so "no diff" was a prediction confirmed rather than an
    outcome accepted. TASK-0021 established that habit.
- Validation:
  - `tests/validate.sh` — OK. It failed once mid-task on this file's
    empty `## Outputs / handover`, which is TASK-0023's check working on
    the second task written since it shipped.
  - `scripts/sync-registry.sh` — no diff; descriptions provably unchanged
    by `git diff skills/ | Select-String "^[+-]description:"` → empty.
  - `git status --porcelain skills/` filtered to
    `scripts/|templates/|references/` → empty. No behaviour changed.
  - `scripts/install.sh` — redeployed; both clients report `1.1.0` and
    `3.2.0`.
- Result: success. B-009 closed as decided-not-implemented; the backlog
  is empty for the second time in this repo's history; the divergence is
  now documented in both skills so the item cannot be re-raised by the
  next grep.
- Commit: see below
- Push: to `origin master`
