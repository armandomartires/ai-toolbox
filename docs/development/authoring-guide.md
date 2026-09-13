# Component Authoring Guide

## Skills
- SKILL.md required, case-sensitive. Required frontmatter: `name`,
  `description`. Optional frontmatter: `license`; `metadata.author`;
  `metadata.version` (semver — see Versioning below). No README.md
  inside skill folders.
- Keep SKILL.md lean; push detail into `references/`.
- Scripts must be idempotent and safe to re-run.

## MCP servers
Two shapes (ADR-0005) — state which one in the registry entry.

- **Authored (Python)**: Python 3.10+, src layout, hatchling, FastMCP.
  One tool per concern; document every argument; tests required.
- **External (npm, PyPI CLI, etc.)**: no source vendored. Document the
  launch command, required environment variables, and any destructive
  capability in a `configs/*/README.md` wiring snippet. Still needs a
  `docs/registry.md` entry.

## Loops
- loop.md with frontmatter, trigger, steps, and explicit exit conditions.

## Versioning
- Semver per component. Skills: `metadata.version` in SKILL.md
  frontmatter (see ADR-0003). Authored MCP servers: `pyproject.toml`.
  External MCP servers: the upstream package's own version, recorded in
  the `configs/*/README.md` snippet — this repo doesn't own that number.
- Interface-breaking changes get an ADR in .ai/decisions/.
