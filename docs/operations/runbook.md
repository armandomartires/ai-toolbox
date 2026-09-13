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

Status: **`mcp-servers/ansible` has now passed this procedure**
(2026-09-13, TASK-0017). It is kept as the reference procedure for the next
server, and because it caught a real defect — see step 7.

**1. Add the server entry.** LM Studio is installed Windows-side, so from
WSL the file is at `/mnt/c/Users/<user>/.lmstudio/mcp.json` (in the app:
Program ▸ Install ▸ Edit `mcp.json`). Back it up first, then paste the
`ansible` block from `configs/lm-studio/README.md` — copy it from there
rather than retyping, so the pinned version stays correct.

**2. Replace `WORKSPACE_ROOT` before starting the app.** A separate step
because skipping it is not hypothetical: the first run of this procedure
left the placeholder in place and the server connected and enumerated every
tool regardless. **Nothing in the connection validates this value** — the
handshake and tool listing never touch the filesystem.

Use an **absolute** path to a real project directory. This is the server's
blast radius: it executes playbooks (`ansible_navigator`), installs OS
packages (`ade_setup_environment`), and rewrites files in place
(`ansible_lint --fix`). Never `$HOME`, never `/`. Verify the path exists
before continuing:

```
ls -d /your/chosen/workspace     # must succeed
```

**3. Restart LM Studio.** It reads `mcp.json` at startup; an edit made
while running may not be picked up.

**4. Check the tool list.** Open a chat with any loaded model and look at
its tools/integrations panel, or simply ask the model what tools the server
provides. A **pass** is the server present *and* its named tools
enumerated.

**5. Interpret what you see.** These are genuinely different outcomes:

| Observation | Meaning |
|---|---|
| Server listed, tools enumerated | **Pass.** Record it. |
| Server listed, zero tools | Connected but tool discovery failed. Not a pass. |
| Server absent | Config not read, or JSON invalid. Validate the file parses. |
| Error/red indicator | Launch failed — usually `npx` not on the app's PATH. A desktop app does not inherit your shell's PATH. |

Expect the tool **count** to differ by one from the repo's figure if the
server exposes a meta-tool: ansible exposes 10, of which
`list_available_tools` enumerates the other 9, so a model asked to list
"available tools" reasonably reports 9. Reconcile before assuming drift.

**6. Record the result — pass or fail.** Update the `Verified` row in
`configs/lm-studio/README.md` and the verification note at the end of its
ansible section. A failure is a legitimate, useful outcome: it would mean
this repo's LM Studio wiring is wrong, which is worth knowing. Do not
overwrite the existing handshake-level evidence; add to it.

**7. Re-check `WORKSPACE_ROOT` after a pass.** Not redundant with step 2 —
this is the step the first run of this procedure needed and did not have.
A pass proves the server *connects*; it proves nothing about the value,
because a nonexistent `WORKSPACE_ROOT` produces an identical-looking pass.
Confirm the path in the live `mcp.json` is the one you intended and that it
exists.

**8. Restore `mcp.json` if this was only a test.** If you do not intend to
keep the server wired, restore your backup — and say so in the record, so
the next reader knows the file's state.

## Verifying remote branch state

`tests/validate.sh` is hermetic and never queries a remote (ADR-0007,
ADR-0009), so no local gate can confirm a claim about GitHub's state. Check
it directly:

```
git ls-remote --symref origin HEAD    # which branch the remote's HEAD points at
git ls-remote --heads origin          # every branch that actually exists
git branch -vv                        # local branches and what they track
```

Current state (verified 2026-09-13): one branch, `master`, and
`default_branch` is `master`. There is no `main`.

**The `auto_init: false` trap.** When creating a repo via the API without
`auto_init`, the response's `default_branch` field reports the *account's
default branch name preference* — typically `main` — even though no ref
exists yet. It describes an intention, not a state. The first branch you
push to an empty repo becomes the default automatically.

TASK-0019 exists because that field was read as fact, producing a
"default-branch mismatch" follow-up for a branch that never existed. If a
rename had been attempted, it would have failed against a nonexistent ref.
When a claim concerns state outside this repo, run one of the commands above
before recording it — and again before acting on it.

## Human approval required for
- Destructive tool capabilities in MCP servers.
- Deleting or rewriting components (see AGENTS.md).
- Publishing the repo, or changing remote visibility. `origin` is private
  (TASK-0015); making it public is not meaningfully reversible.
