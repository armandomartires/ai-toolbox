# TASK-0185 — switchboard: one mod that turns mods, skills and connectors on and off

## Status

- Status: done
- Owner: agent (Claude Code), with the human checking in the desktop app
- Created: 2026-10-27
- Updated: 2026-10-27
- Applies to: `mods/switchboard/` (new); `ADR-0042`; registry; `CURRENT_STATE.md`
- Source: the human's request of 2026-10-27 ("a mod to enable and disable mods, skills and connectors"); plan approved 2026-10-27

## Objective

A session can turn off, and back on, any installed mod, skill or MCP server, per project, from one pane and a `/switchboard` command. Off means refused when called, and hidden from what the model reads where the engine allows it. One mod, not three: the on/off list is one fact (`ADR-0042`).

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/_template/` | the ADR-0040 mod shape |
| Engine API (2.1.308 types) | `plugin.register` (`refuse`), `prompt.attachment` (`skill_listing`), `tool.call`, `skill.prompt`, `settings.read`, `$.store`, `$.tool.list`, `$.ui.open`, `$.command.register` |
| `install.selection` | owns what is deployed; untouched by this task |

## Scope

- In: the mod, its tests, README, DEVELOPING.md, ADR-0042, registry, state, GOALS/TODO rows.
- Out: writing any settings file or `install.selection` (a runtime layer only); OpenCode or Bionic (mods are Claude Code only, ADR-0040); publishing to the organization library (human step).

## Likely files

- `mods/switchboard/.claude-plugin/plugin.json`, `hooks/hooks.json`, `hooks/register.tsx`, `hooks/model.ts`, `hooks/kinds/{mods,skills,connectors}.ts`, `hooks/view.tsx`, `hooks/*.test.ts*`, `types/index.d.ts`, `README.md`, `DEVELOPING.md`, `LICENSE`, `tsconfig.json`
- `.ai/decisions/0042-one-switch-mod.md`, `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`, `.ai/GOALS.md`, `docs/registry.md`

## Execution plan

1. Spike the three unknowns: whether a `deniedMcpServers` answer at `settings.read` drops claude.ai connectors; whether `plugin.register` judges plugins that load before this one; the `skill_listing` attachment's `detail` shape. Record each answer here; fall back as the plan says where one fails.
2. Model: the per-project store (`$.store` keyed by the session root), `isOff(kind, name)`, toggles; `switchboard` itself never off.
3. One module per kind, hiding and blocking as the plan's table says.
4. Pane (three sections, a toggle per row, a note on when each kind takes effect) and `/switchboard`.
5. Tests per kind and for the self-exemption, each red-proved; validate; type-check.
6. ADR-0042, docs, registry, state; commit; push `origin`.

## Acceptance criteria

- [x] A skill turned off has its `Skill` call denied (live, Windows CLI) and is absent from the listing where no plugin bypasses `prompt.attachment` (live, WSL CLI: listing rewritten 11183 → 10838 characters). Under `cc-plugin-sec-default` it stays listed: recorded, not fixed (`ADR-0042`).
- [x] An MCP server turned off has its tools deferred with the note and its calls denied (live, `claude.ai Excalidraw`). Amended: the `deniedMcpServers` answer was dropped, since servers connect before any plugin loads.
- [x] A mod turned off is refused at `plugin.register` (live, `agent-watch` in WSL, `task-compass` under the security plugin); `switchboard` never is.
- [x] Toggles are kept per project root in `$.store` and read by the next session.
- [x] The mod's tests pass and each fails with its hook removed; `tests/validate.sh` passes.

## Mandatory validations

- [x] tests/validate.sh
- [x] tests/test-mods.sh --mod switchboard
- [x] claude plugin validate mods/switchboard
- [x] each new test red-proved against its reverted hook
- [x] tsc against the 2.1.308 API types

## Risks and rollback

- Turning off a server the session needs mid-task: the pane says each kind's effect, and on is one press away.
- `plugin.register` does not reach plugins loaded first: confirmed live, recorded in the README.
- Rollback: git revert the task commit

## Outputs / handover

- `mods/switchboard/` 0.1.0: the pane, `/switchboard [list | on|off <kind> <name>]`, one hook set per kind, the per-project store; 12 tests.
- `ADR-0042`: one mod; refused, and hidden where the engine allows; no settings answer; a runtime layer.
- Deviation from the plan: the `settings.read` hook (`enabledPlugins`, `deniedMcpServers`) was built, tested, then removed after the live check showed it could not act.
- Next: publish to the organization library (human step), and a desktop session's live use of the pane.

## Execution log

- 2026-10-27 · Claude Code (Opus 5.5) · started in worktree `agent/switchboard`
  - Spiked from the 2.1.308 types: `plugin.register` is judged by the plugins admitted before it; `skill_listing` carries no `detail`, so the listing is trimmed by text; `settings.read` is a `$` call, so a hook answers `{ value }`.
  - Written: the mod (6 modules, 2 test files), README, DEVELOPING.md, `ADR-0042`, registry row.
  - Evidence: `tests/test-mods.sh --mod switchboard` → `PASS switchboard: 12 pass`; `claude plugin validate` → no errors; `tsc` (5.6.3, the recommended options over the 2.1.308 types) → exit 0, after it caught the `settings.read` answer shape.
  - Evidence, red-proofs (each against a copy with the hook removed): skill hooks → 3 fail; connector hooks → 1 fail; self-exemption → 2 fail; one store for all roots → 1 fail.
  - Evidence, live (headless `--plugin-dir`, `--output-format stream-json`, `--debug-file`): WSL `claude` 2.1.312 → `plugin.register: agent-watch … refused by switchboard`; `prompt.attachment skill_listing: switchboard (user) rewrote it (11183 -> 10838 characters)`. Windows `claude.exe` 2.1.310 → `Skill` call result `The skill loop is turned off for this project in switchboard…`; `mcp__claude_ai_Excalidraw__read_me` needed ToolSearch, its description began `[Turned off in switchboard; calls are refused]`, its call was refused; `task-compass … judged by cc-plugin-sec-default, switchboard: refused by switchboard`.
  - Found live: `switchboard: settings.read bypassed by cc-plugin-sec-default` and the same for `prompt.attachment`; MCP connections start before the mod loads. The `settings.read` hook was removed; README and ADR say what holds under the security plugin.
  - Not run: a model turn in WSL (its OAuth session has expired; logging in is a human step), so the trimmed listing was seen in the debug log, not in a model's answer. The hot-load of this session's link is unanswered; nothing depends on it.
  - Every toggle the checks set was turned back on in both CLIs' stores.
