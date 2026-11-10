# TASK-0275 — CLAUDE.md layer over AGENTS.md (P1.5)

## Status

- Status: planned
- Owner: agent
- Branch: agent/TASK-0275
- Created: 2026-11-10
- Updated: 2026-11-10
- Applies to: `CLAUDE.md`, `.claude/rules/`, `.gitignore`, ADR-0002
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P1.5 (N5), decisions D4=B (short CLAUDE.md importing @AGENTS.md, track .claude/rules/); related: ADR-0002

## Objective

Replace the `CLAUDE.md` symlink with a short regular file that imports `@AGENTS.md` and adds Claude-only notes, and track path-scoped rules in `.claude/rules/`. This supersedes ADR-0002.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `CLAUDE.md` | a git symlink to `AGENTS.md` (ADR-0002) |
| .gitignore line 33 | ignores `.claude/` |
| `AGENTS.md` | the shared source; unchanged here |
| ADR-0002 | accepted; this task supersedes it |

## Scope

- In: `CLAUDE.md` as a regular file starting with `@AGENTS.md` and a few Claude-only notes; `.claude/rules/mods.md` and `.claude/rules/mcp.md` each with a `paths` filter; a `.gitignore` change: line 33 is `.claude/`, which excludes everything under it, so re-including `.claude/rules/` needs that line changed to `.claude/*` plus `!.claude/rules/` (a `!` exception under an ignored parent directory does not work); a superseding ADR; a test; a check of how a Windows clone treats the swap from symlink to file.
- Out: moving content out of `AGENTS.md`; other `.claude/` files, which stay ignored; rules for areas beyond mods and MCP; Codex or OpenCode instruction files.

## Likely files

- `CLAUDE.md`
- `.claude/rules/mods.md`
- `.claude/rules/mcp.md`
- `.gitignore`
- a new ADR under `.ai/decisions/` superseding 0002
- a test wired into `tests/validate.sh`

## Execution plan

1. Write the test: `CLAUDE.md` is a regular file starting with `@AGENTS.md`; each `.claude/rules/*.md` has a `paths` filter. See it fail.
2. Replace the symlink with the file; add the rules and change `.gitignore:33` to `.claude/*` with `!.claude/rules/`; check with `git check-ignore` that the rules are tracked and the rest of `.claude/` still ignored.
3. Run the test green; restore the symlink and see it fail; switch back.
4. Write the ADR superseding ADR-0002 and mark ADR-0002 superseded.
5. Run `tests/validate.sh`.

## Acceptance criteria

- [ ] `CLAUDE.md` is a regular file whose first line is `@AGENTS.md`
- [ ] Each tracked rule has a `paths` filter and is not ignored by git
- [ ] Restoring the symlink fails the test
- [ ] The new ADR exists and ADR-0002 points to it

## Mandatory validations

- [ ] tests/validate.sh
- [ ] the new CLAUDE.md test and `tests/test-private-names.sh`

## Risks and rollback

- Governance change (ADR-0002); tools that read `CLAUDE.md` as a copy of `AGENTS.md` now see an import line.
- Notes in `CLAUDE.md` can drift from `AGENTS.md`; keep them to Claude-only facts.
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
