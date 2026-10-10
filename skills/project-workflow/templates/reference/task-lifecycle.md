# Reference: task ids and lifecycle

Read this when creating or promoting a task.

## Task ids

```
S002.T004_ShortName.md
└┬┘ └┬┘  └────┬────┘
sprint task   short PascalCase or hyphenated name
```

- **`S###`** is the sprint, numbered sequentially and never reused.
- **`T###`** is the task, numbered sequentially within its sprint and reset to `001` at each new sprint.
- Sprint names live in `30.ROADMAP.md`, not in each brief.

Generate a brief with `scripts/new-artifact.sh --kind task`; never copy one.

## Status

The status is one of `not started`, `in progress`, `blocked`, `completed`. A project's own template may add states, and its header is then authoritative.

## Promoting an ad-hoc item

1. Create the task brief.
2. Move the entry from `35.AD_HOC_TASKS.md` "Open" to "Resolved", with a one-line link to the brief.
3. Leave the facts in one place only: the brief.
