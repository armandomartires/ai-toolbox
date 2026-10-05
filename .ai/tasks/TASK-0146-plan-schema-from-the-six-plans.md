# TASK-0146 — Give the plan kind a schema, transcribed from the six plans (B-042, part 1)

## Objective

The first half of `B-042`, by the route the human chose on 2026-10-05:
**count, then schemas**. `plan` is a real artifact kind with six instances
and no schema in either framework. Its shape lives only in a heredoc inside
`ai-project-scaffold.sh`, so it is ungenerated and ungated. Transcribe a
schema from what the six plans actually share, then render the template from
it, emit it from the scaffold, and check the plans against it. The backlog
entry is part 2, `TASK-0147`, which closes the row.

## Minimal context

**The count**, taken 2026-10-05 from the headings of
`.ai/planning/plans/PLAN-000{1..6}-*.md` (`grep '^#'`):

| Heading | Plans | Notes |
|---|---|---|
| `## Objective` | 6 of 6 | |
| `## Context consulted` | 6 of 6 | |
| `## Findings that shape this plan` | 3 (0003-0005) | always between Context and the phases |
| a phases section | 6 of 6 | named three ways: `## Phases / steps` ×3, `## Phases` ×2, `## The shape of the work` ×1 |
| `## Tasks generated` | 5 (not 0006) | |
| `## Acceptance criteria` | 3 exact, plus 2 as `## Acceptance criteria (plan level)` | 0006 has `## Success, and how it will be judged` |
| `## Risks` | 5 (not 0006) | |
| `## Human decisions required` | 5 (not 0006) | |

Also present, as extras: `## Resolved ambiguities (decided at plan time,
<date>)` (0001, 0002), `## Out of scope` (0002), and `## Scope` and
`## Known unknowns, stated before they are discovered` (0006).

**What a schema may therefore require** (`ADR-0027`: transcribed, not
designed; `ADR-0008`: the gate invents nothing):

- Required: only `Objective` and `Context consulted`, the two all six share.
- The canonical forms of the rest are optional, in the order the plans use:
  Findings, then `Phases / steps`, then Tasks generated, Acceptance
  criteria, Risks, and Human decisions required.
- Variant spellings are not listed as superseded, as the ADR schema does
  with *Alternatives considered/rejected*: picking a winner would flag
  accepted plans over a synonym.
- `allow_extra: true`.

All six then pass without being edited, and the check still has teeth: a
plan without an Objective or Context consulted, or with the known sections
out of order, fails.

**Where it plugs in**:

- `scripts/sync-templates.sh` renders it to `.ai/templates/PLAN.md` and
  `skills/project-migration/templates/PLAN.md`;
- `ai-project-scaffold.sh` reads the latter instead of its heredoc;
- `tests/validate.sh`'s scaffold check covers PLAN like the other four, and
  its artifact pass checks `.ai/planning/plans/PLAN-*.md`.

The B-051 banner check (`TASK-0139`) globs
`skills/project-migration/templates/*.md`, so it covers the new template
without change.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/planning/plans/PLAN-000{1..6}-*.md` | `PLAN-0001`…`PLAN-0006` | headings as counted above |
| `skills/project-migration/schemas/` | `TASK-0109` | `adr`, `review`, `session`, `task`; no `plan` |
| `.ai/templates/PLAN.md` | hand-written | 9 lines of bare headings, no banner |
| `skills/project-migration/scripts/ai-project-scaffold.sh` | `TASK-0119` | emits PLAN.md from a heredoc |
| `skills/project-migration/SKILL.md` | ongoing | its version, read before editing |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. `skills/project-migration/schemas/plan.md`, with the count in its header
   comment.
2. `sync-templates.sh` gains two targets, and its PLAN comment is updated.
3. `ai-project-scaffold.sh` reads `$TEMPLATE_DIR/PLAN.md`; the heredoc and
   its comment go; the missing-template guard covers PLAN.
4. `tests/validate.sh`:
   - the scaffold check's two loops include PLAN, and its B-042 note goes;
   - the artifact pass adds `plan` for `.ai/planning/plans/PLAN-*.md`.
5. Red proofs on copies: a plan without `## Context consulted`, and one with
   `## Risks` before `## Tasks generated`.
