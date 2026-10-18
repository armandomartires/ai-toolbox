# TASK-0175 — Track unexercised capability as backlog rows, and cap it

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-18
- Updated: 2026-10-18
- Applies to: `.ai/planning/BACKLOG.md`, `.ai/context/CURRENT_STATE.md`, `scripts/check-backlog-closures.py`, `AGENTS.md`, a new ADR; retirement notes in `loops/unattended-run/`, `skills/unattended-ops/`, `ADR-0022`
- Source: human request 2026-10-18 (correction 3 of the review against current practice); human decisions the same day: the cap is 3; retire Bionic F8 and, re-decided once the facts were read, the OpenCode binding's two stub-proven protections rather than the binding

## Objective

Lesson 5 says an unexercised artifact is the most reliable failure mode, yet capability keeps landing proven against stubs only. The open items live as prose in `CURRENT_STATE.md`, which the gate does not count, while the backlog reads "zero open". Make each one a backlog row, cap the unexercised rows at 3 in the gate, and retire the two the human chose, so new capability waits until old capability has been exercised.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `CURRENT_STATE.md` *Open items* | 9 bullets: 5 unexercised (forge trackers, live secrets backends, OpenCode binding, ansible-ops PVE snapshot, Bionic F8), 1 decision (`worktree-only`), 2 external (asset-management copy, estate repo), 1 known limitation |
| `BACKLOG.md` | "Zero items are open"; last row `B-055`; schema `columns:` unchanged |
| `check-backlog-closures.py` | counts open rows (Status says neither done nor closed) against the sentence |
| `AGENTS.md` | at its 120-line budget (`TASK-0174`) |

## Scope

- In: one row per open item, unexercised titles prefixed `Unexercised:`; *Open items* reduced to a pointer and the known limitation; the cap in the gate; the rule in `AGENTS.md` within budget; an ADR; retirement of Bionic F8 and the OpenCode binding.
- Out: exercising any item; deleting code (retirement withdraws claims, nothing else); the backlog schema's columns; the CI `bindings` job, which keeps running both suites.

## Likely files

- `.ai/planning/BACKLOG.md`, `.ai/context/CURRENT_STATE.md`, `.ai/decisions/0039-cap-unexercised-capability.md`
- `scripts/check-backlog-closures.py`, `tests/validate.sh` (if the red proof needs a fixture)
- `AGENTS.md`
- `ADR-0022` (F8 row), `skills/unattended-ops/SKILL.md`, `skills/unattended-ops/templates/binding.md`, `loops/unattended-run/loop.md`, `configs/lm-studio-bionic/README.md`

## Execution plan

1. Write the ADR: an unexercised capability is an open backlog row titled `Unexercised: …`, naming what would exercise it; at most 3 are open; at the cap, a task adding capability first exercises or retires one. Retiring withdraws the claim and closes the row.
2. Add rows `B-056`… for the 8 work items; update the "N items are open" sentence.
3. Close the Bionic F8 and OpenCode binding rows as retired: OpenCode becomes an experimental binding in `unattended-ops` and the loop, and Bionic leaves the authored-MCP claim in `ADR-0022` (dated amendment notes).
4. Replace *Open items* in `CURRENT_STATE.md` with a pointer to the backlog and the known limitation.
5. Teach `check-backlog-closures.py` to fail when more than 3 open rows are titled `Unexercised:`.
6. Red-prove it: a 4th open `Unexercised:` row fails; 3 pass.
7. Add the rule to `AGENTS.md` *Documentation rules* without exceeding 120 lines.

## Acceptance criteria

- [x] Every *Open items* bullet but the known limitation is a backlog row, and the open count matches.
- [x] Exactly 3 open `Unexercised:` rows: forge trackers, live secrets backends, ansible-ops PVE snapshot.
- [x] The gate fails on a 4th and names the cap and the ADR.
- [x] No file claims Bionic as an authored-MCP client, or the two OpenCode protections as proven in a real run.
- [x] `AGENTS.md` states the rule and is ≤ 120 lines.

## Mandatory validations

- [x] tests/validate.sh
- [x] the cap check with a 4th row (red proof)
- [x] `grep -rn` for the withdrawn claims → none left unqualified

## Risks and rollback

- **The cap blocks wanted work.** It holds at 3 today, so the next capability task must exercise or retire one first. That is the intent; raising the cap takes an ADR amendment.
- **A prefix is a weak type.** A row can dodge the cap by its title. The ADR says so; the closure check is a count, not an audit.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `ADR-0039` | accepted: `Unexercised:` rows, cap 3, retire = withdraw the claim |
| `BACKLOG.md` | `B-056`–`B-063`; six open, three of them `Unexercised:` (the cap) |
| `check-backlog-closures.py` | fails on a 4th open `Unexercised:` row |
| OpenCode binding, `unattended-ops` 1.4.1 | the bulk-staging halt and the gate map's out-of-reach placement are marked stub-proven |
| Bionic | out of the authored-MCP claim: `ADR-0022` F8 note, `configs/lm-studio-bionic/` |
| `AGENTS.md` | the rule, at 120 lines |

Next: exercise or retire one of `B-056`–`B-058` before the next capability task.

## Execution log

- 2026-10-18 · Claude Code (Opus 5.5) · done
  - Evidence: fixture, 3 `Unexercised:` rows → `OK (… 3 of 3 unexercised)`; 4 → `BACKLOG: 4 open rows are titled 'Unexercised:' …, over the cap of 3 (ADR-0039)`, exit 1; `HEAD`'s checker on the 4-row fixture → `OK`, exit 0
  - Evidence: `check-backlog-closures.py` → `OK (… 6 open, matching the sentence; 3 of 3 unexercised)`; `tests/validate.sh` → `validate.sh: OK`
  - Deviation: the OpenCode binding ran for real in the S10 pilot (`TASK-0092`) and is the primary one. Only `TASK-0097`'s halt and `TASK-0098`'s map placement were stub-proven. The human re-decided: retire those two claims and keep the binding.
