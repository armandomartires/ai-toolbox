# Sprint — S1 Foundation

- Objective: migrate existing skills, MCP servers, and loops into the
  component layer with full validation.
- Time reference: first two weeks after scaffold.
- Included tasks: TASK-0001 (port and harmonize the project-migration
  skill), TASK-0002 (extend the skill frontmatter schema), TASK-0003
  (harmonize the project-workflow skill), TASK-0004 (allow external
  Node/npm MCP servers, ADR-0005), TASK-0005 (external MCP server shape:
  manifest, scripts, validation), TASK-0007 (port the ansible MCP
  server), TASK-0006 (client config snapshots).
- Recommended order: 0001 → 0002 → 0003 → 0004 → 0005 → 0007 → 0006.
  0004 → 0005 → 0007 is a hard dependency chain: 0005 needs the amended
  rule, 0007 needs the manifest shape and the validation that gates its
  destructive-capability authorization.
- Dependencies: none between 0001–0003. TASK-0001 and TASK-0002 both
  touch skills/project-migration/SKILL.md — 0002 owns line 7 (version),
  0001 owns lines 12 and 37 (script paths). TASK-0003 follows ADR-0004,
  a cross-repo canonicalization decision independent of 0001/0002.
- Success criteria: tests/validate.sh green; registry lists all ported
  components; install.sh verified in Claude Code.
- Risks: porting reveals structural mismatches — split tasks if needed.
  Realized twice now: TASK-0004 exists because "port first MCP server"
  assumed every server would be Python; the first real candidate
  (ansible) wasn't. Then the remainder split again into 0005 (build the
  external-server mechanism) and 0007 (use it) — see PLAN-0001.
- Completed tasks: TASK-0001, TASK-0002, TASK-0003, TASK-0004,
  TASK-0005, TASK-0007. Blocked tasks: none.
- Recommended next task: TASK-0006 (client config snapshots) — now the
  only open task in this sprint. PLAN-0001 is fully executed.
- Sprint success criteria status: `tests/validate.sh` green (and now
  covers MCP shape/manifest integrity, not just skills); registry lists
  every ported component (2 skills + 1 external MCP server); install.sh
  verified in Claude Code — the ansible wiring reached `✔ Connected`
  from a clean start, which also satisfies the Phase 1 roadmap milestone
  "first component installed and used in a real session".
