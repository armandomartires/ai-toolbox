# Operations Runbook

## Environments
- Development: Windows 11 + WSL; local repo; quick/unit tests.
- Deployment targets (no staging/production web tier for this repo):
  local agent clients (`~/.claude/skills`, OpenCode, LM Studio config)
  and lab machines, via `scripts/install.sh`.

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
- On a WSL `/mnt/c` checkout, `core.filemode` is `false` and files report
  `rwxrwxrwx` regardless, so `chmod +x` never reaches git's index. Set the
  executable bit git actually records with
  `git update-index --chmod=+x .githooks/pre-commit`; `validate.sh` checks
  that recorded mode, not the filesystem bit.

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

## Human approval required for
- Destructive tool capabilities in MCP servers.
- Deleting or rewriting components (see AGENTS.md).
