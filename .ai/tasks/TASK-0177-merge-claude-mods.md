# TASK-0177 — Merge claude-mods, and develop mods here from now on

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-26
- Updated: 2026-10-26
- Applies to: new component kind `mods/` (`task-compass`, `_template`); `tests/validate.sh`, `scripts/sync-registry.sh`, a new `tests/test-mods.sh`; `AGENTS.md`, authoring guide, runbook, `CURRENT_STATE.md`, `BACKLOG.md`; a new ADR; the human's Windows `~/.claude/settings.json`
- Source: human request 2026-10-26; human decisions the same day: retire `GOALS.md` (its open story becomes a backlog row), load the live mod from this WSL checkout over `\\wsl.localhost`, and leave the old folder for the human to delete

## Objective

`C:\Users\armando.martires\work\claude-mods` holds one Claude Code mod, `task-compass`, outside any repository, and future mods are to be developed in ai-toolbox. Bring it in as the first component of a new `mods/` kind, with a template, a shape check in the gate and a test script, and point the human's sessions at the copy here.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `claude-mods/` | not a git repository; `CLAUDE.md`, `GOALS.md`, `task-compass/` (16 authored files plus engine-generated, self-ignored `.claude-plugin/types/`) |
| `claude-mods/GOALS.md` | sprints 1–2 done; sprint 3 has one open story, "Screenshots for the README" |
| Windows `~/.claude/settings.json` | `env.CLAUDE_CODE_PLUGIN_DIRS` = `C:\Users\armando.martires\work\claude-mods\task-compass`, `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` |
| CLIs | Windows `claude.exe` 2.1.310 (mods need 2.1.308+) validates the mod; WSL `claude` is 2.1.284 |
| `AGENTS.md` | at its 120-line budget |
| `BACKLOG.md` | six open rows, last `B-063`; `Unexercised:` cap 3 reached |

## Scope

- In: `mods/task-compass/` (authored files only); `mods/_template/`; the mod rules from `claude-mods/CLAUDE.md` split into the authoring guide (general) and the mod's `DEVELOPING.md` (its own); a hermetic shape check in the gate; `tests/test-mods.sh` running `claude plugin validate` and `test`; a *Mods* registry section; an ADR; `AGENTS.md` within budget; runbook *Loading a mod in development*; the settings line; a backlog row for the open story.
- Out: deleting `claude-mods/` (the human's step); `GOALS.md` in this repo; teaching `install.sh` to deploy mods; making the pane read `.ai/` planning; publishing a new version to the organization plugin library; OpenCode or Bionic support (mods are a Claude Code capability).

## Likely files

- `mods/task-compass/**`, `mods/_template/**`, `.gitignore`, `tests/validate.sh`, `tests/test-mods.sh`, `scripts/sync-registry.sh`, `docs/registry.md`
- `.ai/decisions/0040-mods-component-kind.md`, `AGENTS.md`, authoring guide, runbook, `CURRENT_STATE.md`, `BACKLOG.md`, `TODO.md`

## Execution plan

1. Write the ADR: `mods/` is a component kind, Claude Code only; a mod is a plugin folder whose name matches its directory; the live copy loads from this checkout; the organization plugin library is how teammates get it.
2. Copy `task-compass/` without `.claude-plugin/types/`; ignore that path from the root `.gitignore`.
3. Move `claude-mods/CLAUDE.md`'s content: general mod rules to the authoring guide's *Mods* section, the module map and its own notes to `mods/task-compass/DEVELOPING.md`.
4. Add `mods/_template/`: plugin.json, hooks.json, a minimal `register.tsx` with one pure function and its test, `types/index.d.ts`, README.
5. Gate: per mod, `plugin.json` parses, `name` matches the directory, one-line `description`, `hooks.json` modules exist, a declared `types` file exists, a README exists, nothing tracked under `.claude-plugin/types/`. Red-prove it.
6. `tests/test-mods.sh`: finds a `claude` ≥ 2.1.308 (`CLAUDE_BIN`, `claude`, `claude.exe`), runs `plugin validate` and `plugin test` per mod; without one it says SKIP and exits non-zero.
7. Registry: a *Mods* section from `plugin.json`. Docs: `AGENTS.md`, runbook, `CURRENT_STATE.md`, backlog row, `TODO.md`.
8. Point `CLAUDE_CODE_PLUGIN_DIRS` at `\\wsl.localhost\AlmaLinux-10\…\ai-toolbox\mods\task-compass`; validate the mod through that path.

## Acceptance criteria

- [x] `mods/task-compass/` matches the source's authored files byte for byte, but for one file's line endings (see the log).
- [x] The gate fails on a mod whose `plugin.json` name differs from its directory, and on a missing hooks module; passes on both real mods.
- [x] `tests/test-mods.sh` passes `task-compass` and `_template` with `claude.exe` 2.1.310.
- [x] `docs/registry.md` lists `task-compass` under *Mods*.
- [x] Windows `settings.json` points at the WSL copy and `claude.exe plugin validate` passes on that path.
- [x] `AGENTS.md` names `mods/` and is ≤ 120 lines.

## Mandatory validations

- [x] tests/validate.sh
- [x] the mods shape check on a broken fixture (red proof)
- [x] tests/test-mods.sh

## Risks and rollback

- **File watch over `\\wsl.localhost` may not fire,** so an edit would not reload until the next session. Checked by the human in a new desktop session; the fallback is the runbook's restart step.
- **The gate cannot run the mod's own tests:** it is hermetic and this host's WSL `claude` is too old. They live in `tests/test-mods.sh`, as the MCP smoke test does.
- Rollback: git revert the task commit, and restore the old `CLAUDE_CODE_PLUGIN_DIRS` value

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mods/task-compass/` | the mod, plus `DEVELOPING.md` (module map, how it meets the guide's traps) |
| `mods/_template/` | `my-mod`: one command, one `$.state` key, one pure function and its test |
| `check-mods.py` in the gate; `test-mods.sh` | the shape check, and a failure on tracked generated types; `plugin validate` and `test` per mod, SKIP exits 3 |
| `ADR-0040`; authoring guide; runbook | `mods/`, Claude Code only; *Mods*; *Loading a mod in development* |
| `B-064` | README screenshots, from the retired `GOALS.md` |
| Windows `settings.json` | `CLAUDE_CODE_PLUGIN_DIRS` → `\\wsl.localhost\AlmaLinux-10\…\ai-toolbox\mods\task-compass` |

Next: the human deletes `claude-mods/`.

## Execution log

- 2026-10-26 · Claude Code (Opus 5.5) · done
  - Evidence: `sha256sum -c` of the source's 12 authored files → 0 mismatches before normalizing; `register.test.tsx` was CRLF throughout, now LF, same text
  - Evidence: `scripts/check-mods.py` on fixtures → wrong name, missing module, two-line description, `types` outside the mod, missing README, empty dir each reported, exit 1; real tree → `OK (2 mods)`
  - Evidence: `tests/validate.sh` with `name` changed and a types file force-added → both `MOD SHAPE` lines, exit 1; restored → `validate.sh: OK`
  - Evidence: `tests/test-mods.sh` → `PASS task-compass: 15 pass`, `PASS _template: 1 pass`; a broken template test → `FAIL _template: plugin test`, exit 1; no CLI on PATH → SKIP, exit 3
  - Evidence: `claude.exe plugin list` → `task-compass@inline`, the `\\wsl.localhost` path, `Status: √ loaded`
  - Deviation: the copy's one file normalized to LF. The human confirmed in a new desktop session that the pane loads from `\\wsl.localhost` and an edit reloads it.
