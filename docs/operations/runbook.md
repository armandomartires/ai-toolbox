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
- The hook runs **only** `validate.sh` — offline, and sub-second *on a
  native filesystem* (~570 ms). On a `/mnt/c` WSL checkout expect ~1000 ms:
  the Windows filesystem bridge, not the checks. `validate.sh`'s own cost
  comment owns these numbers and explains why you should measure on a
  native path before concluding a check is expensive.
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

## One worktree per agent session

**Two agent sessions must never share this checkout.** A git index is a
single mutable resource with no locking between sessions, so the failure mode
is not a merge conflict — it is **one session committing another's
half-finished work**, which no gate here can detect. It has happened: see
`ADR-0023` for the two occurrences and the decision.

The main checkout stays on `master` and is the **integration tree**. Each
session works in its own worktree on its own branch.

```bash
scripts/worktree.sh add s9        # create (or report) a session worktree
scripts/worktree.sh list          # every worktree, main checkout marked
scripts/worktree.sh remove s9     # refuses if work would be lost
```

Worktrees are created as **siblings** of the repo, in
`../ai-toolbox-worktrees/<name>`, on branch `agent/<name>`. Never put one
inside the repo: `tests/validate.sh` and `scripts/sync-registry.sh` glob
component directories and `git status` would see the nested tree.

### Landing work

Git refuses to check out the same branch in two worktrees, so a session
cannot commit on `master` directly. It lands instead:

```bash
git fetch origin
git rebase origin/master          # replay this session's commits on top
git push origin HEAD:master       # land them; master stays linear
```

**This preserves `AGENTS.md`'s "one task = one commit" rule.** `master` still
receives one commit per task, still linear, still gated — the only added step
is the rebase. A rejected push means `master` moved; rebase again. There is no
PR or review step, deliberately (`ADR-0007` keeps this repo trunk-based).

Then remove the worktree. These are for isolation, not for parallel
development, so they should be short-lived:

```bash
scripts/worktree.sh remove s9
```

`remove` refuses while the worktree has uncommitted changes or commits not
yet on `origin/master`, and says which.

### The gate runs in a worktree — verify it, don't assume it

`core.hooksPath` is `.githooks`, shared across worktrees and resolved inside
each, so `.githooks/pre-commit` runs there and **refuses a bad commit**
exactly as it does here. `worktree.sh add` reports the gate's state for the
new worktree and says so when it is not runnable as a bare path.

> **Why `worktree.sh` tests the gate by running it rather than with `-x`:**
> on `/mnt/c` (DrvFs) every file reports mode `0777` regardless of what git
> records, so `-x` cannot tell the truth here. `core.filemode` is `false` for
> the same reason. Until 2026-09-23 every script in this repo was recorded
> `100644`, which nothing noticed because the hook and CI both invoke
> `bash tests/validate.sh` — but a worktree on a real Linux filesystem got
> `Permission denied`, exit 126. Fixed by `TASK-0070` with
> `git update-index --chmod=+x`; a plain `chmod` is invisible while
> `core.filemode` is `false`.

### A worktree on the Linux filesystem is roughly twice as fast

The gate costs about 570 ms on a native filesystem and about 1000 ms on a
`/mnt/c` checkout — the Windows filesystem bridge, not the checks
(`tests/validate.sh:306-314` owns those numbers). Placing a worktree under
`~/` instead of `/mnt/c` halves that, at the cost of the tree not being
visible to Windows tools. Both work; pick per session.

## Skill deployment targets
| Client | Skills target | Deployed by install.sh |
|--------|---------------|------------------------|
| Claude Code | `~/.claude/skills/` | yes |
| OpenCode | `~/.config/opencode/skills/` | yes |
| Bionic (LM Studio) | `~/.lmstudio/skills/` global · `<project>/.agents/skills/` project | no — global installs are approval-gated (ADR-0020) |

`install.sh` replaces a client-side skill only when this repo owns a skill
of that name, and announces replacing any pre-existing real directory.
Skills the repo does not own (e.g. `agent-tiers` under OpenCode) are never
touched. Every client in `install.sh`'s list must have a
`configs/<client>/README.md`; `tests/validate.sh` enforces the pairing.

## Wiring the `gather_subset` guard into a consuming Ansible repository

