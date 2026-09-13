# Reference: task ID scheme and lifecycle

Linked from `00.CONVENTIONS.md` — read this when about to create or
promote a task, not every session.

## Task IDs

```
S002.T004_ShortName.md
└┬┘ └┬┘  └────┬────┘
sprint task   short PascalCase or hyphenated name
```

- **`S###`** — sprint/phase, zero-padded 3 digits, sequential, never
  reused
- **`T###`** — task, zero-padded 3 digits, sequential **within** the
  sprint, resets to `001` at the start of each new sprint
- **Name** — short, descriptive, no spaces

Sprint **names** (e.g. "Foundations", "Safety Hardening") live in
`30.ROADMAP.md`'s sprint table, not baked into every task filename twice —
`S000_Foundations` in the filename already carries the name once; don't
also repeat it in file content headers if `30.ROADMAP.md` already says
what `S000` means.

## Promoting an ad-hoc item to a real task

`35.AD_HOC_TASKS.md` holds things noticed during other work that are
real, verified, and out of scope for whatever was being done at the
time — not a bug tracker for hypothetical problems. When one of these
gets picked up for real:

1. Create `tasks/S###.T###_Name.md` for it, following the ID scheme
   above.
2. Remove the entry from `35.AD_HOC_TASKS.md`'s "Open" section (or move
   it to a "Resolved" section with a one-line pointer to the new task
   brief).
3. Do not leave the same fact in both files once the task brief exists —
   the task brief becomes the one owner.

## Status vocabulary

A task brief's `**Status**:` field uses one of: `not started`,
`in progress`, `blocked`, `completed`. If a project's own task template
declares additional states (e.g. a `ready` gate for dispatching to a
narrower-scoped agent), that template's own header is authoritative —
this reference file states the baseline, not every project's extension.
