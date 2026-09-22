# Bionic (LM Studio) wiring

Snapshot of how this repo's components are wired into **Bionic**, LM
Studio's agent-oriented workspace. Sources of truth live elsewhere and win
any disagreement: `mcp-servers/*/server.json` for MCP servers.

## Which app this is

Bionic is a **separate application** from the classic LM Studio local-LLM
desktop app, and it is LM Studio's own product.
`~/AppData/Local/Programs/Bionic/resources/app/package.json`, re-read
2026-09-22:

```json
{ "name": "lm-studio", "productName": "Bionic",
  "desktopName": "ai.elementlabs.bionic", "version": "1.1.3+5",
  "author": { "name": "LM Studio <team@lmstudio.ai>", "url": "https://lmstudio.ai" } }
```

**Version drift, recorded rather than smoothed over.** `TASK-0047` observed
**1.1.1+5** here on 2026-09-15; the app has updated itself since. `ADR-0020`
still says 1.1.1+5 **on purpose** — it is a dated record, not a live status
page, and this is precisely the risk it accepted for itself: *"Every
observation here is version-stamped, and the paths may move. The mitigation
is the stamp, not a promise of stability"* (`ADR-0020:207-210`). The stamp is
what made this cheap to catch. Re-read this block before trusting any
version-specific claim below.

It has its own binary (`Bionic.exe`), its own Electron profile
(`AppData/Roaming/Bionic/`), its own update feed
(`bionic-updates.lmstudio.ai`, channel path `.../update/bionic/win32/x86/`),
and its own bundle directory (`.webpack-bionic`, where classic uses
`.webpack`). It shares the `~/.lmstudio` data root and namespaces its own
state under `~/.lmstudio/apps/bionic/`.

**Classic LM Studio is still installed alongside it** — version **0.4.24**
at `C:\Program Files\LM Studio\LM Studio.exe`. The two are tracked
separately in `~/.lmstudio/.internal/historical-version-info.json`
(`targetHistories: [{"target": "lmstudio", "lastRecordedAppVersion": "0.4.24"}]`).

This repo models the pair as **one client entry**, named for Bionic, because
Bionic is the agentic successor and the only one of the two this repo has
reason to target. The split is recorded here so a future reader can reopen
that choice rather than rediscover the fact.

| | |
|---|---|
| Client | Bionic **1.1.3+5** (LM Studio) — re-read 2026-09-22; was 1.1.1+5 at `TASK-0047` |
| Skills target | `~/.lmstudio/skills/` (global) · `<project>/.agents/skills/` (project) |
| Skills deployment | **not automated** — global installs are approval-gated (see below); Bionic is not in `scripts/install.sh` |
| Agents target | none documented as of 2026-09-15 — Bionic has subagents, but no user-authored agent-role directory was found |
| MCP config | `~/.lmstudio/mcp.json` — **currently `{"mcpServers": {}}`**, re-read 2026-09-22; see below |
| Verified (MCP) | classic LM Studio 0.4.24: **fully verified** 2026-09-13 (TASK-0006, TASK-0017). **Bionic: not verified at any version** — neither 1.1.1+5 nor 1.1.3+5 — see below |

## Skills — supported, but not auto-deployed

**This supersedes ADR-0006's finding that this client has no Agent Skills
target.** It does. ADR-0020 records the correction; the short version is
that the repo previously checked `~/.lmstudio/hub/skills/`, which is a *hub
cache* (its siblings are `hub/models` and `hub/presets`), not the skills
directory.

Bionic documents the real paths itself, in a bundled skill at
`~/.lmstudio/.internal/skills/skill-management/SKILL.md:23-25`:

> "In Bionic, skills are folders that contain at least one `SKILL.md` file...
> All global skills are located in the `~/.lmstudio/skills` folder and are
> available to all projects. Project skills are located in each project's
> `.agents/skills` folder."

So:

- **Global skills** — `~/.lmstudio/skills/<skill-name>/SKILL.md`. Exists and
  is empty on this machine. The same file notes a rare legacy location for
  very old installations, `~/.cache/lm-studio/skills`.
- **Project skills** — `<project-folder>/.agents/skills/<skill-name>/SKILL.md`.

Bionic's frontmatter schema, from the same source: `name` (required,
kebab-case, 1-63 chars, no leading/trailing/consecutive hyphens),
`description` (required), `display-name` (optional), and two invocation
gates — `disable-model-invocation` and `user-invocable`. Unknown fields are
ignored, so this repo's skills are schema-compatible.

### Why `install.sh` still does not deploy here

Not because the target is missing — because the vendor forbids writing to it
directly. `skill-management/SKILL.md:31`:

> "DO NOT edit global skills directly. If you need to install a new skill,
> you must prepare it in the scratchpad and then use the following tools to
> install it."

