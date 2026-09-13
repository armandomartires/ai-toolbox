# OpenCode wiring
Config snippets for opencode.json: MCP servers, agent roles, skills paths.

Manifests under `mcp-servers/*/server.json` are the source of truth for
launch commands, required environment variables, and destructive
capabilities. The snippets here are the per-client translation of them —
if they disagree, the manifest wins.

## MCP servers

### ansible (external — `mcp-servers/ansible/server.json`)

> **Destructive capabilities.** This server can execute playbooks against
> real inventory (`ansible_navigator`), install OS packages
> (`ade_setup_environment`), build container images
> (`define_and_build_execution_env`), rewrite playbooks in place
> (`ansible_lint` with `fix: true`), and scaffold directories
> (`create_ansible_projects`). Authorized in
> `.ai/tasks/TASK-0007-port-ansible-mcp-server.md` (2026-09-13) and shipped
> enabled. `WORKSPACE_ROOT` is the blast radius — set it to the project
> directory, never `$HOME` or `/`.

Add to `~/.config/opencode/opencode.json` (or `opencode.jsonc`):

```jsonc
{
  "mcp": {
    "ansible": {
      "type": "local",
      "command": ["npx", "-y", "@ansible/ansible-mcp-server@26.6.0", "--stdio"],
      "environment": {
        "WORKSPACE_ROOT": "."
      }
    }
  }
}
```

Notes:
- The version is **pinned** (`@26.6.0`). Unpinned `npx -y` refetches on
  every launch and can cross a breaking upstream change silently. Bump it
  deliberately, and update the manifest's `upstream.version` in the same
  change.
- `WORKSPACE_ROOT: "."` resolves relative to wherever OpenCode was
  started, which is usually the project root — convenient, but it means
  the blast radius follows your shell. Use an absolute path if you want
  it fixed.
- Upstream declares `node>=24.0`. On node 22 npm prints an `EBADENGINE`
  warning and the server still runs, because npm `engines` is advisory
  unless `engine-strict` is set. Tested on node v22.23.2.
