# Operations Runbook

## Environments
- Development: Windows 11 + WSL; local repo; quick/unit tests.
- Deployment targets (no staging/production web tier for this repo):
  local agent clients (`~/.claude/skills`, OpenCode, LM Studio config)
  and lab machines, via `scripts/install.sh`.

## Environment variables
`.env.example` is the committed template. Copy it to `.env` (gitignored) or
export the variables from your shell profile — nothing in the repo loads
`.env` automatically.

| Variable | Needed for | Required? |
|----------|-----------|-----------|
| `GITHUB_URL` | pushing to the remote | only to push |
| `GITHUB_TOKEN` | creating/pushing to the remote (`repo` scope) | only to push |
| `GITLAB_URL` / `GITLAB_TOKEN` | a GitLab mirror; unused by any script today | no |
| `WORKSPACE_ROOT` | the ansible MCP server (`mcp-servers/ansible/server.json`) | to run that server |

Rules that are enforced, not merely advised:

- **`.env.example` carries names and meanings, never values.** Same rule as
  a manifest's `environment` block (ADR-0009).
- **`tests/validate.sh` asserts every `required` variable in any
  `server.json` appears in `.env.example`**, so a new server cannot add a
  requirement nobody can discover. It checks *documentation*, not whether a
  variable is set — a presence check would fail on every fresh clone and in
  CI, and a gate that cannot pass on a clean checkout stops being run.
- **Nothing here is needed to validate or develop locally.** `validate.sh`
  passes with the whole file empty.
- **Never put a token in a remote URL.** `git remote -v` must stay
  token-free; authenticate the push instead.

## Procedures
- Run locally: clone on WSL; `bash scripts/install.sh link` (deploys
  skills to every installed client; clients whose config dir is absent are
  skipped, not created).
- Deploy to one client: `bash scripts/install.sh link --client opencode`
  (or `claude-code`). `copy` instead of `link` for checkouts without
  symlink support (ADR-0002).
- Validate: `bash tests/validate.sh`.
- Regenerate index after component changes: `bash scripts/sync-registry.sh`.
- Smoke-test MCP servers: `bash tests/smoke-mcp.sh` (all) or
  `--server <name>` (one); `--timeout <seconds>` to adjust the per-server
  bound (default 90).
- Add an MCP server to a client: see configs/<client>/README.md.
- Roll back: `git revert` the component's commit, re-run install.sh.

## Pre-commit gate
`scripts/install.sh` activates the tracked hook with
`git config core.hooksPath .githooks`. From then on `tests/validate.sh`
runs before every commit and blocks a failing one.

- Bypass: `git commit --no-verify` — legitimate for work-in-progress, a
  scratch branch, or fixing the gate itself. Not for dodging a real
  failure.
- Hooks are tracked in `.githooks/`, not `.git/hooks/`, so they are
  version-controlled and survive a fresh clone. `.git/` is not.
- The hook runs **only** `validate.sh` (offline, sub-second).
  `tests/smoke-mcp.sh` must never be added: it fetches upstream packages
  and would make every commit slow and offline-hostile.
- **Removing the hook takes two steps.** `git revert` of the commit that
  added it does not deactivate it, because `core.hooksPath` lives in
  `.git/config`, which is not version-controlled. Also run
  `git config --unset core.hooksPath`.
### The `core.filemode=false` trap

On a WSL `/mnt/c` checkout `core.filemode` is `false`, and the 9p mount
reports every file `rwxrwxrwx` while silently ignoring `chmod -x`. The
consequence is worth stating precisely, because the obvious fix does not
work and the symptom does not appear where the cause is:

- `chmod +x` **never reaches git's index** here. It appears to succeed.
- The hook still runs fine *locally* — git invokes it through the OS and
  the mount claims it is executable. Nothing looks wrong.
- If git recorded the mode as `100644`, the hook is **silently ignored on
  any machine that honours the executable bit**. The gate does not error;
  it simply never fires.

So the bit that matters is the one git *records*, not the one the
filesystem reports:

```
git update-index --chmod=+x .githooks/pre-commit   # the fix that works
git ls-files -s .githooks/pre-commit               # verify: expect 100755
```

Two places check this, deliberately:

| | When | Behaviour |
|---|---|---|
| `scripts/install.sh` | first script a fresh clone runs | **warns**, names the fix, and adds the `chmod`-won't-work note when `core.filemode=false`. Advisory: never exits non-zero, never mutates the index. |
| `tests/validate.sh` | every commit, via the hook | **fails**. Authoritative. |

`validate.sh` checks the recorded mode rather than `[ -x ]` for the same
reason: on this mount `[ -x ]` can never fail, making it a check incapable
of detecting its own failure case.

