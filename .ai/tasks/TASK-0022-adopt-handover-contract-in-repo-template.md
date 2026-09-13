# TASK-0022 — Adopt the handover contract in this repo's task template

## Objective
Restructure `.ai/templates/TASK.md` so it carries the ADR-0012 handover
contract, by **merging** the sections that already hold input- and
output-shaped information rather than adding two more beside them.

## Inputs
| Artifact | Produced by | Expected state |
|---|---|---|
| `.ai/decisions/0012-handover-contract-resumability-invariant.md` | ADR-0012, this sprint | Accepted. Decision 1's second paragraph specifies the merge, not an addition. |
| `skills/project-workflow/templates/tasks/0000_TEMPLATE.md` | **TASK-0021** | Carries `## Inputs` and `## Outputs / handover`. The canonical shape this task adopts — section names must match it, or the skill and its home repo diverge on day one. |
| `skills/project-workflow/SKILL.md` | TASK-0021 | `metadata.version: "3.1.0"`. |
| `.ai/templates/TASK.md` | pre-existing (34 lines) | Has `Minimal context`, `Preconditions`, `Dependencies`, `Expected result` — the four sections being merged into two. |
| `.ai/tasks/TASK-0001…0019` | sprints S1–S4 | **Not to be modified.** Read one or two to see how the four old sections were actually used, so the merge preserves their function rather than guessing at it. |
| `.ai/templates/PLAN.md`, `.ai/templates/REVIEW.md`, `ADR.md`, `SESSION.md` | pre-existing | Unchanged by this task. Checked only to confirm the new section names stay TASK-specific. |

## Minimal context
This repo already carries ~60% of the contract without naming it as one:
`Minimal context` and `Preconditions` describe entry state, `Dependencies`
names prior tasks, `Expected result` describes the end state. What is
missing is the *link* — which prior task produced each input, and what the
next task inherits.

Adding `## Inputs`/`## Outputs` alongside those four would create two
owners for one fact, in the layer whose governing rule forbids exactly
that. `reference/size-budgets.md:10-13` records what that costs here:
a stale test count drifted between two files because nothing forced single
ownership.

ADR-0004 makes this repo the skill's owner, and the skill's
copy-never-symlink rule means TASK-0021 did **not** change anything here.
This adoption is deliberate, with its own commit.

## Scope
### Included
- Merge `Minimal context` + `Preconditions` + `Dependencies` → `## Inputs`
  (artifact · produced by · expected state).
- Rename `Expected result` → `## Outputs / handover`, add the
  `**Next task starts here**:` line.
- Reorder so `## Inputs` sits near the top, matching the skill's template
  and the order a cold session reads in.
- Keep every remaining section (`Objective`, `Scope`, `Likely files`,
  `Execution plan`, `Acceptance criteria`, `Mandatory validations`,
  `Risks and rollback`, `Status`, `Execution log`) as-is.

### Not included
- **Modifying TASK-0001…0019.** ADR-0012 Decision 4. They are records of
  what happened, not instances of the current template.
- **The `validate.sh` check** — TASK-0023, deliberately separate: this
  task changes a template, that one changes the commit gate, and the two
  have different rollback profiles.
- **`PLAN.md`, `REVIEW.md`, `ADR.md`, `SESSION.md`.** A plan's inputs are
  its "Context consulted"; a review's are the sprint. Forcing one contract
  onto all five templates would generalise a TASK-shaped idea past its
  evidence.
- **Dropping `.ai/sessions/`.** It is the narrative bridge that already
  works; the contract complements it.
- Editing `AGENTS.md`'s "Mandatory task process". It points at
  `.ai/templates/` for file templates, so it stays correct without
  restating the sections. **Verify that at execution time** — if it turns
  out to name the old sections explicitly, updating it becomes in-scope
  for this task's commit, since a normative doc left contradicting the
  template is worse than a slightly larger diff.

## Preconditions
- TASK-0021 done; the skill's template is the settled shape.
- Working tree clean; `tests/validate.sh` passing.

## Likely files
- `.ai/templates/TASK.md`
- `AGENTS.md` (only if step 1 finds it names the old sections)

