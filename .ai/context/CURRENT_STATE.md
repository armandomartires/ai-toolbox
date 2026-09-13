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
  the skill's own worked example is accurate).
- Incomplete: migration of remaining components (MCP server, loop);
  client config snapshots.
- In flight: `opencode-customization` (a separate repo) still has its own
  stale copy of project-workflow and an unresolved `S025_WorkflowHarmonization`
  sprint referencing it — that repo's own follow-up, not this repo's, per
  ADR-0004. `skills/project-migration.zip`/`project-workflow.zip` sit
  untracked alongside the skills (pre-existing artifacts, not created by
  any task here) — left untouched, not in scope.
- Blockers: none. Risks: symlink support on Windows checkouts (ADR-0002).
- Expected branch: master. Latest relevant commits: TASK-0001–0003 (see
  `git log --oneline -5` for hashes).
- Recommended next action: TASK-0004 (port first MCP server).
- Known validations: tests/validate.sh, scripts/sync-registry.sh.
- Validated in: WSL (development). Deployment targets: local agent
  clients (~/.claude/skills, OpenCode, LM Studio) via scripts/install.sh.
