# ADR-0063 — gates may speak Streamable HTTP, off by default, behind OAuth 2.1, loopback only

**Status**: proposed
**Date**: 2026-11-11
**Task**: `TASK-0285`

Within the alignment plan item P2.6 (decision D7=B). Builds on ADR-0024 (authored MCP shape) and ADR-0025 (who starts a gate). Proposed: the identity provider and any deployment are open questions for the human (clause 8).

## Context

xAI and OpenAI reach MCP servers server-side only over Streamable HTTP or SSE, so a remote harness cannot use the stdio-only gates server. The assessment recommended stdio only (D7=A); the human chose B: an HTTP transport behind OAuth 2.1, sandboxed, with its own ADR. gates starts the commands a consuming repository's hash-pinned map names (ADR-0025), so this puts an execution server on a network.

Spec status, re-checked 2026-11-11 against what could be read offline: the pinned SDK (mcp 1.30.0, `uv.lock`) speaks protocol 2025-11-25, where authorization is optional for HTTP transports and, when used, makes the server an OAuth 2.1 resource server that validates the token audience (RFC 8707), publishes Protected Resource Metadata (RFC 9728) and never passes tokens through. The plan cites MCP 2026-07-28 as requiring OAuth 2.1 for HTTP; that page could not be fetched from this session. This ADR makes authentication mandatory either way, so the decision does not depend on which reading is current.

## Threat model

| Asset or path | Threat | Control |
|---------------|--------|---------|
| `start_gate`, `kill_gate` (destructive, TASK-0088) | an unauthenticated or stolen-token caller runs or stops gates | bearer token on every request; short lifetime; client allowlist; run scope per call; gate ownership; running cap |
| the gate commands | a caller injects a command | unchanged: tools take a gate *name* only; the map is hash-pinned; argv[0] is allowlisted outside the map |
| the host | a gate escapes into the host or the network | gates run under bwrap with no network and a read-only filesystem; HTTP mode refuses `GATES_SANDBOX=none` |
| the listener | exposure on a LAN or the internet by a setting | only a loopback IP literal can be bound, checked at config time and again before binding |
| the browser | DNS rebinding, cross-origin calls | Host header must be the loopback bind; no Origin is allowed |
| tokens | forged, replayed for another service, held by a third party | signature against the issuer's JWKS, `iss` and `aud` exact, asymmetric algorithms only; a provider holding a token is accepted risk (clause 6) |

## Decision

