# Developing task-compass

`README.md` is the user-facing spec, including the `GOALS.md` format. Rules every mod follows, and the engine and desktop traps found while building this one: authoring guide, *Mods*. Loading and testing: runbook, *Loading a mod in development*, and `tests/test-mods.sh`.

## Modules

- `hooks/model.ts`: pure logic (parse sprints, status table `STATUS`, sticky colors, `setStoryStatus`, `applyPlan`, `guessStory`, `wrap`). Tested directly in `register.test.tsx`.
- `hooks/rails.ts`: pure layout of the pane: `focusOf`, `carousel`, `columnRows` (rows, cards, progress, folding), sprint dates. Tested directly in `rails.test.ts`.
- `hooks/view.tsx`: the `ui.render` pane, drawing what `rails.ts` lays out.
- `hooks/register.tsx`: the hooks, the `story` tool, `GOALS.md` loading, subagent tracking.
- `types/index.d.ts`: the `$.state` contract.

## Statuses

Statuses map to fixed `GOALS.md` markers: plain item = backlog, `[ ]` todo, `[>]` in_progress, `[?]` review, `[!]` blocked, `[x]` done. Colors are theme keys (`inactive`, `suggestion`, `warning`, `merged`, `error`, `success`), so they follow light and dark.

## How it meets the guide's traps

- The model reads the board from the `story` tool's description, re-described when `GOALS.md` changes.
- The story tool is answered from the general `tool.call` hook by comparing `e.tool` with `mcp__task-compass__story`.
- Cards open on a click on a dot's name, a plain `Button`; the dot stays a `Text` outside it. The open card sits in its column's flow under its story, so the rows below slide down. The tree fills the pane with `minHeight` of `e.props.scroll.bodyRows`, not the viewport's rows.
- On a desktop the rail is the left edge of a bordered `Box` clipped by a one-cell `overflow="hidden"` Box (`railRun`), and cards are four straight edges (`squareFrame` in `view.tsx`); the terminal keeps `│` text.
