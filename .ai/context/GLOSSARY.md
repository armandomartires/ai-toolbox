# Glossary

- Skill — folder with SKILL.md following the Agent Skills spec.
- MCP server — Model Context Protocol tool provider. Either an authored
  Python/FastMCP package, or an external upstream package (npm, PyPI
  CLI) documented via config wiring (ADR-0005).
- Loop — repeatable multi-step agent workflow with exit conditions.
- Agent (role) — a directory under `agents/` whose `agent.md` carries an
  identity, a `mode` (`primary`/`subagent`), an **abstract** capability
  profile, a `clients` list and a system prompt. Emitted per client rather
  than symlinked (ADR-0018).
- Capability term — one entry of the fixed vocabulary a role uses to state
  its safety boundary (`read-only`, `bash-allowlist`, …). Abstract by rule:
  client-native permission syntax in a role file is forbidden, because one
  client **silently discards** the other's and the boundary vanishes
  without an error.
- Component — any of: skill, MCP server, loop, prompt, agent role.
- Registry — generated index of components (docs/registry.md).
