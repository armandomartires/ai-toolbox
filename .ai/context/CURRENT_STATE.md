# Current State

- Current objective: populate the component layer with existing skills,
  MCP servers, and loops.
- Status: one live component. project-migration skill fixed, registered,
  and versioned (TASK-0001, TASK-0002). Skill frontmatter schema
  (license/metadata) accepted (ADR-0003).
- Completed: harmonized structure, install/registry/validate scripts;
  TASK-0001 (project-migration script-path fix, masked-commit-failure
  fix, ADR-0002-compliant CLAUDE.md fallback, AGENTS.md idempotence fix,
  duplicate scaffold scripts removed, registry regenerated); TASK-0002
  (skill frontmatter schema extended in template + authoring guide,
  ADR-0003 accepted, project-migration version normalized to 1.0.0).
- Incomplete: migration of remaining components (MCP server, loop);
  client config snapshots.
- In flight: skills/project-workflow/ appeared untracked mid-session,
  unaudited, not part of any task yet — excluded from both TASK-0001's
  and TASK-0002's registry regenerations to keep those commits
  single-purpose.
- Blockers: none. Risks: symlink support on Windows checkouts (ADR-0002).
- Expected branch: master. Latest relevant commits: TASK-0001, TASK-0002
  (see `git log --oneline -5` for hashes). Untracked: skills/project-workflow/.
- Recommended next action: TASK-0003 (port first MCP server), then decide
  on skills/project-workflow/ (audit or discard).
- Known validations: tests/validate.sh, scripts/sync-registry.sh.
- Validated in: WSL (development). Deployment targets: local agent
  clients (~/.claude/skills, OpenCode, LM Studio) via scripts/install.sh.
