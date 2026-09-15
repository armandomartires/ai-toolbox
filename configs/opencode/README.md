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

## Agents

Deployed by the same command as skills; there is no separate step.

```bash
bash scripts/install.sh --client opencode
```

Agents are **emitted, not linked** (ADR-0018). A role is authored once in
`agents/<role>/agent.md` with an *abstract* capability profile, and
`scripts/emit-agents.py` generates an OpenCode-native file at
`~/.config/opencode/agents/<role>.md`. The `link`/`copy` mode applies to
skills only: an emitted file's content differs per client by definition, so
it cannot be a symlink to one source.

The directory is `~/.config/opencode/agents/` (**plural**). TASK-0036
observed that OpenCode discovers **both** `agents/` and the undocumented
singular `agent/`; this repo writes the documented plural. Do not "fix" a
singular directory found in place. It is created under an existing
`~/.config/opencode`; if that is absent the client is skipped and nothing
is created.

**Currently deployed: none.** No real role exists yet (TASK-0043,
TASK-0045); `agents/_template/` is never emitted.

All nine capability terms are expressible here, via the `permission` model —
which is why an OpenCode-only role is a legitimate outcome rather than a
degradation. Note that `permission` glob rules are **last-match-wins**, so
the emitter writes the broad rule (`"*"`) first and the specific ones after;
reordering an emitted file changes its meaning.

**Emission writes role files only. It never touches `opencode.jsonc`** — no
`agent` key is added, and the `agent-tiers` BMAD topology stays unapplied.
Those are separate acts needing their own authorization.

**Two known properties of emission**, both deliberate:
- **No freshness check exists or may be added.** The emitted file is a copy
  outside the repo; nothing verifies it is current. ADR-0009 forbids
  validating runtime presence, so the control is re-running `install.sh`.
- **Nothing prunes a stale emitted file.** Deleting a role from the repo
  leaves `~/.config/opencode/agents/<role>.md` in place. Remove it by hand.

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
