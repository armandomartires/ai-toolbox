# ai-toolbox

Local monorepo for AI customization tools: agent skills, MCP servers,
agent loops, prompts, agent roles, and client configurations.

- Component layer (analog of src/): `skills/`, `mcp-servers/`, `loops/`,
  `prompts/`, `agents/`, `configs/`
- Governance layer: `.ai/` (context, decisions, planning, tasks, sessions,
  reviews, templates) — see `.ai/README.md`
- Index: `docs/registry.md` (generated, never hand-edit)
- Deploy: `scripts/install.sh`; validate: `tests/validate.sh`

Read `AGENTS.md` before doing any work in this repository.
