# REVIEW-0002 — Compliance audit of the imported project-workflow skill

- Task(s) reviewed: pre-task audit of the untracked import
  `skills/project-workflow/` (led to TASK-0003, ADR-0004)
- Reviewer: agent (opencode), 2026-09-13
- Diff summary: nothing committed. Audited `skills/project-workflow/`
  (SKILL.md, 7 template files) against `AGENTS.md`,
  `docs/development/authoring-guide.md`, and ADR-0003.

## Provenance (the finding that reshaped this task)

This skill is not an isolated import. It has an actively-developed
canonical source, `opencode-customization` (a separate git repo with a
GitHub remote), currently mid-sprint on exactly this skill:

- **Three copies exist on this machine, all claiming `metadata.version:
  "2.1.0"` while differing in content**: the live install at
  `~/.config/opencode/skills/project-workflow/` (pre-ADR-0017), this
  repo's copy (matches `opencode-customization`'s git HEAD, commit
  `ac8d43b`, byte-for-byte), and `opencode-customization`'s own working
  tree (HEAD plus an uncommitted, in-progress `reference/` split for
  `00.CONVENTIONS.md`, sprint `S025.T003`). Same version string, three
  different files — a version-integrity defect independent of any
  content issue.
- `opencode-customization`'s own roadmap (`.ai/30.ROADMAP.md`, "Next up")
  already states the plan: **`S027`** hands `project-workflow` (and
  `agent-tiers`) to `ai-toolbox` as their permanent home, and
  `opencode-customization` stops shipping skills entirely; **`S028`**
  bootstraps `ai-toolbox` itself. This session's human decision (below)
  executes that handover now, ahead of that repo's own sequencing.
- **Human decision (2026-09-13)**: `ai-toolbox`'s copy becomes the
  canonical, generic version of this skill going forward.
  `opencode-customization`'s copy is to be dropped in favor of it. This
  is recorded in ADR-0004 (this task) and is a **cross-repo** decision —
  `opencode-customization`'s own retirement of the skill and its `S025`
  sprint are not touched by this task; that repo needs its own follow-up
  to close `S025` against the new reality and remove its copy. Flagged,
  not executed, here.

## Findings

### Compliant
| Guideline | Result |
|---|---|
| SKILL.md present, case-correct | pass |
| `name` matches directory (`project-workflow`) | pass |
| No README.md inside the skill folder | pass |
| `license` / `metadata.author` / `metadata.version` present, matching ADR-0003's schema | pass |
| Scripts: none present — skill is documentation/scaffolding only | n/a |
| tests/validate.sh | pass |
| No secrets/tokens/`.env` (grep clean) | pass |

### Defects (blocking)

1. **Version-integrity: `2.1.0` means three different files.** See
   Provenance above. Fixed by bumping to a new version the moment content
   changes (human decision, this session) — `3.0.0`, given the frontmatter
   contract changes (skill body size budget, restructured references) even
   though `name`/`description` stay byte-identical.
2. **`SKILL.md` is 150 lines / ~6.6 KB, almost entirely mandatory-read
   context.** `docs/development/authoring-guide.md` says "keep SKILL.md
   lean; push detail into `references/`" — this skill violates its own
   stated purpose (the governing rule it teaches: "every artifact has
   exactly one owner... a fact stored in two places drifts") by
   `SKILL.md` restating rename/origin history that belongs in an ADR.
3. **`templates/00.CONVENTIONS.md` is 172 lines / ~7.4 KB**, loaded into
   *every session of every project this skill scaffolds into* per its own
   stated rule ("Both files are read at the start of every session").
   Same violation as #2, one layer deeper — situational detail (task-ID
   scheme, size-budget rationale, reuse-across-projects mechanics) is
   mixed into the mandatory-read entry point instead of split into
   on-demand reference material.
4. **Dangling references to `ADR 0017` and `decisions/0005`/`0006`.**
   `SKILL.md` (lines 21, 56, 130, 147) and `templates/00.CONVENTIONS.md`
   (line 35) cite these ADR numbers as if the reader has access to
   `opencode-customization`'s `.ai/decisions/`. They don't — this skill
   ships standalone into arbitrary target projects. A reader following
   "see ADR 0017 for the mechanism" hits a dead link outside this
   specific machine's `opencode-customization` checkout. This is the
   provenance problem made concrete: the skill's own docs assume a
   repo-specific numbering scheme that doesn't travel with it.
5. **Zero git/secrets policy**, same defect the source repo's own
   `S026.T005`/`T007` already identified and placeholder-documented
   (`reference/git-workflow.md`, `reference/environments-and-secrets.md`
   in that repo's working tree, uncommitted). Grepping this skill's 7
   files for `push|remote|secret|token|\.env|staging|production` returns
   nothing except the word "secrets" in a template's own prose. Confirmed
   independently, not inherited as an assumption.
6. **The `.ai-layout.json` / `ADR 0017` mechanism is described but not
   made self-contained.** `SKILL.md` step 0 says "see ADR 0017" for a
   mechanism this skill needs to fully specify itself once it no longer
   lives next to that ADR.

### Not a defect (verified, not assumed)
- `sync-registry.sh`'s naive `awk` match on `^name:` is unaffected by the
  `metadata:` block's indentation — confirmed empirically in TASK-0002.
- No secrets found beyond the word "secrets" appearing in policy prose
  (the placeholder files this task writes name the gap, they don't leak
  anything).

## Validation results
- `bash tests/validate.sh` → `validate.sh: OK`
- Secrets grep → clean
- Byte counts measured directly (`wc -c`) against the ≲2 KB /≲3 KB budgets
  this task adopts, mirroring `opencode-customization`'s own `S025.T002`/
  `T003` acceptance criteria (which this task independently reaches the
  same conclusion as, without importing that repo's ADR numbers)

## Verdict
request changes — provenance issue and version-integrity defect must be
resolved (ADR-0004); SKILL.md and 00.CONVENTIONS.md must shrink to
mandatory-read budgets with self-contained reference material; git and
secrets policy gaps must be closed.

## Follow-up tasks
- TASK-0003 — all defects above
- Cross-repo follow-up (not this task, not this repo): `opencode-customization`
  needs to close or redirect its own `S025_WorkflowHarmonization` sprint
  now that `ai-toolbox` is canonical, and remove its copy of the skill.
