# AGENTS.md — ai-toolbox

## Objective and scope
Collect, develop, validate, and deploy AI customization tools (skills,
MCP servers, loops, prompts, agent roles). Every component must be
self-contained and portable across every client that supports its
capability: skills to Claude Code and OpenCode; MCP servers to those two
and LM Studio, which is MCP-only (ADR-0006). Out of scope: application
code, public services, secrets.

## Security and secrets
- Never commit secrets, tokens, passwords, private keys, or `.env` files.
- MCP servers must not expose destructive capabilities without explicit
  human authorization in the task file.
- Scan new components for credentials before commit.

## Technology stack
- Skills: Agent Skills spec (SKILL.md, YAML frontmatter `name`,
  `description`). Python/Bash scripts must be idempotent.
- MCP servers: two shapes (ADR-0005), derived from which marker file the
  server directory holds — exactly one is required. Servers this repo
  authors (`pyproject.toml`): Python 3.10+, src layout, hatchling,
  FastMCP, strict schemas, one tool per concern, tests required. Servers
  with a working upstream package (npm, PyPI CLI, etc.) and no source to
  vendor (`server.json`): described by that manifest plus a
  `configs/*/README.md` wiring snippet per client and a registry entry,
  not vendored source. Manifest schema:
  `docs/development/authoring-guide.md`.
- Shell: Bash, POSIX-safe where possible. Repo developed on WSL.

## Commands
- Prerequisites: Bash and `python3` (the scripts below parse
  `server.json` manifests with it; do not grep JSON).
- Install/deploy skills: `scripts/install.sh [link|copy]`
- Regenerate index: `scripts/sync-registry.sh`
- Validate: `tests/validate.sh` — the mandatory gate. Fast, offline,
  hermetic; keep it that way.
- Smoke-test MCP servers: `tests/smoke-mcp.sh [--server <name>]`. Needs
  the network (launchers fetch upstream), so it is deliberately *not* part
  of `tests/validate.sh`. Reports PASS / FAIL / SKIP as three distinct
  outcomes; a SKIP is not a pass.
- Run a Python server: `cd mcp-servers/<name> && uv run <name>`. External
  servers: `scripts/install.sh` prints the launch command from the
  manifest; per-client wiring is in `configs/*/README.md`.

## Structure
Component layer: `skills/`, `mcp-servers/`, `loops/`, `prompts/`,
`agents/`, `configs/` (client wiring snapshots). Governance layer:
`.ai/` per `.ai/README.md`. Index: `docs/registry.md` (generated).
Details: `docs/development/`, runbook: `docs/operations/`.

## Git rules
- Before changes: check `git status`, branch, remote, uncommitted changes.
- One task = one commit; never include unrelated changes.
- Never delete or overwrite human changes without authorization.
- At task end: validate, review diff, commit, push to GitHub, record the
  commit hash and push result in the task log.
- Never force-push without explicit authorization.
- Simple checks (status, diff analysis, test runs) may be delegated to a
  subagent; the main agent still verifies results.

## Documentation rules
- Update `.ai/context/CURRENT_STATE.md` after any significant change.
- New components: copy from the nearest `_template/`, then run
  `scripts/sync-registry.sh` and commit the regenerated registry.
- Decisions with lasting impact get an ADR in `.ai/decisions/`.

## Definition of done
A task is complete only when acceptance criteria are satisfied,
validations pass (`tests/validate.sh` at minimum), docs and registry are
updated, no secrets are included, the diff is reviewed, the task is
marked `done` with commit hash and confirmed push recorded.

## Ambiguity policy
If requirements are significantly ambiguous or risky, stop and ask the
human. State assumptions explicitly; do not invent requirements.

## Destructive changes
Deletions, overwrites, history rewrites, and force-pushes require
explicit human authorization in the task file.

## Planning references
Roadmap: `.ai/planning/ROADMAP.md`; active sprint:
`.ai/planning/SPRINT-CURRENT.md`; tasks: `.ai/tasks/`; current state:
`.ai/context/CURRENT_STATE.md`.

## Mandatory task process
Follow the work cycle for every task: gather context (AGENTS.md,
CURRENT_STATE, sprint, task, git status) → perceive (knowns, gaps,
assumptions) → plan (scope, files, acceptance criteria, validation
commands, stop conditions) → act (small reversible changes) → observe
(outputs, errors, tests) → evaluate against criteria → repeat or
terminate. Details and file templates: `.ai/templates/`.
