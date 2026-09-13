# Current State

- Current objective: populate the component layer with existing skills,
  MCP servers, and loops.
- Status: two live components. project-migration and project-workflow
  skills both fixed, registered, and versioned (TASK-0001–0003). Skill
  frontmatter schema (license/metadata) accepted (ADR-0003).
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
- Incomplete: actually porting the ansible server — now planned as
  PLAN-0001 and split into TASK-0005 (build the external-server
  mechanism: `server.json` manifest schema, sync-registry/install
  discovery, validate.sh checks incl. an executable destructive-
  capability gate) and TASK-0007 (port ansible using it); loop
  component; client config snapshots (TASK-0006).
- In flight: `opencode-customization` (a separate repo) still has its own
  stale copy of project-workflow and an unresolved `S025_WorkflowHarmonization`
  sprint referencing it — that repo's own follow-up, not this repo's, per
  ADR-0004. `skills/project-migration.zip`/`project-workflow.zip` sit
  untracked alongside the skills (pre-existing artifacts, not created by
  any task here) — left untouched, not in scope.
- Blockers: none. Risks: symlink support on Windows checkouts (ADR-0002).
- Expected branch: master. Latest relevant commits: TASK-0001–0004 (see
  `git log --oneline -5` for hashes).
- Recommended next action: TASK-0005, then TASK-0007. Both are specified
  in `.ai/planning/plans/PLAN-0001-port-ansible-mcp-server.md`, which
  also resolves two ambiguities so they are not re-litigated: external
  metadata lives in `mcp-servers/<name>/server.json` (not in
  `configs/*/README.md` prose, which ADR-0005's original wording implied
  but a generator cannot parse), and ansible's destructive tool surface
  (`ansible_navigator`, `ade_setup_environment`,
  `define_and_build_execution_env`) is human-authorized as of 2026-09-13
  to ship enabled, with disclosure in the manifest and every wiring
  snippet. Re-verified at plan time: ansible connects; proxmox still
  lacks `numpy`; obsidian's app still isn't running.
- Known validations: tests/validate.sh, scripts/sync-registry.sh.
- Validated in: WSL (development). Deployment targets: local agent
  clients (~/.claude/skills, OpenCode, LM Studio) via scripts/install.sh.
