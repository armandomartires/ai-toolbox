# TASK-0024 — Unify `.ai/decisions/` filenames on the `NNNN-*` scheme

## Objective
Close B-008 by renaming the seven `ADR-000N-*.md` decision files to the
`NNNN-*.md` scheme the other five already use, and fixing every path
reference that points at an old name.

## Minimal context
`.ai/decisions/` holds twelve files under two naming schemes:
`ADR-0001-…` through `ADR-0007-…`, then `0008-…` through `0012-…`. Both
resolve for a human reader, so nothing is broken today — which is why
this sat at `low` priority through five sprints.

**The direction is not a matter of taste.** The `project-workflow`
skill — which this repo owns and is canonical for (ADR-0004) — prescribes
`decisions/NNNN-short-title.md` in two places:
`templates/00.CONVENTIONS.md:45` and `SKILL.md:40`. The `0008`–`0012`
files follow the skill; `ADR-0001`–`ADR-0007` predate it. So this is not
"pick a scheme", it is "the older files never got migrated to the
convention this repo publishes to other projects".

**What is *not* changing: the identifier.** Every file's H1 already reads
`# ADR-NNNN — Title`, all twelve consistently, and prose across the repo
cites "ADR-0009" while its file is `0009-….md`. The identifier is
`ADR-NNNN` and is independent of the filename. Only filenames and true
path references are in scope; the ~25 prose mentions of `ADR-000N` stay
exactly as they are.

Verified before planning: **nothing programmatic reads these filenames.**
No script, test, hook, or workflow globs or parses `.ai/decisions/` —
grepped `tests/*.sh`, `scripts/*.sh`, `.githooks/*`,
`.github/workflows/*.yml`. So the blast radius is markdown links only.

## Inputs
| Artifact | Produced by | Expected state |
|---|---|---|
| `.ai/planning/BACKLOG.md` | pre-existing | B-008 `open`, the only open item. This task closes it. |
| `.ai/decisions/` (12 files) | S1–S5 | 7 named `ADR-000N-*.md`, 5 named `NNNN-*.md`. All 12 H1s already read `# ADR-NNNN — …`. |
| `skills/project-workflow/templates/00.CONVENTIONS.md:45` | TASK-0003/0020 | States `decisions/NNNN-short-title.md`. **The authority for the rename direction** — verify it still says this. |
| `skills/project-workflow/SKILL.md:40` | TASK-0021 | Same convention, `3.1.0`. |
| 7 true path references | S1–S4 task/session files | In `TASK-0002` (×2), `TASK-0004`, `TASK-0005`, `TASK-0013` (×2), `SESSION-20260912-2230`. These are the only occurrences carrying a directory or `.md`. |
| `tests/validate.sh` | TASK-0023 | Passing. Does **not** read `.ai/decisions/` — confirmed by grep, so no check needs updating. |

## Scope
### Included
- `git mv` the seven `ADR-000N-*.md` files to `000N-*.md`, preserving the
  descriptive slug unchanged.
- Update the seven true path references.
- Close B-008 in `BACKLOG.md`.

### Not included
- **Rewriting the ~25 prose mentions of `ADR-000N`.** The identifier is
  unchanged; editing them would be a large diff that changes no meaning
  and would break the H1 titles' agreement with the text.
- **Changing any H1 title.** All twelve already agree.
- **Editing historical task/session narrative beyond the literal broken
  path.** Six of the seven references sit in completed task files. A path
  that no longer resolves is a defect worth fixing; the surrounding
  account of what happened is not to be reworded.
- **Adding a `validate.sh` check for decision filenames.** Tempting and
  out of scope: it would be inventing a requirement mid-task, exactly
  what ADR-0008 declined to do for the "line budget". If wanted, it needs
  its own brief.
- Renaming `REVIEW-*`, `TASK-*`, or `SESSION-*` files. Those schemes are
  internally consistent.

## Likely files
<!-- A forecast, written BEFORE the work — what you expect to touch.
     What you actually changed belongs in Outputs / handover, not here. -->
- `.ai/decisions/ADR-0001…ADR-0007-*.md` (renamed)
- `.ai/tasks/TASK-0002-*.md`, `TASK-0004-*.md`, `TASK-0005-*.md`,
  `TASK-0013-*.md`
- `.ai/sessions/SESSION-20260912-2230.md`
- `.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`,
  `.ai/context/CURRENT_STATE.md`

## Execution plan
1. Re-verify the skill still prescribes `NNNN-*` (the rename direction
   rests on it) and that nothing programmatic reads the filenames.
