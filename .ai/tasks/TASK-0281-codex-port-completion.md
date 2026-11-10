# TASK-0281 — Codex port completion (P2.2)

## Status

- Status: planned
- Owner: agent
- Branch: agent/TASK-0281
- Created: 2026-11-10
- Updated: 2026-11-10
- Applies to: `scripts/install.sh` codex step (`mod_ports codex`, `~/.codex/plugins`), `tests/test-install.sh`
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P2.2 (S2), decisions D6=B (Codex supported, generated port with tests; S2 is done); the plan lists no related remediation or ADR

## Objective

Give Codex users the skills, agents and hooks: skills into `.agents/skills` (Codex's scan path), custom agents as TOML, and `hooks.json`; mods through Codex plugins (task-compass already).

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `scripts/install.sh` codex step | does not install into `.agents/skills` |
| TASK-0280 | emits `.codex/agents/*.toml` from the reference profile |
| `configs/codex/` | does not exist; Codex is wired through `scripts/install.sh` `mod_ports codex` into `~/.codex/plugins` |
| task-compass Codex plugin | exists |

## Scope

- In: the install step for skills, custom agents and hooks; mods through Codex plugins; test assertions of 8 skills under `.agents/skills` and one `.codex/agents/<role>.toml` per Codex role.
- Out: the TOML emission itself (TASK-0280); a Codex marketplace; Bionic and LM Studio; hooks beyond what the Stop hook port needs (TASK-0277).

## Likely files

- `scripts/install.sh`
- a new `configs/codex/` only if a README or fragment needs a home (it does not exist today)
- `tests/test-install.sh`
- `docs/registry.md`

## Execution plan

1. Extend the codex step of `tests/test-install.sh`: 8 skills under `.agents/skills`, one `.codex/agents/<role>.toml` per Codex role, `hooks.json` present. See it fail.
2. Implement the install step.
3. Wire mods through Codex plugins where one exists.
4. Run the test green; revert the step and see it fail.
5. Update the registry and the Codex notes (a new `configs/codex/README.md` if wanted).
6. Run `tests/validate.sh`.

## Acceptance criteria

- [ ] The codex install step yields 8 skills, one TOML per role and the hooks file
- [ ] Reverting the step fails the test
- [ ] A second install run is idempotent

## Mandatory validations

- [ ] tests/validate.sh
- [ ] `bash tests/test-install.sh`

## Risks and rollback

- Codex's config format moves quickly; pin the version the test was written against in the README.
- Depends on TASK-0280; the TOML shape must come from the emitter, not be written twice.
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
