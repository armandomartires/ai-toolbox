# TASK-0217 — Preview mod panes in a browser; copy mods into a session

## Status

- Status: in review
- Owner: agent (Claude Code)
- Created: 2026-11-03
- Updated: 2026-11-04
- Applies to: `scripts/`, `mods/agent-watch/preview/`, `mods/task-compass/` (0.9.1 → 0.9.2), the runbook
- Source: the human, 2026-11-03: "sometimes the edits are live and sometimes they are not. How can we solve this inconsistency?", then "we need a better approach to preview the panels as we develop them", the proposal, "Yes, build it"

## Objective

A pane being developed can be seen at once, at several sizes and on both surfaces, without the desktop app; and a session that does load the mod loads the repo's current code.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| the test kit (`claude plugin test`) | mounts a pane at any size and surface; `ui.drawn()` is the tree; no files, console output dropped, a failure message printed whole |
| `~/.claude/dev-mods/<session>/agent-watch` | a junction into this checkout, running code older than its source |

## Findings (2026-11-03)

- **Two copies of one mod.** The desktop app drew the organization library's task-compass 0.8.0 over the 0.9.1 named in `CLAUDE_CODE_PLUGIN_DIRS`, while `claude plugin list` reported the opposite; 0.8.0 draws its own Sessions panel and hides agent-watch's, so agent-watch's fixes never showed in Compass's pane.
- **A link may not reload.** A junction from the session's dev-mods folder into this checkout was watched, but its code stayed old after several edits.
- **The kit can draw a pane anywhere.** `ui.mount` at any size and surface, `ui.drawn()` the whole tree as plain data. It has no files and drops console output; a failure message prints in full.

## Scope

- In: `scripts/preview-mods.py` (scenes in a scratch copy, trees out through the failure message, `build/preview/index.html`, `--serve` with rebuild on save and page reload); `scripts/preview/index.html` (Box as flexbox, cells to px per surface, Text tokens, Button, `Svg`, `Raster` cells); scenes for agent-watch (its pane at four sizes, Compass's pane with a board stand-in) and task-compass (the repo's own `.ai/GOALS.md`, four sizes); `scripts/dev-mods.py` (copy, not link; mirror; `--watch`); `COMPASS <version>` after the board's legend on the desktop, 0.9.2; runbook.
- Out: a pixel-exact copy of the desktop's styling; the combined pane with the real Compass and agent-watch together (the kit loads an inline plugin without its imports); removing the library's duplicate task-compass (the human's).

## Likely files

- `scripts/preview-mods.py`, `scripts/preview/index.html`, `scripts/dev-mods.py`, `mods/*/preview/`, `mods/task-compass/hooks/view.tsx`, `docs/operations/runbook.md`

## Execution plan

1. Probe the kit: console output, failure-message length, `$.fs`.
2. The build script and page; scenes for both mods; serve with rebuild on save.
3. The copy script; Compass's version line; the runbook.

## Acceptance criteria

- [x] `python3 scripts/preview-mods.py` builds 9 scenes from both mods in about 2 s and writes the page
- [x] Served, a save rebuilds the changed mod and the page reloads
- [x] task-compass's scenes show this repo's board (16 sprints)
- [x] `scripts/dev-mods.py` replaces a link with files and mirrors edits and removals
- [x] The desktop prints `COMPASS <version>`; a terminal does not
- [ ] The human previews a pane change before seeing it live

## Mandatory validations

- [x] tests/test-mods.sh --mod agent-watch
- [ ] tests/test-mods.sh --mod task-compass — 64 pass on this Windows clone (2026-11-04), but only with an uncommitted path fix in `layer.test.tsx`; ticked once that lands
- [x] python3 scripts/check-mods.py

## Risks and rollback

- The page approximates the surfaces; a layout it shows right can still differ in the app.
- The failure-message channel depends on the kit printing a failure whole.
- Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `scripts/preview-mods.py`, `scripts/preview/index.html` | build and serve `build/preview/index.html` from `mods/*/preview/*.scene.tsx` |
| `scripts/dev-mods.py` | copies mods into a session's dev-mods folder as files |
| `mods/task-compass/` | 0.9.1 → 0.9.2: `COMPASS <version>` after the legend on the desktop |

Next: a mod change is previewed before its live look (`TASK-0218` makes this the workflow).

## Execution log

- 2026-11-03 · Claude Code (Opus 5.5) · probes: console output dropped, a 60 kB failure message printed whole, `$.fs` absent in the kit; built and opened in the browser pane at `http://127.0.0.1:8765/`
- 2026-11-04 · Claude Code (Opus 5.5) · board review: `tests/test-mods.sh --mod task-compass` → `PASS task-compass: 64 pass` on Windows, with an uncommitted `layer.test.tsx` path fix not made here; the human's preview-before-live look is still open