6. `SKILL.md` version bump; ledger; this brief.

### Not included

- Editing any of the six plans.
- A `plan` kind for `project-workflow`, whose framework has no plans
  directory.
- The backlog entry (`TASK-0147`).

## Likely files

`skills/project-migration/schemas/plan.md` (new),
`skills/project-migration/templates/PLAN.md` (new, rendered),
`.ai/templates/PLAN.md` (re-rendered), `scripts/sync-templates.sh`,
`skills/project-migration/scripts/ai-project-scaffold.sh`,
`tests/validate.sh`, `skills/project-migration/SKILL.md`, the ledger, this
brief.

## Execution plan

1. This brief first.
2. The schema; check all six plans against it with `check-artifact.sh`.
3. Render; the scaffold; the gate; the red proofs; a scratch scaffold run.
4. `tests/validate.sh`; ledger; commit; push both remotes; record commit.

## Acceptance criteria

- [x] The schema requires exactly the two headings all six plans share, and
      all six pass `check-artifact.sh` unedited.
- [x] A plan missing `Context consulted`, or with known sections out of
      order, fails.
- [x] Both PLAN templates are rendered from the schema, and the scaffold
      emits PLAN.md by reading, with no heredoc.
- [x] `tests/validate.sh` checks the plans and passes.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed)
- [x] `check-artifact.sh --kind plan` on each plan, and the two red proofs
- [x] a scratch scaffold run emitting the rendered PLAN.md

## Risks and rollback

- **A schema that requires too little.** Two required headings is what the
  evidence supports. Requiring more would flag accepted plans, which is the
  fabrication `ADR-0027` forbids.
- **Rollback:** `git revert` the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `schemas/plan.md` | new; 2 required, 6 optional, `allow_extra` |
| both PLAN templates | rendered, with the B-051 banner |
| scaffold | reads `PLAN.md`; no heredoc left |
| `tests/validate.sh` | scaffold check and artifact pass include plans |
| `BACKLOG.md` | `B-042` still `ready`, with part 1 noted; it closes with `TASK-0147` |

**Next task starts here**: `TASK-0147`, the backlog entry.

**Deviation from the plan**: `project-migration/SKILL.md` line 23 still said
the banner names ai-toolbox paths as if local. That became false with
`TASK-0139`, which missed this sentence. It is corrected here, in the same
paragraph as the PLAN sentence this task had to change anyway.

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-05
- Updated: 2026-10-05

## Execution log

### Attempt 1

- Date: 2026-10-05
- Agent: Claude Code (Opus 5.5), main checkout
- Actions: wrote the brief from the count, then the schema, checked the six
  plans against it, then the generator targets, the scaffold, the gate and
  `SKILL.md` (`3.2.0`).
- Observations:
  - The first draft of the schema put a `### Phase N …` example inside its
    `!literal` guidance, and the parser read it as a section: *"section
    '### Phase N — Name (TASK-XXXX)' has no !standard guidance"*, exit 2.
    It was reworded to describe the heading without containing one.
  - `check-artifact.sh --kind plan` printed `OK` for all six plans, none
    edited.
  - **Red proofs** on copies: PLAN-0003 without `## Context consulted`
    gave `missing required section: ## Context consulted`, exit 1.
    PLAN-0004 with `## Risks` moved before `## Tasks generated` gave
    `sections out of schema order`, exit 1, with both orders printed.
  - `sync-templates.sh: wrote 13 templates`, two of them new. A scratch
    `ai-project-scaffold.sh demo` exited 0, and its `.ai/templates/PLAN.md`
    is byte-identical to the rendered template.
  - The gate's two PLAN patterns, run against the pre-task scaffold, gave
    `reads=0 heredoc=1`, which fails both; against the new one,
    `reads=1 heredoc=0`.
- Validation: `tests/validate.sh` printed `validate.sh: OK`, now checking
  six plans. The registry is unchanged.
- Result: done. `B-042` stays open for `TASK-0147`.
- Commit: recorded in the follow-up record commit
- Push: recorded in the follow-up record commit
