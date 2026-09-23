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

**Currently deployed: six roles.** Design stage — `designer-manager`
(primary), `ideator`, `critic` (TASK-0043). Production stage — `qa-test`,
`review`, `git-ops` (TASK-0045). `agents/_template/` is never emitted.

**Four of the six are OpenCode-only** (`qa-test`, `review`, `git-ops`,
`designer-manager`): the first three each need a command allowlist or a
path-scoped edit, and neither has a per-agent expression in Claude Code.
`install.sh` **skips** them for that client — a clean skip with exit 0,
because their `clients` list says so, rather than a refusal.

**`designer-manager` joined that list on 2026-09-23** (`TASK-0075`, closing
`B-028`), for a different reason: it *delegates to* `git-ops`, which is
OpenCode-only. It was previously emitted for Claude Code carrying
`tools: Agent(ideator, critic, git-ops)` while that client had no `git-ops`,
and `TASK-0056` observed Claude Code says **nothing** about a dead name
inside an `Agent(...)` allowlist. **So `loops/design-brief/` is now
OpenCode-only in the registry as well as in practice** — it never worked on
the other client; it only looked as though it did. `tests/validate.sh` now
rejects any role whose delegate is not emitted for every client the caller
is.

### `git-ops` may exist twice on this machine, by design

`agent-tiers` (in `opencode-customization`) also ships a `git-ops`, written
into a **project's** `.opencode/agents/` by its `/bmad` command. This repo
emits its own into the **global** `~/.config/opencode/agents/`.

They do not collide: OpenCode resolves **project over global**, so a project
that ran `/bmad` uses that copy and every other project uses this one. Both
enforce the same boundary — git only, push asks, force-push denied.

**This is a coexistence, not a defect, and it cannot be fixed from here** —
the other copy belongs to another repo's installer (ADR-0017). If the two
ever diverge, this repo's copy governs work in this repo. Recorded so that
finding two `git-ops` files is explicable rather than alarming.

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

### The unattended-run harness is OpenCode-first — this is the reference client

`loops/unattended-run/` and `skills/unattended-ops/` (sprint S9) ship **nine
agent roles, and all nine emit here.** Seven of them emit **only** here:
`preflight`, `refuter`, `implementer`, `gate-runner`, `closer`,
`park-steward` and `run-scribe`. Only `task-planner` and `adjudicator` — the
two that only think — also reach Claude Code.

**That is not a preference for this client; it is where the enforcement
exists.** Each of the seven declares a per-agent *command* boundary, and
OpenCode's `permission` model is the only one of the three clients that can
express one (`ADR-0018` clause 8.3). Under the other clients the same method
runs on **prompt-level rules, weaker by construction**.
`skills/unattended-ops/SKILL.md` owns that reasoning and is linked rather than
restated, so it has one owner.

**Two consequences worth knowing here**, both observed rather than reasoned
(`TASK-0055`, against `opencode 1.18.31`):

- **A driver must pass `-m <provider/model>` explicitly**, or guarantee a
  configured default. With neither, `opencode run` **hangs indefinitely — no
  output, no error, no exit** — which is what a nightly run would do at 3am
  with nothing in the log.
- **Every role the driver invokes must be `mode: primary`.** A
  `subagent`-mode role is not refused: it is **silently replaced by the
  default agent**, which answers with well-formed stdout and exit 0.

> **Nothing runs unattended yet, on this client either.** The loop, the skill
> and the roles are the portable core; **every binding is S10**, and none
> exists.

Extensions that are **not components of this repo** and are wired through
the client's own mechanism (`ADR-0021` clause 2). Nothing here is installed,
deployed, linked, emitted or pruned by `scripts/install.sh`.

`tests/validate.sh` checks that this file **exists**; it cannot check that
anything below is true (`ADR-0009`). Every claim is therefore labelled
either *vendor doc* or *observed*, with a date and a version.

### ponytail

`@dietrichgebert/ponytail`, MIT, **4.10.0** — version and license re-checked
on npm 2026-09-23. A prompt ruleset that biases an agent toward the smallest
solution that works, plus six Agent Skills and six `/ponytail` commands.

**This repo does not install ponytail** and does not vendor it (`ADR-0021`
clauses 3 and 4).

**Mechanism here: an npm plugin entry.** *Vendor doc, README 2026-09-23.*

```json
{ "plugin": ["@dietrichgebert/ponytail"] }
```

Upstream documents this for a project's `opencode.json`; the same key works
in the global `~/.config/opencode/opencode.jsonc` this repo targets
elsewhere. A checkout can be used instead, and upstream notes the `./` path
resolves against the project's `opencode.json`, so an absolute path is what
shares one checkout across projects:

```json
{ "plugin": ["./.opencode/plugins/ponytail.mjs"] }
```

