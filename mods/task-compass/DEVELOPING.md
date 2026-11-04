# Developing task-compass

`README.md` is the user-facing spec, including the `GOALS.md` format. Rules every mod follows, and the engine and desktop traps found while building this one: authoring guide, *Mods*. Loading and testing: runbook, *Loading a mod in development*, and `tests/test-mods.sh`.

## Modules

- `hooks/sigma.tsx`: the SIGMAorbital design module, a byte-identical copy of `mods/_template/hooks/sigma.tsx` (`ADR-0043`); never edit it here.
- `hooks/handle.tsx`: the resize handle's surface module and `heldRows`, a byte-identical copy of `mods/_template/hooks/handle.tsx` (`ADR-0052`); never edit it here.
- `hooks/model.ts`: pure logic (parse sprints, status table `STATUS` on SIGMAorbital tokens, `setStoryStatus`, `applyPlan`, `guessStory`, `wrap`). Tested directly in `register.test.tsx`.
- `hooks/rails.ts`: pure layout of the pane: `focusOf`, `carousel`, `columnRows` (rows, cards, progress, folding), sprint dates. Tested directly in `rails.test.ts`.
- `hooks/view.tsx`: the `ui.render` pane, drawing what `rails.ts` lays out, and `registerPane` and its slot (below), and `renderOutput`, `/compass` and `/goals` drawn as panels from the results `register.tsx` keeps with `remember`.
- `hooks/plan.ts`: pure reading of a project-workflow `.ai/` layer: `layoutOf`, `parseRoadmap`, `briefStory`, `statusOfRaw`, `planSprints` (open sprints last). Tested directly in `plan.test.ts`.
- `hooks/register.tsx`: the hooks, the `story` tool, board loading (`<layout root>/GOALS.md`, else a root `GOALS.md` copied there, else the `.ai/` layer, re-reading only the briefs whose mtime or size moved), the live task list (`tasks`, matched to a story by `guessStory`) and the `now` clock the sprint dates read. It tracks no subagents. It is the only module that knows the source (`source` in `$.state`), and it writes only when the source is `goals`. Its `.ai/` behaviour is tested in `layer.test.tsx`.
- `types/index.d.ts`: the `$.state` contract. Compass reads no other plugin's state and declares no mirror (rule 8).

## The `.ai/` board

Its shape is the locked brief `docs/design/task-compass-ai-planning-brief.md`; change it through a new design run, not here.

- `skills/project-workflow/dashboard/` (Python) also maps these status words and has its own open-sprint rule. TypeScript in the sandbox cannot share its code, so the two are kept in step by hand: a status word added to one belongs in the other (`statusFromWords` here).
- `hooks/fixtures/sigma.ts` holds structure-only copies of sigma-infrastructure's `.ai/` at `90f9a4d`: the roadmap's *Sprint history* rows (themes and commit cells dropped, review pointers and `(open)` kept) and each brief's title, first `**Status**:` line and `**Sprint**:` line. Host names, private addresses, the LDAP base DN and a person's name are replaced. The script that makes them is not tracked, because its patterns are private; to refresh them, copy the live layer, keep what is listed above, replace every name in the host's `.git/info/private-patterns`, and run `scripts/check-private-names.sh` after staging. Tests import them as a module, since `claude plugin test` gives a test no file access.

## Statuses

Statuses map to fixed `GOALS.md` markers: plain item = backlog, `[ ]` todo, `[>]` in_progress, `[?]` review, `[!]` blocked, `[x]` done. Colours are SIGMAorbital tokens (`text-3`, `text-2`, `cyan`, `amber`, `red`, `text-1`), drawn as exact hex for the theme the host is set to (`syncTheme`, `watchTheme`). Rows and cards carry token names; `view.tsx` turns them into hex.

## How it meets the guide's traps

- The model reads the board from the `story` tool's description, re-described when `GOALS.md` changes.
- The story tool is answered from the general `tool.call` hook by comparing `e.tool` with `mcp__task-compass__story`.
- Cards open on a click on a dot's name, a plain `Button`; the dot stays a `Text` outside it. The open card sits in its column's flow under its story, so the rows below slide down. The tree fills the pane with `minHeight` of `e.props.scroll.bodyRows`, not the viewport's rows.
- On a desktop the rail is the left edge of a bordered `Box` clipped by a one-cell `overflow="hidden"` Box (`railRun`), and cards are four straight edges (`frame` from `sigma.tsx`); the terminal keeps `│` text.

## The resize handle

Under the Sprints panel, on a surface whose table has `Client` (terminal, desktop), the pane draws a `Client` keyed `sprints-handle` running `handle.tsx` (`ADR-0052`) in `handleSlot`, absolute at the foot of a column Box that holds the panel alone, so its row is the frame's own last row: a terminal redraws that edge around the grip, a desktop draws a 3px `Svg` bar (`barSvg`) on its bottom line and the hint (`hintText`) as a hover reveal just above it, centred, framed in `line` on a solid `raised` fill (a `display: none` Box with no key, so the keyed slot is what the hover answers to); the region itself draws nothing there. Its `ui.message` hook, on `{ requestId: 'task-compass', element: 'sprints-handle' }`, reads the post with `heldRows` (clamped to `[BOARD_FLOOR, 400]`, `null` for reset) and writes `sprintsRows[surface]` in `$.state`. A held value is the board's `room` and the columns Box's `height` (`overflow: hidden`), so its delta is the panel's; automatic is today's room, and the handle is told the longest column's drawn rows (`drawnRows`), what a drag starts from. The hook answers `{ props }` with the held rows, so a drag's next move does not wait on a redraw (seen live: without it the desktop measured every move from the press's height and snapped back). The handle measures a terminal drag from the region where it now is and a desktop one from where it was at the press (`handle.tsx`), both seen live in a spike. Kept per session and per surface, never in `$.store`: a row is not the same height on the two. Mobile and vscode draw no handle and ignore a held value. Tested in `handle.test.tsx`.

## Contributions

The Pane hook awaits `next(e)` and places the result after the Sprints board (`ADR-0048` clause 1), so whatever another plugin contributes to the pane (agent-watch's meter and Sessions panel) shows below the board whichever mod loaded first. A rejected `next(e)` is caught and counts as no contribution, and so does core's own drawing, `{ type: 'engine', ref }`, which is what `next(e)` resolves to when no plugin beneath drew the pane (`isEngineElement`): embedded, it makes the engine drop the whole tree, the board included (`slot.test.tsx`, red-proved), so the board is never lost. A debug line, `task-compass: next(e) resolved …` or `rejected: …`, names what came back, written only when it changes. The board's room is `max(BOARD_FLOOR = 6, rows - BOARD_CHROME_ROWS = 7)`: the title bar and rule (2), the frame above and below (2), the carousel header (1), the legend's margin (1) and the legend (1). The legend wraps to a second row on a pane under about 69 columns, which the constant does not count, so the pane then scrolls one row. No test measures drawn rows (the kit reports props, not layout). Compass tracks no agents and reads no other plugin's state, so it holds no copy of agent-watch's or task-orchestrator's. Tested in `slot.test.tsx` with an inline contributor plugin placed on either side of Compass. The test kit throws at the bottom of a pane's chain, so the tests add an empty base hook; what the real engine draws there is unverified.
