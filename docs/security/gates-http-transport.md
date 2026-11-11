# gates over Streamable HTTP: settings and sandbox

The decision and threat model are ADR-0063 (**proposed**). This page is the operator's: what to set, and how to confine the process. Nothing here is deployed by this repository; exposing the endpoint beyond loopback is the human's step and needs ADR-0063 accepted first.

## Off by default

Without `GATES_TRANSPORT`, or with `GATES_TRANSPORT=stdio`, gates is the stdio server every client wiring uses, unchanged. `GATES_TRANSPORT=streamable-http` is the only way on.

## Settings when on

All are described in `mcp-servers/gates/pyproject.toml` `[tool.ai-toolbox.environment.*]`. The server refuses to start if any required one is missing or weak.

| Variable | Required | Rule |
|----------|----------|------|
| `GATES_HTTP_RESOURCE_URL` | yes | https URL callers use, e.g. `https://gates.example.com/mcp`; token `aud` must equal it |
| `GATES_OAUTH_ISSUER` | yes | https issuer; token `iss` must equal it |
| `GATES_OAUTH_JWKS_URL` | yes | https JWKS of that issuer |
| `GATES_OAUTH_CLIENTS` | yes | comma-separated client ids allowed (`client_id` or `azp`) |
| `GATES_OAUTH_REQUIRED_SCOPES` | no | every request; default `gates:read` |
| `GATES_OAUTH_RUN_SCOPES` | no | also needed by `start_gate` and `kill_gate`; default `gates:run` |
| `GATES_OAUTH_JWKS_CACHE_SECONDS` | no | key-set cache, default 300; a removed key stops validating within it |
| `GATES_OAUTH_REQUIRE_AT_JWT` | no | default `true`: header `typ` must be `at+jwt` |
| `GATES_OAUTH_ALLOW_MULTI_AUDIENCE` | no | default `false`: an `aud` list with more than one value is refused |
| `GATES_HTTP_MAX_RUNNING` | no | gates running at once, default 2 |
| `GATES_HTTP_MAX_CONNECTIONS` | no | uvicorn `limit_concurrency`, default 16 |
| `GATES_OAUTH_ALGORITHMS` | no | default `RS256`; HS* and `none` refused |
| `GATES_OAUTH_MAX_TOKEN_SECONDS` | no | default 900; longer-lived tokens refused |
| `GATES_HTTP_HOST` | no | default `127.0.0.1`; only a loopback IP literal |
| `GATES_HTTP_PORT` | no | default 8765 |
| `GATES_SANDBOX` | — | must be `bwrap` (the default); `none` is refused in HTTP mode |

No secret is needed: the server checks signatures with the issuer's public keys. The gate map, its hash and the executable allowlist are the same as for stdio.

Run: `GATES_TRANSPORT=streamable-http ... uv --directory mcp-servers/gates run gates`. The endpoint is `/mcp`; Protected Resource Metadata (RFC 9728) is at `/.well-known/oauth-protected-resource/mcp`, unauthenticated. Requests are stateless and answered as JSON; a request without a valid token gets 401, one without the read scope 403. A token without the run scope can list and read but not start or kill; a client sees only the gates it started; tool errors carry no absolute paths or hashes.

## Sandbox layers

1. **Each gate**: bubblewrap, as on stdio: no network, read-only filesystem, private `/tmp`, empty environment, all capabilities dropped. HTTP mode refuses to start without it.
2. **The listener**: loopback only, checked at startup and again before binding; Host must be the bind address (DNS rebinding); browser Origins are refused.
3. **The process** (the deployer's, suggested for a systemd unit):

```ini
[Service]
# a dedicated account with no login and no sudo
User=gates
# the settings above; not in any repository
EnvironmentFile=/etc/gates/http.env
NoNewPrivileges=yes
ProtectSystem=strict
# the consuming repository and its gate map then live outside /home
ProtectHome=yes
PrivateTmp=yes
# GATES_RUN_ROOT only
ReadWritePaths=/var/lib/gates/run
CapabilityBoundingSet=
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
# bwrap needs unprivileged user namespaces for each gate:
RestrictNamespaces=user net pid ipc uts mnt
LockPersonality=yes
SystemCallArchitectures=native
```

Outbound traffic is needed only to the JWKS URL; restrict egress to it at the host firewall.

## In front of it (the human's deployment)

A TLS reverse proxy or tunnel on the public name, forwarding only `/mcp` and `/.well-known/oauth-protected-resource/mcp` to `127.0.0.1:8765`, sending `Host: 127.0.0.1:8765`, with a read timeout above 420 s (`wait_gate`). No `X-Forwarded-*` header is trusted by gates.

## Revoking

Remove the client from `GATES_OAUTH_CLIENTS` and restart; or disable the client at the issuer (effective within the token lifetime). To rotate a key, publish the new key in the JWKS first (an unknown `kid` forces a refetch), then remove the old one: it stops validating within `GATES_OAUTH_JWKS_CACHE_SECONDS`. Or unset `GATES_TRANSPORT` to turn the transport off.
