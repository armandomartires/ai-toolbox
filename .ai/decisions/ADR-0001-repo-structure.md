# ADR-0001 — Harmonized repo structure

## Status
Accepted

## Context
One home for AI customization tools, governed by the .ai framework
(context/planning/tasks/sessions/decisions) used across projects.

## Decision
Two layers: component layer (skills/, mcp-servers/, loops/, prompts/,
agents/, configs/) as the analog of src/ for a component-collection
repo, and the .ai governance layer. ADRs live in .ai/decisions/ (not
docs/decisions/) to follow the framework. Registry is generated.

## Consequences
- Portability across Claude Code, OpenCode, LM Studio.
- Repo is source of truth; clients are sync targets.
