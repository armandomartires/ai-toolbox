# Roadmap

## Vision
A validated, indexed, versioned library of AI customization tools that
any agent or human can understand, trust, and deploy.

## Phase 1 — Foundation (complete, 2026-09-13)
- Objectives: scaffold structure; port existing components; validate
  install.sh for Claude Code.
- Milestone: first component installed and used in a real session — met
  (ansible MCP reached `✔ Connected` in a clean Claude Code install).
- Exit criteria: install, registry sync, and validate scripts pass; at
  least three components migrated. **Met** (2 skills + 1 MCP server).
- Note: the objective also named porting *loops*. No first-party loop
  artifact existed anywhere to port — see ADR-0006. Loops are authored
  instead, in Phase 2.

## Phase 2 — Multi-client deployment (complete, 2026-09-13)
- Objectives: OpenCode and LM Studio sync targets; configs/ snapshots;
  first loop component authored; MCP servers verified by a harness rather
  than by hand.
- Exit criteria (restated per ADR-0006 — the original "one skill and one
  MCP server working in all clients" was unmeetable, because LM Studio
  has no Agent Skills target):
  - One skill deployed and working in **every client that supports
    skills** — Claude Code and OpenCode. *Met* (TASK-0006).
  - One MCP server wired and verified in **all three** clients. *Partly
    met*: Claude Code `✔ Connected`; OpenCode in live use; LM Studio
    verified at config + MCP-handshake level, not yet in its own UI.
  - `configs/<client>/README.md` complete for every client. *Met*.
  - At least one loop component exists and is exercisable. *Met*
    (`loops/release-check`, TASK-0008).
  - MCP server startup verified by a repeatable check, not manual steps.
    *Met* (`tests/smoke-mcp.sh`, TASK-0009).
- Closed with one known gap, recorded not counted: LM Studio's ansible
  server is unverified in the app's own UI (needs the GUI launched
  interactively) — a client-side manual step, not repo work. See
  REVIEW-0004.

## Phase 3 — Automation (current)
- Objectives: CI checks (frontmatter validation, server smoke tests);
  registry automation in task flow.
- Exit criteria: tests/validate.sh wired into CI or pre-commit.
- **Blocker to resolve first: there is no git remote configured.** Every
  task through S2 recorded "nothing to push". "CI" presupposes a remote,
  so either one is added or Phase 3's automation means a local pre-commit
  hook. Decide before scoping the sprint — see `SPRINT-CURRENT.md`.
- Note when writing this phase's criteria: both ADR-0005 and ADR-0006
  exist because a criterion written at scaffold time met reality and lost.
  Check Phase 3's assumptions against the environment before committing
  to them.

## Risks
- Client config format drift; symlink issues on Windows; skill spec
  evolution. Mitigations: configs/ snapshots, ADR-0002, spec templates.
- Client capability gaps are not repo defects and must not be recorded as
  such (ADR-0006). Check what a client actually supports before writing a
  criterion that assumes it.
- Aspirational verbs hide unchecked assumptions. "Port existing loops"
  survived a whole sprint before anyone verified a loop existed to port.
  Scope a task against observed reality, not against a plan's wording.
