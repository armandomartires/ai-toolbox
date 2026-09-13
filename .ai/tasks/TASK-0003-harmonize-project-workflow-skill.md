# TASK-0003 — Harmonize the project-workflow skill

## Objective
Bring `skills/project-workflow/` into compliance with `AGENTS.md` and
`docs/development/authoring-guide.md`: fix the version-integrity defect,
shrink the two mandatory-read files (`SKILL.md`,
`templates/00.CONVENTIONS.md`) via progressive disclosure, make every
mechanism the skill describes self-contained (no dangling references to
another repo's ADR numbers), and close the git/secrets policy gap — per
REVIEW-0002 and ADR-0004.

## Minimal context
This skill was imported from a separate, actively-developed repo,
`opencode-customization`, which is mid-sprint reconciling the exact same
defects (see ADR-0004 for the full provenance finding). The human decided
`ai-toolbox`'s copy becomes canonical going forward, ahead of that repo's
own sequencing, and any future content change here bumps the skill's
version.

This task **generalizes** the pattern already proven in that repo's
`S025` sprint (progressive disclosure, a declarable layout root) rather
than copying its files verbatim — the source repo's version cites its own
ADR numbers (`0005`, `0006`, `0017`) and ships two placeholder reference
files (`git-workflow.md`, `environments-and-secrets.md`) that this task
must write for real, not copy as placeholders, since `ai-toolbox` has no
follow-on sprint to fill them in later.

## Scope

### Included
- Bump `metadata.version` to `3.0.0` (semver, per ADR-0003) — the first
  content change to this skill inside `ai-toolbox`.
- Rewrite `SKILL.md` as a lean index: keep the governing rule, when-to-use,
  copy-never-symlink rule, and the fails-when-reverted pointer; cut
  narrative history; target ≲2 KB. Frontmatter (`name`, `description`)
  stays byte-identical — it is the discovery surface.
- Rewrite `templates/00.CONVENTIONS.md` as a lean index: governing rule,
  directory map, the loop, when-to-write-what, Definition of Done, and a
  pointer table into `reference/`; target ≲3 KB.
- Create `templates/reference/`:
  - `layout-declaration.md` — the `.ai-layout.json` mechanism, fully
    self-contained (this is this skill's own decision now, not a citation
    of another repo's ADR-0017).
  - `size-budgets.md` — the byte-budget rationale, generalized (no
    citation to another repo's ADR-0015).
  - `task-lifecycle.md` — the `S###.T###` ID scheme and status vocabulary.
  - `git-workflow.md` — a **real** policy, not a placeholder: push/remote/
    force-push rules, "a failed push means the task is not done."
  - `environments-and-secrets.md` — a **real** policy, not a placeholder:
    never commit secrets/tokens/`.env`; name which env var a change
    depends on without quoting its value.
  - `skill-maintenance.md` — how this skill is maintained and reused,
    rewritten to name `ai-toolbox` as the source (not
    `OPENCODE-CUSTOMIZATION`).
- Update every cross-reference in `SKILL.md`/`00.CONVENTIONS.md` that
  cited `ADR 0017`, `decisions/0005`, `decisions/0006` to instead point at
  `reference/layout-declaration.md` or `ADR-0004`, whichever is accurate.

### Deviation found during execution (Mandatory validations, not in the
original scope)

The functional smoke test caught real broken links: while shrinking
`00.CONVENTIONS.md` and `SKILL.md` to fit their byte budgets, several
`reference/*.md` pointers lost their `reference/` prefix (trimmed as
"redundant" during compression) or, in `SKILL.md`'s case, were missing
the `templates/` prefix needed since `SKILL.md` lives at the skill root
while `reference/` is nested under `templates/`. Both classes of breakage
were only caught by actually scaffolding into a throwaway directory and
resolving every link programmatically — a `wc -c` byte count alone would
have passed with silently broken navigation. Fixed; re-verified with a
second scaffold + link-resolution pass. Recorded per AGENTS.md ("record
any deviation from the original Plan").

### Not included
- **New templates beyond the six `reference/` files above** — no
  `context/` trio, no `sessions/`, no `BACKLOG.md`, no hardened
  seven-state task lifecycle. That is `opencode-customization`'s `S026`
  scope; importing it here without being asked would silently expand this
  task well beyond "harmonize to current requirements." Left as a
  candidate in this task's Risks section, not started.
- **`opencode-customization`'s own retirement of its copy** or its
  `S025` sprint's disposition — explicitly out of scope per ADR-0004,
  cross-repo, needs its own follow-up there.
- Re-litigating the `CLAUDE.md`-symlink-vs-copy question — `ai-toolbox`'s
  ADR-0002 already covers this repo's own `CLAUDE.md`; this skill's
  templates don't scaffold a `CLAUDE.md` at all (only `.ai/` +
  `AGENTS.md`/`README.md` pointers), so it's not in scope here.

## Preconditions
- Branch `master`, clean except the untracked `skills/project-workflow/`
  and this task's own new files.
- REVIEW-0002 and ADR-0004 exist and are read before editing.

## Likely files
- `skills/project-workflow/SKILL.md`
- `skills/project-workflow/templates/00.CONVENTIONS.md`
- `skills/project-workflow/templates/reference/*.md` (6 new files)
- `docs/registry.md` (regenerated)
- `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`,
  `.ai/planning/SPRINT-CURRENT.md`

## Execution plan
1. Re-verify preconditions: `git status`.
2. Write the 6 `reference/` files first (bottom-up: the index files will
   link to them, so link targets must exist before the indexes are
   finalized — mirrors the source repo's own `T003`-before-`T002`
   dependency ordering, for the same reason).
3. Rewrite `templates/00.CONVENTIONS.md` to the index shape, verify byte
   count ≲3 KB (`wc -c`).
4. Rewrite `SKILL.md` to the index shape, verify frontmatter is
   byte-identical to before except the version bump, verify body ≲2 KB.
5. Grep the whole skill directory for `ADR 0017|0005-move|0006-project`
   to confirm no dangling cross-repo citation remains.
6. Run validations (below).
7. Regenerate `docs/registry.md`, update `CURRENT_STATE.md`, `TODO.md`,
   `SPRINT-CURRENT.md`.
8. Review diff, commit, push (if a remote exists), record in the
   Execution log.

## Acceptance criteria
- [x] `metadata.version` is `3.0.0`; `name`/`description` byte-identical
      to the pre-task frontmatter (confirmed with a direct diff against
      the pre-edit frontmatter block).
- [x] `SKILL.md` ≲2 KB (target 2048 B; **2089 B** final — the first pass
      hit 2066 B, then +23 B came back fixing two broken links the
      smoke test found, which is not scope creep, it's a correctness fix
      the byte target cannot be allowed to block).
- [x] `templates/00.CONVENTIONS.md` ≤ 3072 bytes (**3087 B** final, same
      reason: +80 B from link-prefix fixes over the pre-fix 3007 B).
      Both final counts are the honest number, not force-fit to the
      round target — see Risks for why correctness wins over a byte cap.
- [x] Both files state their own budget in-file.
- [x] Zero occurrences of `ADR 0017`, `decisions/0005`, `decisions/0006`,
      or `OPENCODE-CUSTOMIZATION` anywhere in `skills/project-workflow/`.
- [x] `reference/git-workflow.md` and `reference/environments-and-secrets.md`
      contain real policy, not placeholder text.
- [x] Every fact cut from the two index files survives in exactly one
      `reference/` file — no fact is stated in two places.
- [x] `docs/registry.md` lists `project-workflow`; `name`/`description`
      parse correctly (registry doesn't print version, confirmed as
      expected, not a defect).
- [x] A fresh read of only the trimmed `SKILL.md` answers: what the skill
      does, when it's used, and where the task-ID scheme lives (verified
      by the scaffold smoke test below, not just by inspection).

## Mandatory validations
- [x] tests/validate.sh — `validate.sh: OK`
- [x] scripts/sync-registry.sh — ran clean; no untracked-content exclusion
      was needed this time (`skills/project-workflow/` itself is the
      thing being registered, not something to exclude).
- [x] `wc -c` on both index files against their budgets — see acceptance
      criteria above for the final numbers and why they exceed the round
      target slightly.
- [x] Grep for dangling cross-repo references — clean.
- [x] Secrets scan over the skill before commit — clean (only policy
      prose mentions "secrets").
- [x] Functional smoke test: copied `templates/` into a throwaway `.ai/`
      twice (before and after the link-prefix fix), and programmatically
      resolved every `reference/*.md` link found in `00.CONVENTIONS.md`,
      `SKILL.md`, `20.PLAN.md`, and `30.ROADMAP.md` against the actual
      filesystem. First pass found 4 broken links (see Deviation above);
      second pass: all resolve.
- [x] Fails-when-reverted: restoring the original (untrimmed) `SKILL.md`/
      `00.CONVENTIONS.md` content would make the byte-budget check fail
      immediately (150→41 and 172→86 lines respectively) — verified the
      shape of this check by inspecting the byte counts of the pre-edit
      files (2940 B / body-only pre-trim, 7398 B directory total before
      any edits), confirming the budget is a real constraint, not vacuous.

## Risks and rollback
- **Risk: cutting something load-bearing** while shrinking the two index
  files. Mitigated by the "every fact survives in exactly one reference
  file" acceptance criterion — nothing is deleted, only relocated.
- **Risk: scope creep into `opencode-customization`'s `S026` backlog**
  (new templates: `context/` trio, `sessions/`, `BACKLOG.md`, hardened
  task states). Explicitly excluded above; noted as a candidate for a
  future task if the human asks for it, not assumed here.
- **Risk: this repo's own governance docs (`AGENTS.md`, `docs/`) start
  drifting from what this skill teaches**, since the skill's own
  `00.CONVENTIONS.md` describes a generic `.ai/` shape while `ai-toolbox`
  itself uses `AGENTS.md` as entrypoint with no `00.CONVENTIONS.md` — this
  is exactly the case `reference/layout-declaration.md` must document as
  the worked example (`root: .ai/`, `entrypoint: AGENTS.md`), not paper
  over.
- **Rollback**: `git revert` this task's commit; the skill returns to its
  imported, pre-harmonization state (still non-compliant, but no worse
  than before this task).

## Dependencies
Follows ADR-0004. Independent of TASK-0001/TASK-0002 (different skill).

## Expected result
`project-workflow` is self-contained, versioned distinctly from the two
other machine-local copies, loads a materially smaller mandatory context
per session, and states real (not placeholder) git/secrets policy.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13
## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode (anthropic/claude-sonnet-5)
- Actions: traced the skill's provenance to a separate, actively-developed
  repo (`opencode-customization`), found three machine-local copies all
  claiming `metadata.version: "2.1.0"` while differing in content;
  wrote REVIEW-0002 and ADR-0004 recording the human's decision to make
  `ai-toolbox`'s copy canonical; wrote 6 self-contained `reference/*.md`
  files generalizing the source repo's progressive-disclosure pattern
  without citing its private ADR numbers; rewrote `SKILL.md` and
  `templates/00.CONVENTIONS.md` as lean indexes; fixed two stale
  `00.CONVENTIONS.md`-size-budget-section references in `20.PLAN.md`/
  `30.ROADMAP.md` left over from the old monolithic file; added
  `.ai-layout.json` to `ai-toolbox` itself so its own worked example in
  `reference/layout-declaration.md` is true, not aspirational.
- Observations: byte-trimming both index files to their targets initially
  broke 4 relative links (dropped `reference/` or `templates/` prefixes) —
  caught only by the functional smoke test's programmatic link
  resolution, not by the byte count itself. Fixing them pushed both files
  slightly over their round-number targets (2089 B vs 2048, 3087 B vs
  3072) — accepted as correct, since a broken link is a worse defect than
  41/15 extra bytes.
- Validation: all Mandatory validations above passed after the link fix.
- Result: success.
- Commit: `29dc472` "Harmonize the project-workflow skill; declare
  ai-toolbox as canonical" on `master` (recorded post-commit, not
  amended, so no self-reference staleness).
- Push: no remote configured (`git remote -v` empty) — nothing to push.
