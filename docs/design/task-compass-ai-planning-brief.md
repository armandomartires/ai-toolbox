---
# The three lock fields. Left empty by step 4; filled by step 7 of
# loops/design-brief/ on acceptance only, then committed by git-ops.
# The COMMIT is the lock, not these fields — a field can be flipped by the
# next agent to open this file; a commit cannot be altered without a
# visible history rewrite.
status: accepted
accepted_by: Armando Martires
accepted_on: 2026-10-27
---

# Design brief — task-compass reads a project's .ai/ planning

`TASK-0178`. Step 1 confirmed and the brief accepted by the human on 2026-10-27, in iteration 1 of 3.

## Problem

In a project that plans in `.ai/` under the project-workflow convention, such as sigma-infrastructure, the Compass pane shows no sprints and no stories. It reads only a `GOALS.md` at the project root, and those projects have none. The person cannot see the project's sprints, which ones are open, or where each task stands, beside the chat.

## Constraints

| Constraint | Hard or assumed | Source |
|------------|-----------------|--------|
| The mod never writes `.ai/` files. Claude updates briefs under the project's own rules, and the pane picks the change up. | hard | human, 2026-10-27 |
| Covers the project-workflow layout only: sprints in `30.ROADMAP.md`, tasks in `.ai/tasks/S###_Name.T###_Name.md` | hard | human, 2026-10-27 |
| Every open sprint counts as current, centred together; closed sprints scroll as earlier | hard | human, 2026-10-27 |
| A `GOALS.md` project behaves as today, and the mod's existing tests pass unchanged | hard | `TASK-0178` scope |
| Runs in the hook sandbox through `$.fs`; a status edit shows within a few seconds | hard | engine (`claude-code` types); `register.tsx` |
| Reads the files as they are. First words of the 235 files' `**Status**:` lines: `completed` 177, `done` 29, `not started` 12 (the template included), `complete` 8, `closed` 3, `blocked` 2, `resolved` 1, none 3. No schema owns the roadmap's sprint table. | hard | sigma-infrastructure `90f9a4d`; `skills/project-workflow/schemas/task.md` (four values) |
| Tested against fixtures copied from real sigma-infrastructure files | hard | lesson 4, `CURRENT_STATE.md` |
| The layout is found through `.ai-layout.json` (default root `.ai/`), its entrypoint and `30.ROADMAP.md` both present | assumed | `skills/project-workflow/templates/reference/layout-declaration.md` |
| If a project has a `GOALS.md`, it wins | assumed | none has both today |
| The first load (1.78 MB in 235 reads) and a 6-second tick stay cheap in the sandbox | assumed | measured size; time not measured |

## Out of scope

