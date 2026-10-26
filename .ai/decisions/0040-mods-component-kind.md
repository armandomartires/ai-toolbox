# ADR-0040 — Mods are a component kind, for Claude Code only

**Status**: accepted
**Date**: 2026-10-26
**Task**: `TASK-0177`

## Context

On 2026-10-26 the human asked to merge `claude-mods`, a folder outside any repository holding one Claude Code mod (`task-compass`, a function-hook plugin that draws a pane), into ai-toolbox, and to develop every future mod here. ai-toolbox had no kind for it: a mod is neither a skill, an MCP server nor a loop, and it runs only in Claude Code 2.1.308 or later. Its sessions loaded it through `CLAUDE_CODE_PLUGIN_DIRS` from that folder, and teammates install it from the organization plugin library.

## Decision

1. **`mods/<name>/` is a component kind.** A mod is a Claude Code plugin folder: `.claude-plugin/plugin.json` whose `name` matches the directory, `hooks/hooks.json` naming its hooks modules, and a `README.md`. New mods copy `mods/_template/`. Rules: authoring guide, *Mods*.
2. **Mods target Claude Code only.** That is the one client with the capability, so the portability rule (`AGENTS.md`, *Objective and scope*) is met by it alone.
3. **The gate checks shape, offline.** The mod's own tests need a `claude` that supports mods, which the gate must not require, so they run in `tests/test-mods.sh`, outside the gate, like the MCP smoke test. A SKIP is not a pass.
4. **The live copy loads from this checkout**, through `CLAUDE_CODE_PLUGIN_DIRS` in the host's `~/.claude/settings.json` (runbook, *Loading a mod in development*). `install.sh` does not deploy mods.
5. **Teammates get a mod from the organization plugin library.** Publishing there stays a human step.
6. **A mod's planning lives in `.ai/`.** `claude-mods/GOALS.md` was retired, not imported: its sprints were done, and its one open story is `B-064`.

## Alternatives considered

- **A skill or a `configs/claude-code/` entry.** A skill is instructions, and `configs/` holds client wiring; a mod is code that the engine loads, with its own tests.
- **Keep `claude-mods` as its own repository.** That is what the human asked to end: a second home for AI customization.
- **Run the mod tests in the gate.** It would need a networked, versioned CLI, which breaks the gate's offline, hermetic rule.

## Consequences

- One place to develop, review and push mods, under the same gate and record as every other component.
- The mod tests are not enforced by the gate. Run `tests/test-mods.sh` for any task that changes a mod.
- The pane reads `GOALS.md` at a project's root, so it shows no board in this repository.
- No `Unexercised:` row is added (`ADR-0039`): `task-compass` is in daily use, and its tests run for real.
