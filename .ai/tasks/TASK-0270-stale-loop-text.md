# TASK-0270 — Fix stale loop text (P0.5)

## Status

- Status: planned
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

- [ ] Neither phrase appears under `loops/*/loop.md`, counted after whitespace normalisation so a wrapped phrase is caught
- [ ] The passages read correctly in context without a pointer to a finished task
- [ ] Restoring the old text, including `before it exists` split across two lines, fails the check

## Mandatory validations

- [ ] tests/validate.sh

## Risks and rollback

- The check could match a legitimate quotation elsewhere; limit it to `loops/*/loop.md`.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next:

## Execution log

- 2026-11-10 · agent/Sonnet 5.5 · brief written from the alignment plan; no work done yet
  - Evidence: none yet
  - Deviation: none
