# Operations Runbook

## Environments
- Development: Windows 11 + WSL; local repo; quick/unit tests.
- Deployment targets (no staging/production web tier for this repo):
  local agent clients (`~/.claude/skills`, OpenCode, LM Studio config)
  and lab machines, via `scripts/install.sh`.

## Procedures
- Run locally: clone on WSL; `bash scripts/install.sh link`.
- Validate: `bash tests/validate.sh`.
- Regenerate index after component changes: `bash scripts/sync-registry.sh`.
- Add an MCP server to a client: see configs/<client>/README.md.
- Roll back: `git revert` the component's commit, re-run install.sh.

## Human approval required for
- Destructive tool capabilities in MCP servers.
- Deleting or rewriting components (see AGENTS.md).
