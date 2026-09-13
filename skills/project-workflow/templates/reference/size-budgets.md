# Reference: size budgets for `20.PLAN.md` and `30.ROADMAP.md`

Linked from `00.CONVENTIONS.md` — read this when about to edit either
index file, not every session.

Both files are read at the start of **every session** this convention
governs. Left unchecked, their "history" sections grow one dense cell per
closed sprint — duplicating what `reviews/`'s checkpoints and `tasks/`'s
briefs already own, in violation of the one-owner-per-fact rule. Two
symptoms of that growth, observed in practice: a stale fact (a test
count) drifted between two files because nothing forced it to have one
owner, and a markdown table became too large to review, hiding a
structural defect (a stray blank line) for multiple sprints.

The fix, not merely a caution:

1. **`20.PLAN.md`'s "Recently completed" keeps at most the three most
   recently closed sprints in full prose.** Older entries collapse to a
   one-line row: sprint ID, one-clause theme, a link to its checkpoint
   (or to `30.ROADMAP.md`'s row where no checkpoint exists).
2. **`30.ROADMAP.md`'s sprint-history table is an index, not a digest.**
   Each row states the theme in a sentence or two and links to the
   checkpoint and task briefs — never restates their content.
3. **The budget is measured in bytes, not lines**, and stated in each
   file's own header so it doesn't survive only as tribal knowledge. A
   dense single-line table cell is invisible to a line-based cap; that is
   precisely how the defects above went unnoticed.
4. **Nothing is deleted outright.** Before collapsing a sprint's row,
   confirm its narrative survives in a checkpoint, a task brief, or `git
   log` — write or amend the checkpoint first if it does not.
5. **`tasks/`, `decisions/`, and `reviews/` are exempt.** They are the
   point-in-time and long-form records this budget exists to protect, not
   files it should also shrink.

If a project's `20.PLAN.md`/`30.ROADMAP.md` grow past whatever budget was
set for them, apply this fix rather than raising the cap — raising the
cap first and pruning to fit second defeats the purpose: a budget that
grows to match whatever already exists never actually bounds anything.
