# ADR-0054 — A mod is laid out per harness, and `core/` waits for a second one

**Status**: accepted
**Date**: 2026-11-05
**Task**: `TASK-0233`
**Amended 2026-11-08** (`TASK-0254`): task-compass has the first `core/`; see clause 4.

## Context

A mod was one Claude Code plugin folder: `mods/<name>/.claude-plugin/`, `hooks/`, `types/`, `preview/` beside its `README.md`. Ports to OpenCode (`B-069`) and Codex (`B-070`) are in the backlog, and `ADR-0051` clause 7 and `mod-workflow.md`, *Portability*, left open where a port's code lives: "inside the mod's folder, one subfolder per client". With the plugin files at the mod's root, a second harness's files would sit among the first's, and nothing would say which belongs to which.

The human approved a per-harness layout on 2026-11-05. Most of the four mods cannot port at all: agent-watch, task-compass and switchboard are UIs (panes, bands) on Claude Code's mod engine, which no other harness has. Only task-orchestrator's routing and dispatch logic is harness-neutral.

## Decision

1. **A mod is `mods/<name>/` with one folder per harness.** `mods/<name>/claude/` holds the Claude Code plugin: `.claude-plugin/plugin.json`, `hooks/`, `types/`, `preview/`, `tsconfig.json` and `status.json`. `README.md`, `DEVELOPING.md` and `LICENSE` stay at `mods/<name>/`, since they describe the mod, not one harness. The README carries a *Portability* table saying which harnesses the mod supports.
2. **The plugin folder Claude loads is `mods/<name>/claude`.** `CLAUDE_CODE_PLUGIN_DIRS`, `claude plugin validate` and `claude plugin test` name it; `dev-mods.py` copies its files flat to `~/.claude/dev-mods/<session>/<name>`; the registry row still names `mods/<name>`.
3. **`mods/_template/` is the scaffold and keeps the shared owner.** The owner of `sigma.tsx` and `handle.tsx` (`ADR-0043`, `ADR-0052`, `ADR-0053`) is `mods/_template/claude/hooks/`; a copy stays byte-identical in each mod's `claude/hooks/` (`check-mods.py` rule 7). A `mods/_shared/` folder is not created: it is for code more than one harness would share, and none does.
4. **`core/` is added only when a second harness needs it.** Then it holds harness-neutral logic and data (a parser, a routing table, a state model), pure TypeScript tested once, and **imports no harness API**: nothing from `claude/` or another harness folder, and no harness package (`claude-code`, `@opencode-ai/*`, `@anthropic-ai/*`, `@openai/codex`, and the like). `opencode/` and `codex/` are added when a port starts (`B-069`, `B-070`); empty folders are not created ahead of it. task-orchestrator's `routing.ts`, `router.ts`, `ledger.ts` and `contract.ts` were the first candidates. task-compass has the first `core/` (`TASK-0254`, 2026-11-08). The Claude Code loader refuses an import from outside the plugin folder, so each harness folder carries byte-identical copies of the `core/` modules it uses, and `check-mods.py` rule 10 fails a copy that differs.
5. **The gate checks it, offline.** `check-mods.py` rule 0 requires `claude/.claude-plugin/plugin.json` in every mod (so a manifest left at the old place fails) and, where a mod has a `core/`, fails an import from a harness folder or package. Proven by `tests/test-check-mods.sh`.
6. **`install.sh` lists `mods/<name>/claude`.** A selected mod's entry in `CLAUDE_CODE_PLUGIN_DIRS` is that path; an entry from before this layout (`mods/<name>`) names the same mod and is replaced, with the usual notice.

## Alternatives considered

- **Keep the plugin at the mod's root and add `opencode/`, `codex/` beside it.** Rejected: the Claude files and the ports would share one namespace, and `core/` would have no clear neighbour.
- **Create `core/`, `opencode/` and `codex/` now.** Rejected: empty folders claim a port that does not exist, and a `core/` extracted before a second harness needs it is a guess at the seam.
- **A `mods/_shared/` for the design module now.** Not needed: only Claude mods draw, so the owner stays in the template.

## Consequences

- `git mv` kept each file's history; the only content changes in a moved module are the owner's path in the comments of `sigma.tsx` and `handle.tsx`, in every copy at once.
- No mod's version changed: the manifest, hooks and types are as they were, and `plugin.json` moved.
- A host's `CLAUDE_CODE_PLUGIN_DIRS` that names `mods/<name>` finds no manifest until `scripts/install.sh` runs there once and rewrites it; each host (Windows, WSL, an SSH machine) needs its own run. A watched folder that holds several mods as `<dir>/<name>/` no longer works for `mods/` itself; `dev-mods.py`'s folder is flat and is unaffected.
- `ADR-0040` clause 1 and `ADR-0043` clause 2 name the new paths. `ADR-0051` clause 7's open question, where a port lives, is answered by clause 1 and 4 here.
