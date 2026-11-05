# TASK-0233 — Per-harness mod layout: `mods/<name>/claude/` today, `core/` and other harnesses later

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-05
- Updated: 2026-11-05
- Applies to: `mods/`, `scripts/`, `skills/mod-dev/`, `tests/`
- Source: the human, 2026-11-05: develop mods for Claude, then adapt those that fit to OpenCode, Codex, Cursor and Grok Build; "we need a folder tree and move the mods into the adequate claude folder".

## Objective

Each mod keeps its Claude Code plugin under `mods/<name>/claude/`, so ports and a harness-neutral `core/` can sit beside it later (ADR-0054).

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/<name>/{.claude-plugin,hooks,types,preview}` | moved with `git mv` into `mods/<name>/claude/`; README, DEVELOPING and LICENSE stay at the mod's root |
| `mods/_template/` | the scaffold and the shared-parts owner, now `mods/_template/claude/hooks/` |

## Scope

- In: the move; every script, test, skill and doc that names a mod path; `check-mods.py` rule 0 and the `core/` import rule; ADR-0054.
- Out: creating `core/`, `opencode/`, `codex/`, `cursor/` or `grok/` (added when a second harness needs them); mod behaviour and versions.

## Likely files

- `scripts/check-mods.py`, `check-mod-status.py`, `dev-mods.py`, `preview-mods.py`, `preview_snapshots.py`, `install.sh`, `sync-registry.sh`
- `skills/mod-dev/`, `tests/test-check-mods.sh`, `test-install.sh`, `test-mods.sh`, `validate.sh`
- `docs/development/authoring-guide.md`, `AGENTS.md`, ADR-0040/0043/0045/0052/0053

## Execution plan

1. `git mv` each mod's `.claude-plugin/`, `hooks/`, `types/`, `preview/`, `tsconfig.json` and `status.json` into `mods/<name>/claude/`; `mods/_template` stays the shared-parts owner.
2. Point every script, test, skill and doc at the new paths; add rule 0 and the `core/` import rule to `check-mods.py`; record ADR-0054.

## Acceptance criteria

- [x] `git diff -M` shows renames and no file lost
- [x] No script, skill, test or doc names `mods/<name>/hooks` or `mods/<name>/.claude-plugin` without `claude/`
- [x] `check-mods.py` requires `claude/.claude-plugin/plugin.json`; a `core/` that imports a harness package fails

## Mandatory validations

- [x] `tests/test-check-mods.sh`: 29/29 pass
- [x] `tests/test-install.sh`: OK (37 cases)
- [x] `scripts/check-mods.py` and `scripts/check-mod-status.py`: OK (5 mods)
- [ ] `tests/validate.sh`: the Windows host fails the worktree and symlink cases, the Vault login times out; see the log

## Risks and rollback

- A checkout that still names `mods/<name>` in `CLAUDE_CODE_PLUGIN_DIRS` loads nothing; `install.sh --status` flags it.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mods/<name>/claude/` | holds each mod's Claude Code plugin |
| ADR-0054 | accepted |

Next: add `core/` and `opencode/` to the first mod that gets a second harness (`B-069`).

## Execution log

- 2026-11-05 · Claude Code (Sonnet 5.5) · moved the five mods, updated scripts, tests, skills and docs, regenerated `docs/registry.md`, wrote ADR-0054.
  - Evidence: `tests/test-check-mods.sh` → `29/29 passed`; `tests/test-install.sh` → `OK (37 cases)`
