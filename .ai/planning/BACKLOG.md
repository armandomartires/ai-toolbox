# Backlog

| ID | Title | Priority | Value | Dependencies | Risk | Status | Ready when |
|----|-------|----------|-------|--------------|------|--------|-----------|
| B-001 | Subagent-run registry validation | low | medium | Phase 3 | low | idea | CI exists |
| B-002 | Skill Linter (frontmatter + line budget) | medium | high | Phase 1 | low | ready | TASK-0001 done — condition met |
| B-003 | MCP server smoke test harness | medium | high | Phase 1 | medium | **done** | TASK-0009 — `tests/smoke-mcp.sh` |
| B-005 | Re-scope Phase 2 exit criterion (LM Studio has no Agent Skills target) | high | medium | none | low | **done** | resolved by ADR-0006 |
| B-006 | ~~Port~~ **Author** a loop component | medium | medium | none | low | **done** | TASK-0008; verb corrected — nothing existed to port (ADR-0006) |
| B-007 | De-duplicate sync-registry.sh per-section loops (or assert no `_template*` row) | medium | medium | none | low | idea | now — 3 identical fixes is enough evidence |

Notes:
- B-003 closed by TASK-0009. Its seed was TASK-0006's by-hand `initialize`
  handshake; that incantation is now `tests/smoke-mcp.sh`, driven entirely
  from each `server.json` manifest. Kept out of `tests/validate.sh` on
  purpose so the mandatory gate stays offline and fast.
- B-007 comes from REVIEW-0004: the template-leak defect was fixed three
  separate times (MCP loop, skills loop, loops loop) because
  `sync-registry.sh` duplicates its iteration logic per section, so a rule
  added to one does not reach the others. The pattern is the finding, not
  any one fix. `tests/smoke-mcp.sh` skips templates from the outset.
- B-005 and B-006 came from REVIEW-0003's follow-ups; both closed by
  ADR-0006 and TASK-0008. B-006 is kept visible rather than deleted
  because its *verb* was the defect: it said "port", and a search found no
  first-party loop artifact existed anywhere to port. Recording the
  correction is the point.
| B-004 | Repo LICENSE file (backs skill `license:` claims) | low | medium | none | low | idea | license chosen by human |
