# ADR-0040 — Mods are a component kind, for Claude Code only

**Status**: accepted
**Date**: 2026-10-26
**Task**: `TASK-0177`
**Amended 2026-11-04** on the human's choice (`TASK-0222`): see clause 4 and the last **Consequences** bullet.
**Amended 2026-11-05** (`TASK-0233`, `ADR-0054`): clause 1 names the per-harness folder `mods/<name>/claude/`.
**Amended 2026-11-08** (`TASK-0254`, `B-069`): clause 2 lets a mod carry ports for OpenCode (`opencode/`) and Codex (`codex/`) beside `claude/`.

## Context

On 2026-10-26 the human asked to merge `claude-mods`, a folder outside any repository holding one Claude Code mod (`task-compass`, a function-hook plugin that draws a pane), into ai-toolbox, and to develop every future mod here. ai-toolbox had no kind for it: a mod is neither a skill, an MCP server nor a loop, and it runs only in Claude Code 2.1.308 or later. Its sessions loaded it through `CLAUDE_CODE_PLUGIN_DIRS` from that folder, and teammates install it from the organization plugin library.

## Decision

1. **`mods/<name>/` is a component kind.** A mod is a Claude Code plugin folder, `mods/<name>/claude/` (`ADR-0054`): `.claude-plugin/plugin.json` whose `name` matches the directory above it, `hooks/hooks.json` naming its hooks modules, and a `README.md` one level up. New mods copy `mods/_template/`. Rules: authoring guide, *Mods*.
2. **Mods target Claude Code first; a port sits beside it.** Claude Code is the one client with the mod engine (panes, bands, the kit), so a mod is built there. Since 2026-11-08 a mod may also carry `mods/<name>/opencode/` (an OpenCode plugin: a server part and a `tui.tsx`) and `mods/<name>/codex/` (a Codex plugin bundle: command hooks, an MCP server, skills), added when the mod is wanted on that client (`B-069`, `B-070`). A port carries only what that client can do; its shared logic lives once in `mods/<name>/core/` (`ADR-0054` clause 4), and each harness folder holds byte-identical copies of the core modules it uses (`check-mods.py` rule 10, `ADR-0018`). `install.sh` copies a selected mod's port into the client.
3. **The gate checks shape, offline.** The mod's own tests need a `claude` that supports mods, which the gate must not require, so they run in `tests/test-mods.sh`, outside the gate, like the MCP smoke test. A SKIP is not a pass.
4. **The live copy loads from this checkout**, through `CLAUDE_CODE_PLUGIN_DIRS` in the host's `~/.claude/settings.json` (runbook, *Loading a mod in development*). `install.sh` copies and links no Claude plugin; since `TASK-0222` it writes that setting (a port for another client is copied, clause 2).
5. **Teammates get a mod from the organization plugin library.** Publishing there stays a human step.
6. **A mod's planning lives in `.ai/`.** `claude-mods/GOALS.md` was retired, not imported: its sprints were done, and its one open story is `B-064`.

## Alternatives considered

- **A skill or a `configs/claude-code/` entry.** A skill is instructions, and `configs/` holds client wiring; a mod is code that the engine loads, with its own tests.
- **Keep `claude-mods` as its own repository.** That is what the human asked to end: a second home for AI customization.
- **Run the mod tests in the gate.** It would need a networked, versioned CLI, which breaks the gate's offline, hermetic rule.

## Consequences

- One place to develop, review and push mods, under the same gate and record as every other component.
- The mod tests are not enforced by the gate. Run `tests/test-mods.sh` for any task that changes a mod.
- The pane reads `GOALS.md` from a project's `.ai/` folder (`TASK-0180`; it first read the project root), so it shows no board in this repository.
- **Amendment, 2026-11-04.** The setting was written by hand per host, and a new mod went missing until someone saw its command fail: on 2026-11-04 Windows listed only task-compass, from the WSL checkout. `install.sh`'s claude-code step now sets `CLAUDE_CODE_PLUGIN_DIRS` to every selected mod in the checkout it runs from, in that host's paths and separator, and `--status` names a mod not listed from there. Mods join the selection namespace. Each host still needs its own run. Proven by `tests/test-install.sh`, in the gate.
- **Amendment, 2026-11-08.** The person asked for task-compass in OpenCode and Codex (`TASK-0254`, `TASK-0255`). A harness folder cannot import from outside itself: Claude Code's loader refuses an import from outside the plugin folder (`cannot import ... it is outside the plugin's folder`, `claude plugin test`, 2.1.318), and `dev-mods.py` and an install copy one harness folder alone. So `core/` is the one source and each harness carries copies of it, compared byte for byte by `check-mods.py` rule 10 and proven by `tests/test-check-mods.sh`. The ports' own tests run on node's test runner, outside the gate, like the mod tests (clause 3).
- No `Unexercised:` row is added (`ADR-0039`): `task-compass` is in daily use, and its tests run for real.