1. **Off by default.** `GATES_TRANSPORT` unset or `stdio` runs exactly the stdio server as before; the HTTP module is not even imported. `streamable-http` is the only other value; anything else refuses to start. Client wiring (`.mcp.json`, plugins, `install.sh`) stays stdio.
2. **No anonymous mode.** With `streamable-http`, the server refuses to start unless `GATES_HTTP_RESOURCE_URL`, `GATES_OAUTH_ISSUER`, `GATES_OAUTH_JWKS_URL` (all https) and `GATES_OAUTH_CLIENTS` are set. Every request to `/mcp` needs a bearer JWT access token that gates validates itself: header `typ` `at+jwt` (RFC 9068; `GATES_OAUTH_REQUIRE_AT_JWT=false` only for an issuer that cannot set it), signature by the JWKS key its `kid` names (RS/PS/ES/EdDSA only), `iss` exactly the issuer (no trailing-slash tolerance), a single `aud` equal to the resource URL (lists only with `GATES_OAUTH_ALLOW_MULTI_AUDIENCE=true`), `exp`, `iat` and `sub` present, no future `iat`, `exp - iat` at most 900 s, `client_id` or `azp` in the allowlist, and the read scope (default `gates:read`). Failure is 401 with a `WWW-Authenticate` pointing at the Protected Resource Metadata; a missing scope is 403. Tokens are never forwarded.
3. **Who authenticates.** An OAuth 2.1 authorization server the human names (clause 8) authenticates the remote harness as a confidential client (client credentials, or the provider's own OAuth flow) and issues tokens for the gates resource URL. gates is a resource server only: it registers no clients and issues no tokens.
4. **What a remote caller may run.** The same five tools as stdio, nothing more, with the same schemas (the tool lock is asserted over both transports). Over HTTP: `start_gate` and `kill_gate` also need the run scope (default `gates:run`), checked per call; a gate belongs to the client that started it, and `wait_gate`, `gate_status` and `kill_gate` refuse another client's handle; at most `GATES_HTTP_MAX_RUNNING` (2) gates run at once and uvicorn caps connections (16); tool errors lose absolute paths and SHA-256 values. A remote client should get `start_gate` and `kill_gate` only with per-call approval (`require_approval` on OpenAI; see `docs/development/remote-model-providers.md`).
5. **Sandboxed and loopback only.** HTTP mode requires `GATES_SANDBOX=bwrap`. The listener binds `127.0.0.1` (or `::1`) and nothing else: making it reachable is a reverse proxy or tunnel with TLS that the human deploys, and is outside this repository. Process hardening for that deployment is in `docs/security/gates-http-transport.md`.
6. **Revocation and key rotation.** Remove the client id from `GATES_OAUTH_CLIENTS` and restart (immediate); disable the client at the issuer (effective within the token lifetime, 15 minutes by default). Only the key set is cached, for `GATES_OAUTH_JWKS_CACHE_SECONDS` (300); there is no per-key cache, so a key removed from the JWKS stops validating when the set expires, and an unknown `kid` forces one refetch so a new key works at once; unset `GATES_TRANSPORT` (immediate, everything). A provider such as xAI or OpenAI holds a token it was given for as long as the token lives; that is accepted, bounded by the lifetime cap.
7. **The declaration is checked.** `[tool.ai-toolbox.transports]` in `pyproject.toml` (or `transports` in an external `server.json`) declares every transport; `tests/check-mcp-transport.py`, run by `tests/validate.sh`, fails a non-stdio transport without an existing ADR id (an ADR whose title names the transport and whose status is proposed or accepted), `default = false`, `auth = "oauth2.1"` and `enabled_by`, and fails source that builds an HTTP app, passes an argument to `mcp.run` or calls `uvicorn.run` without a non-stdio declaration. The plugin's `.mcp.json` pins `GATES_TRANSPORT=stdio`. The enforcement tests run in CI job `gates-http`.
8. **Open, for the human before acceptance:** which authorization server issues the tokens (Keycloak, Entra ID, another); whether and where the endpoint is deployed, behind which proxy and hostname; and a live remote test, which needs written authorization in a task file (AGENTS.md, destructive capabilities). Until this ADR is accepted, the HTTP transport is run only on loopback in tests.

## Alternatives considered

- **Stdio only (D7=A, the assessment's recommendation).** No new attack surface; remote providers use function calling through a local harness. Not chosen by the human, who wants remote harnesses to reach gates; it stays the default and the fallback.
- **Defer (D7=C).** No remote use until a concrete case exists. Not chosen.
- **Static API key or shared HMAC secret.** Simpler, but a long-lived secret in the process environment and in every provider, with no audience or expiry; contrary to the MCP authorization model.
- **Token introspection (RFC 7662) instead of JWT validation.** Revokes instantly, but needs a client secret for the introspection call and a round trip per request; JWTs with a 15-minute cap were chosen. Revisit if the human's issuer only issues opaque tokens.
- **A setting that allows a non-loopback bind.** Rejected: exposure would become a typo; it stays a deployment step.

## Consequences

- A remote harness can call gates once the human deploys a TLS proxy and names an issuer; until then nothing changes for any client.
- What would reverse this: a token compromise or a gate run by an unauthorized caller; an MCP or provider change that breaks the resource-server model; or no remote harness using it within two review cycles. Reversal is `git revert` of TASK-0285, or simply never setting `GATES_TRANSPORT`.
- The HTTP path is covered by hermetic tests only (`mcp-servers/gates/tests/test_http.py`); it has not run against a real issuer or provider (an `Unexercised:` row is the coordinator's to add).
- Each gate call over HTTP holds a request open up to 420 s (`wait_gate`); the proxy's timeout must exceed that.
