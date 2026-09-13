# LM Studio wiring
MCP server entries for LM Studio's config. Note local model endpoint URLs.

Manifests under `mcp-servers/*/server.json` are the source of truth for
launch commands, required environment variables, and destructive
capabilities. The snippets here are the per-client translation of them —
if they disagree, the manifest wins.

## MCP servers

### ansible (external — `mcp-servers/ansible/server.json`)

> **Destructive capabilities.** Executes playbooks against real inventory
> (`ansible_navigator`), installs OS packages (`ade_setup_environment`),
> builds container images (`define_and_build_execution_env`), rewrites
> playbooks in place (`ansible_lint` with `fix: true`), scaffolds
> directories (`create_ansible_projects`). Authorized in
> `.ai/tasks/TASK-0007-port-ansible-mcp-server.md` (2026-09-13) and shipped
> enabled. `WORKSPACE_ROOT` is the blast radius — set it to the project
> directory, never `$HOME` or `/`.

LM Studio reads `mcp.json` (Program ▸ Install ▸ Edit `mcp.json`):

```json
{
  "mcpServers": {
    "ansible": {
      "command": "npx",
      "args": ["-y", "@ansible/ansible-mcp-server@26.6.0", "--stdio"],
      "env": { "WORKSPACE_ROOT": "/absolute/path/to/your/project" }
    }
  }
}
```

Notes:
- Version **pinned** — see the rationale in `configs/opencode/README.md`.
- Use an **absolute** `WORKSPACE_ROOT` here: LM Studio is a desktop app,
  so a relative `"."` resolves against the app's working directory, not a
  project you chose.
- Upstream declares `node>=24.0`; runs on node 22 with an `EBADENGINE`
  warning. Tested on node v22.23.2.
- **Unverified against a live LM Studio install** — this snippet follows
  LM Studio's documented `mcpServers` shape and the manifest, but was not
  executed during TASK-0007. Treat the exact config path and schema as
  needing confirmation on first use. See that task's execution log.
