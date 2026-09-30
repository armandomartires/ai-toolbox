# AGENTS.md — ai-toolbox

## Objective and scope
Collect, develop, validate, and deploy AI customization tools (skills,
MCP servers, loops, prompts, agent roles). Every component must be
self-contained and portable across every client that supports its
capability: skills to Claude Code and OpenCode; MCP servers to those two
and Bionic, LM Studio's agent-oriented workspace (ADR-0020). Bionic *has*
an Agent Skills target, but its global installs are approval-gated, so
nothing is auto-deployed there yet. Out of scope: application code, public
services, secrets.

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
- Prerequisites: Bash and **`python3` ≥ 3.11**. The scripts below parse
  `server.json` manifests with it (do not grep JSON), and since `TASK-0059`
  `tests/validate.sh` also parses `pyproject.toml` with `tomllib`, which is
  standard library only from **3.11**. On an older interpreter the gate
  **fails loudly rather than skipping that check** — a gate that quietly does
  nothing is worse than no gate, because it is still trusted (`ADR-0009`).
  This is the floor for *running the gate*; it is unrelated to the
  `requires-python = ">=3.10"` an authored MCP server targets.
- Environment: copy `.env.example` to `.env` (gitignored — **never commit
  it**) or export the variables from your shell. All of it is optional for
  local work; `tests/validate.sh` is hermetic and passes with nothing set.
  Needed only for specific operations: `GITLAB_URL` + `GITLAB_PUSH_TOKEN`
  to push to `origin`, and `GITHUB_TOKEN` to push to the `github` mirror
  (ADR-0007, ADR-0009, ADR-0028); `WORKSPACE_ROOT` for the
  ansible MCP server. `.env.example` documents names and meanings only,
  never values; `validate.sh` enforces that every `required` variable in
  any `server.json` appears there.
- Install/deploy skills: `scripts/install.sh [link|copy]`
- Regenerate index: `scripts/sync-registry.sh`
- Validate: `tests/validate.sh` — the mandatory gate. Fast, offline,
  hermetic; keep it that way.
- Smoke-test MCP servers: `tests/smoke-mcp.sh [--server <name>]`. Needs
  the network (launchers fetch upstream), so it is deliberately *not* part
  of `tests/validate.sh`. Reports PASS / FAIL / SKIP as three distinct
  outcomes; a SKIP is not a pass.
- Delivery dashboard: `skills/project-workflow/scripts/build-dashboard.sh
  --root .ai --project ai-toolbox --out docs/dashboard.html` — renders this
  repo's own `.ai/` as one self-contained HTML file (burn-up, burn-down,
  cumulative flow, velocity, cycle time, dependencies, backlog, roadmap,
  forecast). **A view, not a gate**: it reports what the artifacts say and
  audits nothing, so it is deliberately not part of `tests/validate.sh` and not
  run by any hook. The output is **gitignored** — it reads the git log, so a
  committed copy is stale the moment it lands. Regenerate it; never commit it.
  **The published page is the current `master` dashboard** — CI rebuilds it
  from a full clone (URL and when: `README.md`). Build locally only to preview
  state you have not pushed, and never upload a local build: it reads the
  working tree and checked-out `HEAD`, not what was pushed (ADR-0029).
  Component check: `skills/project-workflow/scripts/check-dashboard.sh`. What
  each metric does *not* prove: `skills/project-workflow/references/dashboard.md`.
- Dashboard publishing: **optional**, declared in `dashboard-publish.conf` —
  here GitHub Pages (on the `github` mirror) and GitLab Pages (on `origin`).
  The pipelines are **rendered**, never hand-edited:
  `skills/project-workflow/scripts/publish-dashboard.sh render` writes
  `.github/workflows/dashboard.yml`, `.gitlab/ci/dashboard-pages.yml` and the
  `.gitlab-ci.yml` stub, and `tests/validate.sh` runs `render --check` plus
  `check-publish.sh` (TASK-0127). Each rendered file's `STATUS:` line comes from
  the conf and moves only against an observed run.
- **The generator itself is vendored, not ours to edit.** It lives in
  `skills/project-workflow/dashboard/` as a copy of the one developed in the
  `sigma-llmwiki` repository, synced by that repo's `sync_dashboard_skill.py`,
  which records the source commit and a sha256 per file in
  `dashboard/VENDORED.md` and whose `--check` exits non-zero on drift. Change it
  there and re-sync; a local edit re-creates the two-generators split that
  `TASK-0125` removed. `build-dashboard.sh` is a thin wrapper over it and keeps
  the flag surface `.github/workflows/dashboard.yml` and
  `skills/project-migration/SKILL.md` already call.
