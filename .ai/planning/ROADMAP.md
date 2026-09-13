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
  - One MCP server wired and verified in **all three** clients. ***Met*** —
    completed retroactively 2026-09-13 by TASK-0017: Claude Code
    `✔ Connected`; OpenCode in live use; LM Studio now verified in its own
    UI (server active in chat, tools enumerated by a loaded model), not
    merely at config + handshake level.
  - `configs/<client>/README.md` complete for every client. *Met*.
  - At least one loop component exists and is exercisable. *Met*
    (`loops/release-check`, TASK-0008).
  - MCP server startup verified by a repeatable check, not manual steps.
    *Met* (`tests/smoke-mcp.sh`, TASK-0009).
- Closed 2026-09-13 with one known gap, recorded not counted: LM Studio's
  ansible server was unverified in the app's own UI (needs the GUI launched
  interactively) — a client-side manual step, not repo work. See
  REVIEW-0004.
- **That gap is now closed (TASK-0017), so Phase 2 has no outstanding
  criteria.** It took a written procedure (TASK-0016) before the human could
  act on it — the gap survived three sprints as a candidate-list bullet and
  was closed within a day of becoming a documented procedure. The lesson is
  about the form of the record, not the difficulty of the work.
- The verification also *found* something, which is the argument for doing
  it rather than assuming it: `WORKSPACE_ROOT` was still the unreplaced
  placeholder, and the server connected and enumerated all its tools anyway.
  A green connection is not a validated configuration.

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

## Phase 4 — Closing the open loops (in progress, opened 2026-09-13)
- Objective: close every backlog item that is actually closeable, and for
  the ones that are not, replace the perpetual "candidate" listing with
  either a decision or a documented human-action procedure. The defect
  being fixed is *process*, not code: B-002 sat `ready` for three sprints
  and two items recycled through three consecutive candidate lists,
  because nothing distinguished "not yet done" from "cannot be done by an
  agent".
- Exit criteria:
  - Skill linting enforces the rules that are actually defined. *Scoped
    to frontmatter only* — the originally-imagined "line budget" half had
    no threshold defined anywhere in the repo, so enforcing one would
    have meant inventing a requirement (TASK-0012, ADR-0008).
  - A `LICENSE` file exists, backing the `license: MIT` that both shipped
    skills already declare in frontmatter (TASK-0013).
  - `install.sh` warns about the `core.filemode=false` hook trap at the
    moment someone is most likely to hit it (TASK-0014).
  - Required environment variables are documented and validated, and the
    git remote is wired from them (TASK-0015, ADR-0009).
  - Every remaining gap that needs a human has a written procedure in
    `docs/operations/`, not a roadmap bullet (TASK-0016).
- Deliberately **not** in scope: authoring a Python MCP server purely to
  exercise that shape. `SPRINT-CURRENT.md` warned it "needs a real reason
  … not a synthetic one"; see TASK-0016 and ADR-0010 for the standing
  decision rather than a fourth candidate-list appearance.
- Outcome: all five exit criteria met; sprint S4 closed 2026-09-13,
  checkpoint REVIEW-0006. The backlog now holds no `ready` item — B-001 is
  the only one left open, unblocked but unscoped.
- Pattern this phase was created to fix: an item can sit in a candidate
  list for sprints looking blocked when it is merely **undocumented**. The
  git remote was the clearest case — the credentials had been in the
  environment the entire time; nothing said so. Before carrying an item
  forward again, check whether it is actually blocked or just unwritten.

## Risks
- Client config format drift; symlink issues on Windows; skill spec
  evolution. Mitigations: configs/ snapshots, ADR-0002, spec templates.
- Client capability gaps are not repo defects and must not be recorded as
  such (ADR-0006). Check what a client actually supports before writing a
  criterion that assumes it.
- Aspirational verbs hide unchecked assumptions. "Port existing loops"
  survived a whole sprint before anyone verified a loop existed to port.
  Scope a task against observed reality, not against a plan's wording.
