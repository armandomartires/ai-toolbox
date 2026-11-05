# TASK-0230 — agent-watch: the band above the prompt shows the orchestrator's state, idle included

## Status

- Status: review
- Owner: agent (Claude Code)
- Created: 2026-11-04
- Updated: 2026-11-05
- Applies to: `mods/agent-watch/`
- Source: the human, 2026-11-04: "Is there a way to show the orchestrator status above this text input?"

## Objective

With task-orchestrator on, the band above the prompt always says so: `ORCH <POLICY> · IDLE` when nothing else shows, and an `ORCH <POLICY>` label on the run and meter lines.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/agent-watch/hooks/band.tsx` | `drawMeter` empty without a task list, a running agent or an open ledger task |
| task-orchestrator's `enabled` and `policy` `$.state` atoms | written by task-orchestrator only |

## Scope

- In: `drawMeter` reads both atoms read-only; the idle line; the label on the run and meter lines, dropped first when narrow; tests; version 0.11.0.
- Out: task-orchestrator's status line (unchanged); any change to task-orchestrator.

## Likely files

- `mods/agent-watch/hooks/band.tsx`, `hooks/register.test.tsx`, `hooks/panel.tsx` (`VERSION`), `.claude-plugin/plugin.json`, `README.md`, `DEVELOPING.md`; `CHANGELOG.md`

## Execution plan

1. Read the two atoms in `drawMeter`; draw the idle line; add the label to the run and meter lines under the same width rule.
2. Tests for idle, off, policy, and narrow widths on each path.
3. Reviews R1 and R2 by separate workers; fixes T3 and T4.

## Acceptance criteria

- [x] Orchestration on with nothing else: `ORCH BALANCED · IDLE`, which opens the pane when pressed
- [x] Orchestration off with nothing else: the engine's band (`next`)
- [x] The label is dropped before any step text is cut, on every path; the line never wraps
- [x] A non-default policy is drawn (`ORCH QUALITY`)
- [ ] Seen live: the idle line was seen in the Compass pane (2026-11-04); the band above the prompt, on and off, not yet

## Mandatory validations

- [x] `tests/test-mods.sh --mod agent-watch`: 155 pass
- [x] `scripts/check-mods.py`: OK (5 mods)
- [x] `tests/validate.sh`: the failures (VAULT-SECRETS, worktree W1–W3, test-check-mods 16/22, STANDARD, PUBLISH 1/60, MCP-PIN, JOURNAL) also fail on clean HEAD (T2)

## Risks and rollback

- `drawMeter` also feeds Compass's pane, so the idle line shows there too (documented).
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| agent-watch | 0.11.0 |

Next: a live look at the band with `/orchestrate on` and `off`, then done.

## Execution log

- 2026-11-04 · Claude Code (Opus 5.5, orchestrated) · T1 built the idle line and labels; R1 asked for width gating on ALL DONE, a policy test and docs; T3 fixed them; R2 approved with one stale README line; T4 fixed it and added a narrow running-agent test
  - Evidence: `tests/test-mods.sh --mod agent-watch` → `PASS agent-watch:  155 pass`
  - Evidence: `python scripts/check-mods.py` → `OK (5 mods)`
  - Evidence: T2 ran `tests/validate.sh` on clean HEAD: the same failures as with the change
