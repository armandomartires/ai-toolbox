---
kind: adhoc
framework: project-workflow
id_placeholder: N
title_placeholder: Short description of the thing observed
sprint_placeholder: S###.T###_Name
filename_pattern: 35.AD_HOC_TASKS.md
title_prefix: "### "
title_pattern: {id}. {title}
allow_extra: true
---

# An entry, not a file. 35.AD_HOC_TASKS.md is an index holding many of
# these, so scripts/sync-templates.sh does not regenerate that file -- this
# schema owns the shape of one entry, which the generator prints for pasting
# into the "Open" section. The same reason 20.PLAN.md and 30.ROADMAP.md stay
# hand-maintained: an index is not an instance.

!preamble
!terse
an observed problem, deliberately not fixed now
!standard
Something real, verified and out of scope for whatever you were doing.
Replace the text after each label. Not a bug tracker for hypothetical
problems — every entry is something actually observed, not a guess.
!explicit
Replace the text after each of the five labels below. Every entry must be
something you actually observed, not something you suspect might be true.
If you have not seen it happen, it does not go on this list.
!literal
Replace the text after each of the five labels below. Keep the labels.
  Found during  — the task ID you were working on when you noticed it.
  File          — where the problem lives, as a path.
  What's wrong  — what you actually observed. Not what you suspect.
  Why not fixed — why it is out of scope for that task, specifically.
  Next step     — what picking this up would involve.
If you did not observe the problem yourself, do not add the entry.
Delete this comment when done.
!body
**Found during**: `{sprint}`.
**File**: where the issue lives.
**What's wrong**: the concrete, observed problem.
**Why not fixed**: the reason it's deliberately out of scope right now.
**Next step**: what picking this up would involve.
