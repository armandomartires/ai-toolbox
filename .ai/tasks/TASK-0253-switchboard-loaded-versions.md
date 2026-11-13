# TASK-0253 — switchboard 0.8.0: the pane lists each repo mod's loaded version beside its manifest version

## Status

- Status: review
- Owner: agent (Claude Code)
- Created: 2026-11-08
- Updated: 2026-11-08
- Applies to: `mods/switchboard/`
- Source: `B-071` (`.ai/planning/BACKLOG.md`). Raised 2026-11-03 by `TASK-0218`; the person asked on 2026-11-08 to complete S16, which is the row's "the human asks for it" trigger. Until now `mod-dev.sh status` printed the loaded version from `claude plugin list`, so a stale second copy of a mod showed only there.

## Objective

The Switchboard pane shows, for each mod of this checkout (`mods/<name>/claude`), the version the session loaded beside the version its `plugin.json` declares, and marks a loaded copy that is stale (its version differs from the manifest's) or comes from somewhere other than this checkout (a library install, a `dev-mods` sync). A stale second copy is visible at a glance.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `plugin.register` event (engine types) | carries `name`, `tier`, `root` (the plugin's folder, absolute), `version` (its manifest's, when stated) and `provenance` |
| `hooks/inventory.ts`, `kinds/mods.ts`, `model.ts`, `view.tsx` | the pane lists mods from `CLAUDE_CODE_PLUGIN_DIRS` and `plugin.register`, with categories; no versions |
| `skills/mod-dev/SKILL.md`, `docs/development/mod-workflow.md` | the stages followed: shape, validate, preview, test, version |

## Scope

- In: pure `samePath`, `repoModDir`, `versionRow`, `versionRows`, `versionLine`, `versionProblems` in `model.ts`; `$.state` `loaded`, `checkout`, `manifests`; `refreshVersions` and a `version` in `readManifest` and a `root` in `modsFromPluginDirs`; `plugin.register` recording what loaded; a Versions section and a `SWITCHBOARD <version>` line in the pane; preview scene seeded with a checkout; tests; README, DEVELOPING; 0.7.1 to 0.8.0 (the worktree was cut before `TASK-0252` bumped it to 0.7.1 and was rebased onto master; the pane had no version line, so one is added, as agent-watch's).
- Out: `sigma.tsx`, `handle.tsx` (shared, byte-identical copies); a root found by walking up from a subfolder (the session's project root only); the same view in `/switchboard list`; other mods' panes; `mod-dev.sh status`.

## Likely files

- `mods/switchboard/claude/hooks/{model,inventory,view}.ts(x)`, `kinds/mods.ts`, `model.test.ts`, `register.test.tsx`, `types/index.d.ts`, `preview/pane.scene.tsx`
- `mods/switchboard/{README,DEVELOPING}.md`, `claude/.claude-plugin/plugin.json`
- `CHANGELOG.md` (the coordinator's)

## Execution plan

1. Tests first in `model.test.ts` for the pure functions; red.
2. `model.ts`; green.
3. Wiring: `loaded` written by `plugin.register` (not for a refused mod) and by `refreshInventory` from the plugin folders; `manifests` and `checkout` by `refreshVersions`; the section drawn only when the checkout has mods (a folder starting with `_` left out).
4. Pane tests through the test kit; preview; validate; `check-mods.py`; version step.

## Acceptance criteria

- [x] The pane shows, per repo mod, the loaded version and the manifest version, with a `▲` note for a stale copy, one loaded from elsewhere, and a line for a mod not loaded
- [x] New pure functions in `model.ts` covered by tests that failed before the change (`model.test.ts` did not load without the exports)
- [x] `sigma.tsx` and `handle.tsx` untouched
- [x] switchboard 0.8.0 in `plugin.json`, the pane's `VERSION` line, README (*The pane*, *Not yet verified*) and DEVELOPING
- [ ] Live: in a real session started in this checkout with the mod loaded from `mods/switchboard/claude`, open `/switchboard`; expect `VERSIONS` listing each mod with its version, no `▲` for a mod loaded from the checkout at its manifest's version; then load a second copy of one mod (a `dev-mods` sync, or an older library install) and expect `▲ loaded from elsewhere: <folder>` and, where versions differ, `▲ stale`

## Mandatory validations

- [x] `cd mods && claude plugin test switchboard/claude`: 39 pass, 0 fail
- [x] `claude plugin validate mods/switchboard/claude`: passed with the usual warnings
- [x] `python scripts/preview-mods.py switchboard`: 4 drawings; the Versions section, the stale line and the version line are in them
- [x] `python scripts/check-mods.py`: `OK (5 mods)`
- [ ] `tests/validate.sh`: run by the pre-commit hook at the commit

## Risks and rollback

- `plugin.register` cannot be raised in a test, so what it writes into `loaded` is seen in a real session only (the live check); the tests seed `loaded` from the plugin folders.
- A session opened in a subfolder of the checkout shows no Versions section (the project root is not the checkout's).
- A mod loaded by a plugin folder that switchboard refused is left out of `loaded`; one that loaded before switchboard and so never raised `plugin.register` here is read from `CLAUDE_CODE_PLUGIN_DIRS`.
- A mod loaded before switchboard keeps the version read from its folder at `session.start`: `refreshInventory` lets a held entry win over the folder's, and such a mod raises no `plugin.register`. After `/reload-plugins` it may stay marked stale; whether a reload re-raises the event or keeps `$.state` is unverified (independent review, medium-low).
- A loaded copy newer than the manifest is called stale too, and its note says to load the older manifest version (review, low).
- The refused-mod fix (a refused mod's earlier `loaded` entry is dropped) has no kit test: the test kit cannot raise `plugin.register`.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| switchboard | 0.8.0, committed on the worktree branch |

Next: the live check above; the coordinator adds the CHANGELOG entry, moves `B-071` and updates `CURRENT_STATE.md`.

## Execution log

- 2026-11-08 · Claude Code (Sonnet 5.5, builder worker T1b of the S16 run) · model, tests (red then green), wiring, pane, preview, docs, version.
  - Evidence: `claude plugin test switchboard/claude` first run with the new `model.test.ts` and no implementation: `13 pass`, `1 fail` (the file did not load); after: `37 pass`, then `39 pass` with the pane tests; `scripts/check-mods.py` → `OK (5 mods)`; `claude plugin validate mods/switchboard/claude` → `Validation passed with warnings`; `preview-mods.py switchboard` → `4 drawing(s)`.
- 2026-11-08 · Claude Code (Opus 5.5, S16 coordinator) · rebased onto master `86d5aa7` (switchboard 0.7.1 to 0.8.0); independent review (request changes, no blocker) acted on: `pluginDirs` no longer cuts a single Windows folder at its drive colon, `samePath` compares a Windows path without case and collapses doubled and `.` segments, and a refused mod's earlier `loaded` entry is dropped. Red first: two new model tests failed, then `40 pass`, `0 fail`; `check-mods.py` → `OK (5 mods)`. The reload and newer-copy findings are recorded under Risks.