Global installs go through a `skill.install` tool call that prompts the user
for approval. That is incompatible with `install.sh`'s symlink-or-copy
model, which is non-interactive and idempotent by design. Project skills
under `.agents/skills/` *are* ordinary files and could be written directly.

Wiring that up is a real option, not a dead end, and is tracked as a
backlog item rather than assumed here. Until it exists, Bionic stays absent
from `install.sh`'s client list and therefore exempt from the
`configs/<client>/README.md` pairing `tests/validate.sh` enforces for
deployable clients — it keeps this snapshot anyway.

## Agents — Bionic is agentic; no user-authored role directory found

The previous version of this file claimed this client "supplies models and
performs no agentic work, so it has nothing an agent role would configure."
**That is false and has been removed.** Bionic's main bundle contains
subagent identifiers:

```
lmstudio/exploration-subagent-v1
lmstudio/coder-yolo-subagents
lmstudio/coder-v0-yolo-subagents
```

alongside projects, per-session transcripts (`ng-sessions.sqlite`), a
permissions store, a `bionic_tool` dispatch mechanism, and a
`bionic-skills-onboarding-v2` UI-state flag.

What has **not** been established is a directory where a user authors their
own agent roles, of the kind `~/.claude/agents/` and
`~/.config/opencode/agents/` are. Bionic's subagents appear to be built-in
and named internally. So this repo emits no agent roles here — but the
reason is now *"no documented authoring surface found"*, which is a
findable gap, and no longer *"the client does nothing agentic"*, which was
simply wrong.

Applying ADR-0006's own evidence bar in the direction it points: reopen this
if Bionic's documentation describes a user-agent directory. Do not infer one
from a directory name — that inference is exactly what produced the
`hub/skills` error corrected above.

## MCP servers

Bionic reads `mcp.json`. On this machine it lives at
`/mnt/c/Users/<user>/.lmstudio/mcp.json` — the app is installed
Windows-side; WSL has no `~/.lmstudio`.

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
> **This is advisory, not enforced — and least enforceable here.** Nothing in
> this repo can switch a tool off in the upstream server, and this client is
> configured by hand through a GUI-adjacent JSON file with no hook or plugin
> mechanism this repo has verified. The config below starts a server exposing
> all ten tools. What this section reduces is *default* exposure, by telling
> you not to enable it.
>
> **`WORKSPACE_ROOT` bounds filesystem reach only — it is not the blast
> radius for every tool.** It bounds `ansible_lint --fix`,
> `create_ansible_projects` and `define_and_build_execution_env`'s file
> writes. It does **not** bound `ansible_navigator`, which reaches **remote
> managed infrastructure**, nor `ade_setup_environment`, which installs OS
> packages **system-wide**. Set it to the project directory, never `$HOME`
> or `/`. **This client is where that trap was actually sprung:** the live
> `mcp.json` carried the literal placeholder path and everything connected
> anyway (see the verification section below).

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

> **Replace `WORKSPACE_ROOT` before starting the app.** The sentinel above
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
- Use an **absolute** `WORKSPACE_ROOT`. This is a desktop app, so a
  relative `"."` resolves against the app's working directory, not a
  project you chose.
- Upstream declares `node>=24.0`; runs on node 22 with an `EBADENGINE`
  warning, because npm `engines` is advisory unless `engine-strict` is set.
  Tested on node v22.23.2.
- **Verified against classic LM Studio 0.4.24** (2026-09-13, TASK-0006),
  with one limitation stated plainly: the `mcpServers` schema above is the
  app's own — confirmed against the real `~/.lmstudio/mcp.json`, which
  already contained `{"mcpServers": {}}`. The entry was written into that
  live file, parsed clean, and the file was then restored byte-for-byte
  (md5 verified). Separately, the exact `command` + `args` + `env` above
  were run directly and completed a real MCP `initialize` handshake,
  returning `serverInfo: {"name": "ansible-mcp-server"}` with `tools` and
  `resources` capabilities.
- **UI verification: PASS against classic LM Studio 0.4.24** (2026-09-13,
  TASK-0017). The server activates and shows under the message in chat, and
  a loaded model (`qwen3.8 27b`) enumerated its tools on request.

### Bionic MCP status: inferred, not verified

**Attribution matters here.** The two verifications above were performed on
2026-09-13, before Bionic was identified as a distinct app, and classic LM
Studio 0.4.24 is installed on the same machine. They are credited to
classic, not to Bionic. Nothing in this repo has verified the ansible server
inside **Bionic**.

What is known. The structural facts were observed 2026-09-15 and re-checked
2026-09-22; the **contents** changed in between and are corrected below.

