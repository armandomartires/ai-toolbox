# LM Studio wiring

Snapshot of how this repo's components are wired into LM Studio.
Sources of truth live elsewhere and win any disagreement:
`mcp-servers/*/server.json` for MCP servers.

| | |
|---|---|
| Skills target | **none — not supported** (see below) |
| Skills deployment | n/a; LM Studio is not a target of `scripts/install.sh` |
| MCP config | `~/.lmstudio/mcp.json` (Program ▸ Install ▸ Edit `mcp.json`) |
| Verified | 2026-09-13 — ansible MCP config accepted and handshake confirmed |

## Skills — not deployed

`scripts/install.sh` deliberately does not deploy skills here. LM Studio
has a `~/.lmstudio/hub/skills/` directory, but it is not an Agent Skills
target of the kind `~/.claude/skills/` and OpenCode's skills dir are, and
inventing a deployment path into it would be guessing. Revisit only with
evidence from LM Studio's own documentation that it consumes the Agent
Skills spec.

This is why LM Studio is absent from `install.sh`'s client list, and
therefore exempt from the `configs/<client>/README.md` pairing that
`tests/validate.sh` enforces for deployable clients — it is documented
here as a config-only client.

## MCP servers

LM Studio reads `mcp.json`. On this machine it lives at
`/mnt/c/Users/<user>/.lmstudio/mcp.json` (the app is installed
Windows-side; WSL has no `~/.lmstudio`).

### ansible (external — `mcp-servers/ansible/server.json`)

> **Destructive capabilities.** Executes playbooks against real inventory
> (`ansible_navigator`), installs OS packages (`ade_setup_environment`),
> builds container images (`define_and_build_execution_env`), rewrites
> playbooks in place (`ansible_lint` with `fix: true`), scaffolds
> directories (`create_ansible_projects`). Authorized in
> `.ai/tasks/TASK-0007-port-ansible-mcp-server.md` (2026-09-13) and shipped
> enabled. `WORKSPACE_ROOT` is the blast radius — set it to the project
> directory, never `$HOME` or `/`.

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
- Version **pinned** to `26.6.0` — see the rationale in
  `configs/opencode/README.md`.
- Use an **absolute** `WORKSPACE_ROOT`. LM Studio is a desktop app, so a
  relative `"."` resolves against the app's working directory, not a
  project you chose.
- Upstream declares `node>=24.0`; runs on node 22 with an `EBADENGINE`
  warning, because npm `engines` is advisory unless `engine-strict` is set.
  Tested on node v22.23.2.
- **Verified** (2026-09-13, TASK-0006), with one limitation stated plainly:
  the `mcpServers` schema above is LM Studio's own — confirmed against the
  real `~/.lmstudio/mcp.json`, which already contained
  `{"mcpServers": {}}`. The entry was written into that live file, parsed
  clean, and the file was then restored byte-for-byte (md5 verified).
  Separately, the exact `command` + `args` + `env` above were run directly
  and completed a real MCP `initialize` handshake, returning
  `serverInfo: {"name": "ansible-mcp-server"}` with `tools` and
  `resources` capabilities. **Not** verified: the server appearing in
  LM Studio's own UI tool list, which needs the GUI launched
  interactively.
