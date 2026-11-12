# Codex wiring

What `scripts/install.sh --client codex` writes (TASK-0281, ADR-0065), when
`~/.codex` exists. Sources of truth live elsewhere and win any disagreement.

| What | Where | How |
|------|-------|-----|
| Skills | `~/.agents/skills/<name>/`, the user folder Codex scans | a copy with the Claude-only keys stripped (TASK-0274); a hand-invoked skill (`disable-model-invocation: true`) gets `agents/openai.yaml` with `policy: allow_implicit_invocation: false`, Codex's equivalent |
| Agents | `~/.codex/agents/<role>.toml` | emitted by `scripts/emit-agents.py codex`; **none today**: every role carries a term Codex cannot enforce per agent, so each is refused (the *Port parity* matrix in `docs/registry.md`) |
| Mods | `~/.codex/plugins/<name>/` | a mod's `codex/` bundle, copied (TASK-0255); Codex loads it once a marketplace entry names it |
| Stop hook | this checkout's `.codex/hooks.json` | `hooks.json` here, merged: `configs/claude-code/hooks/stop-fast-check.sh` runs the fast check when tracked files changed. Codex runs a project hook only after the person trusts the `.codex/` layer and the hook itself |

The Stop hook works unchanged because Codex's Stop input carries `cwd` and
`stop_hook_active`, and exit code 2 with stderr continues the turn, as in
Claude Code (Codex's hooks docs, read 2026-11-12). Nothing here was loaded
by a real Codex: there is none on this host.

## MCP servers

`scripts/install.sh` wires no MCP server into Codex. A server is added by
hand under `[mcp_servers.<name>]` in `~/.codex/config.toml`, and a custom
agent cannot narrow it: MCP servers are the parent session's (Codex's
subagent docs, read 2026-11-12), so a destructive tool reaches every agent
of a session that has it.

### ansible (external — `mcp-servers/ansible/server.json`)

> **Not wired into this client.** It has destructive tools (it installs OS
> packages, builds images, rewrites playbooks with `fix: true`) and a required
> `WORKSPACE_ROOT`; their meaning and the tools to disable are in
> `configs/claude-code/README.md`'s section. Wiring it here is the human's
> decision, and the disabled-tool list must be carried over by hand, since
> Codex has no per-agent way to withhold a server's tool.

### gates (authored — `mcp-servers/gates/pyproject.toml`)

> **Not wired into this client.** It starts the gate commands of a gate map,
> which makes it destructive by design; see `configs/claude-code/README.md`
> and ADR-0063 for its stdio and HTTP launches. Nothing here has run it under
> Codex.
