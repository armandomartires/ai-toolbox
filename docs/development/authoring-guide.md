# Component Authoring Guide

## Skills
- SKILL.md required, case-sensitive; frontmatter needs `name` and
  `description`. No README.md inside skill folders.
- Keep SKILL.md lean; push detail into `references/`.
- Scripts must be idempotent and safe to re-run.

## MCP servers
- Python 3.10+, src layout, hatchling, FastMCP.
- One tool per concern; document every argument; tests required before
  registration in configs/.

## Loops
- loop.md with frontmatter, trigger, steps, and explicit exit conditions.

## Versioning
- Semver per component (pyproject.toml or frontmatter comment).
- Interface-breaking changes get an ADR in .ai/decisions/.