`skills/ansible-ops/scripts/gather_subset_guard.py` is a custom
`ansible-lint` rule (`gather-subset-mounts`). It refuses a play that gathers
facts against a hazard-class host without excluding `mounts`. **Nothing in
`ai-toolbox` runs it** — it lints *other* repositories' Ansible content, and
the mandatory gate must stay offline and hermetic (ADR-0009), so
`ansible-lint` is deliberately not a dependency here.

**Why a lint rule rather than a `pre-commit` hook** (TASK-0027): a custom rule
runs wherever `ansible-lint` runs — `pre-commit`, CI, an editor, **and the
pinned ansible MCP server's own lint tool**. A standalone hook fires at commit
time only, so it would not see an agent linting through MCP, which is the case
S6 exists to guard.

### Steps

**1. Copy the rule into a rules directory** in the consuming repo, e.g.
`.ansible-lint-rules/gather_subset_guard.py`. It has no dependencies beyond
`ansible-lint` itself and `PyYAML`.

**2. Enable it in `.ansible-lint`. This is mandatory, not advisory:**

```yaml
profile: production
rulesdir:
  - .ansible-lint-rules
enable_list:
  - gather-subset-mounts
```

**Without `enable_list` the rule is loaded, listed by `-L`, and never
evaluated — at exit 0.** Observed in TASK-0027 and reproduced as a negative
control in `tests/gather-subset-guard.sh`. A lint run that passes is therefore
**not** evidence the rule ran.

**3. Configure it by environment variable, not in `.ansible-lint`:**

```bash
export GATHER_SUBSET_GUARD_HAZARD_GROUPS=pve_cluster
export GATHER_SUBSET_GUARD_INVENTORY=inventory/production.yml
```

Both are comma-separated and optional; defaults are `pve_cluster` and a short
list of common inventory paths. **A `rules:` block will not work** — the
config schema's `$defs.rule` sets `additionalProperties: false` and permits
only `exclude_paths`, so a custom key there is a **fatal** config error
(exit 3, nothing linted). The `get_config()` API exists and the schema forbids
reaching it. Consequence: rule configuration lives outside the committed lint
config and is therefore not reviewable alongside it — an upstream constraint,
not a choice.

