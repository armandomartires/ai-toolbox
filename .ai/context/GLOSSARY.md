# Glossary

- Skill — folder with SKILL.md following the Agent Skills spec.
- MCP server — Model Context Protocol tool provider. Either an authored
  Python/FastMCP package, or an external upstream package (npm, PyPI
  CLI) documented via config wiring (ADR-0005).
- Loop — repeatable multi-step agent workflow with exit conditions.
- Component — any of: skill, MCP server, loop, prompt, agent role.
- Registry — generated index of components (docs/registry.md).
