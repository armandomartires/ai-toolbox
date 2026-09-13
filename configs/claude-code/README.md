# Claude Code wiring
Snapshots and snippets: `.mcp.json` entries, `settings.json` fragments.
Register a server globally:
`claude mcp add --scope user --transport stdio <name> -- <command>`

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

Register for the current user:

```bash
claude mcp add --scope user --transport stdio ansible \
  --env WORKSPACE_ROOT="$PWD" \
  -- npx -y @ansible/ansible-mcp-server@26.6.0 --stdio
```

Or, per project, in `.mcp.json`:

```json
{
  "mcpServers": {
    "ansible": {
      "command": "npx",
      "args": ["-y", "@ansible/ansible-mcp-server@26.6.0", "--stdio"],
      "env": { "WORKSPACE_ROOT": "." }
    }
  }
}
```

Notes:
- Version **pinned** — see the rationale in `configs/opencode/README.md`.
- Upstream declares `node>=24.0`; runs on node 22 with an `EBADENGINE`
  warning. Tested on node v22.23.2.
- **Verified** (2026-09-13, TASK-0007): both forms were run in a clean
  scratch directory on a Claude Code install that had no prior ansible
  entry. `claude mcp list` reported `✔ Connected` for the `mcp add
  --scope local` form, and `--env` was accepted by that CLI version. The
  `.mcp.json` form registered correctly and reported `⏸ Pending
  approval`, which is Claude Code's normal gate for project-scoped
  servers — approve it interactively on first use.
