# Developing task-compass

`README.md` is the user-facing spec, including the `GOALS.md` format. Rules every mod follows, and the engine and desktop traps found while building this one: authoring guide, *Mods*. Loading and testing: runbook, *Loading a mod in development*, and `tests/test-mods.sh`.

## Modules

The Claude Code plugin is `mods/task-compass/claude/` (`ADR-0054`); the paths below are relative to it, and `README.md` and this file stay one level up.

The harness-neutral board is `core/` (`TASK-0254`), pure TypeScript that imports no harness API (`check-mods.py` rule 0):

- `core/board.ts`: the `GOALS.md` board: the `Status`, `Story` and `Sprint` types (the same shapes as `types/index.d.ts`), the checkbox table `MARKER`, `statusFromWords`, `deriveStatus`, `parseSprints`, `setStoryStatus`, `currentSprint`, and finding the board's project folder: `foldersUp`, `boardFolders` (never inside a `.ai/`), `projectFolder`.
- `core/plan.ts`: reading a project-workflow `.ai/` layer (below, *Modules*); imports only `board.ts`.
- `core/story.ts`: the `story` tool and the board as text for a harness with no pane (`answerStory`, `openStoriesText`, `boardText`), and `storyFolder`, the ports' `projectFolder` over `.ai/GOALS.md` or a `tracker.conf` with a `.git` as the top; OpenCode and Codex only.
- `core/tracker.ts`: a project's declared tracker and the forge card: `trackerOf` (the `tracker.conf` grammar; absent means files; invalid is `{ error }`), `forgeState` (the forge `20.PLAN.md`'s sections, capped at `SECTION_LINES`, and the history tag), `forgeText`, `forgeDecline`. Imports nothing. Design: *Amendment 1* of the brief, `ADR-0068`.
- `core/core.test.ts`: their tests, on node's runner: `node --test mods/task-compass/core/core.test.ts` (Node 22.18 or later strips the types itself). The imports name the `.ts` file (`./board.ts`), which node needs and Claude Code's loader accepts.

A harness loads its own folder alone (Claude Code refuses an import from outside the plugin folder; `dev-mods.py` and `install.sh` copy one folder), so each carries copies: `claude/hooks/board.ts`, `claude/hooks/plan.ts` and `claude/hooks/tracker.ts`, `opencode/board.ts`, `opencode/story.ts` and `opencode/tracker.ts`, `codex/scripts/board.ts`, `codex/scripts/story.ts` and `codex/scripts/tracker.ts`. Rule 10 treats any file named `tracker.ts` in a harness folder as a gated copy, so no fixture may take that name (the forge fixture is `hooks/fixtures/forge.ts`). `check-mods.py` rule 10 fails a copy that differs from `core/`: change `core/`, then `cp` it over each copy.

The OpenCode port is `opencode/`: `index.ts` (the server part, the `story` tool), `tui.tsx` (the `sidebar_content` slot), `compass.ts` (the file side both use: `runStory`, `sidebarBoard`), `types/opencode-plugin.d.ts` (the part of `@opencode-ai/plugin` 1.18.30 they use, declared by hand). Tested by `node --test mods/task-compass/opencode/compass.test.ts`; `index.ts` and `tui.tsx` import OpenCode's packages and are not loaded by a test.