**4. Prove it fires before trusting it.** Run
`tests/gather-subset-guard.sh` in *this* repo (manual; needs `ansible-lint`,
reports PASS/FAIL/**SKIP** as three distinct outcomes). Then confirm in the
consuming repo by temporarily flipping a known-safe play to
`gather_facts: true` and checking the rule reports `MISSING EXCLUSION` naming
that host. **Revert the flip.**

### What it proves, and what it does not

It proves a keyword is present in a play whose target resolves into a
configured hazard group. **It does not prove a node cannot hang**: the hazard
is an uninterruptible D-state stat on a wedged clustered filesystem, not
reproducible on demand, so the rule is validated against **syntax**. It also
does not see a play whose `hosts:` is an **undefined Jinja variable** — the
unskippable built-in `syntax-check` fails the file first, so that case is
caught by a different rule with a different message.

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

## Verifying an MCP server in an LM Studio app's UI (human procedure)

The one verification step no script can perform. `tests/smoke-mcp.sh`
proves a server *speaks MCP*; it cannot prove the app **lists the server's
tools in its own interface**, because that needs the desktop GUI running.
This procedure exists so that gap is closeable on demand rather than
rediscovered each sprint (TASK-0016).

Status, per client — the two are **not** interchangeable (ADR-0020):

| App | Status |
|---|---|
| Classic LM Studio 0.4.24 | **passed** 2026-09-13 (TASK-0017), `qwen3.8 27b` enumerated the tools |
| **Bionic 1.1.3+5** | **open — never run.** Bionic reading `~/.lmstudio/mcp.json` is inferred from the shared data root, not verified. Version re-read 2026-09-22; was 1.1.1+5 at `TASK-0047` |

**Run this against Bionic.** It is the outstanding human action from
TASK-0047. Both apps may be installed simultaneously (Bionic at
`~/AppData/Local/Programs/Bionic/`, classic at `C:\Program Files\LM Studio\`),
so **note which one you opened** — recording a Bionic pass from a classic
window is the exact error TASK-0047 was written to undo.

Kept as the reference procedure for the next server, and because it caught a
real defect — see step 7.

**1. Add the server entry.** Both apps are installed Windows-side and share
one config, so from WSL the file is at
`/mnt/c/Users/<user>/.lmstudio/mcp.json`. Back it up first, then paste the
`ansible` block from `configs/lm-studio-bionic/README.md` — copy it from
there rather than retyping, so the pinned version stays correct.

**This step is not optional any more.** As of 2026-09-22 that file is
`{"mcpServers": {}}` — an app wrote the config empty on 2026-09-17, cause
unestablished (`TASK-0053`; evidence in the client snapshot). Earlier runs of
this procedure could skip step 1 because the entry was already there. This
one cannot.

If the entry does not appear in Bionic, check whether Bionic has begun
reading `ng-mcp.json` instead: both binaries contain that string literal.
`configs/lm-studio-bionic/README.md` owns its current status — still absent
from disk at the last check, but a `ng-mcp-managed-oauth` credential
directory has since appeared beside it. Finding `ng-mcp.json` live is a real
result — record it there.

**2. Replace `WORKSPACE_ROOT` before starting the app.** A separate step
because skipping it is not hypothetical: the first run of this procedure
left the placeholder in place and the server connected and enumerated every
tool regardless. **Nothing in the connection validates this value** — the
handshake and tool listing never touch the filesystem.

Use an **absolute** path to a real project directory. Never `$HOME`, never
`/`.

**`WORKSPACE_ROOT` bounds filesystem reach only — it is not the server's
whole blast radius.** Corrected by `TASK-0026`; this file was the **fifth**
place repeating the overstatement, and the brief that fixed it had only
predicted four. It bounds `ansible_lint --fix` and
`create_ansible_projects`. It does **not** bound `ade_setup_environment`,
which installs OS packages **system-wide**, nor `ansible_navigator`, which
executes playbooks against **remote managed infrastructure** — and
`ansible_navigator` is **disabled by default** (`TASK-0026`), so it should
not be enabled in the `mcp.json` this procedure writes.

Verify the path exists before continuing:

```
ls -d /your/chosen/workspace     # must succeed
```

**3. Restart the app.** It reads `mcp.json` at startup; an edit made while
running may not be picked up.

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

**6. Record the result — pass or fail, and name the app and version.**
Update the `Verified (MCP)` row in `configs/lm-studio-bionic/README.md` and
the "Bionic MCP status" section. A failure is a legitimate, useful outcome:
it would mean this repo's wiring is wrong, which is worth knowing. Do not
overwrite the existing handshake-level evidence, and do not overwrite the
classic-0.4.24 attribution; add to it.

**7. Re-check `WORKSPACE_ROOT` after a pass.** Not redundant with step 2 —
this is the step the first run of this procedure needed and did not have.
A pass proves the server *connects*; it proves nothing about the value,
because a nonexistent `WORKSPACE_ROOT` produces an identical-looking pass.
Confirm the path in the live `mcp.json` is the one you intended and that it
exists.

**8. Restore `mcp.json` if this was only a test.** If you do not intend to
keep the server wired, restore your backup — and say so in the record, so
the next reader knows the file's state.

## Authenticating a push

The remote URL is token-free and must stay that way, so the credential is
supplied per-command. **Use basic auth, not bearer:**

```
b64 = base64("<github-username>:$GITHUB_TOKEN")
git -c http.extraheader="AUTHORIZATION: basic <b64>" push origin master
```

`AUTHORIZATION: bearer $GITHUB_TOKEN` fails against
`github.com/<owner>/<repo>.git` with `remote: invalid credentials`, even
with a token that is valid — `GET /user` returns 200 with the same token
via bearer. GitHub's git-over-HTTPS endpoint wants basic auth with the
token as the password; the bearer form is accepted by the REST API only.
Discovered 2026-09-13 while pushing S5's planning commit, after a failed
push that looked like an expired token and was not.

**Always confirm the push landed by comparing hashes**, never by exit
code (`reference/git-workflow.md`; AGENTS.md's Git rules):

```
git rev-parse HEAD
git ls-remote origin master
```

Then check `git remote -v` is still token-free.

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
