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

## Phase 3 — Automation (complete, 2026-09-13)
- Objectives: automated validation in the commit flow; registry staleness
  detection.
- Exit criterion, restated by ADR-0007 from the original "wired into CI or
  pre-commit": **`tests/validate.sh` runs automatically before every
  commit.** *Met* — `.githooks/pre-commit`, activated by
  `scripts/install.sh` (TASK-0010).
- Why restated: the original presumed CI, and therefore a remote. This
  repo has none, and the human rule is that local git is mandatory while a
  remote is only recommended (ADR-0007). A CI-only gate would have run
  nowhere while satisfying the criterion's wording.
- Also delivered: `scripts/sync-registry.sh` de-duplicated and a
  registry-staleness check added, closing a defect that had recurred three
  times (TASK-0011).
- CI ships as `.github/workflows/validate.yml`, **inert and unverified** —
  no remote exists to run it. Labelled as such rather than presented as
  working.
- Pattern worth remembering: ADR-0005, ADR-0006 and ADR-0007 all exist
  because a criterion written at scaffold time met reality and lost. Check
  a phase's assumptions against the environment before committing to them.

## Phase 4 — not yet defined
No phase is currently in progress. Candidates carried forward:
- B-002 skill linter (frontmatter + line budget) — "ready" for three
  sprints; scope it properly or drop it.
- Authored (Python) MCP server shape has never been exercised — only
  `mcp-servers/_template/` uses it.
- LM Studio UI verification of the ansible server (needs a human at the
  GUI).
- Add a git remote, which would activate the CI workflow — a
  recommendation, not a requirement.

## Risks
- Client config format drift; symlink issues on Windows; skill spec
  evolution. Mitigations: configs/ snapshots, ADR-0002, spec templates.
- Client capability gaps are not repo defects and must not be recorded as
  such (ADR-0006). Check what a client actually supports before writing a
  criterion that assumes it.
- Aspirational verbs hide unchecked assumptions. "Port existing loops"
  survived a whole sprint before anyone verified a loop existed to port.
  Scope a task against observed reality, not against a plan's wording.
