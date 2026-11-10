# TASK-0272 — Claude Code plugins per component kind (P1.2)

## Status

- Status: planned
- Owner: agent
- Branch: agent/TASK-0272
- Created: 2026-11-10
- Updated: 2026-11-10
- Applies to: `scripts/build-plugin.py`, `plugins/`, `.claude-plugin/marketplace.json`, `scripts/install.sh`, `tests/test-install.sh`
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P1.2 (N2), decisions D2=B (marketplace primary), Q8=D (GitLab marketplace plus the claude.ai org library), Q11=B (plugins per component kind), Q15=B (packaging first with 4 roles); related: ADR-0001, ADR-0021

## Objective

Ship the skills, agents and gates server as installable plugins split by component kind (Q11=B), not as one core plugin: a skills plugin, an agents plus role-guard plugin, and a gates MCP plugin, with dependencies between them. The counts of 8 skills, the agents the emitter emits for Claude Code and the gates server are taken across the three plugins. `install.sh` keeps link mode for development and non-Claude ports (D2=B).

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `scripts/install.sh` | links skills and emits agents into `~/.claude/agents` (line 589); mods exposed through `CLAUDE_CODE_PLUGIN_DIRS` |
| .claude-plugin/marketplace.json (TASK-0266) | lists the four mod plugins |
| `skills/` (8 skills), the emitted agents, `mcp-servers/gates/` | not packaged as plugins |
| TASK-0271 | the plan lists P1.1 as a dependency of P1.2 |

## Scope

- In: `scripts/build-plugin.py` writing three plugins under `plugins/`: a skills plugin (`skills/`), an agents plus role-guard plugin (emitted `agents/`, `hooks/hooks.json` with the worktree hooks and, later, the guard), a gates MCP plugin (`.mcp.json`); dependencies between them in the marketplace entries; marketplace entries for the three; an install test counting 8 skills, the emitter's agent count for claude-code and the gates server across the three; `claude plugin validate` on each.

  Ordering (Q15=B): this task ships first with the 4 roles emitted today. The plan lists P1.1 (TASK-0271) as a dependency; with Q15=B that dependency is relaxed, and the agents plugin gains the remaining roles and the guard hooks when TASK-0271 lands. The agent count in the test is the number of roles the emitter emits for `claude-code` (4 today), read from the emitter and not hardcoded. Under D1=B not every role may pass TASK-0271's measurement, so 15 is not a target here. This task closes on the emitter's count and does not wait for TASK-0271.
- Out: the role guard itself, adding `claude-code` to more roles' `clients:` lists, and the agents plugin carrying those roles (all TASK-0271); tags, version policy and signing (TASK-0283); the loop wrappers and adding them to the skills plugin build (TASK-0273, soft dependency on this task); removing `install.sh` link mode; a single core plugin (not chosen).

## Likely files

- `scripts/build-plugin.py`
- `plugins/` (three generated plugin folders)
- `.claude-plugin/marketplace.json`
- `scripts/install.sh`
- `tests/test-install.sh`
- `docs/registry.md`

## Execution plan

1. Extend `tests/test-install.sh`: install the three plugins into a throwaway config dir and count skills, agents (as the emitter reports) and the gates server; run `claude plugin validate` on each. Run and see it fail.
2. Write `scripts/build-plugin.py` to generate the three plugin folders from the existing sources, with no second copy to edit by hand.
3. Add the three marketplace entries and their dependencies (agents depends on skills; gates is independent unless a skill needs it).
4. Run the test green; drop one component from the build and see the count fail; restore it.
5. Document that `install.sh` is the development and non-Claude path.
6. Run `tests/validate.sh`.

## Acceptance criteria

- [ ] The three plugins validate and install into a throwaway config dir, giving 8 skills, the agent count the emitter reports for `claude-code` (4 today) and the gates server
- [ ] Removing a component from the build fails the count
- [ ] `build-plugin.py` output is generated, and a drift check fails if `plugins/` is stale

## Mandatory validations

- [ ] tests/validate.sh
- [ ] `bash tests/test-install.sh`

## Risks and rollback

- Plugin subagents ignore hooks, `permissionMode` and `mcpServers`, so the guard must be plugin-level hooks keyed on `agent_type`, and the gates server must be wired by the gates plugin, not by an agent.
- Three plugins mean dependency and version handling to keep in sync; TASK-0283 owns the version rule.
- Two install paths (marketplace and `install.sh`) can drift; the test covers both.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next:

## Execution log

- 2026-11-10 · agent/Sonnet 5.5 · brief written from the alignment plan; no work done yet
  - Evidence: none yet
  - Deviation: none
