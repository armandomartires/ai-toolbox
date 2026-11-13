# Reference: size budgets

Read this before editing `10.CURRENT_STATE.md`, `20.PLAN.md` or `30.ROADMAP.md`, or before changing a schema's budget.

Files that are read every session hold **state, not history**. History is already owned by `reviews/`, `tasks/` and git, and a second copy drifts.

1. **`10.CURRENT_STATE.md`:** at most 200 lines (its schema's `max_lines`). It states what is true now; edit the fact, never append a log. `40.RISK_REGISTER.md` is a table, one row per risk, and must carry a `Last reviewed` date that each sprint review updates.
2. **`20.PLAN.md`:** on a forge tracker the forge variant (`templates/forge/20.PLAN.md`) has the same budget and no task list; the rest of this rule is for the files tracker. "Recently completed" keeps at most the last three sprints. Collapse older entries to one line that links to a checkpoint.
3. **`30.ROADMAP.md`:** the sprint table is an index. Each row is a theme sentence plus links, never a digest. "Explicitly deferred" is exempt.
4. **Artifacts:** each schema's `max_lines` caps a brief, ADR or review, and `check-artifact.sh` enforces it. A file over budget is split or trimmed, never exempted.
5. **Never delete without a home.** Before collapsing anything, confirm its content survives in a checkpoint, a brief, or `git log`.
6. **Never raise a budget to fit what is already there.** Trim first. A budget that grows to match its contents bounds nothing.
