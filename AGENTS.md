# AGENTS.md — ai-toolbox

Rules and commands only; each rule's reason is in the ADR or runbook it names.

## Objective and scope
Collect, develop, validate and deploy AI customization tools: skills, MCP
servers, loops, mods, prompts, agent roles, each self-contained and portable to
every client with its capability: skills to Claude Code and OpenCode, MCP
servers to those and external ones to Bionic, mods to Claude Code (ADR-0020,
ADR-0039, ADR-0040). Out of scope: application code, public services, secrets.

## Security and secrets
- Never commit secrets, tokens, passwords, private keys, or `.env` files. Scan
  new components for credentials before commit.
- MCP servers must not expose destructive capabilities without explicit human
  authorization in the task file.
- Secret values live in the intranet Vault, never in a profile or `.env`
  (ADR-0030). Run what needs one through
  `skills/vault-secrets/scripts/vault_secrets.py exec <VAR> -- <cmd>`, naming
  only its variables. Never read, print or copy a value or `~/.vault-token`; a
  missing or rejected secret is a stop: logging in and writing values are
  human steps.
- CI variables hold only secrets a CI job consumes, or a project's whose
  `secrets.conf` declares `gitlab` or `github` (ADR-0034).

## Technology stack
- Skills: Agent Skills spec (`SKILL.md`, frontmatter `name`, `description`).
  Python/Bash scripts must be idempotent. Shell: Bash, POSIX-safe where
  possible; developed on WSL.
- MCP servers, one marker file each (ADR-0005): authored (`pyproject.toml`;
  Python 3.10+, FastMCP, one tool per concern, tests required) or external
  (`server.json` wiring an upstream package; no vendored source).
- Mods: Claude Code plugins in TypeScript (ADR-0040). Rules for every kind:
  `docs/development/authoring-guide.md`.

## Commands
- Validate: `tests/validate.sh` (Bash, `python3` ≥ 3.11), the mandatory gate:
  offline, hermetic, fast; keep it so. Not in it, so a SKIP is not a pass:
  `tests/smoke-mcp.sh [--server <name>]`, `tests/test-mods.sh [--mod <name>]`.
- Environment: optional locally. Copy `.env.example` to a gitignored `.env`,
  never committed; per-operation variables: runbook, *Environment variables*.
- Deploy: `scripts/install.sh [link|copy]`, `--status`, `--only a,b` or a
  gitignored `install.selection`. Index: `scripts/sync-registry.sh`.
- Run an authored server: `uv --directory mcp-servers/<name> run <name>`
  (ADR-0024); an external one as `scripts/install.sh` prints it.
- Work tracker: `tracker.conf`; this repo is `files`, gate-asserted (ADR-0037).
- Dashboard: `skills/project-workflow/scripts/build-dashboard.sh --root .ai
  --project ai-toolbox --out docs/dashboard.html`. A gitignored view, not a
  gate: never commit or upload it. Rebuild it once an approved plan's files
  are written and after a confirmed push (ADR-0035); CI alone publishes it
  (ADR-0029). `dashboard/` is vendored: never edit it here (`VENDORED.md`).

## Structure
Components: `skills/` `mcp-servers/` `loops/` `mods/` `prompts/` `agents/`
`configs/` (client wiring). Governance: `.ai/`. Index: `docs/registry.md`
(generated). Guides: `docs/development/`; runbook: `docs/operations/`.

## Git rules
- Before changes: check `git status`, branch, remote, uncommitted changes.
- One task = one commit; never include unrelated changes.
- Never delete or overwrite human changes without authorization.
- **Two agent sessions must never share this checkout.** Each takes its own
  worktree (`scripts/worktree.sh add <name>`) and lands by rebase; `master`
  stays linear (ADR-0023; runbook, *One worktree per agent session*).
- Remotes (ADR-0028): `origin`, the intranet GitLab, is primary; `github` is
  its **public** mirror. Everything committed is world-readable, so the
  intranet hostname never goes in a tracked file: write `$GITLAB_URL`,
  `$VAULT_ADDR` or a placeholder such as `pve-node-1` (gate:
  `scripts/check-private-names.sh`).
- At task end: validate, review the diff, commit, then push **`origin` only**
  with `vgit_origin` and `GITLAB_PUSH_TOKEN`, never `GITLAB_TOKEN` (runbook,
  *Authenticating a push*). Never push `github`; poll until `ls-remote` on
  both remotes equals `git rev-parse HEAD`, and if `github` lags, report the
  mirror's status. No token goes in a remote URL or a tracked file.
- **Git is the record** (ADR-0033). A task lands as one commit, subject
  `<Imperative summary> (TASK-NNNN)`; the brief does not carry its hash.
- **Task report** — the chat output at task end, nothing longer:
  ```
  Result:   done | blocked | partial — one line
  Changed:  file or component — what, one line each
  Verified: command → observed output
  Pushed:   origin ✓ github ✓ @<short hash>   (or: not pushed — why)
  Next:     one line
  ```
- `.githooks/pre-commit` runs the gate; CI re-runs it on each push as a second
  opinion. `--no-verify` only for work in progress or fixing the gate.
- Simple checks may be delegated to a subagent; the main agent verifies.

## Documentation rules
- Update `.ai/context/CURRENT_STATE.md` after any significant change — edit
  the state it describes; do not append a narrative (history is in git).
- New component: copy the nearest `_template/`, then `scripts/sync-registry.sh`.
- Decisions with lasting impact get an ADR in `.ai/decisions/`.
- Capability no task could run for real gets an `Unexercised:` backlog row; at
  the cap of 3, exercise or retire one before adding more (ADR-0039).

## Definition of done
A task is complete only when acceptance criteria are satisfied, validations
pass (`tests/validate.sh` at minimum), docs and registry are updated, no
secrets are included, the diff is reviewed, the task is `done`, its commit
subject names it, and the task report confirms the push to every remote.

## Ambiguity policy
If requirements are significantly ambiguous or risky, stop and ask the human.
State assumptions explicitly; do not invent requirements.

## Destructive changes
Deletions, overwrites, history rewrites, and force-pushes require explicit
human authorization in the task file.

## Planning references
Roadmap `.ai/planning/ROADMAP.md`; sprint `.ai/planning/SPRINT-CURRENT.md`;
tasks `.ai/tasks/`; state `.ai/context/CURRENT_STATE.md`.

## Mandatory task process
Every task: gather context (AGENTS.md, CURRENT_STATE, sprint, task, git
status) → perceive (knowns, gaps, assumptions) → plan (scope, files,
acceptance criteria, validation commands, stop conditions) → act (small
reversible changes) → observe (outputs, errors, tests) → evaluate against
criteria → repeat or terminate. Templates: `.ai/templates/`.
