# TASK-0280 — Invert portability: Claude Code is the reference (P2.1, HIGH RISK)

## Status

- Status: blocked
- Owner: agent
- Branch: agent/TASK-0280
- Created: 2026-11-10
- Updated: 2026-11-12
- Applies to: `scripts/emit-agents.py`, `.ai/decisions/`, `docs/registry.md`, `configs/opencode/`, `configs/lm-studio-bionic/`
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P2.1 (S1), decisions D1=B (only terms that passed measurement), D6=A,B,C (OpenCode and Codex supported with tests; Bionic and LM Studio best-effort, untested); related: ADR-0018, ADR-0054

## Objective

Make Claude Code the reference profile and generate the other ports from it. A new ADR supersedes ADR-0018's 'profile at the ceiling of the weaker client' rule with a Claude Code reference profile (tools, permission rules, role guard). `emit-agents.py` emits OpenCode permission maps and Codex custom agents from it, and a parity matrix in `docs/registry.md` is tested. OpenCode and Codex are supported with tests; Bionic and LM Studio stay best-effort and untested (D6).

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `scripts/emit-agents.py` | one profile at the ceiling of the weaker client |
| ADR-0018, ADR-0054, ADR-0020 | the rules and layout this changes or keeps |
| TASK-0271 | the role guard and the superseding of clause 8.3 for passing terms |
| TASK-0272 | the plugins that ship the Claude Code side |
| `docs/registry.md` | no port parity matrix |

## Scope

- In: the ADR and the reference profile; emission of OpenCode permission maps and Codex `.codex/agents/*.toml` from it; a parity matrix generated into `docs/registry.md`; parity tests; a Bionic and LM Studio note marking them best-effort and untested.
- Out: installing the Codex outputs (TASK-0281); terms that failed measurement in TASK-0271 (they remain refused or per-client); testing Bionic or LM Studio; changing role content.

## Likely files

- `scripts/emit-agents.py`
- a new ADR under `.ai/decisions/`
- `docs/registry.md` and its generator
- parity tests wired into `tests/validate.sh`
- `configs/opencode/`, `configs/lm-studio-bionic/README.md`; `configs/codex/` does not exist, since Codex is wired through `scripts/install.sh` `mod_ports codex` into `~/.codex/plugins`, so the emitted `.codex/agents/*.toml` need a named home (a new `configs/codex/` or the emitter's output dir) chosen in this task

## Execution plan

1. Write the parity test: one agent source emits Claude Code, OpenCode and Codex files and the matrix in `docs/registry.md` matches the emitted set. See it fail.
2. Write the ADR and define the reference profile.
3. Refactor `emit-agents.py` so the OpenCode and Codex outputs derive from the profile.
4. Generate the matrix into `docs/registry.md`.
5. Run the parity test green; drop one mapping and see it fail; restore it.
6. Mark Bionic and LM Studio best-effort and untested in their README and the matrix.
7. Run `tests/validate.sh` and the emit tests.

## Acceptance criteria

- [ ] One source emits all three client formats
- [ ] The matrix in `docs/registry.md` equals the emitted files and fails when a mapping is dropped
- [ ] Existing OpenCode and Codex outputs stay valid or change only as the ADR states
- [ ] Bionic and LM Studio are labelled best-effort and untested

## Mandatory validations

- [ ] tests/validate.sh
- [ ] the new parity test, `tests/test-emit-prune.sh`, `tests/test-emit-allowlist-note.sh` and `tests/test-install.sh`

## Risks and rollback

- HIGH: a governance change across every role; a weaker profile on the other clients could loosen a boundary that holds today. Compare emitted OpenCode permissions before and after.
- Two harnesses are now supported with tests (D6); every emitter change has to keep both green.
- Bionic and LM Studio may break silently; that was accepted (D6).
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
- 2026-11-12 · Claude Code (Opus 5.5) · blocked on TASK-0271, which the human parked on 2026-11-12. The reference profile rests on which of the seven refused terms pass measurement there; with none measured, the ADR would supersede ADR-0018 on a guard that does not exist, and this HIGH-risk task is left for the human to re-scope or resume after TASK-0271
  - Evidence: `.ai/tasks/TASK-0271-role-guard.md` (Status: blocked, parked by the human)
  - Deviation: none
