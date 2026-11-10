# TASK-0285 — Gates over HTTP behind OAuth 2.1, sandboxed (P2.6, HIGH RISK)

## Status

- Status: planned
- Owner: agent
- Branch: agent/TASK-0285
- Created: 2026-11-10
- Updated: 2026-11-10
- Applies to: `mcp-servers/gates/`, `.ai/decisions/`, provider docs, `tests/validate.sh`
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P2.6 (S6), decisions D7=B (HTTP transport behind OAuth 2.1, sandboxed, with its own ADR; P2.6 stays HIGH risk); related: R-03

## Objective

Make the gates server reachable over Streamable HTTP for remote harnesses (xAI and OpenAI server-side MCP), behind OAuth 2.1, in a sandbox, and with an ADR that owns the decision. The gates server starts gate commands, so this exposes an execution server to a network. Keep the xAI and OpenAI eval providers and document function-calling and remote-MCP use.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mcp-servers/gates/src/gates/server.py` | stdio FastMCP only |
| `mcp-servers/gates/server.json` | does not exist (nor `tools.lock.json`); this task creates `server.json` for the transport declaration, and TASK-0269 may have created both first |
| ADR-0024, ADR-0025 | the gate server and invoker rule |
| MCP 2026-07-28 and the xAI and OpenAI remote-MCP docs | OAuth 2.1 required for HTTP; re-check before writing the ADR |

## Scope

- In: a new ADR (threat model, who authenticates, what a remote caller may run, how to revoke); an HTTP transport enabled only by explicit config and off by default; OAuth 2.1 token validation; sandbox settings for the process; a validate check failing if `server.json` declares an HTTP transport without an ADR id; provider docs for xAI and OpenAI.
- Out: exposing any other server; running the endpoint on a public host (deployment is the human's); changing gate commands; stdio behaviour. A live remote test needs human authorization (AGENTS.md rule for destructive capabilities).

## Likely files

- `mcp-servers/gates/src/gates/server.py`
- `mcp-servers/gates/server.json` (new; the transport declaration lives here)
- a new ADR under `.ai/decisions/`
- `tests/validate.sh` or a new check script
- provider docs under `docs/`
- `mcp-servers/gates/tools.lock.json` (new, or regenerated if TASK-0269 created it)

## Execution plan

1. Add the validate check: an HTTP transport in `server.json` without an ADR id fails. Run it against a fixture and see it fail.
2. Write the ADR, threat model first; stop and ask the human if the identity provider or deployment is unknown.
3. Implement the HTTP transport behind config, with OAuth 2.1 validation and refusal of unauthenticated calls.
4. Add tests: unauthenticated call refused; wrong audience refused; stdio unchanged.
5. Sandbox the HTTP process and document the settings.
6. Update provider docs; create or regenerate the gates lock.
7. Run the check green; remove the ADR id and see it fail.
8. Run `tests/validate.sh` and `tests/smoke-mcp.sh`.

## Acceptance criteria

- [ ] A transport declaration without an ADR id fails validation
- [ ] An unauthenticated HTTP call to gates is refused and an authenticated one lists the tools
- [ ] The HTTP path is off unless configured
- [ ] Provider docs describe function-calling and remote-MCP use

## Mandatory validations

- [ ] tests/validate.sh
- [ ] `bash tests/smoke-mcp.sh` and the new transport check

## Risks and rollback

- HIGH: a network-reachable endpoint that can start gate commands; off by default, OAuth 2.1 mandatory, sandboxed, and no live exposure without the human's sign-off.
- D7=B was not the assessment's recommendation (stdio only); the ADR must say why it is accepted and what would reverse it.
- The OAuth 2.1 requirement is as read from the MCP spec in the plan; re-verify against the current spec before coding.
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