**The npm entry resolves — stated precisely.** The package's `main` and both
`exports` point at `./.opencode/plugins/ponytail.mjs`, a path inside a
dotfile directory, which raised a real doubt about whether it survives into
the published tarball. It does: the file ships, and a real
`npm install @dietrichgebert/ponytail@4.10.0` followed by the dynamic
`import()` that OpenCode's npm-plugin loading performs returned successfully
(`TASK-0048` Q3, 2026-09-22; `main`/`exports` and the file's presence
re-confirmed 2026-09-23).

> **This is package-resolution evidence, not an observed in-client load.**
> The stronger claim was not obtainable: `TASK-0048` put the entry in a live
> `opencode.jsonc` and started OpenCode twice, and **no plugin log line
> appeared for ponytail *or* for the pre-existing, working
> `opencode-arcade-hub`** — so the silence was uninformative rather than a
> negative result, and `~/.cache/opencode/node_modules` was never created.
> `ADR-0021` clause 6 asks for the honest version over the confident one.

**What it adds:** the ruleset is injected each turn at the active level,
plus six commands (`/ponytail`, `-audit`, `-debt`, `-gain`, `-help`,
`-review`) from `.opencode/command/*.md`, and the `lite`/`full`/`ultra`/`off`
levels. Upstream notes OpenCode also auto-loads its `AGENTS.md`, so the
rules apply even without the plugin — the plugin is what adds the levels.

**Why the six skills are not vendored into `skills/`.** Two independent
reasons, neither a matter of taste:

- `scripts/install.sh` deploys skills with `ln -sfn`, so a vendored copy
  would be a symlink into this repo's working tree — making this repo
  maintainer-of-record for independently-shipping upstream content
  (`ADR-0004`'s three-copies problem).
- **They would fail this repo's own gate.** All six declare
  `description: >` — a folded scalar. `tests/validate.sh` rejects the bare
  block sigil for skills outright, because the registry renders the sigil
  and drops the text (the defect `TASK-0039` found). *Observed 2026-09-23
  against the 4.10.0 tarball.* Upstream is not wrong to write them that way;
  they are simply not authored to this repo's registry constraint.

**State it writes outside the plugin entry**, which nothing here creates or
prunes (*vendor doc, README 2026-09-23*): `~/.config/ponytail/config.json`
(`%APPDATA%\ponytail\config.json` on Windows) for an optional `defaultMode`,
also settable via the `PONYTAIL_DEFAULT_MODE` environment variable; plus
`~/.claude/.ponytail-active`, `~/.cursor/.ponytail-active` and
`~/.cursor/hooks.json` entries if you installed for those clients too.
Upstream ships `node scripts/uninstall.js` for them.

**Adding the plugin entry is your edit, not this repo's.** `install.sh`
never writes to `opencode.jsonc` — the same line agent emission holds, where
role files are written but no `agent` key is ever added.

## MCP servers

> **Not every server has a subsection here, and that is a rule rather than an
> omission.** One is owed only when a server declares a required environment
> variable, a destructive capability, or a launch a client cannot perform from
> the manifest alone — the rule, its reasoning and the worked exemption are in
> [the authoring guide](../../docs/development/authoring-guide.md). The first
> two conditions are enforced by `tests/validate.sh`. **graphify is exempt**:
> it declares neither, and `scripts/install.sh` already prints its launch
> command, transport and preconditions from the manifest. Its OpenCode-native
> surface (`graphify opencode install`) is a **separate** question from MCP
> wiring — see Third-party extensions above. (`TASK-0073`, closing `B-023`.)

Add to `~/.config/opencode/opencode.json` (or `opencode.jsonc`).
`scripts/install.sh` prints each server's launch command from its manifest.

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
> off in the upstream server: the config below starts a server that exposes
> all ten tools, and you can re-enable `ansible_navigator` yourself at any
> time. What this section reduces is *default* exposure, by telling you not
> to.
>
> **OpenCode-specific note:** a plugin's `tool.execute.before` hook **can**
> intercept and block an MCP tool call, verified on `opencode 1.18.31`
> (`TASK-0028`). The tool ID is server-prefixed with a single underscore —
> `ansible_ansible_navigator`, **not** `mcp__ansible__ansible_navigator`,
> which is Claude Code's scheme. That is a genuine enforcement route if you
> want one, but **this repo ships no such plugin** and declined to
> (`ADR-0016`): the two clients disagree on the tool's name, so the guard
> would not be portable. Note also that under `experimental.codeMode` MCP
> tools are not registered individually and per-tool hooks do not fire.
>
> **`WORKSPACE_ROOT` bounds filesystem reach only — it is not the blast
> radius for every tool.** It bounds `ansible_lint --fix`,
> `create_ansible_projects` and `define_and_build_execution_env`'s file
> writes. It does **not** bound `ansible_navigator`, which reaches **remote
> managed infrastructure**, nor `ade_setup_environment`, which installs OS
> packages **system-wide**. Set it to the project directory, never `$HOME`
> or `/` — and note that nothing in the MCP handshake validates the value
> (`TASK-0017`).

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
