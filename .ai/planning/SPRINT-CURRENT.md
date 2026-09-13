# Sprint — S1 Foundation

- Objective: migrate existing skills, MCP servers, and loops into the
  component layer with full validation.
- Time reference: first two weeks after scaffold.
- Included tasks: TASK-0001 (port and harmonize the project-migration
  skill), TASK-0002 (extend the skill frontmatter schema), TASK-0003
  (harmonize the project-workflow skill), TASK-0004 (port first MCP
  server), TASK-0005 (client config snapshots).
- Recommended order: 0001 → 0002 → 0003 → 0004 → 0005.
- Dependencies: none between tasks. TASK-0001 and TASK-0002 both touch
  skills/project-migration/SKILL.md — 0002 owns line 7 (version), 0001
  owns lines 12 and 37 (script paths). TASK-0003 follows ADR-0004, a
  cross-repo canonicalization decision independent of 0001/0002.
- Success criteria: tests/validate.sh green; registry lists all ported
  components; install.sh verified in Claude Code.
- Risks: porting reveals structural mismatches — split tasks if needed.
- Completed tasks: TASK-0001, TASK-0002, TASK-0003. Blocked tasks: none.
- Recommended next task: TASK-0004.
