# ADR-0065 — Claude Code is the reference profile; each port maps a term or refuses the role

**Status**: proposed
**Date**: 2026-11-12
**Task**: `TASK-0280`

Within the alignment plan item P2.1 (S1), decisions D1=B and D6=A,B,C. Supersedes, for agents, ADR-0018's rule that the capability profile sits at the ceiling of what both clients can enforce; keeps ADR-0018 clauses 1-5 and 8.

## Context

ADR-0018 made one abstract capability profile per role and emitted it to Claude Code and OpenCode, admitting a term only where both clients enforced it. Seven terms were refused for Claude Code until the role guard (ADR-0062, TASK-0271) enforced them there. Claude Code now expresses every term in the vocabulary: tools withheld, the role guard, or worktree isolation. The plan (D6) adds Codex as a supported port with tests and keeps Bionic and LM Studio best-effort and untested.

A Codex custom agent (`.codex/agents/<role>.toml`, read 2026-11-12 from Codex's subagent, rules and hooks docs) takes `name`, `description` and `developer_instructions`, a model, and feature switches such as `features.shell_tool = false`. Its sandbox, approval policy, MCP servers and `prefix_rule` command rules are the parent session's, and its `PreToolUse` hook input names no agent, so no hook can act as the role guard does.

## Decision

1. **Claude Code is the reference.** A capability term means what Claude Code enforces for it (`scripts/emit-agents.py` `VOCAB[...]["claude_code"]`). A new term is admitted when Claude Code can enforce it, with the role guard if need be.
2. **Each port maps a term or refuses the role.** OpenCode keeps its permission maps, unchanged. Codex maps only `no-bash` (`features.shell_tool = false`); every other term is refused for Codex, so a role carrying one is not emitted for it. ADR-0018 clause 8, refuse and never degrade, holds for every port.
3. **One source emits all three formats.** `emit-agents.py codex <dir>` writes `<role>.toml`; Claude Code and OpenCode output does not change. Installing the Codex files is TASK-0281.
4. **The parity matrix is generated and tested.** `emit-agents.py --parity` prints a term table (how each client expresses each term) and a role table (emitted, plugin only, refused and why, not declared). `scripts/sync-registry.sh` writes it into `docs/registry.md`. `tests/test-emit-parity.sh` checks the registry equals it, that each role row matches what an emission writes, and that dropping a mapping changes it.
5. **Bionic and LM Studio take no agents** (ADR-0018 clause 6, ADR-0020) and are labelled best-effort and untested.

## Alternatives considered

- **Instruction-only roles on Codex (best-effort).** Emit every role to Codex with its boundary written into `developer_instructions` and a note that nothing enforces it. Gives Codex users the roles, but ships files that claim boundaries nothing holds: the false-boundary class ADR-0018 clause 8 exists to refuse. **Open for the human:** accepting this would amend clause 2 for Codex only, with the matrix marking each such term "instructed, not enforced".
- **Global Codex rules per project.** `.codex/rules/*.rules` with `prefix_rule` could hold the bash allowlists, but for the whole session, not per agent; one role's allowlist would bind every other.
- **Derive the OpenCode maps from the guard rules.** Would change emitted OpenCode permissions that tests and live runs have verified (TASK-0045, TASK-0082, TASK-0083), for no gain in enforcement.

## Consequences

- Today no role reaches Codex: each carries `read-only` or `no-delegation`, which Codex cannot set per agent. The matrix says so per role; a Codex release that lets an agent file narrow its sandbox or block spawning, or a hook input that names the agent, would add rows to `CODEX` and roles to the port.
- TASK-0281's install step can deliver skills and hooks to Codex; its `.codex/agents/` count is zero until then.
- The Codex mapping rests on documentation, not a loaded file: no Codex binary on this host.
