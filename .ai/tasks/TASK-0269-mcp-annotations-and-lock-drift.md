# TASK-0269 — MCP hygiene: gates annotations and lock drift (P0.4)

## Status

- Status: planned
- Owner: agent
- Branch: agent/TASK-0269
- Created: 2026-11-10
- Updated: 2026-11-10
- Applies to: `mcp-servers/gates/`, `mcp-servers/graphify/`, `scripts/mcp-tool-lock.py`
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P0.4 (Q4), decisions Q12=A (lock all 17 graphify tools); related: #7 / R-04 (integrity-pinned installs, tool hashing)

## Objective

Give MCP clients accurate safety hints on the five gates tools and close the graphify drift, where `server.json` lists 17 tools and `tools.lock.json` pins 12. Q12=A: lock all 17 and keep the full surface.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mcp-servers/gates/src/gates/server.py` | 5 tools, no annotations |
| `mcp-servers/gates/` | has no `server.json` and no `tools.lock.json`; both are new files this task creates |
| `mcp-servers/graphify/server.json` and `tools.lock.json` | 17 listed (12 in `wired_command_tools` plus 5 in the prose list, about lines 66-72), 12 locked; no consumer in the repo |
| `scripts/mcp-tool-lock.py` `snapshot()` | hashes the live `tools/list`, which serves 12; the other 5 exist only as prose in `server.json` |
| `scripts/mcp-tool-lock.py` and `.gitlab/ci/mcp-tool-lock.yml` | do not compare listed tools to locked tools; the job covers only `mcp-servers/ansible` and `mcp-servers/graphify`, so adding gates to it is new work |
| CODEOWNERS | lock files need an owner review |

## Scope

- In: annotations on the gates tools (`start_gate` and `kill_gate` with `destructiveHint`; `list_gates`, `gate_status`, `wait_gate` with `readOnlyHint`); create `mcp-servers/gates/server.json` and `tools.lock.json`; make the lock run list all 17 graphify tools and regenerate its lock; add gates to the `mcp-tool-lock` job; a CI assertion that listed tools equal locked tools for every server and that gates `tools/list` carries annotations.
- Out: narrowing graphify's `cli_scope` or removing it (not chosen); wiring a graphify consumer; the HTTP transport for gates (TASK-0285); changing tool behaviour.

## Likely files

- `mcp-servers/gates/src/gates/server.py`
- `scripts/mcp-tool-lock.py`
- `mcp-servers/*/tools.lock.json`
- the mcp-tool-lock CI job under `.gitlab/ci/`
- `tests/smoke-mcp.sh` if it hosts the annotation check

## Execution plan

1. Find out why the live graphify server lists only 12 tools (a config, a flag or an optional dependency) and make the lock run's `tools/list` return all 17. If that is impossible, stop and report to the human: Q12=A would need to be asked again. Do not lock the 5 from prose.
2. Add the assertion (listed == locked for every server; gates annotations present) and run it; it fails on graphify and on gates.
3. Add the annotations in `server.py`; create the gates `server.json` and generate its `tools.lock.json`.
4. Regenerate the graphify lock with `scripts/mcp-tool-lock.py` at 17 tools, and add gates to the CI job's server list.
5. Run the assertion green; revert the annotations and, separately, one lock entry, and see each fail; restore.
6. Run `tests/validate.sh`.

## Acceptance criteria

- [ ] `tools/list` for gates returns the five tools with the stated annotations
- [ ] Every server's listed tools equal its locked tools, graphify at 17; "listed" means the live `tools/list` in the lock run, not the prose in `server.json`
- [ ] `mcp-servers/gates/server.json` and `tools.lock.json` exist and the `mcp-tool-lock` job covers gates
- [ ] Reverting the annotations or a lock entry fails the CI job

## Mandatory validations

- [ ] tests/validate.sh
- [ ] `bash tests/smoke-mcp.sh` and the mcp-tool-lock check

## Risks and rollback

- The live server may not be able to list 17 (a version or option difference). Then this task stops and reports to the human, since Q12 would need re-asking.
- Locking 17 tools of an unused server keeps a larger attack surface than narrowing to 12; the surface was accepted (Q12=A, not the assessment's recommendation).
- Lock hashes change; the diff needs CODEOWNERS review.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next:

## Execution log

- 2026-11-10 · agent/Sonnet 5.5 · brief written from the alignment plan; no work done yet
  - Evidence: none yet
  - Deviation: none
