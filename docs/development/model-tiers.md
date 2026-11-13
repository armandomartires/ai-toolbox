# Model tiers for Claude Code agents

The one tier table that `scripts/emit-agents.py` reads when it emits a role for Claude Code (ADR-0059, which supersedes ADR-0018 clause 7 for Claude Code emission only). It does not apply to OpenCode or Codex.

Each row maps one tier to its roles. A role not listed is emitted with `model: inherit`. To change a role's tier, move its name to another row; the emitter holds no copy.

| Tier | Roles |
|---|---|
| opus | adjudicator, critic, designer-manager, refuter, task-planner |
| sonnet | git-ops, ideator, implementer, qa-test, review |
| haiku | closer, gate-runner, park-steward, preflight, run-scribe |
