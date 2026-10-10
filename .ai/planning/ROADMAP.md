# Roadmap

Phases only. Closed phases keep a short summary; their detail is in the sprint archive (`planning/sprints/`), the checkpoint reviews (`reviews/`), and git history (ADR-0033).

## Vision
A validated, indexed, versioned library of AI customization tools that any agent or human can understand, trust, and deploy.

## Phase 1 — Foundation (complete, 2026-09-13)
- Delivered the repo scaffold, two skills, and the `ansible` MCP server, installed and used in a real Claude Code session.
- Sprint S1; checkpoint `REVIEW-0003`.

## Phase 2 — Multi-client deployment (complete, 2026-09-13)
- Delivered sync to OpenCode and LM Studio, `configs/` snapshots, the first loop (`release-check`), and the MCP smoke harness.
- The exit criteria were restated by `ADR-0006`: LM Studio has MCP only.
- Sprint S2; checkpoint `REVIEW-0004`.

## Phase 3 — Automation (complete, 2026-09-13)
- `tests/validate.sh` runs before every commit through `.githooks/pre-commit` (`ADR-0007`). Registry staleness is detected.
- Sprint S3; checkpoint `REVIEW-0005`.

## Phase 4 — Closing the open loops (complete, 2026-09-13)
- Every closeable backlog item was closed. The rest became a decision or a documented human-action procedure.
- Sprint S4; checkpoint `REVIEW-0006`.

## Phase 5 — Session handover contract (complete, 2026-09-13)
- A task is resumable in a fresh session: briefs have `Inputs` and `Outputs / handover`, and the gate checks they are present (`ADR-0012`).
- Planned by `PLAN-0002`; sprint S5; checkpoint `REVIEW-0007`.

## Phase 6 — Ansible agent guardrails (COMPLETE 2026-09-22)
- Delivered the instruct layer for the `ansible` MCP server: `skills/ansible-ops/` and `loops/ansible-change/`. The server's surface was narrowed, and two false wiring claims were corrected (`ADR-0014`–`0016`).
- Planned by `PLAN-0003`; sprint S6; checkpoint `REVIEW-0010`.

## Phase 7 — Design and production agent loops (complete 2026-09-16)
- Delivered the `design-brief` and `project-build` loops, `agents/` as a real category with per-client emission (`ADR-0018`), and human acceptance as the convergence gate (`ADR-0019`).
- Planned by `PLAN-0004`; sprint S7; checkpoint `REVIEW-0008`.

## Phase 8 — Third-party agent extensions (COMPLETE 2026-09-23)
- Third-party extensions are wired, not vendored (`ADR-0021`). `graphify` is a component.
- Planned by `PLAN-0005`; sprint S8; checkpoint `REVIEW-0009`.

## Phase 9 — Unattended runs: the decision and the portable core (COMPLETE 2026-09-23)
- `ADR-0022` was ratified. Delivered the `unattended-run` loop, the `unattended-ops` skill and nine roles. All seven exit criteria were met.
- Planned by `PLAN-0006`; sprint S9; checkpoint `REVIEW-0011`.

## Phase 10 — Unattended runs: bindings, the gate server, and the pilot (COMPLETE 2026-09-26)
- Delivered the OpenCode and Claude Code bindings, the `gates` MCP server, and a pilot that closed two real tasks unattended.
- Six of seven exit criteria were met. Criterion 3 is partly met: some binding boundaries are tested against stubs only.
- Sprint S10; checkpoint `REVIEW-0012`.

## After Phase 10 (no sprint open)
- Work runs task by task on the human's routing:
  - dashboard publishing (`ADR-0029`)
  - GitLab as primary remote (`ADR-0028`)
  - Vault-owned secrets (`ADR-0030`, `ADR-0031`)
  - backlog close-out
  - concise artifacts (`ADR-0033`, `PLAN-0007`)
- Open items: `planning/SPRINT-CURRENT.md`.

## Risks
- **Client formats and capabilities drift.** Re-verify a claim about external state when you act on it, not from a plan written days earlier (`ADR-0006`).
- **The commit gate grows linearly with components.** Measure it on the `/mnt/c` checkout, not on `/tmp`: `/tmp` understates by about 40%.
- **Status records decay faster than artifacts.** Sweep the status columns when closing a sprint. Live files hold state only, and their line budgets are gated (`ADR-0033`).
- **A presence check can be misread as a correctness check.** A green gate means the structure is present, nothing more.
- **Emitted per-client files have no freshness check at their destination** (`ADR-0009`). The control is idempotent regeneration.
