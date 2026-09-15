# Project Map

- `skills/` — Agent Skills; entry point SKILL.md; discovered by clients
  after install.sh sync. Each is independent.
- `mcp-servers/` — authored Python packages (marker `pyproject.toml`,
  entry point src/<pkg>/server.py) *or* external upstream packages with
  no vendored source (marker `server.json`, ADR-0005); exactly one marker
  per server dir. Either way, registered per client from `configs/`.
- `loops/` — repeatable multi-step workflows (loop.md: trigger, steps,
  exit conditions); may invoke skills and MCP servers.
- `agents/` — role definitions, one dir per role (`agent.md`: identity,
  `mode`, an **abstract** capability profile, `clients`, system prompt).
  **Emitted per client, never symlinked** — the two clients' permission
  models differ in semantics, so a per-client file is generated
  (ADR-0018). Schema: `docs/development/authoring-guide.md` "Agents".
- `prompts/` — prompt fragments consumed by loops and clients. Still a
  declared category with **no schema, template or check** (ADR-0016);
  deliberately not built out alongside `agents/` (B-016).
- `configs/` — client wiring snapshots; source of truth stays in repo.
- `docs/registry.md` — generated index; built by scripts/sync-registry.sh
  from SKILL.md frontmatter, pyproject.toml metadata, and
  `mcp-servers/*/server.json` manifests (ADR-0005). Templates are
  excluded from the MCP table.
- Data flow: repo (git) → scripts/install.sh → client skill dirs/configs.
- Fragile/unknown areas: cross-client config formats drift; revisit
  configs/ after client updates.
