# ADR-0059 — The tier-to-model table for Claude Code emission is owned here

**Status**: accepted
**Date**: 2026-11-10
**Task**: `TASK-0268`

Accepted by the human in advance on 2026-11-10 (alignment plan item P0.3, decision D3=B), within exactly this scope: Claude Code emission and the 15-role table below. Nothing about OpenCode or Codex tiers is decided here.

## Context

`scripts/emit-agents.py` emits a role's `model` for Claude Code as `model: "{tier:<name>}"`, a placeholder no client resolves. ADR-0018 clause 7 kept the tier-to-model mapping in one place, `agent-tiers`' `models.jsonc`, and forbade a second table here. ADR-0017 (this repo owns agent tiers) was rejected on 2026-09-15, so that file stays in opencode-customization and serves OpenCode only. The result: no role can name a model for Claude Code, and the orchestrator's roles all run on whatever the session uses. On 2026-11-10 the human chose D3=B: per-role tiers, default `inherit`, the table kept in `.ai/context`.

## Decision

1. **Supersedes ADR-0018 clause 7 for Claude Code emission only.** Clause 7 stands for every other client and for the `{tier:<name>}` mechanism OpenCode uses.
2. **Reverses the ADR-0017 outcome for Claude Code emission only.** This repo owns the tier table that Claude Code agents are emitted from. ADR-0017's other findings stand: `agent-tiers`, `install-tiers.ps1` and `models.jsonc` stay with opencode-customization, and this repo imports none of them. Why it is reversed: a Claude Code agent file needs a concrete alias, no other owner exists for that file, and a role-to-alias table in `.ai/context` duplicates nothing in the other repo (that file maps tiers to provider model ids for OpenCode).
3. **One table, `docs/development/model-tiers.md`.** It maps a role name to `opus`, `sonnet` or `haiku`. `emit_claude_code` reads it and writes `model: <alias>`. A role not in the table is emitted with `model: inherit`. The emitter holds no table of its own.
4. **The D3 table.**

   | Tier | Roles |
   |---|---|
   | opus | adjudicator, critic, designer-manager, refuter, task-planner |
   | sonnet | git-ops, ideator, implementer, qa-test, review |
   | haiku | closer, gate-runner, park-steward, preflight, run-scribe |

5. **A role's own `model` key does not override the table for Claude Code.** One owner per fact; to change a role's tier, change its line in the table.

## Alternatives considered

- **Leave the placeholder and omit `model`** (the standing guidance). Rejected by D3: every role then runs on the session's model, including the cheap ones.
- **Emit a client-native model id per role.** Rejected: ids age, and an alias tracks the client's current model of that tier.
- **Reuse `models.jsonc`.** Rejected: ADR-0017 leaves it in the other repo, and it resolves OpenCode placeholders, not Claude aliases.

## Consequences

- Emitted Claude Code agents carry a real alias, and no emitted agent holds `{tier:`.
- Changing a role's tier is one line in one file; a tier set too low degrades quality silently, so a change is reviewed like a prompt change.
- OpenCode and Codex tiers are untouched; `TASK-0280` owns the ports. Extending this table to them needs its own decision.
- ADR-0018 clause 7 now carries a pointer to this record, and the authoring guide's "Known gap" and the emitter's docstring are rewritten to match.
