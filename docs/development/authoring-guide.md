# Component Authoring Guide

## Skills
- SKILL.md required, case-sensitive. Required frontmatter: `name`,
  `description`. Optional frontmatter: `license`; `metadata.author`;
  `metadata.version` (semver — see Versioning below). No README.md
  inside skill folders.
- Keep SKILL.md lean; push detail into `references/`.
- Scripts must be idempotent and safe to re-run.

## MCP servers
Two shapes (ADR-0005). A server directory must contain **exactly one** of
`pyproject.toml` (authored) or `server.json` (external) — never both,
never neither. The shape is derived from which file is present, so it
cannot drift out of sync with the directory's actual contents;
`scripts/sync-registry.sh` reports it in the registry's Shape column.

- **Authored (Python)**: Python 3.10+, src layout, hatchling, FastMCP.
  One tool per concern; document every argument; tests required. Copy
  from `mcp-servers/_template/`.
- **External (npm, PyPI CLI, etc.)**: no source vendored. Described by a
  `server.json` manifest (schema below). Copy from
  `mcp-servers/_template-external/`. Per-client wiring goes in
  `configs/*/README.md`; the manifest, not the wiring snippet, is the
  machine-readable source of truth.

### `server.json` schema (external servers)
All keys below are required unless marked optional. `scripts/install.sh`
reads `launch` and `environment`; `tests/validate.sh` enforces required
keys and the `capabilities`/`authorization` rule.

| Key | Meaning |
|-----|---------|
| `name` | Server name; must match the directory name. |
| `description` | One line, for the registry. |
| `upstream.registry` | Where the package comes from: `npm`, `pypi`, … |
| `upstream.package` | Exact package name as published. |
| `upstream.version` | Version this repo has tested and wired. This repo does not own the number — record what upstream published. |
| `upstream.license` | Upstream's license identifier. |
| `upstream.homepage` | *Optional.* Upstream docs or repo URL. |
| `launch.command` | Argv array, exactly as a client should invoke it. |
| `launch.transport` | `stdio` or `sse`. |
| `runtime.declared` | Runtime the package *declares* it needs (e.g. `node>=24.0`). |
| `runtime.tested` | Runtime it was actually verified on here. Record both: npm `engines` is advisory by default, so a package can declare one version and run on another. Claiming only one number misleads either way. |
| `environment` | Object of `VAR: {required, description}`. Never put secret *values* here — only names and meanings. |
| `preconditions` | *Optional.* Array of things that must be true beyond env vars (a running desktop app, an installed extra). |
| `capabilities.destructive` | Boolean. True if any tool can change state outside the agent's own context. |
| `capabilities.destructive_tools` | Array of `"tool: what it can do"` strings. Required (and non-empty) when `destructive` is true. The boolean is what validation gates on; this list is what a human needs to make an informed decision. |
| `authorization` | Required when `destructive` is true: `{granted, by, date, task}`. `task` is a repo-relative path to the task file carrying the authorization, and validation asserts that file exists — an authorization pointing at nothing is not an authorization. |

Adding an external server with `capabilities.destructive: true` and no
granted authorization fails `tests/validate.sh`. That is the mechanical
form of `AGENTS.md`'s rule that destructive capabilities need explicit
human authorization in the task file.

## Loops
- loop.md with frontmatter, trigger, steps, and explicit exit conditions.

## Versioning
- Semver per component. Skills: `metadata.version` in SKILL.md
  frontmatter (see ADR-0003). Authored MCP servers: `pyproject.toml`.
  External MCP servers: the upstream package's own version, recorded in
  the `configs/*/README.md` snippet — this repo doesn't own that number.
- Interface-breaking changes get an ADR in .ai/decisions/.
