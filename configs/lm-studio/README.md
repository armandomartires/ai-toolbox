# LM Studio wiring

Snapshot of how this repo's components are wired into LM Studio.
Sources of truth live elsewhere and win any disagreement:
`mcp-servers/*/server.json` for MCP servers.

| | |
|---|---|
| Skills target | **none — not supported** (see below) |
| Skills deployment | n/a; LM Studio is not a target of `scripts/install.sh` |
| MCP config | `~/.lmstudio/mcp.json` (Program ▸ Install ▸ Edit `mcp.json`) |
| Verified | 2026-09-13 — **fully verified**: config accepted, MCP handshake confirmed, and the server active in LM Studio's own UI with its tools enumerated in chat (TASK-0017) |

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

## Agents — not supported

`scripts/install.sh` does not emit agent roles here, for a stronger reason
than the skills case above: LM Studio **supplies models and performs no
agentic work**, so it has nothing an agent role would configure. There is no
directory to guess at.

ADR-0006 settled the general rule — portability is scoped **per
capability**, not promised globally — and ADR-0018 extends it to agents:
the agent capability spans Claude Code and OpenCode only, the same two
clients as skills. This is not a gap awaiting work; it is the correct end
state for this client.

Consistent with the skills position, LM Studio stays absent from
`install.sh`'s client list and therefore from the fourth (agents target)
column added in TASK-0040.

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
      "env": { "WORKSPACE_ROOT": "REPLACE_ME_absolute_path_to_your_project" }
    }
  }
}
```

> **Replace `WORKSPACE_ROOT` before starting LM Studio.** The sentinel above
> is deliberately not a plausible path, because the previous placeholder
> (`/absolute/path/to/your/project`) was pasted verbatim and survived a full
> verification undetected — see the note below. **A successful connection
> does not validate this value:** the MCP handshake and tool enumeration
> never touch the filesystem, so the server reports healthy while its blast
> radius points nowhere. The mistake surfaces only when a destructive tool
> runs.

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
  `resources` capabilities.
- **UI verification: PASS (2026-09-13, TASK-0017).** The previously-recorded
  gap — the server appearing in LM Studio's own UI tool list — is closed.
  The server activates and shows under the message in LM Studio chat, and a
  loaded model (`qwen3.8 27b`) enumerated its tools on request. This
  completes the three-client verification; Phase 2's second exit criterion
  moved from *partly met* to met.

### Tool count: 10 exposed, 9 functional

Recorded because the two numbers look like drift and are not. The repo has
said "10 tools" since TASK-0007; a model asked to list them may report **9**.
Both are correct: `list_available_tools` is a meta-tool that enumerates the
other nine, so a model listing "the tools available" reasonably omits it.

The nine functional tools: `zen_of_ansible`,
`ansible_content_best_practices`, `ansible_lint`, `create_ansible_projects`,
`define_and_build_execution_env`, `ansible_navigator`,
`ade_environment_info`, `ade_setup_environment`, `adt_check_env`.
Plus `list_available_tools` = 10.

Do not "correct" either figure to match the other. Confirmed twice
independently during TASK-0017: by a direct `list_available_tools` query, and
by the model itself on re-review. Note that the model's *first* answer was
incomplete and confidently worded — when a count matters, ask the server, not
the model.

### Defect found during this verification — since fixed

The live `mcp.json` had `WORKSPACE_ROOT` set to the literal placeholder
`/absolute/path/to/your/project` — a path that did not exist — and
**everything still worked**: the server started, connected, and listed all
its tools.

Corrected the same day to a real Ansible project directory (verified to
exist, containing `ansible.cfg`, `inventory/`, `requirements.yml`). The value
is a Windows-style path with a drive letter, which is correct — LM Studio is
a Windows app. A WSL-side check must translate `C:/…` to `/mnt/c/…` and test
for existence; a naive POSIX `isabs()` call reports `False` on a drive-letter
path and would wrongly flag a valid value.

The lesson worth keeping:

- Connection success is **not** evidence that `WORKSPACE_ROOT` is valid.
  Nothing in the handshake or tool enumeration touches the filesystem.
- `WORKSPACE_ROOT` is the blast radius for `ansible_navigator`,
  `ade_setup_environment`, and `ansible_lint --fix`. An invalid value fails
  at the moment a destructive tool runs, which is the worst time to find out.
- The guidance above was already correct ("use an absolute path", "never
  `$HOME` or `/`") and was still pasted past. Prose was not the fix; the
  placeholder is now an implausible sentinel so an unedited paste is
  obvious.
- Verifying a *value* is a separate act from verifying a *connection*. Step 7
  of the runbook procedure exists because of this finding.
