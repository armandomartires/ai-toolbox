# Backlog

| ID | Title | Priority | Value | Dependencies | Risk | Status | Ready when |
|----|-------|----------|-------|--------------|------|--------|-----------|
| B-001 | Subagent-run registry validation | low | medium | Phase 3 | low | idea | CI exists |
| B-002 | Skill Linter (frontmatter + line budget) | medium | high | Phase 1 | low | ready | TASK-0001 done — condition met |
| B-003 | MCP server smoke test harness | medium | high | Phase 1 | medium | scoped | TASK-0009 (sprint S2) |
| B-005 | Re-scope Phase 2 exit criterion (LM Studio has no Agent Skills target) | high | medium | none | low | **done** | resolved by ADR-0006 |
| B-006 | ~~Port~~ **Author** a loop component | medium | medium | none | low | **done** | TASK-0008; verb corrected — nothing existed to port (ADR-0006) |

Notes:
- B-003's seed: TASK-0006 verified a server by piping an MCP `initialize`
  request to it and asserting on `serverInfo`. `tests/validate.sh` checks
  manifests statically; nothing yet checks a server actually starts and
  speaks the protocol.
- B-005 and B-006 came from REVIEW-0003's follow-ups; both closed by
  ADR-0006 and TASK-0008. B-006 is kept visible rather than deleted
  because its *verb* was the defect: it said "port", and a search found no
  first-party loop artifact existed anywhere to port. Recording the
  correction is the point.
| B-004 | Repo LICENSE file (backs skill `license:` claims) | low | medium | none | low | idea | license chosen by human |
