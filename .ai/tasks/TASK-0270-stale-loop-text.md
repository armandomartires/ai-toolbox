# TASK-0270 — Fix stale loop text (P0.5)

## Status

- Status: done
- Owner: agent
- Branch: agent/TASK-0270
- Created: 2026-11-10
- Updated: 2026-11-10
- Applies to: `loops/design-brief/`, `loops/unattended-run/`, `tests/validate.sh`
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P0.5 (Q5), no decision applies; the plan lists no related remediation or ADR (overview report findings)

## Objective

Correct two loop passages that describe work as pending when it has landed, and add a validate check so the phrases cannot return.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `loops/design-brief/loop.md` lines 55-56 | says 'Until TASK-0045'; TASK-0045 landed |
| `loops/unattended-run/loop.md` lines 122-126 | says a role does not exist 'before it exists', the phrase wrapping across lines 122-123; the roles exist |
| `tests/validate.sh` | has no check on these phrases |

## Scope

- In: rewrite both passages to state the present behaviour; a check in `tests/validate.sh` that rejects `Until TASK-0045` and `before it exists` under `loops/*/loop.md`. The second phrase wraps across a line break, so the check normalises whitespace first (for example join lines with `tr '\n' ' '` and squeeze spaces, or use a multi-line match); a per-line grep is not enough.
- Out: any other edit to the loops' rules; the loop wrappers (TASK-0273); rewriting passages that are not stale.

## Likely files

- `loops/design-brief/loop.md`
- `loops/unattended-run/loop.md`
- `tests/validate.sh`

## Execution plan

1. Add the whitespace-normalised check to `tests/validate.sh`; run it and see it fail on both files (the `before it exists` hit is the one a per-line grep would miss).
2. Read each passage in context and rewrite it to say what is true now.
3. Run the check green; restore the old wrapped text and see it fail; remove it again.
4. Run `tests/validate.sh`.

## Acceptance criteria

- [x] Neither phrase appears under `loops/*/loop.md`, counted after whitespace normalisation so a wrapped phrase is caught
- [x] The passages read correctly in context without a pointer to a finished task
- [x] Restoring the old text, including `before it exists` split across two lines, fails the check

## Mandatory validations

- [x] tests/validate.sh

## Risks and rollback

- The check could match a legitimate quotation elsewhere; limit it to `loops/*/loop.md`.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `tests/validate.sh` | whitespace-normalised check rejecting `Until TASK-0045` and `before it exists` under `loops/*/loop.md` (flattens with `tr`, then a `case` match) |
| `loops/design-brief/loop.md` | the `git-ops` passage states the role exists (`agents/git-ops/`), so the step executes as written |
| `loops/unattended-run/loop.md` | roles are "defined there" in `agents/`; "named here and nowhere else yet" became "named here" (all nine roles confirmed present) |

Next: review the diff and commit; uncommitted in the worktree.

## Execution log

- 2026-11-10 · agent/Sonnet 5.5 · brief written from the alignment plan; no work done yet
  - Evidence: none yet
  - Deviation: none
- 2026-11-10 · agent/Sonnet 5.5 · added the check, fixed both passages, validated
  - Evidence: red first: the check extracted from tests/validate.sh printed `STALE LOOP TEXT: loops/design-brief/loop.md says 'Until TASK-0045'` and `STALE LOOP TEXT: loops/unattended-run/loop.md says 'before it exists'` (fail=1), the second being the wrapped phrase. After the rewrite it printed nothing (fail=0). Restoring `before it exists` split across two lines gave `STALE LOOP TEXT: loops/unattended-run/loop.md says 'before it exists'` (fail=1); removed again, fail=0. Roles preflight, task-planner, implementer, gate-runner, refuter, adjudicator, closer, park-steward, run-scribe and git-ops each have agents/<role>/agent.md. Full `bash tests/validate.sh` ended `validate.sh: OK` (real 25m16s on this host).
  - Deviation: also reworded "named here and nowhere else yet" in the same passage (line 126 of unattended-run, inside the brief's 122-126 range) because it was stale for the same reason
