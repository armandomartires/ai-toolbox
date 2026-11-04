# TASK-0223 — Every pane panel is resizable, from one shared panel; mods are built from shared parts

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-04
- Updated: 2026-11-04
- Applies to: `mods/_template/hooks/{sigma,handle}.tsx` and their copies; task-compass 0.10.0 → 0.11.0, agent-watch 0.9.0 → 0.10.0, switchboard 0.5.0 → 0.6.0, task-orchestrator 0.5.0 → 0.5.1, `_template` 0.2.0 → 0.3.0; `scripts/check-mods.py`, `tests/test-check-mods.sh`; AGENTS.md, the authoring guide, `mod-workflow.md`; ADR-0053
- Source: the human, 2026-11-04: "all mod panels that we developed and will develop from now on ought to have this handle", "Can the panels be some sort of class?", "we should apply a modular approach to our mod development ... Make sure this sticks for every future development efforts", and "Yes, do it here"

## Objective

Every panel in a mod's pane, now and in mods still to be written, has the drag handle, because the panel drawing every mod already shares draws it; and building from shared parts is a written, gated rule of mod development.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `64a8100` (`TASK-0221`) | the handle on two panels in Compass's pane, each mod drawing its own slot and hook around `handle.tsx` |
| `kit().panel` in `sigma.tsx` | the shared panel every mod draws with; no resize |
| panes on master | Compass (Sprints; agent-watch's Sessions), agent-watch's Agents pane, switchboard's pane; task-orchestrator and the template draw command-output rows only |

## Findings (2026-11-04)

- **A `Client` in `sigma.tsx` makes every mod carrying it need `handle.tsx`**: the engine reads surface modules off every hooks file's source.
- **The stored height cannot live in `sigma.tsx`**: atoms are read off the file that declares them, so `resizeAnswer` takes the mod's own `update` as a callback.
- **A hook's `{ props }` answer can be partial** once the handle lays it over its last full props, so the answer no longer needs the mod's colours.

## Scope

- In: `panel({ resize })` in `sigma.tsx` with `heldOf`, `resizeAnswer`, `PanelRows`; `handle.tsx` takes partial props and draws a plain edge for an unframed panel; Compass, agent-watch (both panes) and switchboard on it, each with one `panelRows` value; every mod carries `handle.tsx`; check-mods rules 7 and 9; the rule in AGENTS.md, the authoring guide and `mod-workflow.md`; ADR-0053; tests; READMEs and DEVELOPINGs; versions.
- Out: a pane in the template; task-orchestrator's command-output panels; persisting heights across sessions.

## Likely files

- `mods/_template/hooks/{sigma,handle}.tsx`, each mod's `hooks/{sigma,handle}.tsx`, `mods/task-compass/hooks/view.tsx`, `mods/agent-watch/hooks/{panel,view,register}.tsx`, `mods/switchboard/hooks/{view,register}.tsx`, each `types/index.d.ts`, tests, snapshots, `scripts/check-mods.py`, `tests/test-check-mods.sh`, `AGENTS.md`, `docs/development/{authoring-guide,mod-workflow}.md`, `.ai/decisions/0053-*.md`

## Execution plan

1. The shared option in the template's `sigma.tsx` and `handle.tsx`, copied to every mod.
2. Compass, agent-watch and switchboard onto it; tests adapted and added.
3. Gate rules and their self-test; the rule in the docs; versions; the human's live check; commit from WSL.

## Acceptance criteria

- [x] `kit().panel({ resize })` draws the handle and holds the body; mobile and vscode draw the panel alone (kit)
- [x] The Sprints, both Sessions and the Switchboard panels resize; the Agents pane's height is apart from Compass's (kit)
- [x] `check-mods.py` fails a mod with `sigma.tsx` and no `handle.tsx`, and a mod drawing a Pane with no `resize` (`test-check-mods.sh` H1–H4)
- [x] AGENTS.md, the authoring guide and `mod-workflow.md` state the shared-parts rule
- [x] Seen live: the Sprints handle in a terminal (the human, 2026-11-04: "Works"); the Sessions handle in Compass's pane on the desktop. Not seen: the Agents pane's and switchboard's handles; the desktop's Sprints handle, since the desktop draws the library's task-compass 0.9.1 (its synced copy on disk, re-synced 2026-11-04)

## Mandatory validations

- [x] `bash tests/test-mods.sh`: agent-watch 149, switchboard 28, task-orchestrator 56, `_template` 12; task-compass 64 in WSL
- [x] `python3 scripts/check-mods.py` OK (5 mods); `tests/test-check-mods.sh` 22/22 in WSL
- [x] `tests/validate.sh` (the pre-commit hook, in WSL)

## Risks and rollback

- switchboard's body rows are counted, not measured: a row that wraps makes a drag start a row off.
- A future mod that draws only command-output panels needs no `resize`; one that draws a pane through something other than `kit().panel` passes rule 9 with any `resize:` text.
- Rollback: git revert the task commit.

## Outputs / handover

- `kit().panel({ resize })`, `heldOf`, `resizeAnswer` in `mods/_template/hooks/sigma.tsx`; `handle.tsx` in every mod; rules 7 and 9; ADR-0053 (proposed).
- The desktop app draws the organization library's task-compass 0.9.1 while it is synced to this host; publishing 0.11.0 to the library, or removing it there, is the human's step.
- `settings.json` on the Windows host loads agent-watch, switchboard and task-compass from the worktree `mystifying-yonath-586446`; point them back at the main checkout once it is at this commit.

## Execution log

- 2026-11-04 · Claude Code (Opus 5.5) · opened from the human's three asks after `TASK-0221` landed; worktree moved to `64a8100`
- 2026-11-04 · Claude Code (Opus 5.5) · built: the shared option, three mods on it, rules 7 and 9 with four self-test cases (22/22 in WSL); tests pass: agent-watch 149, task-compass 55 + the 9 Windows-only layer failures, switchboard 28, task-orchestrator 56, `_template` 12
- 2026-11-04 · Claude Code (Opus 5.5) · live: the Sprints handle works in a terminal; the desktop drew the library's 0.9.1 copy (its synced folder on disk), so its Sprints handle is not seen there
