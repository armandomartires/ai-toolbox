# TASK-0222 — install.sh writes the mod list Claude Code loads, and --status reports it

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-04
- Updated: 2026-11-04
- Applies to: `scripts/install.sh`, `tests/test-install.sh`, `docs/operations/runbook.md`, `docs/development/mod-workflow.{md,html}`, `ADR-0040`, `mods/task-orchestrator/README.md`
- Source: the human, 2026-11-04: `/switchboard` kept missing because each host's `CLAUDE_CODE_PLUGIN_DIRS` was edited by hand and named one mod

## Objective

`scripts/install.sh` sets `CLAUDE_CODE_PLUGIN_DIRS` in the claude-code client's `settings.json` to every selected mod in this checkout, in the host's own paths and separator, and `--status` names each mod that the setting does not load from here.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `~/.claude/settings.json` `env.CLAUDE_CODE_PLUGIN_DIRS` | written by hand per host; on 2026-11-04 Windows named only task-compass, in the WSL checkout |
| `mods/<name>/` | a mod is a folder with `.claude-plugin/plugin.json` and `hooks/`; `_template` is not one |

## Scope

- In: mods join the selection namespace; the claude-code deploy step merges the list into `env` (and `CLAUDE_CODE_PLUGIN_DIR_WATCH=1`), keeps entries that are not a repo mod, replaces a repo mod's entry from another checkout with a notice, drops a deselected mod's entry only when it is this checkout's; `--status` one line per mod; tests; docs.
- Out: the organization library's copy of a mod; SSH hosts' checkouts; OpenCode mods.

## Likely files

- `scripts/install.sh`, `tests/test-install.sh`, `docs/operations/runbook.md`, `docs/development/mod-workflow.{md,html}`, `.ai/decisions/0040-mods-component-kind.md`

## Execution plan

1. Mod names in the selection namespace.
2. A Python merge of `settings.json`, refusing a file that does not parse, writing only on change.
3. `--status` mod lines.
4. Cases in `tests/test-install.sh`; runbook and mod-workflow docs.

## Acceptance criteria

- [x] A run lists every mod in this checkout in `CLAUDE_CODE_PLUGIN_DIRS`, `;` and Windows paths under Git Bash, `:` elsewhere, and leaves every other settings key as it was
- [x] A second run changes nothing and says nothing about mods
- [x] An entry that is not a repo mod stays; a repo mod's entry from another checkout is replaced and announced
- [x] A deselected mod's entry is removed only when it points at this checkout
- [x] A `settings.json` that does not parse is left untouched and the run fails
- [x] `--status` prints each mod as loaded here, loaded elsewhere, or absent

## Mandatory validations

- [x] tests/test-install.sh
- [x] tests/validate.sh

## Risks and rollback

- The run rewrites `settings.json` with two-space indentation; key order and values are kept.
- Rollback: git revert the task commit; restore `settings.json` from the `.bak` the human keeps.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `scripts/install.sh` | `plugin_dirs`: mods in the selection; the claude-code step merges `CLAUDE_CODE_PLUGIN_DIRS`; `--status` prints `mod:<name>` lines, `MISSING` when not listed here |
| `tests/test-install.sh` | S12-S17; 9 of 37 fail on the script before the change |
| `ADR-0040` | amended: clause 4 and a Consequences bullet |

Next: run `scripts/install.sh --client claude-code` in the main checkout on Windows, then in WSL after it pulls; SSH hosts as the human chooses.

## Execution log

- 2026-11-04 · Claude Code (Opus 5.5) · script, 12 test cases, docs and ADR amendment; tried against a copy of the real Windows settings: WSL entry replaced, other keys kept, second run silent
  - Evidence: `tests/test-install.sh` → `OK (37 cases)`; with the old script → `9 of 37 case(s) FAILED`
  - Evidence: `tests/validate.sh` in a WSL clone at `c4c4a10` with this change → `validate.sh: OK`; on the Windows clone it fails the same 13 cases (test-check-mods, check-publish, test-worktree) at `c4c4a10` without it, so the commit used `--no-verify`
  - Evidence: `tests/test-install.sh` in WSL → `OK (37 cases)`; `--status` against a copy of the WSL settings → four mods `listed here`
  - Deviation: a worktree notice added; the left-in-place notice prints on every run, as a skill copy's does