2. `git mv` each of the seven files, so rename detection keeps history.
3. Fix the seven path references — literal path only, no prose rewording.
4. Re-grep for any surviving `decisions/ADR-` or `ADR-000N…md` pattern;
   expect zero.
5. **Verify every markdown link into `.ai/decisions/` resolves**, both
   directions: no reference to a nonexistent file, and no orphaned file.
   This is the real acceptance test — a rename that leaves a dangling
   link is worse than no rename, because the file looks present.
6. `validate.sh`, `sync-registry.sh` (expect no diff — no component
   changed), confirm `git status` shows renames rather than
   delete+add pairs.
7. Close B-008; update the planning files.

## Acceptance criteria
- [x] All twelve files match `^\d{4}-.*\.md$`; none begins `ADR-`.
- [x] Zero occurrences of `decisions/ADR-` or `ADR-000N[-a-z]*\.md` as a
      reference **into this repo's** `.ai/decisions/`. Three remain in
      this brief (describing the pattern being removed) and two in
      B-009's note (describing what `project-migration` emits into *other*
      projects) — prose about the scheme, not links to it.
- [x] **Every** `.ai/decisions/` path reference resolves — verified
      programmatically, and the one flagged "dangling" was traced by hand
      to a heredoc that *creates* a file in a scaffolded project.
- [x] No resolvable-link count drop: 14 resolvable before and after; the
      5 unreferenced files are cited by identifier only, which is correct.
- [x] Prose identifiers `ADR-000N` untouched; all 12 H1 titles unchanged.
- [x] `git status` shows `R` renames for all seven.
- [x] B-008 closed in `BACKLOG.md`.
- [x] `tests/validate.sh` passes; `sync-registry.sh` no diff.
- [x] **Added during execution:** `.ai/README.md` no longer prescribes the
      superseded scheme.

## Mandatory validations
- [x] `tests/validate.sh` — OK (and it caught this very file's empty
      `Outputs / handover` mid-task, which is the check doing its job)
- [x] `scripts/sync-registry.sh` — no diff
- [x] Link-resolution sweep over every `.ai/decisions/*` reference —
      12 files, 8 distinct filenames referenced, 14 resolvable, 0 genuinely
      dangling
- [x] `git status --short` — 7 × `R`, no `D`+`A` pair, no mode churn
- [x] `git diff --staged -M --stat` — all 7 pure renames, 0 insertions /
      0 deletions, so history follows and content is provably unchanged

## Risks and rollback
- **Risk: a dangling link is silently created.** The whole point of the
  task, and the one outcome that would make things worse. Mitigation:
  step 5's programmatic resolution sweep, run after the renames, not
  assumed from the grep in step 4.
- **Risk: over-eager find/replace mangles prose.** `ADR-0003` appears ~25
  times as an identifier and 3 times as a path. A blanket replace would
  rewrite all 28 and change meaning in 25 of them. Mitigation: only
  patterns containing `decisions/` or `.md` are edited, and the diff is
  reviewed line by line.
- **Risk: `git mv` on a `core.filemode=false` /mnt/c checkout.**
  `CURRENT_STATE.md:92-96` documents that mount's mode oddities. Renames
  are not mode changes, so this should be inert — but confirm `git status`
  shows no spurious mode churn.
- Rollback: `git revert` the commit; renames revert cleanly and no
  content is restructured.

## Outputs / handover
| Artifact | End state |
|---|---|
| `.ai/decisions/` (7 files) | Renamed `ADR-000N-*.md` → `000N-*.md` via `git mv`; all 12 now match `^\d{4}-`. **H1 titles and prose identifiers unchanged** — `ADR-NNNN` is still the identifier everywhere. |
| `.ai/tasks/TASK-0002/0004/0005/0013`, `.ai/sessions/SESSION-20260912-2230` | 7 path references updated. Only the literal path changed; no narrative reworded. |
| `.ai/README.md` | **Line 4 rewritten.** It was prescribing `ADR-NNNN-*.md` — the old scheme — so the normative doc contradicted both the convention and, after the rename, every file on disk. Not in the plan; found by the link sweep. |
| `.ai/planning/BACKLOG.md` | B-008 **done**. New **B-009** raised: `project-migration` scaffolds the old scheme into every project it touches. |
| `docs/registry.md` | Unchanged. |
| `skills/project-migration/` | **Deliberately untouched** — see B-009. |

