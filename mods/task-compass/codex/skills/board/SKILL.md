---
name: board
description: Show and keep the project's sprint board in .ai/GOALS.md. Use when the person asks what is on the board, which story is next, or to add or move a story.
---

# The sprint board

The board is `.ai/GOALS.md` in the session's folder. Each `## ` heading is a
sprint, with optional `Goal:`, `Dates:` and `Status:` lines under it. Each
top-level list item is a story, its id `<sprint>.<story>` in file order
(`2.3` is the third story of the second sprint). Its checkbox is its status:

| Item | Status |
|------|--------|
| `- story` (no box) | backlog |
| `- [ ] story` | todo |
| `- [>] story` | in_progress |
| `- [?] story` | review |
| `- [!] story` | blocked |
| `- [x] story` | done |

Indented lines under a story are its details.

## Showing the board

Read `.ai/GOALS.md` and show the current sprint (the first in progress or in
review, else the first not done) with each story's id, title and status;
fold done sprints to one line.

## Changing a status

Call the `story` tool of the task-compass MCP server with the story id and
the new status (`backlog`, `todo`, `in_progress`, `review`, `blocked`,
`done`). Do it unprompted as you work: `in_progress` when you start a
story, `review` when you hand it over, `done` when it is finished,
`blocked` when stuck.

## Adding a story

Edit `.ai/GOALS.md`: add a `- [ ] <story>` line under the sprint it belongs
to, details indented under it. Ids after it in that sprint move by one, so
read the board again before the next `story` call.
