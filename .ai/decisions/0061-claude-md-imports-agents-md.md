# ADR-0061 — CLAUDE.md is a short file that imports AGENTS.md; path-scoped rules are tracked

**Status**: accepted
**Date**: 2026-11-11
**Task**: `TASK-0275`

Supersedes ADR-0002. Within the alignment plan item P1.5 (decision D4=B).

## Context

ADR-0002 made `CLAUDE.md` a symlink to `AGENTS.md`. On a Windows clone without `core.symlinks=true` a symlink becomes a one-line text file reading `AGENTS.md`, so Claude Code got no instructions, and the fallback (copy and re-sync) was a second source that drifts. Claude Code also reads path-scoped rules from `.claude/rules/`, which `.gitignore` excluded with the whole of `.claude/`.

## Decision

1. **`CLAUDE.md` is a regular file** whose first line is `@AGENTS.md`, followed by a few Claude-only notes. `AGENTS.md` stays the shared source and is not changed.
2. **`.claude/rules/*.md` are tracked**, each with a `paths:` front matter filter. Two exist: `mods.md` and `mcp.md`.
3. **`.gitignore` line 33 becomes `**/.claude/*` plus `!/.claude/rules/`.** A `!` exception under an ignored parent directory does not work, so the contents are ignored, at any depth as before; only the root `.claude/rules/` is re-included.
4. **`tests/test-claude-md.sh`** (called from `tests/validate.sh`) fails if `CLAUDE.md` is a symlink or index mode 120000, does not start with `@AGENTS.md`, if a rule lacks a closed front matter block with a non-empty `paths`, if a rule is untracked or ignored, or if a nested `.claude/` file is not ignored.
5. **The rules hold only what `AGENTS.md` does not say**, and never weaken an `AGENTS.md` rule. `project-migration` now scaffolds the import file, and `.claude/rules/` is covered by the hidden-Unicode scan and CODEOWNERS.

## Alternatives considered

- **Keep the symlink.** Breaks on Windows clones, the reason for this change.
- **A copy of `AGENTS.md`.** Two sources that drift.

## Consequences

- A tool that read `CLAUDE.md` as a copy of `AGENTS.md` now sees an import line.
- Notes in `CLAUDE.md` can drift from `AGENTS.md`; keep them to Claude-only facts.
- On a checkout with `core.symlinks=false`, `git add` keeps the old index mode for a path that was a symlink; run `git rm --cached CLAUDE.md` first, then `git add CLAUDE.md`.
