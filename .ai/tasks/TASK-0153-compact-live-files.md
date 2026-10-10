# TASK-0153 — Compact the live files to state only

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-10
- Updated: 2026-10-10
- Applies to: `.ai/` live files, `tests/validate.sh`
- Source: `PLAN-0007` phase 4, `B-054`

## Objective

Make the files every session reads hold current state only, with history left to git (`ADR-0033`), and gate their size so they stay that way.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `.ai/context/CURRENT_STATE.md` | 4,092 lines; newest-first changelog; "state" sections dated 2026-09-13 |
| `.ai/planning/BACKLOG.md` | 108 KB; 54 rows; 330 lines of prose after the table |
| `.ai/tasks/TODO.md`, `ROADMAP.md`, `SPRINT-CURRENT.md` | 1,033 / 806 / 252 lines |
| Dashboard payload of 2026-10-10 | 146 tasks, `--check` clean (saved outside the repo) |

## Scope

- In: rewrite the six live files; add line budgets to the gate.
- Out: closed briefs, ADRs, reviews, sessions, plans, and archived sprints, which are records and stay as written.

## Likely files

`.ai/context/CURRENT_STATE.md`, `.ai/planning/{BACKLOG,ROADMAP,SPRINT-CURRENT}.md`, `.ai/tasks/TODO.md`, `.ai/README.md`, `tests/validate.sh`.

## Execution plan

1. Rebuild `CURRENT_STATE.md` from primary sources: versions, the registry, ADR titles, open items.
2. Reduce `SPRINT-CURRENT.md` to the items still open.
3. Script `TODO.md` down to its headings plus one line per item, titled from the item's own H1.
4. Script `BACKLOG.md`: the table stays first; each long cell keeps whole sentences up to its closer.
5. Collapse closed phases in `ROADMAP.md`; shorten `.ai/README.md`.
6. Add the `LIVE` budgets, red-prove them, and diff the dashboard against the baseline.

## Acceptance criteria

- [x] CURRENT_STATE is at most 200 lines, SPRINT-CURRENT at most 80, TODO at most 400, and no BACKLOG line is over 600 characters.
- [x] The dashboard diff against the baseline shows no change to any pre-existing task, backlog row, phase or sprint; only additions.
- [x] `check-backlog-closures.py` reports 53 closed and 1 open, matching the sentence.

## Mandatory validations

- [x] tests/validate.sh
- [x] `pm_dashboard.py --check`
- [x] Red proof: CURRENT_STATE padded to 201 lines fails `LIVE`

## Risks and rollback

- **Lost context.** Every removed line is in git. CURRENT_STATE names the commit that holds its last full version.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `CURRENT_STATE.md` | 4,092 → 85 lines |
| `BACKLOG.md` | 108 KB → 17 KB; 54 rows, same columns |
| `TODO.md` | 1,033 → 208 lines; same headings and item order |
| `ROADMAP.md`, `SPRINT-CURRENT.md` | 806 → 64 lines; 252 → 26 lines |
| `tests/validate.sh` | `LIVE` budgets |

Next: `TASK-0154`, the project-workflow skill.

## Execution log

- 2026-10-10 · Claude Code (Opus 5.5) · done; history moved to git, gate budgets added
  - Evidence: dashboard diff against the baseline: no pre-existing task, backlog row, phase or sprint changed. Only additions: `TASK-0150`–`0153` and `B-054`, so Post-S10 goes 44 → 48. `--check` → `corpus and payload are clean`
  - Evidence: `CURRENT_STATE.md` padded to 201 lines → `LIVE: … 201 lines, over its budget of 200`; a 601-character backlog line → `LIVE: BACKLOG.md line over 600 characters`; `tests/validate.sh` → `validate.sh: OK`
  - Deviation: the first two backlog runs dropped rows, first at the `|---|` separator and then at a blank line inside the table. Both were caught by row count and re-run from the saved original. `check-backlog-closures.py` passed even the empty table, so that check cannot catch a lost table.
