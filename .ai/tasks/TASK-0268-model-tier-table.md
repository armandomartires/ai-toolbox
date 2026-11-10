# TASK-0268 — Resolve model tiers to Claude aliases (P0.3)

## Status

- Status: planned
- Owner: agent
- Branch: agent/TASK-0268
- Created: 2026-11-10
- Updated: 2026-11-10
- Applies to: `scripts/emit-agents.py`, `.ai/context/`, `.ai/decisions/`, `docs/development/authoring-guide.md`, `tests/`
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P0.3 (Q3), decisions D3=B (per-role tiers, default inherit, table kept in .ai/context); related: ADR-0017 (rejected 2026-09-15), ADR-0018 clause 7

## Objective

Remove the unresolved `{tier:<name>}` placeholder from emitted Claude Code agents. Keep one tier table in `.ai/context` and map each role to `opus`, `sonnet`, `haiku` or `inherit`, with `inherit` for a role not in the table. ADR-0017 (ai-toolbox owns agent tiers) was REJECTED on 2026-09-15 and ADR-0018 clause 7 forbids a tier-to-model table in this repo, so the table needs a new ADR, accepted by the human, before any code lands. The human chose D3=B knowing this.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `scripts/emit-agents.py` `emit_claude_code` | writes `model: {tier:<name>}` unresolved |
| .ai/context/ | no tier table; the only table is in an external doc |
| ADR-0017 | REJECTED (2026-09-15): `agent-tiers` stays with opencode-customization |
| ADR-0018 clause 7 and the `scripts/emit-agents.py` docstring (about lines 24-36) | forbid a tier-to-model table in this repo; the docstring says not to add one |
| `docs/development/authoring-guide.md` "Known gap: `model` has no resolver in this repo" | says to omit `model`; names "own the mapping here and supersede clause 7 by a new ADR" as an option |
| the 15 role sources (`agents/*/agent.md`) | none carries a `model:` key, so no role names a tier today |

## Scope

- In: a new ADR superseding ADR-0018 clause 7 and recording that it reverses the ADR-0017 outcome for Claude Code emission only; the 15-role tier table below in `.ai/context/model-tiers.md`; `emit_claude_code` reads it and emits an alias; the `emit-agents.py` docstring and the authoring guide's "Known gap" rewritten to match the ADR; a test.

  | Tier | Roles |
  |---|---|
  | opus | adjudicator, critic, designer-manager, refuter, task-planner |
  | sonnet | git-ops, ideator, implementer, qa-test, review |
  | haiku | closer, gate-runner, park-steward, preflight, run-scribe |

  Any role not listed gets `inherit`.
- Out: the OpenCode and Codex model mapping (TASK-0280 owns the ports); changing which roles exist; the role guard (TASK-0271); a cap on unattended roles (D3 option D was not chosen).

## Likely files

- a new ADR under `.ai/decisions/` (next free id)
- `scripts/emit-agents.py` (code and docstring)
- `.ai/context/model-tiers.md`, `docs/development/authoring-guide.md`
- a new test under `tests/` (for example `tests/test-emit-tiers.sh`), wired into `tests/validate.sh`

## Execution plan

1. Write the ADR superseding ADR-0018 clause 7 for Claude Code emission, recording that it reverses the ADR-0017 outcome there, and why. Stop: it needs the human's acceptance before steps 2 onward land. If it is declined, close the task as not done.
2. Write the test: each Claude Code agent's `model:` equals the table value for its role (all 15 roles checked against the table directly, since only 4 are emitted today), an unlisted role gets `inherit`, and every `model:` is `sonnet`, `opus`, `haiku`, `inherit` or a full model id. A check that no `{tier:` remains is secondary. Run it and see it fail.
3. Write the table in `.ai/context`.
4. Change `emit_claude_code` to read the table and map role to alias, defaulting to `inherit`.
5. Update the `emit-agents.py` docstring (the `model` section, about lines 24-36) and the authoring guide's "Known gap" to describe the new owner and rule.
6. Run the test green; revert `emit_claude_code` and see it fail; restore it.
7. Wire the test into `tests/validate.sh` and refresh `docs/registry.md` if emission changes it.

## Acceptance criteria

- [ ] The new ADR exists, is accepted by the human, and supersedes ADR-0018 clause 7 (recording the ADR-0017 reversal for Claude Code emission)
- [ ] For each of the 15 roles, the Claude Code agent's `model:` equals the table value; an unlisted role emits `inherit`
- [ ] The test fails when `emit_claude_code` is reverted
- [ ] The docstring and the authoring guide no longer say the gap is open or that a table must not be added
- [ ] Secondary: no emitted agent contains `{tier:`

## Mandatory validations

- [ ] tests/validate.sh
- [ ] the new tier test, plus `tests/test-emit-prune.sh` and `tests/test-emit-allowlist-note.sh` (unchanged behaviour)

## Risks and rollback

- The human may decline the ADR. Then no code lands and D3=B stays unimplemented; do not emit tiers without it.
- A tier that is too low for a role degrades quality silently; the table is one file and a change is one line.
- Only 4 roles are emitted for Claude Code until TASK-0271, so the test must cover the table directly as well as the emitted files.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next:

## Execution log

- 2026-11-10 · agent/Sonnet 5.5 · brief written from the alignment plan; no work done yet
  - Evidence: none yet
  - Deviation: none
