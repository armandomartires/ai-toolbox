# TASK-0204 — agent-watch 0.4.3, task-compass 0.8.1: an open session is idle, never done

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-29
- Updated: 2026-10-29
- Applies to: `mods/agent-watch/`, `mods/task-compass/`
- Source: the human's screenshots of both panes, "they don't seem tied... review and explain", then "yes"

## Objective

THIS SESSION is never drawn as done while the session is open: with no running member it is idle.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/agent-watch/hooks/sessions.ts` | the main node's status is `running` or else `completed` |
| the screenshots | Compass's Sessions panel reads `STATE ■ DONE`, `0/0 STEPS` for a live idle session |

## Scope

- In: the main node's status is `idle` without a running member (shared `sessions.ts`, copied to Compass); Compass's state vocabulary gains `idle` (word IDLE, tone `text-3`, glyph `□`); the empty-tree disc is idle; tests.
- Out: colour by session in agent-watch versus by state in Compass (`ADR-0046`, unchanged).

## Likely files

- `mods/agent-watch/hooks/{sessions.ts,model.test.ts}`, `mods/task-compass/hooks/{sessions.ts,sessions.test.ts,sunburst.ts,sunburst.test.ts}`, the two `plugin.json`

## Execution plan

1. Red tests: a session with no running member is `idle`.
2. Fix in agent-watch's `sessions.ts`, copy it to Compass; add the `idle` kind to `sunburst.ts`.
3. Update the two sunburst tests that encoded `completed`; gates.

## Acceptance criteria

- [x] A session with no running member has status `idle`; with one, `running`.
- [x] Compass says IDLE, not DONE, for it, and its empty-tree disc is idle.
- [x] Compass's `sessions.ts` equals agent-watch's (gate rule 7).

## Mandatory validations

- [x] tests/test-mods.sh (5 passed)
- [x] tests/validate.sh
- [x] the new assertion failed against the old source (agent-watch: `idle` expected, `running`/`completed` seen)

## Risks and rollback

- Idle draws in `text-3`, quieter than the old done white; the disc ring of a live idle session is grey.
- Rollback: git revert the task commit.

## Outputs / handover

- agent-watch 0.4.3, task-compass 0.8.1. Not yet seen in the live panes.

## Execution log

- 2026-10-29 · Claude Code (Sonnet 5.5) · red tests, then the fix and the copy
  - Evidence, red-proof: against the old `sessions.ts`, agent-watch → `Expected: "idle"`, `Received: "running"/"completed"` (`1 fail`).
  - Evidence: `tests/test-mods.sh` → `5 passed, 0 failed` (task-compass 130, agent-watch 22); `tests/validate.sh` → `validate.sh: OK`.
  - Deviation: two Compass sunburst tests encoded `completed` for an empty session and were updated; `idle` needed its own state kind, since `queued` would have read QUEUED.
