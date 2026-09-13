# ai-toolbox

Local monorepo for AI customization tools: agent skills, MCP servers,
agent loops, prompts, agent roles, and client configurations.

- Component layer (analog of src/): `skills/`, `mcp-servers/`, `loops/`,
  `prompts/`, `agents/`, `configs/`
- Governance layer: `.ai/` (context, decisions, planning, tasks, sessions,
  reviews, templates) — see `.ai/README.md`
- Index: `docs/registry.md` (generated, never hand-edit)
- Deploy: `scripts/install.sh`; validate: `tests/validate.sh`

## Getting started

Prerequisites are Bash and `python3` — nothing else is needed to develop or
validate. Optional environment variables (a git remote token, the ansible
MCP server's workspace path) are documented in `.env.example`; copy it to
`.env`, which is gitignored and must never be committed. `tests/validate.sh`
passes with none of them set.

```
bash scripts/install.sh link   # deploy skills + activate the commit hook
bash tests/validate.sh         # the mandatory gate
```

See `docs/operations/runbook.md` for the full variable table.

Read `AGENTS.md` before doing any work in this repository.

## Licensing

This repository is MIT licensed — see `LICENSE`. That grant covers the
components authored here: the skills, loops, prompts, agent roles, scripts,
and any MCP server whose source lives in this repo.

It does **not** extend to upstream packages that external MCP servers only
wire up. Those are not vendored here; each one's own license applies and is
recorded in its `mcp-servers/<name>/server.json` under
`upstream.license`. For example `mcp-servers/ansible/` describes
`@ansible/ansible-mcp-server`, which is independently MIT — this repo
ships a manifest and wiring snippets for it, not its code.

A skill's `license:` frontmatter key should agree with this file unless it
deliberately differs; `tests/validate.sh` checks that the key is non-empty
when present, but does not force it to match (ADR-0008).
