# Current State

- Current objective: populate the component layer with existing skills,
  MCP servers, and loops.
- Status: sprint S1 complete. Three live components: project-migration and
  project-workflow skills, both fixed, registered, versioned, and now
  deployed to Claude Code *and* OpenCode (TASK-0001–0003, TASK-0006); the
  `ansible` MCP server ported as the first external-shape component and
  verified `✔ Connected` in a clean Claude Code install (TASK-0007).
  Skill frontmatter schema (license/metadata) accepted (ADR-0003);
  external MCP manifest shape accepted (ADR-0005 + its Clarification).
- Completed: harmonized structure, install/registry/validate scripts;
  TASK-0001 (project-migration script-path fix, masked-commit-failure
  fix, ADR-0002-compliant CLAUDE.md fallback, AGENTS.md idempotence fix,
  duplicate scaffold scripts removed, registry regenerated); TASK-0002
  (skill frontmatter schema extended in template + authoring guide,
  ADR-0003 accepted, project-migration version normalized to 1.0.0);
  TASK-0003 (project-workflow skill harmonized — version-integrity defect
  fixed via ADR-0004 declaring ai-toolbox canonical over its prior source
  repo, SKILL.md/00.CONVENTIONS.md shrunk to lean indexes via progressive
  disclosure, 6 self-contained reference/ files added incl. real git and
  secrets policy, project-workflow bumped to 3.0.0; ai-toolbox itself
  gained `.ai-layout.json` declaring root:.ai/ entrypoint:AGENTS.md so
  the skill's own worked example is accurate); TASK-0004 (ADR-0005 —
  MCP servers may be external/npm packages, not only authored Python —
  found while scoping "port first MCP server": the only candidate with a
  working connection in this environment, `@ansible/ansible-mcp-server`,
  is npm, not Python; AGENTS.md/authoring-guide/GLOSSARY/PROJECT_MAP all
  amended together so none contradicts the others).
- Completed since: TASK-0005 (external-server mechanism —
  `mcp-servers/<name>/server.json` schema documented normatively,
  `_template-external/`, two-shape discovery in sync-registry/install,
  and `validate.sh` MCP checks that make `AGENTS.md`'s destructive-
  capability rule executable: `capabilities.destructive: true` now
  *requires* `authorization.granted: true` plus an existing
  `authorization.task` file. Also fixed a latent template-leak bug — the
  old `_template` exact-match skip let `template-mcp-server` sit in the
  registry as a real component); TASK-0007 (ansible ported: manifest,
  three client wiring snippets, authorization recorded, pinned to
  upstream 26.6.0).
  TASK-0006 (multi-client deployment: `install.sh` now serves Claude Code
  *and* OpenCode via a `--client` selector and a name-scoped overwrite
  policy, closing a real drift bug — OpenCode was running a hand-placed
  `project-workflow` 2.1.0 while the repo shipped 3.0.0; all three client
  READMEs rewritten as full skills+MCP snapshots; the skills-loop template
  leak fixed so no template appears in the registry; `validate.sh` now
  enforces that every client in `install.sh` has a wiring snapshot).
  TASK-0008 (first loop component authored — `loops/release-check/`, the
  repo's own validate → review → commit cycle; `validate.sh` now enforces
  loop structure incl. mandatory exit conditions; the loops registry
  template leak — third instance of that defect — fixed, so no template
  appears in any registry table).
  TASK-0009 (`tests/smoke-mcp.sh` — manifest-driven MCP smoke test: real
  `initialize` handshake, bounded timeout, PASS/FAIL/SKIP as three
  distinct outcomes; deliberately *not* part of `validate.sh`, which
  stays hermetic at ~330 ms with no network calls).
- Current sprint: **S3 Automation — scope not yet confirmed**
  (`SPRINT-CURRENT.md` lists candidates and open questions). S1 and S2
  archived under `.ai/planning/sprints/`; checkpoints REVIEW-0003 and
  REVIEW-0004.
- Phases 1 and 2 are complete. Phase 3 has a blocker to resolve before
  scoping: **no git remote is configured**, so "wire validate.sh into CI"
  presupposes something that does not exist yet.
- In flight: `opencode-customization` (a separate repo) still has its own
  stale copy of project-workflow and an unresolved `S025_WorkflowHarmonization`
  sprint referencing it — that repo's own follow-up, not this repo's, per
  ADR-0004. `skills/project-migration.zip`/`project-workflow.zip` sit
  untracked alongside the skills (pre-existing artifacts, not created by
  any task here) — left untouched, not in scope.
- Blockers: none. Risks: symlink support on Windows checkouts (ADR-0002).
- Expected branch: master. Latest relevant commits: TASK-0001–0004 (see
  `git log --oneline -5` for hashes).
- Recommended next action: confirm the scope of sprint S3 with the human
  before writing briefs. `SPRINT-CURRENT.md` lists four candidates
  (wire validate.sh into pre-commit/CI; B-007 de-duplicate the registry
  generator; decide CI's handling of the network-dependent smoke test;
  B-002 skill linter) and two open questions (is there to be a git remote;
  is a pre-commit hook acceptable on a `/mnt/c` tree from WSL).
- Standing decisions added this session (ADR-0006): LM Studio is an
  **MCP-only client**, excluded from skill criteria — Phase 2's exit
  criterion is now split per capability rather than claiming "all
  clients"; and loops are **authored here, not ported** — a filesystem-wide
  search found no first-party loop artifact existed to port, and the
  near-candidates were either vendor-bundled third-party content or
  canonically owned by another repo.
- Known gaps, recorded not hidden: LM Studio's ansible server is verified
  at config + MCP-handshake level but not in the app's own UI (needs the
  GUI launched interactively). The registry generator duplicates its
  per-section loop three times, which is why the same template-leak
  defect had to be fixed three times — worth a refactor if a fourth
  section is added.
- Standing decisions not to re-litigate: external MCP metadata lives in
  `mcp-servers/<name>/server.json`, with shape *derived* from which
  marker file is present rather than self-declared (ADR-0005
  Clarification); ansible's destructive tools
  (`ansible_navigator`, `ade_setup_environment`,
  `define_and_build_execution_env`, `ansible_lint --fix`,
  `create_ansible_projects`) are human-authorized as of 2026-09-13 to
  ship enabled, mitigated by disclosure in the manifest and every wiring
  snippet, and enforced by `validate.sh`; the ansible launch command is
  version-pinned so upstream breaking changes cannot land silently.
- Environment notes (re-verified 2026-09-13): ansible connects, 10 tools;
  proxmox still lacks `numpy` for its router; obsidian's desktop app
  still isn't running. Upstream ansible declares `node>=24.0` while this
  machine runs node v22.23.2 — npm warns `EBADENGINE` and the server
  works, because `engines` is advisory unless `engine-strict` is set. If
  that ever changes, ansible launches break with no repo-side change.
- Known validations: tests/validate.sh, scripts/sync-registry.sh.
- Validated in: WSL (development). Deployment targets: local agent
  clients (~/.claude/skills, OpenCode, LM Studio) via scripts/install.sh.
