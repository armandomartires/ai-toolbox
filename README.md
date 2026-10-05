# ai-toolbox

[![validate](https://github.com/armandomartires/ai-toolbox/actions/workflows/validate.yml/badge.svg?branch=master)](https://github.com/armandomartires/ai-toolbox/actions/workflows/validate.yml)
[![dashboard](https://github.com/armandomartires/ai-toolbox/actions/workflows/dashboard.yml/badge.svg?branch=master)](https://github.com/armandomartires/ai-toolbox/actions/workflows/dashboard.yml)

These two badges exist because the gate was **red for fourteen consecutive
commits** and nothing said so (`TASK-0123`). CI cannot tell you it is
failing, and `tests/validate.sh` cannot detect that CI is failing — so the
state has to be visible somewhere a person already looks. This is that
place — and if one of them goes red, `.github/workflows/ci-alert.yml`
opens an issue that closes itself when CI recovers, so the signal does
not depend on anyone reading an email.

Local monorepo for AI customization tools: agent skills, MCP servers,
agent loops, prompts, agent roles, and client configurations.

- Component layer (analog of src/): `skills/`, `mcp-servers/`, `loops/`,
  `prompts/`, `agents/`, `configs/`
- Governance layer: `.ai/` (context, decisions, planning, tasks, sessions,
  reviews, templates) — see `.ai/README.md`
- Index: `docs/registry.md` (generated, never hand-edit)
- Deploy: `scripts/install.sh`; validate: `tests/validate.sh`
- Delivery dashboard: **https://armandomartires.github.io/ai-toolbox/**
  — regenerated from `.ai/` and republished on every push to `master`
  (`.github/workflows/dashboard.yml`), and rebuilt once a day by
  `.github/workflows/dashboard-daily.yml`, scheduled for 00:23 UTC — GitHub
  has started it 5 to 6 hours late — so its date moves without a push. A
  view of the governance layer, not an audit of it

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