## Skill deployment targets
| Client | Skills target | Deployed by install.sh |
|--------|---------------|------------------------|
| Claude Code | `~/.claude/skills/` | yes |
| OpenCode | `~/.config/opencode/skills/` | yes |
| LM Studio | none (no Agent Skills target) | no — MCP config only |

`install.sh` replaces a client-side skill only when this repo owns a skill
of that name, and announces replacing any pre-existing real directory.
Skills the repo does not own (e.g. `agent-tiers` under OpenCode) are never
touched. Every client in `install.sh`'s list must have a
`configs/<client>/README.md`; `tests/validate.sh` enforces the pairing.

## Verifying an MCP server
`tests/validate.sh` checks manifests **statically** — required keys, valid
JSON, name/directory match, destructive capabilities carrying a granted
authorization. It never launches anything.

`tests/smoke-mcp.sh` checks a server **dynamically**: it launches
`launch.command` from the manifest, sends a JSON-RPC `initialize` request
over stdio, and asserts the reply carries `protocolVersion` and a non-empty
`serverInfo.name`, which it prints as evidence.

Deliberately separate, because the two have different properties:

| | validate.sh | smoke-mcp.sh |
|---|---|---|
| Network | never | required (launchers fetch upstream) |
| Runtime | ~0.3s | tens of seconds per server |
| Mandatory gate | yes (Definition of done) | no — run when server wiring changes |

Reading the outcomes:
- **PASS** — started and spoke MCP correctly.
- **FAIL** — started but did not speak MCP correctly. A real defect;
  exit code 1.
- **SKIP** — could not attempt (launcher absent, unsupported transport,
  required env unset). **Not a pass**; exit code stays 0, and the summary
  says so explicitly. Do not read a run of all-SKIP as success.

Only `initialize` is ever sent. Tools are never invoked — ansible's surface
includes playbook execution and OS package installation, and a smoke test
must never be the thing that runs a playbook.

## Verifying an MCP server in LM Studio's UI (human procedure)

The one verification step no script can perform. `tests/smoke-mcp.sh`
proves a server *speaks MCP*; it cannot prove LM Studio **lists the
server's tools in its own interface**, because that needs the desktop GUI
running. This procedure exists so that gap is closeable on demand rather
than rediscovered each sprint (TASK-0016).

Current state: `mcp-servers/ansible` is verified at config + handshake
level only — see `configs/lm-studio/README.md`. The live
`~/.lmstudio/mcp.json` contains `{"mcpServers": {}}`; TASK-0006 restored it
byte-for-byte after testing, so **the entry must be added before anything
can appear in the UI.**

**1. Add the server entry.** LM Studio is installed Windows-side, so from
WSL the file is at `/mnt/c/Users/<user>/.lmstudio/mcp.json` (in the app:
Program ▸ Install ▸ Edit `mcp.json`). Back it up first, then paste the
`ansible` block from `configs/lm-studio/README.md` — copy it from there
rather than retyping, so the pinned version stays correct.

Set `WORKSPACE_ROOT` to an **absolute** path of a real project directory.
This is the server's blast radius: it executes playbooks and installs
packages. Never `$HOME`, never `/`.

**2. Restart LM Studio.** It reads `mcp.json` at startup; an edit made
while running may not be picked up.

**3. Check the tool list.** Open a chat with any loaded model and look at
its tools/integrations panel. A **pass** is `ansible` present *and*
expandable to show named tools (`ansible_lint`, `ansible_navigator`, and
so on — 10 were seen on this machine via the handshake).

**4. Interpret what you see.** These are genuinely different outcomes:

| Observation | Meaning |
|---|---|
| Server listed, tools enumerated | **Pass.** Record it. |
| Server listed, zero tools | Connected but tool discovery failed. Not a pass. |
| Server absent | Config not read, or JSON invalid. Validate the file parses. |
| Error/red indicator | Launch failed — usually `npx` not on the app's PATH. A desktop app does not inherit your shell's PATH. |

**5. Record the result — pass or fail.** Update the `Verified` row in
`configs/lm-studio/README.md` and the "Not verified" note at the end of its
ansible section. A failure is a legitimate, useful outcome: it would mean
this repo's LM Studio wiring is wrong, which is worth knowing. Do not
overwrite the existing handshake-level evidence; add to it.

**6. Restore `mcp.json` if this was only a test.** If you do not intend to
keep the server wired, restore your backup — and say so in the record, so
the next reader knows the file's state.

Note on scope: a pass here would also let Phase 2's second exit criterion
("one MCP server wired and verified in all three clients") close fully; it
is currently recorded as *partly met*. That wording should only change once
this procedure has actually been run.

## Human approval required for
- Destructive tool capabilities in MCP servers.
- Deleting or rewriting components (see AGENTS.md).
- Publishing the repo, or changing remote visibility. `origin` is private
  (TASK-0015); making it public is not meaningfully reversible.
