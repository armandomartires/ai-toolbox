# Turn limits for Claude Code agents

The one table `scripts/emit-agents.py` reads for `maxTurns` and `autoCompactWindow` when it emits a role for Claude Code (TASK-0282). It does not apply to OpenCode or Codex: OpenCode's iteration cap is `steps` (ADR-0018's mapping table), and the reference profile that would carry it there is TASK-0280's.

- `maxTurns`: the most agentic turns before Claude Code stops the subagent and returns its output marked partial. A stopped subagent can be resumed, so this is a stall bound, not a budget.
- `autoCompactWindow`: a token count from `100000` to `1000000`, written as a plain integer. It only lowers the window the subagent would otherwise inherit, and `CLAUDE_CODE_AUTO_COMPACT_WINDOW` overrides it. `-` means the role does not set it.

The limits start generous on purpose. Two task-orchestrator workers at `maxTurns` 60 were stopped mid-step (TASK-0260), so no role that writes code starts below 150. Tighten a limit from the run journal, never from a guess. A role this table does not list is emitted with neither key. To change a limit, edit its row; the emitter holds no copy.

| Role | maxTurns | autoCompactWindow |
|---|---|---|
| adjudicator | 60 | - |
| closer | 60 | - |
| critic | 80 | - |
| designer-manager | 200 | 400000 |
| gate-runner | 60 | - |
| git-ops | 80 | - |
| ideator | 80 | - |
| implementer | 250 | 400000 |
| park-steward | 40 | - |
| preflight | 60 | - |
| qa-test | 200 | 400000 |
| refuter | 120 | - |
| review | 120 | - |
| run-scribe | 60 | - |
| task-planner | 120 | - |
