# Roadmap

## Vision
A validated, indexed, versioned library of AI customization tools that
any agent or human can understand, trust, and deploy.

## Phase 1 — Foundation (current)
- Objectives: scaffold structure; port existing components; validate
  install.sh for Claude Code.
- Milestone: first component installed and used in a real session.
- Exit criteria: install, registry sync, and validate scripts pass; at
  least three components migrated.

## Phase 2 — Multi-client deployment
- Objectives: OpenCode and LM Studio sync targets; configs/ snapshots.
- Exit criteria: one skill and one MCP server working in all clients.

## Phase 3 — Automation
- Objectives: CI checks (frontmatter validation, server smoke tests);
  registry automation in task flow.
- Exit criteria: tests/validate.sh wired into CI or pre-commit.

## Risks
- Client config format drift; symlink issues on Windows; skill spec
  evolution. Mitigations: configs/ snapshots, ADR-0002, spec templates.
