# Developing task-compass

`README.md` is the user-facing spec, including the `GOALS.md` format. Rules every mod follows, and the engine and desktop traps found while building this one: authoring guide, *Mods*. Loading and testing: runbook, *Loading a mod in development*, and `tests/test-mods.sh`.

## Modules

- `hooks/sigma.tsx`: the SIGMAorbital design module, a byte-identical copy of `mods/_template/hooks/sigma.tsx` (`ADR-0043`); never edit it here.
- `hooks/sessions.ts`: the session tree, a byte-identical copy of `mods/agent-watch/hooks/sessions.ts` (`ADR-0045`); never edit it here. Tested in `sessions.test.ts`, which runs agent-watch's tree tests against it.
- `hooks/model.ts`: pure logic (`subagentRows`, the flat fallback's merge of agent rows and the orchestrator's ledger; parse sprints, status table `STATUS` on SIGMAorbital tokens, `setStoryStatus`, `applyPlan`, `guessStory`, `wrap`). Tested directly in `register.test.tsx` and `model.test.ts`.
- `hooks/rails.ts`: pure layout of the pane: `focusOf`, `carousel`, `columnRows` (rows, cards, progress, folding), sprint dates. Tested directly in `rails.test.ts`.
- `hooks/view.tsx`: the `ui.render` pane, drawing what `rails.ts` lays out, and `renderOutput`, `/compass` and `/goals` drawn as panels from the results `register.tsx` keeps with `remember`.
- `hooks/plan.ts`: pure reading of a project-workflow `.ai/` layer: `layoutOf`, `parseRoadmap`, `briefStory`, `statusOfRaw`, `planSprints` (open sprints last). Tested directly in `plan.test.ts`.
- `hooks/register.tsx`: the hooks, the `story` tool, board loading (`<layout root>/GOALS.md`, else a root `GOALS.md` copied there, else the `.ai/` layer, re-reading only the briefs whose mtime or size moved), subagent tracking. It is the only module that knows the source (`source` in `$.state`), and it writes only when the source is `goals`. Its `.ai/` behaviour is tested in `layer.test.tsx`.
- `types/index.d.ts`: the `$.state` contract, and the mirror of task-orchestrator's.

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

## Orchestrator tie-in

The flat Subagents list, drawn only when agent-watch is not loaded (below), follows task-orchestrator's ledger the way agent-watch does (`ADR-0044`): `view.tsx` reads `enabled`, `policy` and `ledger` and never writes them, and `subagentRows` joins each task to its agent by `agentId`. The types are a `// MIRROR of mods/task-orchestrator/types/index.d.ts` block in `types/index.d.ts`, which `scripts/check-mods.py` (rule 8) holds equal to the owner's; `ledgerBadge` and the task-to-row logic are ported from agent-watch, not imported. `shownRows` never cuts a ledger row (`kind: 'task'`): the six-row cap applies only to the unclaimed agents, `6 - tasks` slots, at least none, and an empty ledger leaves the old newest-six of the agents. A running task whose agent failed or was killed takes that outcome as its badge when the ledger word gives none (ported from agent-watch's `outcomeOf`). The tick also refreshes the agents while a task is queued or running. In a test the orchestrator is an inline plugin whose register holds each ledger as a literal (the kit evaluates it without its closure).

## Sessions tie-in

The Sessions panel draws agent-watch's tree (`ADR-0045`). `view.tsx` reads agent-watch's `agents`, `now`, `frame`, `tasks`, `runs` and `tones` beside task-orchestrator's state, and never writes them; `types/index.d.ts` holds a `// MIRROR of mods/agent-watch/types/index.d.ts` block (`Watch<Name>` aliases) that `scripts/check-mods.py` rule 8 keeps equal to the owner's. The tree itself is `hooks/sessions.ts`, one module owned by agent-watch: rule 7 holds this copy byte-identical, so change it there and `cp mods/agent-watch/hooks/sessions.ts mods/task-compass/hooks/sessions.ts`. `trimTree` in `model.ts` (pure) fits the tree to a fixed line budget (`TREE_LINES`), never cutting a head or a ledger task (a member with a `taskId`); the rest of the budget goes to running members across all sessions first, then ended ones, each "+N more" line paid from it, and `room` counts the lines it takes. The tree is drawn when agent-watch is loaded, which `view.tsx` reads from its `now` clock (agent-watch writes it on its first refresh, so `now > 0`), even with no agent yet; otherwise the panel draws the flat list from `subagentRows` and `shownRows`, kept as the fallback. In a test agent-watch and task-orchestrator are inline plugins whose register holds each state as a literal (the kit evaluates it without its closure).

`hooks/sunburst.ts` (pure) draws the same tree as a sunburst above the list (TASK-0198): `arcs(tree, tones)` lays out turns, one equal share per leaf in a stable order (members: ledger tasks by id, then agents by start; sub-sessions by start then key; so a status change, an ending or a new session moves no existing arc), `sunburstSvg` makes the `<svg>` for `Svg` (desktop, mobile, VS Code) and `sunburstCells` the base64 braille cells for the terminal's `Raster`. It draws the untrimmed tree (a session past `MEMBER_CAP` keeps its running members and one `+N` arc); `view.tsx` counts its rows in `room`, first trims the tree to a smaller budget, and hides the chart only when the heads alone would leave the pane under `CHART_FLOOR`. `sunburstSvg` stays under 128 KiB, falling back to titles off and then to a summary disc. The test runtime has no `toBeCloseTo`.
