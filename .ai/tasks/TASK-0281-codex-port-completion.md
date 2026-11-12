# TASK-0281 — Codex port completion (P2.2)

## Status

- Status: review
- Owner: agent
- Branch: agent/TASK-0281
- Created: 2026-11-10
- Updated: 2026-11-12
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

- [x] The codex install step yields 8 skills, one TOML per role and the hooks file: 8 skills under `~/.agents/skills` (test-skill-controls P6); one TOML per role that declares `codex`, which is none today (ADR-0065: every role is refused for Codex), so `~/.codex/agents/` holds none (test-install X9); the Stop hook in the project's `.codex/hooks.json` (X6)
- [x] Reverting the step fails the test: with the previous `install.sh`, test-skill-controls P6-P8 and test-install X6-X9 fail
- [x] A second install run is idempotent (X7)

## Mandatory validations

- [x] tests/validate.sh: in the pre-commit hook
- [x] `bash tests/test-install.sh` → OK (91 cases); `bash tests/test-skill-controls.sh` → OK (24 cases)

## Risks and rollback

- Codex's config format moves quickly; pin the version the test was written against in the README.
- Depends on TASK-0280; the TOML shape must come from the emitter, not be written twice.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `scripts/install.sh` | `codex` is a client row: skills copied to `~/.agents/skills` with Claude-only keys stripped and `agents/openai.yaml` (`allow_implicit_invocation: false`) on the hand-invoked ones; agents emitted to `~/.codex/agents`; mods as before; `hooks_merge` writes the Stop hook into `.codex/hooks.json` (gitignored) |
| `configs/codex/` | `README.md` (what goes where, read from Codex's skills and hooks docs on 2026-11-12) and `hooks.json` |

Unverified: no Codex on this host; Codex runs the project hook only once the person trusts it.

Next: the agents half waits on ADR-0065 (refuse or instruction-only roles).

## Execution log

- 2026-11-10 · agent/Sonnet 5.5 · brief written from the alignment plan; no work done yet
  - Evidence: none yet
  - Deviation: none
- 2026-11-12 · Claude Code (Opus 5.5) · blocked behind TASK-0280: its TOML shape must come from that emitter, not be written twice (this brief's own risk note)
  - Evidence: `.ai/tasks/TASK-0271-role-guard.md` (Status: blocked, parked by the human)
  - Deviation: none
- 2026-11-12 · Claude Code (Opus 5.5) · unblocked by TASK-0280; Codex's skill and hook paths read from its docs; `codex` made a client row, the Stop hook merge generalized from the worktree hooks, the hand-invoked policy file added
  - Evidence: test-skill-controls OK (24), test-install OK (91); against the previous `install.sh` 3 and 4 of the new cases fail
  - Deviation: no TOML is installed, since no role declares codex (ADR-0065); the hooks fragment reuses `configs/claude-code/hooks/stop-fast-check.sh` rather than a copy
