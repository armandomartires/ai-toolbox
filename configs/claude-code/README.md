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

`link` (default) symlinks each skill into `~/.claude/skills/`.
`copy` is the fallback for checkouts
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

**Currently deployed: two of six roles** — `ideator` and `critic`
(TASK-0043). `agents/_template/` is never emitted.

**The four remaining roles are deliberately absent.** `qa-test`, `review` and
`git-ops` declare `clients: [opencode]` because each needs a command
allowlist or a path-scoped edit, and neither has a per-agent expression here
— `tools`/`disallowedTools` gate whole tools, so "git commands only" cannot
be said at all. `install.sh` **skips** them for this client (exit 0), rather
than emitting a `git-ops` that could run any command. See ADR-0018 clause 8
and `agents/git-ops/agent.md`'s scope note.

### The design-brief loop is OpenCode-only, and that is new

**`designer-manager` was narrowed to `clients: [opencode]` by `TASK-0075`,
closing `B-028`.** It is the primary that orchestrates
`loops/design-brief/`, so **this client now has the workers and no loop** —
`ideator` and `critic` are still emitted, but nothing here drives them
through the seven steps.

**That is a real reduction in capability, and it is the accurate one.** Until
this change the role *was* emitted here, carrying
`tools: Agent(ideator, critic, git-ops)` while `~/.claude/agents/git-ops.md`
**did not exist** — and `TASK-0056` observed that Claude Code says **nothing**
about a dead name inside an `Agent(...)` allowlist: no warning, no error,
exit 0. A control naming only an absent delegate ended up with **no delegates
at all**, silently. So the loop did not work here before; it only looked as
though it did.

`git-ops` cannot be given a Claude Code form — it exists to enforce
`bash-allowlist` — and `designer-manager` needs it for `ADR-0019`'s lock
commit. Per-client `delegates_to` was considered and declined as a schema
change belonging inside a sprint. `tests/validate.sh` now **rejects** any role
whose delegate is not emitted for every client the caller is.

> **One stale file this repo cannot clean up.** Nothing prunes an emitted
> agent (`ADR-0018` clause 4 forbids a freshness check, and `ADR-0009`
> forbids validating runtime presence), so
> `~/.claude/agents/designer-manager.md` **survives this change on any
> machine that installed it**. Re-running `install.sh` will not remove it.
> Delete it by hand:
>
> ```bash
> rm ~/.claude/agents/designer-manager.md
> ```

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

### The unattended-run harness is OpenCode-first — this client gets two of nine roles

`loops/unattended-run/` and `skills/unattended-ops/` (sprint S9) ship **nine
agent roles**. **Seven of them are never emitted here.** Checkable in
`docs/registry.md`'s Clients column rather than taken on trust:

| Emitted for this client | Not emitted here |
|---|---|
| `task-planner`, `adjudicator` — **the two that only think** | `preflight`, `refuter`, `implementer`, `gate-runner`, `closer`, `park-steward`, `run-scribe` |

**The reason is structural and is not going to change.** Each of the seven
needs a per-agent *command* boundary — "only these git verbs", "only the gate
script" — and `tools`/`disallowedTools` gate **whole tools**, with no
intra-tool granularity and no `ask` state (`ADR-0018` clause 8.3). So
`install.sh` **skips** them here, cleanly and with exit 0, rather than
emitting a role whose declared boundary this client cannot hold.

**What that means in practice.** The method is portable and the *enforcement*
is not: under this client the same run would proceed on **prompt-level rules,
which are weaker by construction** — not equivalent, and not to be described
as equivalent. `skills/unattended-ops/SKILL.md` owns that reasoning; it is
linked rather than repeated here, so there is one owner of it.

> **Nothing runs unattended on any client yet.** The loop, the skill and the
> roles are the portable core; **every binding — the thing that actually
> drives a run — is S10**, and none exists. A reader finding these components
> installed should not conclude the capability is available.

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

### gates (authored — `mcp-servers/gates/pyproject.toml`)

