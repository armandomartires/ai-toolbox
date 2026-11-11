# Model-only providers (xAI, OpenAI): function calling and remote MCP

xAI and OpenAI models are used here through their APIs, not as clients with this repo's wiring. They reach tools two ways. Plan item P2.6 (TASK-0285); decision ADR-0063 (**proposed**).

## The eval providers stay

`evals/run.py --provider xai|openai` calls the chat completions endpoints with `XAI_API_KEY` / `OPENAI_API_KEY` (from Vault, ADR-0030) and the model in `EVAL_XAI_MODEL` / `EVAL_OPENAI_MODEL`. They send no tools; they score role answers.

## Function calling (default, no network exposure)

The model proposes a call; your harness runs it. Nothing listens on a network:

1. Start gates over stdio as usual (`uv --directory mcp-servers/gates run gates`) inside the harness.
2. Turn each tool from its `tools/list` into a function definition: `name`, `description`, and `inputSchema` as `parameters`. Tools take only `name`, `handle` and `max_wait_seconds`, never a command.
3. Send the definitions with the request (`tools: [{"type": "function", ...}]` on both providers); when the model returns a tool call, call the MCP tool and return its result in the next message.
4. Ask a human before forwarding `start_gate` or `kill_gate` (both are `destructiveHint: true`); annotations are hints, so the harness enforces this, not the model.

Use this unless the provider must call gates on its own.

## Remote MCP (provider-side; needs the human's deployment)

The provider's servers call the gates endpoint themselves, so it must be reachable from the internet over TLS. gates speaks Streamable HTTP only when `GATES_TRANSPORT=streamable-http`, only on loopback, and only with OAuth 2.1 tokens (settings: `docs/security/gates-http-transport.md`). Until a human deploys a proxy, names the issuer and accepts ADR-0063, this path is not available, and a live call needs written authorization in a task file.

Give the provider a short-lived access token (`typ: at+jwt`) issued for `GATES_HTTP_RESOURCE_URL` to a client id in `GATES_OAUTH_CLIENTS`, with scope `gates:read`, plus `gates:run` only if it may start or kill gates; also limit the tools. Shapes as documented on 2026-11-10 (sources X3 and the OpenAI remote-MCP guide in the alignment plan); check the field names against the live docs before use:

OpenAI, Responses API:

```json
{"type": "mcp", "server_label": "gates", "server_url": "https://gates.example.com/mcp",
 "authorization": "<access token>",
 "allowed_tools": ["list_gates", "start_gate", "wait_gate", "gate_status"],
 "require_approval": {"never": {"tool_names": ["list_gates", "wait_gate", "gate_status"]}}}
```

`start_gate` then needs approval on each call; leave `kill_gate` out unless it is needed.

xAI, remote MCP tool:

```json
{"type": "mcp", "server_label": "gates", "server_url": "https://gates.example.com/mcp",
 "authorization": "<access token>",
 "allowed_tool_names": ["list_gates", "wait_gate", "gate_status"]}
```

No per-call approval step is assumed on xAI, so give it the read-only tools and a `gates:read`-only token; adding `start_gate` means a model can start gates unattended and needs the human's written authorization.

## Not exercised

No remote-MCP call has been made: there is no deployed endpoint and no issuer. The HTTP transport is proven by hermetic tests only (`mcp-servers/gates/tests/test_http.py`).
