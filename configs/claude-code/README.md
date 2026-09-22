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

## Agents

Deployed by the same command as skills; there is no separate step.

```bash
bash scripts/install.sh --client claude-code
```

Agents are **emitted, not linked** (ADR-0018). A role is authored once in
`agents/<role>/agent.md` with an *abstract* capability profile, and
`scripts/emit-agents.py` generates a Claude Code-native file at
`~/.claude/agents/<role>.md`. The `link`/`copy` mode applies to skills only:
an emitted file's content differs per client by definition, so it cannot be
a symlink to one source.

The directory is `~/.claude/agents/` — confirmed by observation in
TASK-0036, not from documentation alone. It is created under an existing
`~/.claude`; if `~/.claude` is absent the client is skipped and nothing is
created.

**Currently deployed: three of six roles** — `designer-manager` (primary),
`ideator` and `critic` (TASK-0043). `agents/_template/` is never emitted.

**The three production roles are deliberately absent.** `qa-test`, `review`
and `git-ops` declare `clients: [opencode]` because each needs a command
allowlist or a path-scoped edit, and neither has a per-agent expression here
— `tools`/`disallowedTools` gate whole tools, so "git commands only" cannot
be said at all. `install.sh` **skips** them for this client (exit 0), rather
than emitting a `git-ops` that could run any command. See ADR-0018 clause 8
and `agents/git-ops/agent.md`'s scope note.

Capability terms map to `disallowedTools` plus, for `worktree-only`,
`isolation: worktree`. Five of the nine terms — `test-files-only`,
`bash-allowlist`, `no-force-push`, `push-requires-confirmation`,
`webfetch-requires-confirmation` — **cannot be enforced per-agent here**,
because `tools`/`disallowedTools` gate whole tools and Claude Code has no
third `ask` state. A role declaring one of them for this client makes
emission **fail loudly** rather than emit a file with the boundary dropped
(ADR-0018 clause 8). Narrow such a role's `clients` list to `opencode`.

**Two known properties of emission**, both deliberate:
- **No freshness check exists or may be added.** The emitted file is a copy
  outside the repo; nothing verifies it is current. ADR-0009 forbids
  validating runtime presence, so the control is re-running `install.sh`.
- **Nothing prunes a stale emitted file.** Deleting a role from the repo
  leaves `~/.claude/agents/<role>.md` in place. Remove it by hand.

## Third-party extensions

Extensions that are **not components of this repo** and are wired through
the client's own mechanism (`ADR-0021` clause 2). Nothing here is installed,
deployed, linked, emitted or pruned by `scripts/install.sh` — this section
documents someone else's product so a reader can wire it themselves.

`tests/validate.sh` checks that this file **exists**; it cannot check that
anything below is true (`ADR-0009`). Every claim is therefore labelled
either *vendor doc* or *observed*, with a date and a version.

### ponytail

`@dietrichgebert/ponytail`, MIT, **4.10.0** — version and license re-checked
on npm 2026-09-23. A prompt ruleset that biases an agent toward the smallest
solution that works, plus six Agent Skills and a set of lifecycle hooks.

**This repo does not install ponytail** and does not vendor it (`ADR-0021`
clauses 3 and 4). Run upstream's installer yourself.

**Mechanism here: the plugin marketplace, as two separate prompts.**
*Vendor doc, README 2026-09-23.* Upstream is explicit that one prompt does
not work:

```
/plugin marketplace add DietrichGebert/ponytail
```
```
/plugin install ponytail@ponytail
```

Note this installs from the **GitHub repository**, not from the npm package
— a different distribution channel from the OpenCode wiring, which consumes
the npm tarball. Same product, two delivery routes.

**It installs three lifecycle hooks, not two.** *Observed 2026-09-23 in the
published 4.10.0 tarball*, `hooks/claude-codex-hooks.json`:

| Event | Command | Timeout |
|---|---|---|
| `SessionStart` (matcher `startup\|resume\|clear\|compact`) | `node "${CLAUDE_PLUGIN_ROOT}/hooks/ponytail-activate.js"` | 5 s |
| `SubagentStart` | `node "${CLAUDE_PLUGIN_ROOT}/hooks/ponytail-subagent.js"` | 5 s |
| `UserPromptSubmit` | `node "${CLAUDE_PLUGIN_ROOT}/hooks/ponytail-mode-tracker.js"` | 5 s |

