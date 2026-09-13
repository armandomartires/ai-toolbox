# TASK-0004 — Allow external (Node/npm) MCP servers alongside authored Python ones

## Objective
Amend `AGENTS.md`'s MCP-server rule, the authoring guide, the glossary,
and the project map to recognize a second, "external" MCP server shape —
so TASK-0005 (porting the first real server, `@ansible/ansible-mcp-server`,
an npm package) has a rule to follow instead of contradicting the
Python-only stack the repo started with.

## Minimal context
"Port first MCP server" (`.ai/tasks/TODO.md`) was unscoped — no server
named. Investigating candidates already connected in this environment
(`ansible`, `proxmox`, `obsidian` — all three used successfully in a
separate repo, `opencode-customization`'s `S023_MCPStack` sprint) found
only `ansible` has a working connection here right now (`proxmox`'s
router is missing a Python dependency; `obsidian` needs its desktop app
running, which it isn't).

`@ansible/ansible-mcp-server` is an **npm package**
(`npx -y @ansible/ansible-mcp-server --stdio`), not Python. `AGENTS.md`'s
stack rule as written ("MCP servers: Python 3.10+, ... FastMCP") would
make porting it either a rule violation or force writing a redundant
Python wrapper around Ansible tooling that already has a working,
maintained implementation. Human decision (2026-09-13): amend the rule
rather than force a rewrite or pick a different, less-proven server —
see ADR-0005 for the full reasoning and rejected alternatives.

## Scope

### Included
- ADR-0005: the decision itself, its alternatives, its consequences.
- `AGENTS.md`: Technology stack (two shapes) and Commands (run-a-server
  line, since it's Python-specific as written) sections.
- `docs/development/authoring-guide.md`: MCP servers and Versioning
  sections.
- `.ai/context/GLOSSARY.md`: "MCP server" entry, dropping the
  now-inaccurate "(Python package here)".
- `.ai/context/PROJECT_MAP.md`: `mcp-servers/` and `docs/registry.md`
  entries, both of which assumed Python-only.

### Not included
- **Actually porting `ansible`** — registry entry, `configs/*/README.md`
  wiring snippet, `scripts/sync-registry.sh`/`scripts/install.sh`
  extension to discover external servers. That's TASK-0005 and follows
  this task, per ADR-0005's own Consequences ("implemented in the task
  that actually ports the first external server, not this ADR").
- **`proxmox`/`obsidian`** — not decided as future ports; just observed
  as currently non-functional in this environment. No action taken on
  either.

## Preconditions
- Branch `master`, clean.
- Human confirmed the direction (amend the rule) after being shown the
  alternative options (write a Python wrapper instead; pick a different
  server; leave the rule as Python-only).

## Likely files
- `.ai/decisions/ADR-0005-mcp-servers-allow-node-packages.md` (new)
- `AGENTS.md`
- `docs/development/authoring-guide.md`
- `.ai/context/GLOSSARY.md`
- `.ai/context/PROJECT_MAP.md`

## Execution plan
1. Write ADR-0005 first (the decision the rest of this task implements).
2. Amend `AGENTS.md`'s Technology stack and Commands sections.
3. Amend the authoring guide's MCP servers and Versioning sections.
4. Amend the glossary's MCP server definition.
5. Amend the project map's `mcp-servers/` and registry descriptions.
6. Grep for any other place that assumes MCP servers are exclusively
   Python, to avoid leaving a second, unamended contradiction.
7. Validate, update planning docs, commit.

## Acceptance criteria
- [x] ADR-0005 exists, Accepted, states rejected alternatives.
- [x] `AGENTS.md` describes both shapes without contradicting itself.
- [x] Authoring guide, glossary, and project map all agree with
      `AGENTS.md` — no lingering "(Python package here)"-style claim.
- [x] Nothing in `scripts/sync-registry.sh` or `scripts/install.sh` is
      touched by this task (deferred to TASK-0005 per ADR-0005).

## Mandatory validations
- [x] tests/validate.sh
- [x] Grep for stale Python-only MCP-server claims across `AGENTS.md`,
      `docs/`, `.ai/context/` after editing, confirming none remain.

## Risks and rollback
- **Risk: this quietly weakens the "one tool per concern, strict
  schemas, tests required" bar** by exempting external servers from it.
  Mitigated by ADR-0005's explicit statement that those rules apply only
  to code this repo owns — an external package's internals were never
  actually enforceable, so this makes the rule honest rather than
  removing a real check.
- **Rollback**: `git revert` this task's commit. `AGENTS.md` and friends
  return to Python-only; TASK-0005 would then need re-scoping (a
  different server, or a Python-wrapper approach).

## Dependencies
None. Blocks TASK-0005 (ansible port), which needs this rule to exist
first.

## Expected result
The repo's own documentation stops contradicting the first real MCP
server it's about to port, with the reasoning for why captured in an ADR
rather than silently patched.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13
## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode (anthropic/claude-sonnet-5)
- Actions: investigated which of ansible/proxmox/obsidian MCP servers
  are actually functional in this environment before picking one (only
  ansible connects); found it's an npm package, surfaced the stack-rule
  contradiction to the human rather than silently writing a Python
  wrapper or silently vendoring npm source; wrote ADR-0005 and amended
  AGENTS.md, the authoring guide, the glossary, and the project map.
- Observations: three separate docs (`AGENTS.md`, authoring-guide.md,
  GLOSSARY.md) all independently asserted "Python" for MCP servers —
  confirming the original rule was written once and never
  cross-checked against a real server, exactly the kind of drift the
  "one owner per fact" principle exists to prevent, except here the
  fact itself (Python-only) was simply wrong once tested against reality.
- Validation: tests/validate.sh OK; grep for lingering Python-only claims
  clean after edits.
- Result: success.
- Commit: `ca9801b` "Allow external (Node/npm) MCP servers alongside
  authored Python ones" on `master`.
- Push: no remote configured — nothing to push.
