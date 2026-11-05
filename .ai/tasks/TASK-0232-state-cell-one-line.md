# TASK-0232 — agent-watch 0.11.1: the STATE cell's glyph and word on one line

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-11-05
- Updated: 2026-11-05
- Applies to: `mods/agent-watch/`
- Source: the human, 2026-11-05: "in agent-watch the state column, value the icon is above the state name. Can we have them in the same line, like in the session column?"

## Objective

In the Sessions table, each STATE cell shows its glyph and its word on one line on the desktop, as the SESSION column does.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/agent-watch/hooks/panel.tsx` `tableRow` | the STATE cell is a glyph Text then a `" WORD"` Text, which a desktop wraps at the leading space |

## Scope

- In: the table's STATE cell; the tests that matched the word with its leading space; version 0.11.1.
- Out: the legend and the SELECTED panel, which keep their spacing.

## Likely files

- `mods/agent-watch/hooks/panel.tsx`, `hooks/panel.test.tsx`, `hooks/register.test.tsx`, `.claude-plugin/plugin.json`

## Execution plan

1. Put the glyph and the word each in a box that does not shrink, a gap between them and no leading space.
2. Update the row expectations; check the desktop preview.

## Acceptance criteria

- [x] Every STATE cell draws its glyph and word on one line on the desktop
- [x] `plugin.json` and `VERSION` read 0.11.1
- [x] Seen live by the human, 2026-11-05

## Mandatory validations

- [x] `tests/test-mods.sh --mod agent-watch`: 155 pass
- [x] `scripts/check-mods.py`: OK (5 mods)

## Risks and rollback

- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| agent-watch | 0.11.1 |

Next: none.

## Execution log

- 2026-11-05 · Claude Code (Opus 5.5) · STATE cell rebuilt from two non-shrinking boxes with a column gap; row tests updated; desktop preview (`mod-preview`, 120×40) showed `● RUNNING`, `□ QUEUED`, `▲ BLOCKED` on one line and `AGENT-WATCH 0.11.1`
  - Evidence: `claude plugin test` in `mods/agent-watch` → `155 pass`, `0 fail`
  - Evidence: `python scripts/check-mods.py` → `OK (5 mods)`
  - Evidence: the human saw it live after `/reload-plugins --force`