- Writing any `.ai/` file, a brief's status included.
- The project-migration layout (ai-toolbox's own), forge trackers, and a general source layer for them: a later run.
- `20.PLAN.md` and `35.AD_HOC_TASKS.md` (`#nnn` items).
- Fixing sigma-infrastructure's drifted statuses or stale `(open)` cells: that project's work.
- Publishing to the organization plugin library.

## How success is recognised

In a session in sigma-infrastructure, the pane centres the open sprints (by the rule below, today `S087`–`S089`) with their `T###` tasks. Each task's dot matches its brief's `**Status**:` line, and closed sprints scroll as earlier. No open sprint reads `late` unless its roadmap row gives an end date that has passed. Editing a brief's status shows in the pane within a few seconds. A `GOALS.md` project looks as it does today; `tests/test-mods.sh` passes with the existing tests unchanged and new ones on fixtures drawn from the real files.

## Chosen approach

**C1, amended: `.ai/` is translated at load into the existing `Sprint`/`Story` contract.** The pane and the layout code draw both sources the same way. Only `register.tsx` knows which source is active, through one `source: 'goals' | 'ai'` state key. That is the load-bearing commitment: one data contract and one pane, and no source layer. The GOALS path keeps its code, its tests and its write behaviour.

1. **Detection**, in `loadGoals`: `GOALS.md` first, as today. Otherwise `.ai-layout.json` or its defaults, and the board is `.ai/` only if `<root>/<entrypoint>` and `<root>/30.ROADMAP.md` both exist. Probes use `fs.stat` with a catch, which the existing test stub already answers.
2. **Sprints** come from the *Sprint history* table's rows, sorted by number: `n` = the number (87); `label` = `S087` (new optional field, which the view prefers over `S${n}`); `title` = the name, `CamelCase` split into words; `goal` = the Theme cell, left empty when the cell only points to a review; `dates` = start, plus an end only when the cell gives one after the dash.
3. **Open sprints**: a row whose Dates cell says `(open)` *and* that has at least one task not done (rule A, below). They get `isOpen: true` (new optional field) and sort after the closed ones, so the open group is contiguous.
4. **Stories** come from files matching `S###_Name.T###_Name.md` or `S###.T###_Name.md` exactly, so the template and the three `*.change-record.md` files are excluded. `id` = `S087.T004`, the native id (`Story.id` is already a string); `title` = the name split into words, so `guessStory` can match it; `status` from the first `**Status**:` line within the first 20 lines. The raw status text and the file path go into `details`.
5. **One status table**: `statusFromWords` in `model.ts` gains `resolved` (→ done) and `cancelled` (→ done). The `.ai/` reader maps by the first word through it. A value it does not know shows as `todo`, its raw text on the card, and the sprint's card counts the unknown values, so drift is visible.
6. **Several current sprints**: `carousel`'s signature stays. The caller passes the middle of the open group as `cur`, which centres the group as far as the width allows (2–4 columns). The view marks every `isOpen` sprint current, and the header reads `S087–S089 open · 88 sprints` instead of `Sprint n of m` for `.ai/`. A GOALS board has no `isOpen`, so its path is unchanged.
7. **`sprintEnd`** reads the date after the arrow or dash, or the only date when there is none. An open sprint with only a start never reads `late`. A GOALS file with `Dates: a → b` behaves as today.
8. **Re-reads**: each tick stats the roadmap and calls `$.fs.list` on `tasks/` once, re-reading only the briefs whose `mtimeMs` or `size` changed, from a module-level cache keyed by path. A Write or Edit by Claude under the root triggers an immediate reload, as a GOALS.md edit does today.
9. **The `story` tool** keeps its schema, which is fixed when the tool is registered. In a `.ai/` project its description lists the open sprints' tasks by native id and status. It says the tool records which task Claude is on and writes nothing, and that a status change belongs in the brief under the project's own rules. Called with a status, it sets the focus and replies that nothing was written and which line of which file holds the status.
10. **No write path in `.ai/` mode, enforced by structure and tests**: `answerStory` calls `setStoryStatus` only when `source === 'goals'`. `/goals init` refuses in a `.ai/` project and says where its plan lives. The empty-pane text names the source it looked for. The new engine tests record every `fs.write` and assert none happens.
11. **Tests**: pure parser tests and engine tests on redacted copies of the real files (rule B, below): the roadmap table; S087; S088; S089; S082; S001.T006; S043 with a change-record; S002.T001–T003; the template. Existing tests stay as they are.

## Rejected alternatives

| Alternative | Load-bearing difference | Why rejected |
|-------------|------------------------|--------------|
| C2: a source layer inside task-compass | Each source owns detection, current set, description and tool; state holds the source's own shape | It rewrites the working GOALS path, and the existing tests miss `/goals`, the reload on edit and the invalidation it moves. Its payoff is room for project-migration and forge sources, which are out of scope and fit neither its shape nor the no-network sandbox. The tool's schema cannot be owned per source anyway (`tool.describe` changes only the description). |
| C3: a separate mod | Its own pane, state and tool; task-compass untouched | It leaves the Compass pane itself empty in `.ai/` projects, with a description that tells the model to run `/goals init`. Detection gets two owners, and about 650+ copied lines of pane drift with no possible check. Two plugins have to be installed, and nothing tests them together. |
| C4: the current task follows Claude's edits | Derived from Read/Edit/Write calls, no declared task | Its premise is false in sigma-infrastructure's transcripts: 572 Bash reads of briefs against 14 `Read` calls, status edits by `sed -i`, and sprint planning writing every brief at once (the marker would land on a blocked brief). No correction path, and no success criterion asks for it. |
| Refresh on `classic.FileChanged` | Event-driven reload | Polling with `$.fs.list` meets the latency; the event path for mods is unverified. A later change, not a design commitment. |

## Assumptions

| Assumption | Verified or unverified | If wrong |
|------------|------------------------|----------|
| The story tool in a `.ai/` project records the focus and writes nothing | decided here (step 4), was unverified | the tool needs another role there |
| *Next up* items are not sprints and are not shown | unverified | later sprints have to come from *Next up* |
| sigma-infrastructure's layout at `90f9a4d` (2026-10-26) is current | verified as of that commit | re-read the live copy before implementing |
| `$.fs.list` returns `mtimeMs` and `size` per entry | verified (engine types) | each tick re-reads every brief |
| The first load is fast enough inside `session.start` and `tool.describe` | unverified; to be measured in the implementation | load the open sprints first, the rest after |
| A `GOALS.md` file, even an empty one, wins over `.ai/` | assumed constraint | an empty `GOALS.md` hides the `.ai/` board until removed |

## Decided at step 6 (human, 2026-10-27)

- **Rule A, what counts as open: both together.** A row whose Dates cell says `(open)` and that has a task not done; `S087`–`S089` today. The roadmap marks six rows `(open)` (`S043`, `S066`, `S076`, `S087`–`S089`), and tasks not done mark `S001`, `S082`, `S087`–`S089`.
- **Rule B, fixtures and the public mirror: redacted copies.** 13 of the named fixture files contain internal host names, and ai-toolbox is mirrored publicly. The copies replace host names by placeholders and change nothing else. The fixtures' host patterns go into `.git/info/private-patterns` on this host, so the gate fails on a missed one.
- **The second owner that stays: accepted.** `skills/project-workflow/dashboard/` (Python) also maps these statuses and has its own open-sprint rule; TypeScript in a sandbox cannot share its code. `DEVELOPING.md` names it.

## Verification against the constraints (step 5)

| Constraint | Met? |
|------------|------|
| Never writes `.ai/` | Yes: the write sites are gated on `source`, and tests assert no `fs.write` (approach 10) |
| project-workflow only | Yes; both filename spellings are accepted, nothing else is read |
| Every open sprint current, centred together | **Exception:** centred together up to the pane's 2–4 columns. With more open sprints than that, the rest are one scroll away and the header names them all. |
| `GOALS.md` behaves as today, tests unchanged | Yes: new fields are optional, `carousel` and `focusOf` keep their signatures, and `sprintEnd` keeps GOALS's `a → b` meaning |
| Sandbox; a status edit shows within seconds | Yes: `$.fs` only, a 6-second tick, an immediate reload on Claude's edits |
| Reads files as they are | Yes, through rule A and the status table; unknown values stay visible |
| Fixtures from real files | **Exception, by rule B:** structure verbatim, host names replaced |
