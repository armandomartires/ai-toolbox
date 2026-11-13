# PLAN-0007 — Concise artifacts for project-migration and project-workflow

## Objective

Make the `.ai/` artifacts, both skills' schemas, and the task reports smaller and easier to read without losing anything the gate or the dashboard reads. This was a human request on 2026-10-10. Principles: `ADR-0033`.

## Context consulted

- **The human's research note.** It covers the aircraft-maintenance data standards ATA iSpec 2200 and S1000D: one task per module, explicit applicability, procedure kept separate from the record, validation by running it.
- **`.ai/` measured 2026-10-10:**
  - 254 files, 60.7k lines.
  - Task briefs: median 240 lines.
  - `CURRENT_STATE.md`: 4,080 lines.
  - `BACKLOG.md`: 108 KB.
  - `TODO.md`: 1,033 lines.
- **Both skills' schemas, templates and scripts:** `artifact_lib.py`, `sync-templates.sh`, and the schema-conformance and HANDOVER checks in `tests/validate.sh`.
- **The vendored dashboard's readers.** `pm_corpus_migration.py`, `pm_collect.py` and `pm_briefs.py` decide which headings and fields must keep their shape.

## Findings that shape this plan

- **Two headings are the bulk of a brief.** The Execution log and Minimal context together hold 17k of 40k task lines.
- **The dashboard reads only a few things, and never the Execution log:**
  - `## Status` `-` fields
  - `## Objective`
  - `## Acceptance criteria` and `## Mandatory validations` checkboxes
  - `## Likely files`
  - `Commit:` hashes
  - commit subjects
- **Every ADR is read as `unknown`.** The dashboard reads ADR status only from `**Status**:`, which no ADR has.
- **Changing the schema breaks old briefs.** Schema conformance checks every brief from `TASK-0024` on against the current schema, so a new shape needs a version boundary.

## Phases / steps

1. Decide: `ADR-0033`, plus the "git is the record" rule in `AGENTS.md`, the runbook and the unattended driver.
2. Engine: a `max_lines` key, and the legacy-schema boundary in `tests/validate.sh`.
3. project-migration v2: task and ADR schemas, re-rendered templates, and the skill docs.
4. Live files: compact them to state only, and add line budgets.
5. project-workflow: schemas, `SKILL.md`, references, fixtures.

## Tasks generated

- Phase 1: `TASK-0150`
- Phase 2: `TASK-0151`
- Phase 3: `TASK-0152`
- Phase 4: `TASK-0153`, the first v2 brief
- Phase 5: `TASK-0154`

## Acceptance criteria

- [x] `tests/validate.sh` passes after every task.
- [x] A dashboard payload built after phase 5 matches the 2026-10-10 baseline for every pre-existing task, backlog row, phase and sprint: state, sprint, and closed date.
- [x] `CURRENT_STATE.md` is at most 200 lines, and each new brief is at most 90.

## Risks

- **History lost from the live files.** It stays in git, and `CURRENT_STATE.md` names the commit holding the last full version.
- **The dashboard misreads a compacted file.** Each compaction is diffed against the baseline payload.

## Human decisions required

All taken 2026-10-10:
- Compact the live files only.
- Git is the record.
- Keep the heading names the dashboard reads.
- Change both skills, project-migration first.
