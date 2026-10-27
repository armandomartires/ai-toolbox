# Developing task-compass

`README.md` is the user-facing spec, including the `GOALS.md` format. Rules every mod follows, and the engine and desktop traps found while building this one: authoring guide, *Mods*. Loading and testing: runbook, *Loading a mod in development*, and `tests/test-mods.sh`.

## Modules

- `hooks/model.ts`: pure logic (parse sprints, status table `STATUS`, sticky colors, `setStoryStatus`, `applyPlan`, `guessStory`, `wrap`). Tested directly in `register.test.tsx`.
- `hooks/rails.ts`: pure layout of the pane: `focusOf`, `carousel`, `columnRows` (rows, cards, progress, folding), sprint dates. Tested directly in `rails.test.ts`.
- `hooks/view.tsx`: the `ui.render` pane, drawing what `rails.ts` lays out.
- `hooks/plan.ts`: pure reading of a project-workflow `.ai/` layer: `layoutOf`, `parseRoadmap`, `briefStory`, `statusOfRaw`, `planSprints` (open sprints last). Tested directly in `plan.test.ts`.
- `hooks/register.tsx`: the hooks, the `story` tool, board loading (`GOALS.md`, else the `.ai/` layer, re-reading only the briefs whose mtime or size moved), subagent tracking. It is the only module that knows the source (`source` in `$.state`), and it writes only when the source is `goals`. Its `.ai/` behaviour is tested in `layer.test.tsx`.
- `types/index.d.ts`: the `$.state` contract.

## The `.ai/` board

Its shape is the locked brief `docs/design/task-compass-ai-planning-brief.md`; change it through a new design run, not here.

- `skills/project-workflow/dashboard/` (Python) also maps these status words and has its own open-sprint rule. TypeScript in the sandbox cannot share its code, so the two are kept in step by hand: a status word added to one belongs in the other (`statusFromWords` here).
- `hooks/fixtures/sigma.ts` holds structure-only copies of sigma-infrastructure's `.ai/` at `90f9a4d`: the roadmap's *Sprint history* rows (themes and commit cells dropped, review pointers and `(open)` kept) and each brief's title, first `**Status**:` line and `**Sprint**:` line. Host names, private addresses, the LDAP base DN and a person's name are replaced. The script that makes them is not tracked, because its patterns are private; to refresh them, copy the live layer, keep what is listed above, replace every name in the host's `.git/info/private-patterns`, and run `scripts/check-private-names.sh` after staging. Tests import them as a module, since `claude plugin test` gives a test no file access.

## Statuses

Statuses map to fixed `GOALS.md` markers: plain item = backlog, `[ ]` todo, `[>]` in_progress, `[?]` review, `[!]` blocked, `[x]` done. Colors are theme keys (`inactive`, `suggestion`, `warning`, `merged`, `error`, `success`), so they follow light and dark.

## How it meets the guide's traps

- The model reads the board from the `story` tool's description, re-described when `GOALS.md` changes.
- The story tool is answered from the general `tool.call` hook by comparing `e.tool` with `mcp__task-compass__story`.
- Cards open on a click on a dot's name, a plain `Button`; the dot stays a `Text` outside it. The open card sits in its column's flow under its story, so the rows below slide down. The tree fills the pane with `minHeight` of `e.props.scroll.bodyRows`, not the viewport's rows.
- On a desktop the rail is the left edge of a bordered `Box` clipped by a one-cell `overflow="hidden"` Box (`railRun`), and cards are four straight edges (`squareFrame` in `view.tsx`); the terminal keeps `│` text.
