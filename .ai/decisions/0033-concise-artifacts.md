# ADR-0033 — Concise artifacts: the procedure is not the record

## Status

**Status**: Accepted
**Date**: 2026-10-10
**Task**: `TASK-0150` (plan: `PLAN-0007`)

## Context

`.ai/` had grown to 254 files, 60.7k lines and 3.4 MB (measured 2026-10-10).
- A task brief had a median of 240 lines; its Execution log and Minimal context made up 17k lines between them.
- `CURRENT_STATE.md` was a 4,080-line changelog.
- `BACKLOG.md` cells ran to 4k characters.
- The schemas copied rationale into every brief.
- Every task needed a second "record commit", only to write its own hash and push range into the brief.

The human asked for smaller, simpler files and outputs. The model they chose was aircraft maintenance data (ATA iSpec 2200, S1000D):
- One task is one addressable module.
- Identification and status come first.
- Applicability is explicit.
- The procedure is kept apart from the record of the work done.
- Content is validated, not trusted.

## Decision

1. **One task, one module.** A brief opens with `## Status`, which carries `- Applies to:` and `- Source:`. Then come Objective, Inputs, Scope, Plan, Checks, and Outputs.
2. **The procedure is not the record.**
   - The brief states what to do and what "done" looks like.
   - The log holds only evidence: one result line, then commands with their output, then any deviation.
3. **Git is the record.**
   - A task lands as **one commit**, with subject `<Imperative summary> (TASK-NNNN)`.
   - No follow-up commit writes the hash or push range into the brief. `git log --grep TASK-NNNN` is the lookup.
   - The push result is reported in the chat task report.
   - This supersedes the two-commit rule in `AGENTS.md` (git history, `ccc1855`).
4. **Budgets are gated.**
   - A schema may declare `max_lines`, which `check-artifact` enforces.
   - The live files (`CURRENT_STATE`, `SPRINT-CURRENT`, `TODO`, `BACKLOG`) have line budgets in `tests/validate.sh`.
5. **Guidance lives in the schema, never in the artifact.** No rationale goes into `!body`.
6. **Live files hold state, not history.** Updating `CURRENT_STATE.md` means editing the state; history stays in git.
7. **Every task ends with the same short report:** Result, Changed, Verified, Pushed, Next.
8. **Dashboard-read names keep their shape:**
   - `## Status` with `- Status/Owner/Created/Updated`
   - `## Objective`
   - `## Acceptance criteria` and `## Mandatory validations` as checkboxes
   - `## Likely files`
   - `TASK-NNNN` in commit subjects

   So the vendored generator needs no change.

## Alternatives considered

- **Rename sections to procedure vocabulary (Steps, Verify, Do not):** rejected. The dashboard would need aliases added upstream in `sigma-llmwiki` for no gain in meaning.
- **Condense the 149 closed briefs too:** rejected. They are records, and rewriting them loses evidence. Old briefs are checked against frozen `legacy/` schemas.
- **Keep the record commit but make it one line:** rejected. The commit still exists only to restate what git already holds.

## Consequences

- New briefs from `TASK-0153` and new ADRs from `ADR-0034` use the v2 schemas. Older ones are checked against `schemas/legacy/`.
- A brief no longer carries its own hash. The dashboard dates closure from the commit subject, which is a source it already reads.
- Push evidence leaves the repository: if a push is wrong, the reader has only `git` and the remotes to check.
- History moves out of the live files. `git log -p` on them recovers it.
