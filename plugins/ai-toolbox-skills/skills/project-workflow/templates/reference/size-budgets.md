# Reference: size budgets

Read this before editing `20.PLAN.md` or `30.ROADMAP.md`, or before changing a schema's budget.

Files that are read every session hold **state, not history**. History is already owned by `reviews/`, `tasks/` and git, and a second copy drifts.

1. **`20.PLAN.md`:** "Recently completed" keeps at most the last three sprints. Collapse older entries to one line that links to a checkpoint.
2. **`30.ROADMAP.md`:** the sprint table is an index. Each row is a theme sentence plus links, never a digest. "Explicitly deferred" is exempt.
3. **Artifacts:** each schema's `max_lines` caps a brief, ADR or review, and `check-artifact.sh` enforces it. A file over budget is split or trimmed, never exempted.
4. **Never delete without a home.** Before collapsing anything, confirm its content survives in a checkpoint, a brief, or `git log`.
5. **Never raise a budget to fit what is already there.** Trim first. A budget that grows to match its contents bounds nothing.
