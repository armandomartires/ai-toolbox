# OpenCode wiring

Snapshot of how this repo's components are wired into OpenCode.
Sources of truth live elsewhere and win any disagreement: `skills/*/SKILL.md`
for skills, `mcp-servers/*/server.json` for MCP servers.

| | |
|---|---|
| Skills target | `~/.config/opencode/skills/` |
| Skills deployment | `scripts/install.sh [link\|copy] --client opencode` |
| MCP config | `~/.config/opencode/opencode.json` / `opencode.jsonc` |
| Verified | 2026-09-13 — skills linked and version-checked; ansible MCP in live use |

## Skills

```bash
bash scripts/install.sh link --client opencode
```

`link` (default) symlinks each skill into `~/.config/opencode/skills/`,
per ADR-0002's symlink-first preference; `copy` is the fallback. Re-running
is idempotent.

Currently deployed: `project-migration`, `project-workflow`. Templates
(`skills/_template*`) are never deployed.

**Replacement policy.** A target is replaced only when this repo owns a
skill of that name, and replacing a pre-existing real directory is
announced. Skills this repo does not own are never touched — `agent-tiers`
lives in this directory and is left alone by every run.

> Until TASK-0006, `install.sh` deployed to Claude Code only, so this
> directory held a hand-placed copy of `project-workflow` at `2.1.0` while
> the repo shipped `3.0.0`. That drift is what the replacement policy
> exists to close; ADR-0004 makes this repo canonical for that skill.

Verify a deployment:

```bash
readlink -f ~/.config/opencode/skills/project-workflow
grep -m1 version ~/.config/opencode/skills/project-workflow/SKILL.md
```

## MCP servers

Add to `~/.config/opencode/opencode.json` (or `opencode.jsonc`).
`scripts/install.sh` prints each server's launch command from its manifest.

### ansible (external — `mcp-servers/ansible/server.json`)

> **Destructive capabilities.** Executes playbooks against real inventory
> (`ansible_navigator`), installs OS packages (`ade_setup_environment`),
> builds container images (`define_and_build_execution_env`), rewrites
> playbooks in place (`ansible_lint` with `fix: true`), scaffolds
> directories (`create_ansible_projects`). Authorized in
> `.ai/tasks/TASK-0007-port-ansible-mcp-server.md` (2026-09-13) and shipped
> enabled. `WORKSPACE_ROOT` is the blast radius — set it to the project
> directory, never `$HOME` or `/`.

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
- Version **pinned** to `26.6.0`. Unpinned `npx -y` refetches on every
  launch and can cross a breaking upstream change silently. Bump
  deliberately and update `upstream.version` in the manifest in the same
  change.
- `WORKSPACE_ROOT: "."` resolves relative to wherever OpenCode was
  started, which is usually the project root — convenient, but it means
  the blast radius follows your shell. Use an absolute path to fix it.
- Upstream declares `node>=24.0`; runs on node 22 with an `EBADENGINE`
  warning, because npm `engines` is advisory unless `engine-strict` is set.
  Tested on node v22.23.2.
- OpenCode's `{env:VAR}` substitution resolves to an empty string when the
  variable is unset, so an unconfigured server fails at connection time
  with a clear error rather than at config-parse time.
