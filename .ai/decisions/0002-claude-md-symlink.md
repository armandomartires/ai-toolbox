# ADR-0002 — CLAUDE.md strategy

## Status
Accepted

## Context
CLAUDE.md must point at AGENTS.md without two divergent sources of
truth. Symlinks can be unreliable on Windows Git checkouts unless
core.symlinks=true is set before clone.

## Decision
CLAUDE.md is a symlink to AGENTS.md. Fallback if a checkout renders it
as a plain text file: copy AGENTS.md to CLAUDE.md and re-sync at the
start of any session that touches agent instructions.

## Consequences
- One source of truth; verify with `git ls-files -s CLAUDE.md`
  (mode 120000 = symlink) after cloning on Windows.
