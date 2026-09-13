# Claude Code wiring

Snapshot of how this repo's components are wired into Claude Code.
Sources of truth live elsewhere and win any disagreement: `skills/*/SKILL.md`
for skills, `mcp-servers/*/server.json` for MCP servers.

| | |
|---|---|
| Skills target | `~/.claude/skills/` |
| Skills deployment | `scripts/install.sh [link\|copy] --client claude-code` |
| MCP config | `~/.claude.json` (per-project) or project `.mcp.json` |
| Verified | 2026-09-13 — skills linked; ansible MCP reached `✔ Connected` |

## Skills

```bash
bash scripts/install.sh link --client claude-code
```

`link` (default) symlinks each skill into `~/.claude/skills/`, per
ADR-0002's symlink-first preference; `copy` is the fallback for checkouts
where symlinks are unavailable. Re-running is idempotent.

Currently deployed: `project-migration`, `project-workflow`. Templates
(`skills/_template*`) are never deployed. A pre-existing directory is
replaced only when this repo owns a skill of that name, and the
replacement is announced — skills this repo does not own are left alone.

## MCP servers

`scripts/install.sh` prints the launch command for every server, read from
its manifest. Register a server for the current user:

```bash
claude mcp add --scope user --transport stdio <name> -- <command>
```

### ansible (external — `mcp-servers/ansible/server.json`)

> **Destructive capabilities.** Executes playbooks against real inventory
> (`ansible_navigator`), installs OS packages (`ade_setup_environment`),
> builds container images (`define_and_build_execution_env`), rewrites
> playbooks in place (`ansible_lint` with `fix: true`), scaffolds
> directories (`create_ansible_projects`). Authorized in
> `.ai/tasks/TASK-0007-port-ansible-mcp-server.md` (2026-09-13) and shipped
> enabled. `WORKSPACE_ROOT` is the blast radius — set it to the project
> directory, never `$HOME` or `/`.

```bash
claude mcp add --scope local ansible \
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
- Version **pinned** to `26.6.0`. Unpinned `npx -y` refetches on every
  launch and can cross a breaking upstream change silently. Bump
  deliberately and update `upstream.version` in the manifest in the same
  change.
- Upstream declares `node>=24.0`; runs on node 22 with an `EBADENGINE`
  warning, because npm `engines` is advisory unless `engine-strict` is set.
  Tested on node v22.23.2.
- **Verified** (2026-09-13, TASK-0007): both forms run in a clean scratch
  directory on an install with no prior ansible entry. `claude mcp list`
  reported `✔ Connected` for the `--scope local` form, and `--env` was
  accepted by that CLI version. The `.mcp.json` form registered and
  reported `⏸ Pending approval`, Claude Code's normal gate for
  project-scoped servers — approve interactively on first use.
