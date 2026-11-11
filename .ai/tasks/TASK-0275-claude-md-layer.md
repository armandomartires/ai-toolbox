# TASK-0275 — CLAUDE.md layer over AGENTS.md (P1.5)

## Status

- Status: in review
- Owner: agent
- Branch: agent/TASK-0275
- Created: 2026-11-10
- Updated: 2026-11-11
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

- [x] `CLAUDE.md` is a regular file whose first line is `@AGENTS.md`
- [x] Each tracked rule has a `paths` filter and is not ignored by git
- [x] Restoring the symlink fails the test
- [x] The new ADR exists and ADR-0002 points to it

## Mandatory validations

- [x] tests/validate.sh
- [x] the new CLAUDE.md test and `tests/test-private-names.sh`

## Risks and rollback

- Governance change (ADR-0002); tools that read `CLAUDE.md` as a copy of `AGENTS.md` now see an import line.
- Notes in `CLAUDE.md` can drift from `AGENTS.md`; keep them to Claude-only facts.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| CLAUDE.md, .claude/rules/mods.md and mcp.md, .gitignore, tests/test-claude-md.sh, ADR-0061 | done, staged not committed |

Next: review and commit.

## Execution log

- 2026-11-10 · agent/Sonnet 5.5 · brief written from the alignment plan; no work done yet
  - Evidence: none yet
  - Deviation: none
- 2026-11-11 · agent/Sonnet 5.5 · carried out the plan
  - Evidence: `tests/test-claude-md.sh` red first (3 failures: index mode 120000, first line `AGENTS.md`, no rules), green after the change; with the index entry set back to 120000 it failed (1 failure); `check-ignore` reports the two rules not ignored and `.claude/settings.local.json` and `.claude/agents/x.md` ignored by `.gitignore:33`; ADR-0061 added, ADR-0002 marked superseded; test wired into `tests/validate.sh`
  - Deviation: this clone has `core.symlinks=false`, so `git add` kept index mode 120000; it took `git rm --cached CLAUDE.md` then `git add` (recorded in ADR-0061). "Restore the symlink" was done in the index with `update-index --cacheinfo`, not on disk.
- 2026-11-11 · Claude Code (Opus 5.5, coordinator) · independent review (request changes) acted on: `**/.claude/*` keeps nested `.claude/` ignored, the test uses `--no-index` and checks rules are tracked, rules trimmed to Claude-only facts, project-migration 5.1.0 scaffolds the import, stale ADR-0002 citations dropped, `.claude/rules/` scanned for hidden Unicode and owned in CODEOWNERS.