## Execution plan
1. `grep` `AGENTS.md` for the old section names. If any appear, they come
   into scope now — see the Not-included note.
2. Read two or three real task files (TASK-0018 is the most developed) to
   see what `Minimal context` actually carried in practice. It is often a
   *narrative* — provenance, why an item's shape was wrong — which a
   three-column table cannot hold. Decide deliberately where that goes;
   the likely answer is that `Minimal context` survives as prose *beside*
   the `Inputs` table, and only `Preconditions`/`Dependencies` merge into
   it. **If so, say so in the log and amend the plan honestly** rather
   than forcing a merge that loses the narrative.
3. Apply the restructure to the template.
4. Diff the result against the skill's template. Section *names* must
   match exactly; extra repo-specific sections are fine, a name mismatch
   is not.
5. Confirm the new names read wrong in `PLAN.md`/`REVIEW.md` — if
   `## Inputs` would sit comfortably in a review checkpoint, the name is
   too generic and needs re-thinking before it spreads.
6. Run `tests/validate.sh`.

## Acceptance criteria
- [ ] `.ai/templates/TASK.md` carries `## Inputs` and
      `## Outputs / handover`, named identically to the skill's template.
- [ ] **No net growth in section count** — the merge is real, not
      cosmetic.
- [ ] No fact is owned by two sections. Verified by reading the finished
      template top to bottom, not inferred from the diff.
- [ ] The narrative role `Minimal context` served is either preserved or
      its loss is explicitly justified in the log.
- [ ] TASK-0001…0019 unmodified — `git status` shows no change under
      `.ai/tasks/` other than this task's own file.
- [ ] `AGENTS.md` either needs no change (verified by grep) or is updated
      in the same commit.
- [ ] `tests/validate.sh` passes.

## Mandatory validations
- [ ] `tests/validate.sh`
- [ ] `git status --short .ai/tasks/` — proves no historical task file was
      touched
- [ ] `diff` of section headings, this template vs. the skill's — names
      match
- [ ] `scripts/sync-registry.sh` — no component changed, so no diff

## Risks and rollback
- **Risk: the merge destroys what `Minimal context` was for.** The single
  biggest risk here. In TASK-0018 that section carries the *provenance
  argument* — `git log -S` tracing an item to the scaffold commit — which
  is prose, not a table row. Mitigation: step 2 checks before merging, and
  the plan may be amended. A table that forces narrative out is a
  regression dressed as tidiness.
- **Risk: name drift from the skill.** If this repo says `## Outputs` and
  the skill says `## Outputs / handover`, TASK-0023's check will be
  written against one of them and silently mismatch the other.
  Mitigation: exact-name diff, step 4.
- **Risk: adopting a shape never exercised.** The skill's template will
  have been written but not yet used on real work. Mitigation: this task's
  own file already uses the shape, and TASK-0023 will too — by the time
  the template lands, three task files will have exercised it.
- **Risk: a reader assumes the 19 old files are non-compliant.** They are
  historical records. Mitigation: ADR-0012 Decision 4 states it, and
  TASK-0023's boundary constant encodes it.
- Rollback: revert; template-only change, no code depends on it until
  TASK-0023.

## Dependencies
TASK-0021 (canonical shape), ADR-0012 (the merge decision). Blocks
TASK-0023 — the check must be written against the final headings.

## Outputs / handover
| Artifact | End state |
|---|---|
| `.ai/templates/TASK.md` | Restructured; `## Inputs` + `## Outputs / handover`; no net section growth; names matching the skill's template exactly. |
| `AGENTS.md` | Unchanged if it does not name the old sections; updated in this commit if it does. |
| `.ai/tasks/TASK-0001…0019` | **Untouched**, verified by `git status`. |

**Next task starts here**: the headings are now final and identical on
both sides. TASK-0023 writes the `validate.sh` check against these exact
strings — it must read them from the finished template rather than from
ADR-0012's prose, in case step 2 of this task's plan altered which
sections merged. If this task deviated from its plan, that deviation is
recorded in the log below and TASK-0023 must read it before starting.

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
