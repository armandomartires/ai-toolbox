# Backlog

| ID | Title | Priority | Value | Dependencies | Risk | Status | Ready when |
|----|-------|----------|-------|--------------|------|--------|-----------|
| B-001 | Subagent-run registry validation | low | medium | Phase 3 | low | idea | CI exists |
| B-002 | Skill Linter (frontmatter + line budget) | medium | high | Phase 1 | low | ready | TASK-0001 done — condition met |
| B-003 | MCP server smoke test harness | medium | high | Phase 1 | medium | ready | first server ported (TASK-0007) — condition met |
| B-005 | Re-scope Phase 2 exit criterion (LM Studio has no Agent Skills target) | high | medium | none | low | idea | now (blocks Phase 2 planning) |
| B-006 | Port a loop component (named in S1 objective, never scoped) | medium | medium | none | low | idea | now |

Notes:
- B-003's seed: TASK-0006 verified a server by piping an MCP `initialize`
  request to it and asserting on `serverInfo`. `tests/validate.sh` checks
  manifests statically; nothing yet checks a server actually starts and
  speaks the protocol.
- B-005 and B-006 come from REVIEW-0003's follow-ups.
| B-004 | Repo LICENSE file (backs skill `license:` claims) | low | medium | none | low | idea | license chosen by human |
