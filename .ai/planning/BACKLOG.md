# Backlog

| ID | Title | Priority | Value | Dependencies | Risk | Status | Ready when |
|----|-------|----------|-------|--------------|------|--------|-----------|
| B-001 | Subagent-run registry validation | low | medium | Phase 3 | low | **done** | TASK-0018 — closed as **superseded**, not implemented (ADR-0011); scoping it found two real registry defects, both fixed |
| B-002 | Skill Linter (frontmatter ~~+ line budget~~) | medium | high | Phase 1 | low | **done** | TASK-0012 — frontmatter only; line budget dropped per ADR-0008 |
| B-003 | MCP server smoke test harness | medium | high | Phase 1 | medium | **done** | TASK-0009 — `tests/smoke-mcp.sh` |
| B-005 | Re-scope Phase 2 exit criterion (LM Studio has no Agent Skills target) | high | medium | none | low | **done** | resolved by ADR-0006 |
| B-006 | ~~Port~~ **Author** a loop component | medium | medium | none | low | **done** | TASK-0008; verb corrected — nothing existed to port (ADR-0006) |
| B-007 | De-duplicate sync-registry.sh per-section loops (or assert no `_template*` row) | medium | medium | none | low | **done** | TASK-0011 — did both |

**The backlog is empty — every item above is closed.** New work needs a new
item with its own justification.

Notes:
- B-001 was scaffold boilerplate from the initial commit (`e72b78c`), never
  scoped or justified by an observed failure. By the time its `CI exists`
  condition was met, its *mechanism* had been overtaken: registry validation
  is deterministic and hermetic in `validate.sh`, run by the pre-commit hook
  and CI. A subagent would have been slower, nondeterministic, and unable to
  gate a commit — a weaker check presented as done. Closed as superseded
  (ADR-0011). **Two real defects came out of scoping it anyway**, which is
  the argument for scoping an item before either building or dropping it.
- Read alongside B-002: both sat for sprints as boilerplate. One turned out
  to contain a real requirement once split from an unspecified one; the other
  did not. **An item's age is not an argument for implementing it.**
- B-002's title was the defect, like B-006's verb before it. It bundled a
  fully-specified requirement (frontmatter rules, written down in
  `docs/development/authoring-guide.md` and unenforced) with an entirely
  unspecified one (a "line budget" defined nowhere in the repo). That
  mismatch is why it sat `ready` for three sprints: it could not be
  scoped as written. Split, the first half took one commit. See ADR-0008.
- B-004 was a *known* gap, not a discovered one — ADR-0003 recorded at the
  time that `license: MIT` was unbacked, and it stayed that way for three
  sprints. Recording a gap honestly is necessary but not sufficient; it
  also has to get closed.
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
| B-004 | Repo LICENSE file (backs skill `license:` claims) | low | medium | none | low | **done** | TASK-0013 — MIT chosen by human; ADR-0003's known gap closed |