> **Upstream's README and upstream's shipped manifest disagree on the
> count.** The README says the Claude Code plugin *"run[s] two tiny Node.js
> lifecycle hooks"*; the manifest declares three. The two-hook description
> matches `hooks/copilot-hooks.json`, a **different client's** file, which
> uses different event names (`sessionStart`, `userPromptSubmitted`), a
> different timeout key (`timeoutSec`) and separate `bash`/`powershell`
> forms. Recorded because it is the third README-versus-source disagreement
> this sprint has hit, and because a reader auditing their own hooks should
> expect the third one.

**`node` must be on the *non-interactive* shell's PATH** (*vendor doc*;
upstream calls out Nix and nvm users specifically). The failure is silent by
design: if `node` is missing *"the skills still work, the always-on
activation just stays quiet instead of erroring on every prompt"*. So a
half-working install looks like a working one — check the hooks fire rather
than assuming.

**State it writes outside its plugin directory**, which `/plugin remove`
does **not** clean up (*vendor doc, README 2026-09-23*):

| Path | What |
|---|---|
| `~/.claude/.ponytail-active` | Mode flag |
| `~/.config/ponytail/config.json` (`%APPDATA%\ponytail\config.json` on Windows) | Optional `defaultMode`; also settable via `PONYTAIL_DEFAULT_MODE` |
| `~/.claude/settings.json` → `statusLine` | **Only if you accept the setup nudge** |
| `~/.cursor/hooks.json` | Cursor's entries, if you also installed there |

Upstream ships `node scripts/uninstall.js` to remove them, **and the order
matters**: run it *before* `/plugin remove ponytail`, because the script is
itself a plugin file and removing the plugin deletes it. It only strips the
`statusLine` entry if that entry points at ponytail's own script, so a
statusline you wrote yourself survives.

**Nothing in this repo creates or prunes any of it.** Listed so that finding
these files later is explicable rather than alarming — the same reason
`configs/opencode/README.md` documents its two `git-ops` copies.

## MCP servers

> **Not every server has a subsection here, and that is a rule rather than an
> omission.** One is owed only when a server declares a required environment
> variable, a destructive capability, or a launch a client cannot perform from
> the manifest alone — the rule, its reasoning and the worked exemption are in
> [the authoring guide](../../docs/development/authoring-guide.md). The first
> two conditions are enforced by `tests/validate.sh`. **graphify is exempt**:
> it declares neither, and `scripts/install.sh` already prints its launch
> command, transport and preconditions from the manifest. (`TASK-0073`,
> closing `B-023`.)

`scripts/install.sh` prints the launch command for every server, read from
its manifest. Register a server for the current user:

```bash
claude mcp add --scope user --transport stdio <name> -- <command>
```

### ansible (external — `mcp-servers/ansible/server.json`)

> **Destructive capabilities.** Installs OS packages
> (`ade_setup_environment`), builds container images
> (`define_and_build_execution_env`), rewrites playbooks in place
> (`ansible_lint` with `fix: true`), scaffolds directories
> (`create_ansible_projects`). Authorized in
> `.ai/tasks/TASK-0007-port-ansible-mcp-server.md` (2026-09-13) and shipped
> enabled.
>
> **`ansible_navigator` is DISABLED by default** (human decision 2026-09-14,
> re-confirmed 2026-09-16; `TASK-0026`). **Do not enable it.** It executes
> playbooks against real inventory, and its parameters are `userMessage`,
> `filePath`, `mode`, `environment`, `disableExecutionEnvironment` — **no
> inventory, no limit, no `--check`, no `--diff`**. So it cannot preview a
> change or scope a run, while it *can* change production. Use the control
> venv's own `ansible-playbook`, which does everything this tool does and
> everything it cannot.
>
> **This is advisory, not enforced.** Nothing in this repo can switch a tool
> off in the upstream server: the command below starts a server that exposes
> all ten tools, and you can re-enable `ansible_navigator` in your own client
> config at any time. What this section reduces is *default* exposure, by
> telling you not to.
>
> **`WORKSPACE_ROOT` bounds filesystem reach only — it is not the blast
> radius for every tool.** It bounds `ansible_lint --fix`,
> `create_ansible_projects` and `define_and_build_execution_env`'s file
> writes. It does **not** bound `ansible_navigator`, which reaches **remote
> managed infrastructure**, nor `ade_setup_environment`, which installs OS
> packages **system-wide**. Set it to the project directory, never `$HOME`
> or `/` — and note that nothing in the MCP handshake validates the value
> (`TASK-0017`).

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
