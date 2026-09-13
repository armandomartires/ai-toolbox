# Sprint S4 — Closing the open loops

Phase 4. Opened 2026-09-13. **Active.**

Goal: close every backlog item that can be closed, and convert the ones
that cannot into either a recorded decision or a written human-action
procedure. Scope confirmed with the human before briefs were written, per
`AGENTS.md`'s ambiguity policy.

## Tasks

| Task | Subject | Backlog | Status |
|------|---------|---------|--------|
| TASK-0012 | Skill linter — frontmatter rules only | B-002 | planned |
| TASK-0013 | MIT LICENSE backing the skills' `license:` claims | B-004 | planned |
| TASK-0014 | `install.sh` warns on the `core.filemode=false` hook trap | — | planned |
| TASK-0015 | Required env vars documented + validated; git remote wired | B-001 | planned |
| TASK-0016 | Human-action runbooks; Python-shape decision | — | planned |

## Scope decisions taken at sprint open

These were ambiguous and went to the human rather than being invented:

- **B-002 is frontmatter-only.** The "line budget" half of its title had
  no threshold anywhere in the repo — `docs/development/authoring-guide.md`
  defines required/optional keys but no maximum length. Enforcing a number
  would have meant inventing a requirement. Recorded in ADR-0008.
- **MIT**, matching what `skills/project-migration/SKILL.md` and
  `skills/project-workflow/SKILL.md` already claim. The repo asserting a
  license in frontmatter with no `LICENSE` file was the actual defect.
- **The remote comes from environment variables**, which already exist on
  this machine (`GITHUB_URL`, `GITHUB_TOKEN`). The gap was that nothing
  told a new contributor they were required. ADR-0009.
- **The Python MCP shape stays unexercised, by decision.** ADR-0010
  records why a synthetic server is worse than an honest gap.

## Standing constraints (carried from S3)

- Local git is mandatory; a remote is recommended (ADR-0007). S4 adds one,
  which does not promote it to mandatory.
- `tests/validate.sh` is a commit gate. Its hermeticity — offline, no
  network, sub-second — is load-bearing. Never add `tests/smoke-mcp.sh`
  to the hook, and never add a check that reads the network or an env var
  that only exists on one machine.
- ADR-0005 through ADR-0007 all exist because a criterion written at
  scaffold time met reality and lost. Check assumptions against the
  environment before writing criteria.
