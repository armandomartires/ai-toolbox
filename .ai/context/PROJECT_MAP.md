# Project Map

- `skills/` — Agent Skills; entry point SKILL.md; discovered by clients
  after install.sh sync. Each is independent.
- `mcp-servers/` — Python packages; entry point src/<pkg>/server.py;
  registered per client from `configs/`.
- `loops/` — repeatable multi-step workflows (loop.md: trigger, steps,
  exit conditions); may invoke skills and MCP servers.
- `prompts/`, `agents/` — prompt fragments and subagent role
  definitions consumed by loops and clients.
- `configs/` — client wiring snapshots; source of truth stays in repo.
- `docs/registry.md` — generated index; built by scripts/sync-registry.sh
  from SKILL.md frontmatter and pyproject.toml metadata.
- Data flow: repo (git) → scripts/install.sh → client skill dirs/configs.
- Fragile/unknown areas: cross-client config formats drift; revisit
  configs/ after client updates.