**Next task starts here**: the backlog holds exactly one open item,
**B-009**, and it is blocked on a *decision*, not on effort.
`project-migration`'s scaffold emits `.ai/decisions/ADR-0001-repo-structure.md`
and documents `ADR-NNNN-*.md`, so every project it scaffolds starts on the
scheme this repo just migrated away from. That is a one-line fix and a
one-paragraph doc edit — but only *after* someone decides whether the two
skills are meant to share a convention at all. `project-migration` never
claims alignment with `project-workflow`; assuming they should agree
would be inventing a requirement, which is what ADR-0008 declined to do
for the "line budget". **Write the ADR before the rename.**

## Status notes
Deviation from the plan: the plan scoped this as "rename seven files, fix
seven references". The link-resolution sweep (step 5) found an eighth
problem the four grep passes had all missed — `.ai/README.md` prescribing
the old scheme — and a ninth outside this repo's `.ai/` entirely.
Fixing the README was in scope (a normative doc contradicting the files it
describes is the same defect, one level up). B-009 was not, and was
logged rather than absorbed.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13

## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode
- Actions:
  - Established the rename *direction* from the skill's own convention
    before planning, rather than picking the majority scheme: both
    `00.CONVENTIONS.md:45` and `SKILL.md:40` prescribe `NNNN-short-title.md`.
  - Confirmed nothing programmatic reads these filenames (no script,
    test, hook or workflow globs `.ai/decisions/`), bounding the blast
    radius to markdown links.
  - `git mv` × 7; fixed 7 path references; fixed `.ai/README.md`;
    closed B-008; raised B-009.
- Observations:
  - **The link-resolution sweep found what four grep passes missed.**
    Greps answer "does this string appear"; the sweep answers "does every
    reference resolve", and those are different questions. It surfaced
    `.ai/README.md:4` still prescribing `ADR-NNNN-*.md` — so the
    normative doc describing `.ai/decisions/` contradicted the convention
    *and*, after the rename, every file in the directory. **A grep for
    broken paths cannot find a doc that is simply wrong.**
  - **B-008's own wording understated the problem.** It described a
    cosmetic split resolvable by a rename. The real defect was a
    normative doc prescribing the superseded scheme — which would have
    regenerated the inconsistency the moment anyone wrote ADR-0013 by
    following the README. This is the S5 lesson again from the other
    direction: a backlog item is a hypothesis about a defect, not a
    description of it. **Scope the item by reading, not by its title** —
    the same finding that closed B-001 and B-002.
  - **The sweep's one "dangling" hit was a false positive, and checking
    it was still worth it.** `project-migration/scripts/ai-project-scaffold.sh`
    contains `.ai/decisions/ADR-0001-repo-structure.md` inside a
    heredoc that *creates* that file in a newly scaffolded project. Not a
    broken link here — but it means every project that skill scaffolds
    starts on the scheme this repo just left. Logged as B-009, not fixed:
    `project-migration` is an independent skill that never claims
    alignment with `project-workflow`, so making them agree is a decision
    (an ADR), not a rename.
  - The `git mv` was clean on this `core.filemode=false` /mnt/c checkout —
    7 × `R` with no spurious mode churn, as expected since renames are
    not mode changes.
  - `validate.sh` failed mid-task on *this file's* empty
    `## Outputs / handover`. That is TASK-0023's check working on the
    first task written after it shipped, catching a real omission in the
    only way it can — presence, not correctness.
- Validation:
  - Link sweep: 12 files on disk, 8 distinct filenames referenced, 14
    resolvable references, 0 genuinely dangling. 5 files referenced by
    identifier only — correct, not an error.
  - `tests/validate.sh` — OK. `scripts/sync-registry.sh` — no diff.
  - `git status --short` — 7 × `R`. `git diff --staged -M --stat` shows
    all seven as pure renames, **0 insertions / 0 deletions**, so content
    is provably untouched and `--follow` will trace through them.
    (Ran `git log --follow` first and got empty output — because the
    rename was not yet committed. The right check at that moment was the
    staged rename detection, not the history walk.)
  - All 12 H1 titles re-read: unchanged, all `# ADR-NNNN — …`.
- Result: success, with scope honestly extended by one file
  (`.ai/README.md`) and one new item logged (B-009). B-008 closed.
- Commit: `151fc9e`
- Push: `origin master`, confirmed — local and
  `git ls-remote origin master` both `151fc9e`.
- Post-commit confirmation: `git log --follow .ai/decisions/0001-repo-structure.md`
  traces back through the rename to `e72b78c`, the original scaffold
  commit. History survives, as the staged rename detection predicted.