The Codex port is `codex/`, a plugin bundle (`TASK-0255`): `plugin.json` at its root naming `hooks/hooks.json` (a `SessionStart` command hook running `scripts/session-start.ts`, which prints the current sprint's open stories as `additionalContext`), `mcp.json` (the stdio server `scripts/mcp-server.ts`: newline-delimited JSON-RPC, `initialize`, `ping`, `tools/list`, `tools/call` of `story`, no SDK) and `skills/board/`. Both scripts run on plain node (22.18 or later strips the types). The commands name `${PLUGIN_ROOT}`, unverified against a live Codex. Tested by `node --test mods/task-compass/codex/scripts/codex.test.ts`, the server and the hook also as processes.

- `hooks/sigma.tsx`: the SIGMAorbital design module, a byte-identical copy of `mods/_template/claude/hooks/sigma.tsx` (`ADR-0043`); never edit it here.
- `hooks/handle.tsx`: the resize handle's surface module, `heldRows`, `hintText` and the desktop bar, a byte-identical copy of `mods/_template/claude/hooks/handle.tsx` (`ADR-0052`, `ADR-0053`); `sigma.tsx` imports it, so never edit it here.
- `hooks/model.ts`: pure logic (status table `STATUS` on SIGMAorbital tokens, `applyPlan`, `guessStory`, `wrap`); it re-exports the board functions of `hooks/board.ts`, the copy of `core/board.ts`. Tested directly in `register.test.tsx`.
- `hooks/rails.ts`: pure layout of the pane: `focusOf`, `carousel`, `columnRows` (rows, cards, progress, folding), sprint dates. Tested directly in `rails.test.ts`.
- `hooks/view.tsx`: the `ui.render` pane, drawing what `rails.ts` lays out, and `registerPane` and its slot (below), and `renderOutput`, `/compass` and `/goals` drawn as panels from the results `register.tsx` keeps with `remember`.
- `hooks/plan.ts`: the copy of `core/plan.ts`, pure reading of a project-workflow `.ai/` layer: `layoutOf`, `parseRoadmap`, `briefStory`, `statusOfRaw`, `planSprints` (open sprints last). Tested directly in `plan.test.ts`.
- `hooks/register.tsx`: the hooks, the `story` tool, board loading (from the project folder `projectDir` finds: the session's root, walked up by core's `boardFolders`, never inside a `.ai/`, a folder with a `tracker.conf` counting as a board; there `tracker.conf` is read before any board, re-read when its mtime or size moves, then `<layout root>/GOALS.md`, else a root `GOALS.md` copied there, else the `.ai/` layer, re-reading only the briefs whose mtime or size moved), the live task list (`tasks`, matched to a story by `guessStory`) and the `now` clock the sprint dates read. It tracks no subagents. It is the only module that knows the source (`source` in `$.state`: `goals`, `ai` or `forge`), and it writes only when the source is `goals`; for `forge` it publishes the card of `<layout root>/20.PLAN.md` (`view.tsx`'s `planPanel`, with its own resize handle) and only reports a stray `GOALS.md`. Its `.ai/` and forge behaviour is tested in `layer.test.tsx`.
- `types/index.d.ts`: the `$.state` contract. Compass reads no other plugin's state and declares no mirror (rule 8).

## The `.ai/` board

Its shape is the locked brief `docs/design/task-compass-ai-planning-brief.md`; change it through a new design run, or an amendment the human decides (Amendment 1, forge trackers, `ADR-0068`), not here.

- `skills/project-workflow/dashboard/` (Python) also maps these status words and has its own open-sprint rule. TypeScript in the sandbox cannot share its code, so the two are kept in step by hand: a status word added to one belongs in the other (`statusFromWords` here).
- `core/tracker.ts`'s `tracker.conf` grammar is a second implementation of `skills/project-workflow/scripts/tracker_lib.py` (`load`, `validate`), kept in step by hand, as `statusFromWords` is with the dashboard: no check compares the two, so a grammar change in one belongs in the other. The forge design is *Amendment 1* of the brief (`ADR-0068`). The OpenCode and Codex ports use it to decline only.
- The three node suites, `core/core.test.ts`, `opencode/compass.test.ts` and `codex/scripts/codex.test.ts`, are in no gate: run them by hand (`node --test <file>`) after a change to `core/` or a port.
- `hooks/fixtures/sigma.ts` holds structure-only copies of sigma-infrastructure's `.ai/` at `90f9a4d`: the roadmap's *Sprint history* rows (themes and commit cells dropped, review pointers and `(open)` kept) and each brief's title, first `**Status**:` line and `**Sprint**:` line. Host names, private addresses, the LDAP base DN and a person's name are replaced. The script that makes them is not tracked, because its patterns are private; to refresh them, copy the live layer, keep what is listed above, replace every name in the host's `.git/info/private-patterns`, and run `scripts/check-private-names.sh` after staging. Tests import them as a module, since `claude plugin test` gives a test no file access.

## Statuses

Statuses map to fixed `GOALS.md` markers: plain item = backlog, `[ ]` todo, `[>]` in_progress, `[?]` review, `[!]` blocked, `[x]` done. Colours are SIGMAorbital tokens (`text-3`, `text-2`, `cyan`, `amber`, `red`, `text-1`), drawn as exact hex for the theme the host is set to (`syncTheme`, `watchTheme`). Rows and cards carry token names; `view.tsx` turns them into hex.

## How it meets the guide's traps

- The model reads the board from the `story` tool's description, re-described when `GOALS.md` changes.
- The story tool is answered from the general `tool.call` hook by comparing `e.tool` with `mcp__task-compass__story`.
- Cards open on a click on a dot's name, a plain `Button`; the dot stays a `Text` outside it. The open card sits in its column's flow under its story, so the rows below slide down. The tree sets no `minHeight` of `e.props.scroll.bodyRows` (it pushed a contributing mod's panel off the visible pane, TASK-0231); its outer Box takes `flexGrow={1}`.
- On a desktop the rail is the left edge of a bordered `Box` clipped by a one-cell `overflow="hidden"` Box (`railRun`), and cards are four straight edges (`frame` from `sigma.tsx`); the terminal keeps `│` text.

## The resize handle

The Sprints panel is `kit().panel` with `resize: { key: 'sprints-handle', rows, held, min }` (`ADR-0053`): the shared panel draws the handle on the frame's bottom edge on a surface whose table has `Client`, and holds the body at `held` rows. `held` is `heldOf(panelRows, e, 'sprints-handle')`, the body's rows; the columns get `held - BODY_EXTRA_ROWS` (the carousel header, the legend's margin and the legend) as `room`, and cut what is left over (`overflow: hidden`). Automatic `rows` is the longest column as drawn (`drawnRows`) plus those 3; the floor is 9. The pane's `ui.message` hook is `resizeAnswer` into `panelRows`. Tested in `handle.test.tsx`.


## Contributions

The Pane hook awaits `next(e)` and places the result after the Sprints board (`ADR-0048` clause 1), so whatever another plugin contributes to the pane (agent-watch's meter and Sessions panel) shows below the board whichever mod loaded first. A rejected `next(e)` is caught and counts as no contribution, and so does core's own drawing, `{ type: 'engine', ref }`, which is what `next(e)` resolves to when no plugin beneath drew the pane (`isEngineElement`): embedded, it makes the engine drop the whole tree, the board included (`slot.test.tsx`, red-proved), so the board is never lost. A debug line, `task-compass: next(e) resolved …` or `rejected: …`, names what came back, written only when it changes. The board's room is `max(BOARD_FLOOR = 6, rows - BOARD_CHROME_ROWS = 7)`: the title bar and rule (2), the frame above and below (2), the carousel header (1), the legend's margin (1) and the legend (1). The legend wraps to a second row on a pane under about 69 columns, which the constant does not count, so the pane then scrolls one row. No test measures drawn rows (the kit reports props, not layout). Compass tracks no agents and reads no other plugin's state, so it holds no copy of agent-watch's or task-orchestrator's. Tested in `slot.test.tsx` with an inline contributor plugin placed on either side of Compass. The test kit throws at the bottom of a pane's chain, so the tests add an empty base hook; what the real engine draws there is unverified.