- Only one MCP config exists: `~/.lmstudio/mcp.json`. Bionic has no
  `mcp.json` of its own and keeps no MCP state under
  `~/.lmstudio/apps/bionic/.internal/`. **Still true** (re-checked
  2026-09-22).
- Both binaries contain exactly one `'mcp.json'` string literal, and both
  also contain a `ng-mcp.json` literal — a next-generation path. **No
  `ng-mcp.json` exists on disk** (re-verified 2026-09-22), so it remains
  dormant, but the picture around it has moved — see the managed-credentials
  note below.

**Corrected 2026-09-22 — the live `mcp.json` is empty.** This file
previously recorded, in the present tense, that `~/.lmstudio/mcp.json` held
the `ansible` entry with a real `WORKSPACE_ROOT`. It does not:

| Artifact | mtime | Contents |
|---|---|---|
| `~/.lmstudio/mcp.json` | 2026-09-17 20:00:29.567 | `{"mcpServers": {}}` |
| `~/.lmstudio/credentials/mcp-oauth/` | 2026-09-17 20:00:29.663 | empty |
| `~/.lmstudio/.internal/last-synced-mcp-state.json` | — | `{"mcpServers": {}}` |
| `~/.lmstudio/mcp.json.bak` | 2026-09-13 15:27 | `{"mcpServers": {}}` |

**Nothing in this repo did this.** `TASK-0047:184` put touching the live
`~/.lmstudio/mcp.json` out of scope, and nothing since has claimed it.
`mcp.json` and `credentials/mcp-oauth` were written **within the same tenth
of a second**, and the app's own `last-synced-mcp-state.json` agrees the
config is empty. That is an application writing its own state, not a hand
edit — the same inference shape this section already used on 2026-09-13,
running the other way.

**The cause is not established, and is not guessed at here.** One candidate
has a matching date: the 1.1.1+5 → 1.1.3+5 upgrade, whose changelog entry
names *organization-managed MCPs*. That is a hypothesis with a coincident
timestamp, not a finding. Establishing it needs the GUI and a human.

Two consequences worth stating:

- **The runbook's step 1 is now load-bearing.** "Back it up first, then paste
  the `ansible` block" is no longer a precaution against an entry that is
  already present — the file is empty, so the GUI verification below cannot
  begin without it.
- **This does not weaken the inference that Bionic reads this file.** An
  empty config is evidence in neither direction. The status is unchanged:
  inferred, not verified.

**A managed-credentials directory appeared after ADR-0020 was written.**
`~/.lmstudio/credentials/ng-mcp-managed-oauth/` exists, created **2026-09-16
01:17** — the day after `ADR-0020`, which is why that ADR names only
`ng-mcp-oauth`. It is empty. `ng-mcp-oauth` is also still empty and still
untouched since 2026-07-22, while `credentials/mcp-oauth` now carries the
2026-09-17 mtime above rather than its original 2026-09-13 21:53:06.

A *second*, managed credential channel appearing on a machine whose app then
cleared its MCP config is the "finding it live is a real result" case the
runbook already tells the next reader to watch for. Recorded here; not acted
on.

So Bionic almost certainly reads `~/.lmstudio/mcp.json`. That is a **strong
inference from a shared data root and a dormant alternative, not a
verification**: no Bionic-side artifact records loading it
(`AppData/Roaming/Bionic/logs/main.log` has zero `mcp` mentions in 240
lines).

Do not "upgrade" this to verified without a GUI check. The procedure is in
`docs/operations/runbook.md`; it is a human action. If a future reader finds
`ng-mcp.json` in use, that changes the config path and this section is where
to record it.

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
is a Windows-style path with a drive letter, which is correct — this is a
Windows app. A WSL-side check must translate `C:/…` to `/mnt/c/…` and test
for existence; a naive POSIX `isabs()` call reports `False` on a drive-letter
path and would wrongly flag a valid value.

The lesson worth keeping:

- Connection success is **not** evidence that `WORKSPACE_ROOT` is valid.
  Nothing in the handshake or tool enumeration touches the filesystem.
- `WORKSPACE_ROOT` bounds **filesystem** reach — `ansible_lint --fix` and
  `create_ansible_projects`. An invalid value fails at the moment a
  destructive tool runs, which is the worst time to find out.
  **Corrected by `TASK-0026`:** this bullet previously named
  `ansible_navigator` and `ade_setup_environment` as bounded by it. They are
  not — the first reaches remote infrastructure, the second installs packages
  system-wide. An invalid `WORKSPACE_ROOT` would not have contained either.
- The guidance above was already correct ("use an absolute path", "never
  `$HOME` or `/`") and was still pasted past. Prose was not the fix; the
  placeholder is now an implausible sentinel so an unedited paste is
  obvious.
- Verifying a *value* is a separate act from verifying a *connection*. Step 7
  of the runbook procedure exists because of this finding.
