# ADR-0005 — MCP servers may be Node/npm packages, not only Python/FastMCP

## Status
Accepted (2026-09-13)

## Context
`AGENTS.md`'s Technology stack section states: "MCP servers: Python 3.10+,
src layout, hatchling, FastMCP, strict schemas, one tool per concern,
tests required." `scripts/sync-registry.sh` and `scripts/install.sh` both
hard-code discovery on `mcp-servers/*/pyproject.toml`, and
`.ai/context/GLOSSARY.md` defines "MCP server" as "Model Context Protocol
tool provider (Python package here)."

TASK-0004 set out to port the first real MCP server. The most viable
candidate — proven working in this environment, already connected in a
live session, already used successfully in `opencode-customization`'s own
`S023_MCPStack` sprint — is `@ansible/ansible-mcp-server`, distributed as
an **npm package** and launched via `npx -y @ansible/ansible-mcp-server
--stdio`. It has no Python source to port: it is a complete, working
implementation in a different language runtime.

The Model Context Protocol itself is language-agnostic — a server is
just a process speaking the MCP stdio/SSE protocol. This repo's original
Python-only rule was written before any real server was evaluated, and
reflects an assumption (every MCP server we'll ever use is one we write
ourselves in Python) that the first real candidate already contradicts.

## Decision
`mcp-servers/` may contain either:

- **A Python/FastMCP package** (the original shape: src layout,
  hatchling, `pyproject.toml`, tests) — for servers this repo authors
  itself.
- **A Node/npm-launched server reference** — for servers that ship as a
  complete upstream package (npm, PyPI CLI, or similar) with no source to
  vendor. This is documented as a `configs/*/README.md` wiring snippet
  (the launch command, required environment variables, and any
  destructive-capability flags) and a `docs/registry.md` entry, **not** a
  vendored copy of the upstream package's source.

A component's registry entry states which shape it is (`python` or
`external`) so `scripts/sync-registry.sh` and a human reader both know
whether to expect a `pyproject.toml` or a config-only wiring doc.

**One tool per concern, strict schemas, tests required** still apply
where this repo controls the code (the Python/FastMCP shape). They do not
apply to an external package's internals — this repo cannot enforce
conventions inside code it doesn't own. What this repo *can* and does
require of an external server: documented required environment variables,
and an explicit note if the server exposes destructive capabilities (per
`AGENTS.md`'s existing rule), regardless of which language it's written in.

## Alternatives considered
- **Keep Python-only; skip ansible, wait for or write a Python
  equivalent.** Rejected: this repo's own stated goal (`AGENTS.md`
  Objective) is to collect and deploy AI customization tools that already
  work, not to necessarily re-implement every tool from scratch in a
  preferred language. Writing a fresh Python/FastMCP wrapper around
  Ansible tooling that already has a proven, working, actively-maintained
  npm implementation would be duplicate work with no clear benefit over
  documenting the real thing.
- **Vendor the npm package's source into `mcp-servers/ansible/`.**
  Rejected: this repo doesn't build or publish npm packages, has no
  Node build tooling, and vendoring source this repo doesn't maintain
  creates exactly the update-drift problem `project-workflow`'s own
  "copy, never symlink, but propagate improvements back" rule exists to
  avoid — except here there'd be nowhere to propagate improvements *to*,
  since upstream is a third party.
- **Treat it as config-only with no `mcp-servers/` entry or registry
  row at all.** Rejected: this repo's registry is meant to be the
  complete index of everything deployable from here (ADR-0001). Omitting
  external servers from the registry just because they're not Python
  would make the registry incomplete by construction, contradicting its
  own stated purpose.

## Consequences
- `AGENTS.md`'s Technology stack section is updated in this same task to
  state both shapes.
- `docs/development/authoring-guide.md`'s "MCP servers" section gains the
  same distinction.
- `.ai/context/GLOSSARY.md`'s "MCP server" entry drops "(Python package
  here)" — no longer universally true.
- `scripts/sync-registry.sh` needs a second discovery path (external
  servers, keyed off a per-server manifest or `configs/`-referenced list,
  not `pyproject.toml`) — implemented in the task that actually ports the
  first external server (TASK-0005), not this ADR, per "an ADR states
  *why*, the normative doc/implementation states *what*."
- `scripts/install.sh`'s "Register MCP servers" loop, currently
  Python-only, needs the same extension — same deferral as above.
- A future contributor evaluating a new MCP server first asks "does a
  working implementation already exist" before writing one from scratch,
  which is the correct default for a components-collection repo whose
  explicit Objective is "collect, develop, validate, and deploy."
