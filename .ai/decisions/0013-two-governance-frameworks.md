# ADR-0013 — `project-migration` and `project-workflow` scaffold two different frameworks, deliberately

## Status
Accepted (2026-09-13)

## Context
TASK-0024 renamed this repo's ADR files from `ADR-NNNN-*.md` to
`NNNN-*.md`, matching the `project-workflow` skill's convention. A
link-resolution sweep then flagged
`skills/project-migration/scripts/ai-project-scaffold.sh`, which emits
`.ai/decisions/ADR-0001-repo-structure.md` and documents `ADR-NNNN-*.md`.

That was logged as **B-009**: "`project-migration` scaffolds
`ADR-NNNN-*.md`, diverging from `project-workflow`'s `NNNN-*`". Framed
that way it reads as an unfinished migration — the identical shape to
B-008, which had just been closed by finishing one. The obvious move is
to change one line in the scaffold and close it.

**The premise is false.** The two skills do not scaffold one layout under
two spellings. They scaffold two different governance frameworks, and the
ADR filename is the ninth-smallest difference between them:

| | `project-workflow` | `project-migration` |
|---|---|---|
| Entry point | `00.CONVENTIONS.md` | `AGENTS.md` + `.ai/README.md` |
| In flight | `20.PLAN.md` | `planning/SPRINT-CURRENT.md` |
| Roadmap | `30.ROADMAP.md` | `planning/ROADMAP.md` |
| Backlog | `35.AD_HOC_TASKS.md` | `planning/BACKLOG.md` |
| Project context | *(none)* | `context/{CURRENT_STATE,PROJECT_MAP,GLOSSARY}.md` |
| Session records | *(none)* | `sessions/INDEX.md` + `SESSION-*.md` |
| Templates | `reference/` (6 on-demand files) | `templates/{TASK,PLAN,SESSION,ADR,REVIEW}.md` |
| Task IDs | `S###.T###_Name.md` | `TASK-####-*.md` |
| ADR files | `NNNN-title.md` | `ADR-NNNN-*.md` |

Every row verified against both skills as they stand, not from memory.

Two further facts settle it. **This repo runs `project-migration`'s
framework**, not `project-workflow`'s: `.ai/context/`, `.ai/planning/`,
`.ai/sessions/`, `.ai/templates/`, and task files named
`TASK-0024-*.md`. And `.ai-layout.json` declares
`{"root": ".ai/", "entrypoint": "AGENTS.md"}` — explicitly *not*
`00.CONVENTIONS.md`. ADR-0004 needed that declaration mechanism precisely
because this repo does not adopt the file layout of the skill it
maintains.

So "align the two" is not a one-line rename. It means choosing one
framework and abandoning the other, in a repo that already runs the one
B-009 proposed changing.

The skills also do different jobs. `project-migration` retrofits a
**live repository** — inventory, mapping table, approval gate, `git mv`
with history preservation, four phases. `project-workflow` maintains the
**planning convention** inside a project that already has one. One is a
migration tool; the other is a working convention.

## Decision
**The two skills stay divergent. Neither is changed to match the other.**

1. `project-migration` keeps emitting `ADR-NNNN-*.md`. That naming is
   internally consistent with the framework it scaffolds, and that
   framework is the one `ai-toolbox` itself runs (ADR-0001).
2. `project-workflow` keeps `NNNN-title.md`, unchanged by TASK-0024.
3. **Each skill's `SKILL.md` names the other and states when to use
   which.** The divergence is not self-evident from either file alone,
   which is exactly how it got raised as a defect; the fix is one line of
   disambiguation in each, not a code change.
4. **B-009 is closed as resolved-by-decision, not implemented** — the
   same disposition ADR-0011 gave B-001.

This ADR does **not** decide that two frameworks are ideal. It decides
that unifying them is a large, breaking change that a `low`-priority
one-line backlog item does not license, and that the present cost is
confusion — which documentation fixes.

## Alternatives considered

- **Change `ai-project-scaffold.sh` to emit `NNNN-*.md`.** The literal
  reading of B-009, and rejected: it would align one of nine differences,
  producing a scaffold that is *neither* framework — `context/` and
  `sessions/` and `TASK-####` from one, ADR naming from the other. A
  partial alignment is worse than a clean divergence, because it destroys
  the signal that these are separate systems while fixing nothing. It
  would also break the scaffold's agreement with `.ai/templates/ADR.md`,
  which it emits in the same run.

- **Migrate `ai-toolbox` to `project-workflow`'s layout** so the repo
  matches the skill it maintains. Rejected: it contradicts ADR-0001 and
  the `.ai-layout.json` declaration, would rename or restructure every
  file under `.ai/`, and gains nothing this repo lacks — `context/` and
  `sessions/` have carried real load across five sprints and have no
  equivalent in `project-workflow`.

- **Merge the two skills.** Rejected as out of proportion, but recorded
  because it is the honest long-term option if the duplication ever
  costs more than it saves. It needs a plan, evidence of that cost, and
  a migration path for anything already scaffolded — none of which
  exists. Not deferred with a trigger; simply not justified today.

- **Close B-009 with no ADR.** Rejected: the item would be re-raised the
  next time someone greps for `ADR-` after a rename, exactly as it was
  raised this time. The recurrence is the thing worth preventing.

## Consequences
- **Two frameworks coexist in one repo, and that is now a documented
  choice** rather than an oversight a future session should "fix".
- `SKILL.md` in both skills gains a scope line; both get a minor version
  bump (ADR-0003) and redeployment.
- **An agent scaffolding a new project must choose deliberately.** That
  choice is now stated in each skill instead of being inferred from
  whichever was read first.
- The `ADR-NNNN` *identifier* remains universal — this repo's H1 titles
  and prose still use it, unchanged by TASK-0024. Only filenames differ
  between the two frameworks, which limits the confusion to a directory
  listing.
- **The backlog is empty again.** B-001…B-009 are all closed.
- A future decision to unify would supersede this ADR, not contradict it:
  the evidence table is the input such a decision would need.

## Provenance
Raised as B-009 by TASK-0024; decided by TASK-0025. B-009's own wording
asserted a divergence in a shared convention; investigation found no
shared convention to diverge from. **The third backlog item in this repo
to be closed by scoping rather than building** — after B-001 (superseded,
ADR-0011) and B-002 (split, ADR-0008). In all three the item's *title*
encoded an assumption that did not survive contact with the files.
