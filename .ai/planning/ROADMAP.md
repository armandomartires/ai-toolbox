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

## Phase 4 — Closing the open loops (complete, 2026-09-13)
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
  checkpoint REVIEW-0006. B-001, the last open item, was closed
  post-sprint by TASK-0018 as *superseded* (ADR-0011) — emptying the
  backlog for the first time. The header above read "in progress" until
  S5's planning session corrected it; every criterion had been met and
  the status line simply lagged.
- Pattern this phase was created to fix: an item can sit in a candidate
  list for sprints looking blocked when it is merely **undocumented**. The
  git remote was the clearest case — the credentials had been in the
  environment the entire time; nothing said so. Before carrying an item
  forward again, check whether it is actually blocked or just unwritten.

## Phase 5 — Session handover contract (complete, 2026-09-13)
- Objective: make every task resumable in a brand-new session. The
  `project-workflow` skill's task template names what a task *does* but
  never what it consumes or hands on, so a task file cannot be picked up
  cold — while the skill simultaneously presumes multi-session work in
  three separate places without ever stating a session boundary.
- Planned by `PLAN-0002`; decisions in ADR-0012. Sprint S5, tasks
  TASK-0020…0023.
- Exit criteria:
  - The skill states a session boundary rule and a cold-start read order
    — neither of which it states anywhere today (TASK-0020).
  - `00.CONVENTIONS.md` is back **under** its own declared ≲3 KB budget,
    measured. It is 3087 bytes today, and nobody had checked (TASK-0020).
  - The skill's task template names both what a task consumes and what
    the next task inherits; `metadata.version` → `3.1.0` with the
    deployed copy re-synced and verified (TASK-0021).
  - This repo's `.ai/templates/TASK.md` carries the same contract with
    **no net growth in section count** — a merge of four existing
    sections, not an addition of two more (TASK-0022).
  - `validate.sh` detects a deleted or empty handover section, is proven
    to fail for the right reason, and is honest in its own source about
    what it does not prove (TASK-0023).
- Deliberately **not** in scope: retrofitting TASK-0001…0019. They are
  records of what happened; a brief written retroactively to look tidy is
  not compliance (ADR-0012 Decision 4). The `≥ 0020` boundary encodes
  this in the check itself.
- Outcome: all five exit criteria met and independently re-verified;
  sprint S5 closed 2026-09-13, checkpoint REVIEW-0007. Commits
  `c240f02`, `0f36d66`, `cdedb45`, `7106f9c`.
- **What this phase set out to test, and could not.** The question was
  whether file-based handover makes a cold session cheap. All four tasks
  ran in **one** session, so every `Inputs` table was written and read by
  the same context that produced it. The contract is proven writable, and
  proven to catch stale declarations *within* a session — four times, see
  below. It is **not** proven to make a cold start cheap. That remains a
  hypothesis with supporting mechanism (REVIEW-0007, finding 8).
- What the phase did prove, unplanned: **the convention caught a defect
  in all four of its own tasks, and the check it built caught none of
  them.** A stale symlink claim, a false premise in ADR-0012, a
  four-section merge that would have destroyed 82 lines of narrative, and
  an escape hatch in the new check itself (`.ai/tasks/completed/`). Each
  found by opening the file named in a declaration rather than trusting
  it. Three of the four claims had been written by the same agent one
  session earlier — the defect is claim decay between writing and acting,
  not carelessness.
- Standing caution from this phase: the value delivered was the
  verification discipline, not the enforcement. A future sprint that
  keeps the gate and drops the read-order step keeps the part that found
  nothing.

## Risks
- Client config format drift; symlink issues on Windows; skill spec
  evolution. Mitigations: configs/ snapshots, ADR-0002, spec templates.
- **A convention can grow the thing it exists to bound.** Phase 5 adds a
  reference file and template sections to a convention whose entry point
  is already over its own budget. New content goes to the load-on-demand
  tier, and the existing overage is paid rather than inherited —
  `reference/size-budgets.md:35-38` forbids raising a cap to fit what is
  already there.
- **A presence check can be read as a correctness check.** The likeliest
  failure of Phase 5 is social: a green gate taken to mean the handovers
  are good, when it only means no section is empty. Stated in the check's
  own source comment, where a reader will actually hit it.
- Client capability gaps are not repo defects and must not be recorded as
  such (ADR-0006). Check what a client actually supports before writing a
  criterion that assumes it.
- Aspirational verbs hide unchecked assumptions. "Port existing loops"
  survived a whole sprint before anyone verified a loop existed to port.
  Scope a task against observed reality, not against a plan's wording.
