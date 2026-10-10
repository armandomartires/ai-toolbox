# No sprint is open

S10 closed 2026-09-26 on `REVIEW-0012` and is archived in `planning/sprints/`. Opening the next sprint is a human decision. Until then, work runs task by task on the human's routing. The next task id is the next number not yet used in `.ai/tasks/`.

## In progress

- `B-054` / `PLAN-0007`: concise artifacts (`ADR-0033`), tasks `TASK-0150`–`TASK-0154`.

## Open, not scheduled

1. **`worktree-only` on Claude Code.** Measured as not enforced (`TASK-0111`). To decide: keep emission refused, redefine the term, or have the roles stop declaring it.
2. **OpenCode binding.** Bulk staging (`TASK-0097`) and gate-map reads (`TASK-0098`, `B-030`) are tested against stubs only.
3. **`ansible-ops`.** All nine gates were exercised once (`TASK-0116`). A guest-level change with a real PVE snapshot has not been.
4. **`ADR-0022` F8.** The only open falsifier, and it applies only to Bionic (S10.4).
5. **An untested commitment.** "If a sprint shrinks, cut a product, never the spike." Restate it in the next plan that risks shrinking.

## Known limitation

- **`git add -- .`** cannot be denied at OpenCode's glob layer (`TASK-0083`). The rule lives in the bodies of `git-ops` and `closer`. Reopen only if OpenCode's matcher changes.

## Closed, not to be re-raised

- Backlog items: `B-018`, `B-021`, `B-023`, `B-024`, `B-026` to `B-035`, `B-043`.
- The `ansible-core` version recount (`TASK-0108`, `TASK-0115`).
- `ADR-0022` F7 and F9 (`TASK-0114`).
- The Claude Code binding's first real run (`TASK-0113`).