- Run a Python server: `uv --directory mcp-servers/<name> run <name>` (the
  console script is named after the directory; ADR-0024). External
  servers: `scripts/install.sh` prints the launch command from the
  manifest; per-client wiring is in `configs/*/README.md`.
- Session isolation: `scripts/worktree.sh add|list|remove <name>` — one
  git worktree per concurrent agent session (ADR-0023). Procedure,
  including how work lands on `master`: `docs/operations/runbook.md`.

## Structure
Component layer: `skills/`, `mcp-servers/`, `loops/`, `prompts/`,
`agents/`, `configs/` (client wiring snapshots). Governance layer:
`.ai/` per `.ai/README.md`. Index: `docs/registry.md` (generated).
Details: `docs/development/`, runbook: `docs/operations/`.

## Git rules
- Before changes: check `git status`, branch, remote, uncommitted changes.
- One task = one commit; never include unrelated changes.
- Never delete or overwrite human changes without authorization.
- **Two agent sessions must never share this checkout.** A git index has no
  locking between sessions, so the failure mode is one session committing
  another's half-finished work — which no gate here can detect, because it
  produces a *green* commit. Each concurrent session takes its own worktree
  and lands by rebase (**ADR-0023, `Accepted` 2026-09-23**; runbook has the
  steps). `master` still takes **one commit per task** and stays linear —
  the rebase is an added step, not a branching workflow.
  Observed twice on 2026-09-23 before the decision existed.
- Every project has a local git repository. A remote (GitHub, GitLab) is
  recommended but not mandatory (ADR-0007). **This repo has two**
  (ADR-0028, TASK-0126): `origin` → the private
  `armando.martires/ai-toolbox` project on the intranet GitLab at
  `$GITLAB_URL` — the **primary** — and `github` →
  `armandomartires/ai-toolbox` on GitHub, a **public** mirror. The GitHub
  repo read *private* here until TASK-0123 checked it against the API and
  found `"visibility": "public"` — `.ai/` reads over
  `raw.githubusercontent.com` with no token. **Everything committed here
  is world-readable** through the mirror: every task brief, the backlog,
  every commit subject and author name. The secrets rule above is therefore
  not belt-and-braces, it is the only thing between this repo and a
  published credential — and for the same reason **the intranet hostname
  never goes in a tracked file**; name `$GITLAB_URL` instead. CI and the
  published dashboard run on the mirror (`.github/workflows/`), since
  GitLab has no runner yet.
- At task end: validate, review diff, commit, record the commit hash in
  the task log. Push **to every configured remote** — `origin`, then
  `github` — and record each push result; with no remote, record that
  instead of treating it as a missing step. `origin` is authenticated with
  `GITLAB_PUSH_TOKEN`, a repository-only project token, **never
  `GITLAB_TOKEN`**: the instance is `http://` only, so the credential
  crosses the network in cleartext (ADR-0028). The mirror uses
  `GITHUB_TOKEN`. Never put a token in the remote URL or any tracked file;
  `git remote -v` must stay token-free. Commands: runbook, *Authenticating
  a push*.
- **Recording the hash takes two commits**, because a commit cannot contain
  its own hash. (1) The **task commit** — subject `<Imperative summary>
  (TASK-NNNN)` — carries the work and a task log ending
  `- Commit: recorded in the follow-up record commit` and
  `- Push: recorded in the follow-up record commit`. Push it to both
  remotes and confirm `git rev-parse HEAD` equals `ls-remote` on each.
  (2) The **record commit** — subject `Record TASK-NNNN's landed commit and
  both pushes`, touching only that task file — replaces the two lines with:

  ```
  - Commit: `<short hash>` — *<task commit subject>*, plus the record-keeping commit after it
  - Push: **confirmed to both remotes** — `<old>..<new> master -> master` to
    `origin` and to `github`; `HEAD`, `origin/master` and `github/master` all
    read `<short hash>`, and `git remote -v` is token-free
  ```

  Then push the record commit too. It is recorded only by coming after the
  task commit, never in a third commit. If the push range also carries an
  earlier task's record commit, name it (*"the range carries TASK-NNNN's
  record commit `abc1234` too"*). Unattended runs, which push nothing, use
  the landing placeholders in the runbook's *Landing an unattended run's
  branch* instead. Examples: `TASK-0117`, `TASK-0120`, `TASK-0127`.
- CI (`.github/workflows/validate.yml`) re-runs `validate.sh` and the
  registry-staleness check on every push. It is a second opinion, not the
  gate: the hook prevents a bad commit, CI only reports one already made.
- `tests/validate.sh` runs automatically via `.githooks/pre-commit`
  (activated by `scripts/install.sh`). Bypass with
  `git commit --no-verify` for work-in-progress or when fixing the gate
  itself — never to dodge a real failure.
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
