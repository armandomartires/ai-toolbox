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
- [x] `.ai/templates/TASK.md` carries `## Inputs` and
      `## Outputs / handover`, named identically to the skill's template
      — verified by exact string comparison, both present on both sides.
- [x] **No net growth in section count** — 16 → **15**. The merge is real:
      `Preconditions` + `Dependencies` + `Expected result` (3) became
      `Inputs` + `Outputs / handover` (2).
- [x] No fact is owned by two sections. Read top to bottom; the one
      genuine adjacency (`Likely files` vs `Outputs / handover`) is
      demarcated in the template itself — see log.
- [x] The narrative role `Minimal context` served is **preserved** —
      `Minimal context` survives as prose. The planned four-way merge was
      **not** performed; deviation recorded below.
- [x] TASK-0001…0019 unmodified — `git status --porcelain .ai/tasks/`
      empty apart from this sprint's own files.
- [x] `AGENTS.md` needs no change — grep for all four old section names
      returned nothing, so it stays out of scope as planned.
- [x] `tests/validate.sh` passes.

## Mandatory validations
- [x] `tests/validate.sh` — OK
- [x] `git status --porcelain .ai/tasks/` filtered to exclude `TASK-002x`
      — **empty**, proving no historical task file was touched
- [x] Exact-name comparison of headings against the skill's template —
      `## Inputs` and `## Outputs / handover` match on both sides; the
      repo template is otherwise a superset, as expected
- [x] `scripts/sync-registry.sh` — **no diff**, confirmed via
      `git diff --name-only docs/registry.md`

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
| `.ai/templates/TASK.md` | 15 sections (was 16). Carries `## Inputs` and `## Outputs / handover`, byte-identical names to the skill's template. `Minimal context` **retained** as narrative prose; `Likely files` retained with a forecast-vs-record boundary comment. |
| `AGENTS.md` | **Unchanged** — grep confirmed it names none of the old sections. |
| `.ai/tasks/TASK-0001…0019` | **Untouched**, proven by filtered `git status --porcelain`. |
| `docs/registry.md` | Unchanged (no component touched). |

**Next task starts here**: the headings are final and identical on both
sides — `## Inputs` and `## Outputs / handover`, exactly those strings
including the spaces around the slash.

Three things TASK-0023 must absorb before writing the check:

1. **This task deviated: `Minimal context` was NOT merged into `Inputs`.**
   The template therefore has 15 sections, not the 14 a strict four-way
   merge would have produced. The check must not assume `Minimal context`
   is gone, and must not require it either — it is optional narrative.
2. **Read the heading strings from `.ai/templates/TASK.md` itself**, not
   from this file, ADR-0012, or PLAN-0002. Three consecutive tasks have
   now found the planning prose disagreeing with the artifact.
3. **The `≥ 0020` boundary needs care with this sprint's own files.**
   TASK-0020, 0021, 0022 and 0023 all already carry both sections (they
   were written to the contract before it existed), so they should pass.
   But they predate the template, so if the check demands an exact table
   shape rather than non-empty content, they may not. **Content presence
   only**, as ADR-0012 Decision 3 and this task's Not-included section
   both require — a format check would reject the four files that prove
   the contract works.

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
  - Verified inputs: skill at `3.1.0`, tree clean at `68b7648`. Read the
    **finished** skill template for the section list rather than
    ADR-0012's prose, per this task's own handover note 1.
  - Grepped `AGENTS.md` for all four old section names — **no
    occurrences**, so it stayed out of scope exactly as the plan's step 1
    allowed for.
  - Measured how `Minimal context` is actually used across all 23 task
    files before merging anything (plan step 2).
  - Merged `Preconditions` + `Dependencies` + `Expected result` → `Inputs`
    + `Outputs / handover`. **Left `Minimal context` intact** — deviation,
    see below.
  - Added an HTML-comment boundary to `Likely files` distinguishing
    forecast from record.
- Observations:
  - **DEVIATION from the plan: `Minimal context` was not merged.** The
    plan proposed collapsing four sections into `Inputs`; only three were.
    Measuring settled it — `Minimal context` averages ~25 lines across
    the 23 task files and reaches **82** (TASK-0017), **56**
    (TASK-0019), **53** (TASK-0018). TASK-0019's contains a root-cause
    sub-heading, its own verification table, and the analysis of *why* a
    false claim survived three restatements. None of that is
    artifact-shaped; a three-column table would have destroyed it. The
    plan's step 2 anticipated exactly this and authorised the amendment,
    so this is a planned-for deviation rather than a surprise.
  - `Preconditions` and `Dependencies`, by contrast, **are** genuinely
    artifact/state-shaped — "working tree clean at `9404060`",
    "TASK-0011 (single emit path)". They map onto the table's three
    columns without loss. The distinction that matters is *artifact state*
    vs *narrative*, not "input-ish" vs "output-ish"; the plan's framing
    was one level too coarse.
  - Net section count still **shrank**, 16 → 15, so the criterion holds
    even with `Minimal context` retained. Three sections became two.
  - **`Likely files` is the near-duplicate this task had to resolve**, and
    it is the same defect class TASK-0021 hit with `Files touched`. It is
    forward-looking ("*likely*"), so it does not own what changed — but
    nothing in the template said so, and the skill's `Outputs / handover`
    explicitly absorbed its equivalent. Rather than delete a section that
    earns its place at planning time, both are now labelled: `Likely
    files` is a forecast, `Outputs / handover` is the record, and a
    disagreement between them at the end is itself a finding. **Third
    consecutive task where reading the rendered file caught an ownership
    overlap the plan did not predict.**
  - `PLAN.md` uses "Context consulted" and `REVIEW.md` has no `##`
    sections at all, so `Inputs`/`Outputs` remain TASK-specific and will
    not leak into the other templates.
- Validation:
  - `tests/validate.sh` — OK.
  - Section count 16 → 15, counted from `git show HEAD:` versus the
    working file, not estimated.
  - Exact-string comparison of both contract headings against the skill's
    template — identical.
  - `git status --porcelain .ai/tasks/` excluding `TASK-002x` — empty.
    TASK-0001…0019 provably untouched.
  - `scripts/sync-registry.sh` — no diff (no component changed).
- Result: success, with one recorded deviation. The contract is adopted;
  `Minimal context` survives because measurement showed the merge would
  have cost more than it bought.
- Commit: `cdedb45`
- Push: `origin master`, confirmed — local and
  `git ls-remote origin master` both `cdedb45`.