> **Not wired into this client — verified, then unwired** (`TASK-0090`,
> 2026-09-24, the human's choice). Registered temporarily at local scope from
> a scratch directory, with the harmless fixture map; `claude mcp get gates`
> reported **`Status: ✔ Connected`**; then `claude mcp remove gates -s local`,
> after which `claude mcp get gates` reports *No MCP server named "gates"* and
> `~/.claude.json` holds no `gates` entry in any scope. No tool was invoked.
> The snippet that connected, for whoever wires it for real:
>
> ```bash
> claude mcp add --scope local --transport stdio gates \
>   --env GATES_MAP=<consumer gate map> --env GATES_RUN_ROOT=<gitignored dir> \
>   --env GATES_MAP_SHA256=<sha256 of the map> --env GATES_ALLOWED_EXECUTABLES=<a,b> \
>   -- uv --directory <absolute path to mcp-servers/gates> run gates
> ```
>
> **Destructive capabilities.** `start_gate` runs whatever command the
> consuming repository's gate map declares for a name; `kill_gate` terminates
> the process group of a gate **this server started**, and refuses any other.
> No tool accepts a command, an argv or a path — a caller can only name a gate.
>
> **Required environment:** `GATES_MAP` (the consuming repository's gate map)
> and `GATES_RUN_ROOT` (state, logs and the evidence file `gates.txt`; keep it
> gitignored), `GATES_MAP_SHA256` (the approved map's SHA-256; a changed map
> is refused) and `GATES_ALLOWED_EXECUTABLES` (comma-separated; a gate naming
> any other executable is REFUSED). Optional: `GATES_REPO_ROOT`,
> `GATES_TIMEOUT_SECONDS`, `GATES_SANDBOX` (`bwrap` by default: no network,
> read-only filesystem; `none` is an explicit opt-out). Issue #6.
>
> **Launch form, for reference only:** `uv --directory <absolute path to
> mcp-servers/gates> run gates` — cwd-independent, so it is the form a client
> config needs (`tests/smoke-mcp.sh` uses it).

## Worktrees

Sessions never share a checkout (ADR-0023). Claude Code's own worktrees
default to `<repo>/.claude/worktrees/<slug>`, inside the repo, on a
`claude/<slug>` or `worktree-agent-*` branch; `scripts/worktree.sh list` flags
those as NESTED and as a foreign prefix.

Two hooks, tracked here because `.claude/` is gitignored, replace that default
(`settings.hooks.json` is the fragment; the scripts are in `hooks/`):

- `WorktreeCreate` -> `hooks/worktree-create.sh` reads `name` (a slug such as
  `bold-oak-a3f2`) from the hook JSON, runs `scripts/worktree.sh add <name>`
  with its output on stderr, and prints the worktree's absolute path as the
  last stdout line, which is Claude Code's contract. The path is
  `<repo>-worktrees/<slug>`, beside the repo.
- `WorktreeRemove` -> `hooks/worktree-remove.sh` reads `worktree_path` and runs
  `scripts/worktree.sh remove <path>`. A refusal (uncommitted changes,
  unlanded commits, a locked worktree) is printed and the hook exits 0, so the
  worktree is kept.

A third hook, `Stop` -> `hooks/stop-fast-check.sh` (TASK-0277), runs
`scripts/fast-check.sh` (skill frontmatter, registry, hidden Unicode; about 10 s
on Windows, measured) only when `git status` shows tracked changes, and blocks
the stop with exit 2 and the failure text. A clean tree is not delayed.
Untracked new files and changes already committed are not checked (the full
gate and CI cover them). When the payload's `stop_hook_active` is true it lets
the stop through: a failure is reported once per turn and cannot trap the
session, and the next turn that changes tracked files checks again. The tree
checked is the payload's `cwd` repository, else `CLAUDE_PROJECT_DIR`, else this
checkout. `FAST_CHECK_SKIP=1` turns the hook off. Proof: `tests/test-stop-hook.sh`.

The branch is `agent/<slug>` because the hook has no task id. When the task is
known, create the worktree with `worktree.sh add TASK-nnnn` instead, which
gives `agent/TASK-nnnn` and resumes that branch on a later session.

`bash scripts/install.sh --client claude-code` emits the hooks block: it merges
`settings.hooks.json` into this checkout's `.claude/settings.json` (created if
absent), keeps every other hook, and never writes a file that does not parse.
The fragment names `$CLAUDE_PROJECT_DIR`; the merge writes this checkout's
absolute path in its place. **The desktop app runs the hook with that
variable empty** (measured 2026-11-09: `/bin/bash:
/configs/claude-code/hooks/worktree-create.sh: No such file or directory`),
so an emitted command must not depend on it. **The Windows desktop runs
hook commands through `cmd.exe`**, so a bare `bash` is whatever `PATH` finds
first (WSL's Linux bash here, `C:\Windows\system32\bash.exe`, which cannot
open a `C:/...` path: `/bin/bash: C:/Users/.../worktree-create.sh: No such
file or directory`) and a shell expression is read by cmd (`'gb' is not
recognized as an internal or external command`), both measured 2026-11-09.
On a Windows host the emitted command is therefore a cmd line,
`"C:\Program Files\Git\bin\bash.exe" "<checkout>/configs/.../worktree-create.sh"`.
`bin\bash.exe` rather than `usr\bin\bash.exe`, because only the wrapper
sets up Git Bash's `PATH`; the inner one finds no `cat` or `python3`. A
WSL-side clone is a Linux host: its `install.sh` emits the plain `bash`
form and has its own `.claude/settings.json`.
Run `bash scripts/install.sh --status` to see whether they are present.

**Where the hooks apply.** The project `.claude/settings.json` exists only in
a checkout where `install.sh` ran, and `.claude/` is not tracked. A session in
a sibling worktree (`<repo>-worktrees/X`) reads that worktree's own
`.claude/`, so a subagent it spawns still nests under that worktree unless
`install.sh --client claude-code` was run there too. The alternative is to put
the same `hooks` block in `~/.claude/settings.json`, which every session
reads. We recommend that for a person who works in many worktrees: it is done
once per host, with the same absolute path to the main checkout's `hooks/`
that `install.sh` writes. `install.sh` does not do this: its target stays the
project file.

The create hook sets `WORKTREE_SKIP_GATE=1`, so `worktree.sh add` skips its
gate probe (minutes on this host) and prints `gate     : not probed`; both hook
entries carry `"timeout": 120`. An interactive `worktree.sh add` still probes.

Desktop Code-tab sessions **do** fire `WorktreeCreate` (measured 2026-11-09),
so the hook alone carries the rule. The desktop's own **Worktree location**
and **Branch prefix** (Settings > Code) are account-wide, not per project, so
this repo asks for no value there; if they are set, a folder outside every
repository satisfies ADR-0023's "never inside the repo".

## Permissions and sandbox (TASK-0276, Q13=C)

Permission rules everywhere, the sandbox for unattended runs only.

- `settings.permissions.json`, merged by `bash scripts/install.sh --client
  claude-code` into this checkout's `.claude/settings.json` on every install.
  Deny: `Read` of `.env`, `.env.local`, `.env.*.local` and the named
  `.env.development|staging|production|test`, at any depth (`**/`); `git push`
  with `--force` or `-f` anywhere in the line, a `+refspec`, `--mirror`,
  `--delete` and a `:branch` delete. Ask: `git push*` (so `--force-with-lease`
  asks, it is not denied), `git -C * push*`, `git -c * push*`, and `WebFetch`.
  Lists are merged without duplicates, every other rule is kept, a second run
  changes nothing. The role guard and role rules are TASK-0271's, not here.
- `.env.example` stays readable on purpose: a deny always beats an allow, so
  the deny list names the secret-bearing files instead of `.env*`. A secret
  file under another name needs its own rule in `.claude/settings.local.json`.
- **Read rules do not stop `cat .env` through Bash.** Outside the sandbox a
  shell command reads any file the user can. Only the sandbox (unattended) and
  Vault (AGENTS.md: values never live in a `.env`) close that.
- `settings.sandbox.json`, written only by `install.sh --unattended`, to
  `.claude/settings.unattended.json` (with the same permission rules), never to
  `settings.json`. It sets `sandbox.enabled` true, `allowUnsandboxedCommands`
  false, and `sandbox.network.allowedDomains` to `gitlab.com`, `github.com`,
  `pypi.org`, `files.pythonhosted.org` and `registry.npmjs.org`. A re-run
  overwrites these scalars (a weakened `enabled: false` does not survive; 
  `--status` prints `MISSING or WEAKENED`) and keeps domains you added.
  `--unattended` exits non-zero when either fragment is missing, and when
  `~/.claude` is absent it still writes the file, says the client was skipped
  and exits non-zero. The key name `allowUnsandboxedCommands` could not be
  checked against a Claude Code settings schema in this repo; check it on the
  first live run.
- **Nothing applies the unattended file yet.** The file is produced for a
  launcher that starts Claude Code with `claude --settings
  .claude/settings.unattended.json`. No launcher does that today: the Claude
  Code binding runs as a Workflow inside an existing session, and the CI
  unattended run is the OpenCode driver. TASK-0284 (the Agent SDK runner) is
  where it gets wired. Until then sandboxing an unattended run needs the
  managed settings below.
- Under a marketplace-primary install (D2=B) the plugins do NOT carry these
  permission rules: a plugin `settings.json` is not a known way to ship them
  (TASK-0272 found nothing that applies them). `install.sh` (and
  `--unattended`) stays the writer, so a consumer that installs only the
  plugins gets no deny or ask rules from this repo.

**Recommended: managed settings.** For a host that runs unattended work, put
the `sandbox` block in the managed settings file (the organisation level,
which a project or user file cannot override) instead of relying on a flag a
launcher may forget.

**Tuning `allowedDomains`.** Too narrow a list stalls an unattended run on its
first blocked fetch, and the sandbox CI job is the check. Add the intranet
GitLab host and anything else a run needs to the `allowedDomains` of your own
`.claude/settings.unattended.json` or managed settings, not to the tracked
fragment: the intranet hostname never goes in a tracked file (AGENTS.md).

Start with these rules and tune from use: `ask` on push and `WebFetch` can
interrupt a daily flow; move a rule to `allow` in `.claude/settings.local.json`
rather than editing the fragment.

## Telemetry (`TASK-0279`, R-10)

`settings.otel.json` is the `env` block that turns on Claude Code's own
OpenTelemetry export, aimed at the OTLP/HTTP collector the gates job uses
(`tests/otel/`). **Nothing merges it: `install.sh` does not touch it.** Copy
its four variables into the `env` of the settings file you want (user
`~/.claude/settings.json` or a project `.claude/settings.json`), or export
them in the shell.

| Variable | Value | Why |
|---|---|---|
| `CLAUDE_CODE_ENABLE_TELEMETRY` | `1` | The master switch; without it nothing is exported |
| `OTEL_METRICS_EXPORTER` | `otlp` | Sends the `claude_code.*` metrics (sessions, tokens, cost, ...) |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/json` | Matches the collector's HTTP receiver on 4318 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | **A placeholder.** The real collector address is an intranet host: set it in your own untracked settings or shell, never in this file |

**Prompts are not exported.** The file sets no `OTEL_LOG_USER_PROMPTS` and no
`OTEL_LOGS_EXPORTER`; per the vendor docs, prompt text is redacted from events
unless `OTEL_LOG_USER_PROMPTS=1`. Do not set it. Any credential for an
authenticated collector (`OTEL_EXPORTER_OTLP_HEADERS`) belongs in the Vault
(ADR-0030), never in a tracked file.

**Identity attributes.** *Vendor docs, not observed here:* real metrics can
carry identity attributes such as `user.email` and `user.account_uuid`;
`OTEL_METRICS_INCLUDE_SESSION_ID`, `OTEL_METRICS_INCLUDE_VERSION` and
`OTEL_METRICS_INCLUDE_ACCOUNT_UUID` control some of them. This file sets none,
so the client's defaults apply; check what a live session sends before pointing
it at a shared collector. The replay does not model these attributes.

**What is proved, and what is not.** *Offline* (`tests/validate.sh`,
`tests/test-claude-otel.sh`): the file turns telemetry on, exports metrics,
points only at a local placeholder, enables no prompt logging and holds no
credential. *CI* (`otel-collector` job, `tests/otel/claude-code-check.sh`):
a real, pinned OpenTelemetry Collector receives `claude_code.session.count`
and `claude_code.token.usage` when the shipped settings are applied, receives
nothing when `CLAUDE_CODE_ENABLE_TELEMETRY` is removed (the job fails), and
the collector's output holds no prompt text even with the logs exporter added
(a canary prompt is visible there only when `OTEL_LOG_USER_PROMPTS=1` is
forced, which proves the detector). **The CI job drives the collector with a
replay, `tests/otel/claude_code_replay.py`, not a live Claude Code**: a job has
no binary or login. So the replay's reading of the env (flag, exporter, prompt
redaction) follows the vendor docs and has not been observed against a live
client; the first run on a real session is still owed.

## Install record — 2026-09-24 (`TASK-0090`)

`scripts/install.sh link`, exit **0**. The lines for this client, verbatim
(home directory shortened to `~`):

```
skill deployed: ansible-ops -> claude-code (link)
skill deployed: design-flow -> claude-code (link)
skill deployed: project-migration -> claude-code (link)
skill deployed: project-workflow -> claude-code (link)
skill deployed: unattended-ops -> claude-code (link)
  agent emitted: adjudicator -> claude-code (~/.claude/agents/adjudicator.md)
  agent skipped: closer -> claude-code (not in its clients list)
  agent emitted: critic -> claude-code (~/.claude/agents/critic.md)
  agent skipped: designer-manager -> claude-code (not in its clients list)
  agent skipped: gate-runner -> claude-code (not in its clients list)
  agent skipped: git-ops -> claude-code (not in its clients list)
  agent emitted: ideator -> claude-code (~/.claude/agents/ideator.md)
  agent skipped: implementer -> claude-code (not in its clients list)
  agent skipped: park-steward -> claude-code (not in its clients list)
  agent skipped: preflight -> claude-code (not in its clients list)
  agent skipped: qa-test -> claude-code (not in its clients list)
  agent skipped: refuter -> claude-code (not in its clients list)
  agent skipped: review -> claude-code (not in its clients list)
  agent skipped: run-scribe -> claude-code (not in its clients list)
  agent emitted: task-planner -> claude-code (~/.claude/agents/task-planner.md)
```

Resulting additions, from a before/after listing: `unattended-ops` in the
skills directory; `adjudicator.md` and `task-planner.md` in `~/.claude/agents/` — exactly the two of nine that declare `claude-code`. **`~/.claude/agents/designer-manager.md` was a stale file** from an earlier install: the role is OpenCode-only now, and at the time nothing removed the old emission. **Pruned 2026-09-24** by the next `install.sh link` (`TASK-0091`, `ADR-0026`): *"agent pruned: designer-manager -> claude-code (… the role no longer declares this client, ADR-0026)"* — the only file removed from either client. **Nothing is pruned**, as install.sh itself states.

## Plugins (marketplace, TASK-0272)

`.claude-plugin/marketplace.json` lists three generated plugins under
`plugins/`, one per component kind: `ai-toolbox-skills` (the skills except
`mod-dev`), `ai-toolbox-agents` (the agents emitted for `claude-code`; depends
on the skills plugin) and `ai-toolbox-gates` (the gates MCP server, wired by
`.mcp.json`). `python3 scripts/build-plugin.py` regenerates them and `--check`
fails when `plugins/` is stale; never edit `plugins/` by hand.

The plugins carry no hooks and no permission rules. The worktree hooks are this
repo's sibling-worktree rule and come from `install.sh` (a consumer repo has no
`scripts/worktree.sh`, and they would run twice); permission rules come from
`install.sh` too (see above). Skills and agents were written for an ai-toolbox
checkout, so from the plugin cache some references do not resolve (the plugin
READMEs list them).

`scripts/install.sh` stays the development and non-Claude path (link mode,
OpenCode, the worktree hooks, the permission and unattended settings merge). It
is not replaced by the plugins.
