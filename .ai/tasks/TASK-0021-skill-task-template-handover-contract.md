# TASK-0021 — Skill: task-template handover contract; version 3.1.0

## Objective
Add `## Inputs` and `## Outputs / handover` to the skill's task template,
bump `metadata.version` to `3.1.0`, and re-sync the deployed copy so the
repo and the installed skill agree byte-for-byte.

## Inputs
| Artifact | Produced by | Expected state |
|---|---|---|
| `.ai/decisions/0012-handover-contract-resumability-invariant.md` | ADR-0012, this sprint | Accepted. Decision 1 specifies the two sections and their tabular shape. |
| `skills/project-workflow/templates/reference/session-handover.md` | **TASK-0020** | Exists. The template's new sections link to it rather than re-explaining the invariant. |
| `skills/project-workflow/templates/00.CONVENTIONS.md` | TASK-0020 | ≤ 3072 bytes, with the session-handover row in its reference table. |
| `skills/project-workflow/SKILL.md` | pre-existing | `metadata.version: "3.0.0"` — **still 3.0.0 when this task starts**, by TASK-0020's design. This task performs the single bump for both. |
| `skills/project-workflow/templates/tasks/0000_TEMPLATE.md` | pre-existing | 43 lines, five sections, no handover contract. The file this task edits. |
| `~/.config/opencode/skills/project-workflow/` | `scripts/install.sh` | Currently identical to the repo (`diff -rq` clean). Will drift the moment this task edits the repo — re-syncing it is part of this task, not a follow-up. |
| `docs/registry.md` | `scripts/sync-registry.sh` | Generated. The skill's `description` is not changing, so this must show **no diff**. |

## Minimal context
The skill's task template names what a task does but never what it
consumes or hands on, so a task file cannot be picked up cold — the gap
ADR-0012 exists to close.

Two constraints bind the version handling. ADR-0003 makes
`metadata.version` semver and required-to-bump on content change.
ADR-0004 adds the reason it matters: REVIEW-0002 found three copies of
this skill all declaring `2.1.0` while differing in content, and the fix
was "a version string always means exactly one thing". So the bump and
the `install.sh` re-sync belong in *this* commit, not a later tidy-up.

The sections are tabular by decision, not preference: a prose paragraph
lets an author write "depends on the previous task" and stop, while a
table with an *expected state* column does not.

## Scope
### Included
- `## Inputs` in `templates/tasks/0000_TEMPLATE.md` — table columns:
  artifact · produced by · expected state.
- `## Outputs / handover` — artifact · end state, plus one
  `**Next task starts here**:` line.
- Template guidance text for both, in the same voice as the existing
  sections (the template instructs; it does not argue).
- `SKILL.md` `metadata.version` → `3.1.0`.
- Re-run `scripts/install.sh`; verify with `diff -rq`.
- Regenerate the registry and confirm no diff.

### Not included
- **`reference/session-handover.md`** — TASK-0020's file. This task links
  to it.
- **`ai-toolbox`'s own `.ai/templates/TASK.md`** — TASK-0022. The skill's
  copy-never-symlink rule means editing the skill does not change this
  repo, and conflating the two would hide which change caused what.
- **The `validate.sh` check** — TASK-0023.
- **Retrofitting the 19 existing task files** — ADR-0012 Decision 4.
- **A major version bump.** `3.1.0`, not `4.0.0`: the change is additive
  to a template, and no already-scaffolded project is invalidated by it.
- Changing the skill's `description`. It still describes the skill
  accurately, and editing it would churn the registry for no gain.

## Preconditions
- TASK-0020 done: `session-handover.md` exists,
  `00.CONVENTIONS.md` under budget.
- Working tree clean; `tests/validate.sh` passing.
- `diff -rq` between repo and deployed skill clean **before** starting, so
  any drift found afterwards is known to be this task's.

## Likely files
- `skills/project-workflow/templates/tasks/0000_TEMPLATE.md`
- `skills/project-workflow/SKILL.md`
- `~/.config/opencode/skills/project-workflow/**` (deployed, via
  `install.sh` — not hand-edited)
- `docs/registry.md` (generated; expected unchanged)

## Execution plan
1. Confirm the deployed copy matches the repo before editing
   (`diff -rq`). A pre-existing drift discovered later would be
   indistinguishable from one this task caused.
2. Add `## Inputs` after `## Goal` — inputs are read before the plan is
   formed, so the section order should match the reading order.
3. Add `## Outputs / handover` after `## Verification` and before
   `## Status notes`: outputs are only known once verified, and the
   handover line is the last thing written.
4. Keep the blockquote at the template's head accurate — it currently
   says "Goal and Plan before, Verification and Status after". `Inputs`
   belongs to *before*, `Outputs` to *after*. Update it, or it will
   contradict the sections it introduces.
5. Sanity-check on paper that the two section names do not belong in
   `PLAN.md`/`REVIEW.md`-shaped templates (PLAN-0002's schema-fits-one-
   sample risk). If `Inputs` reads naturally in a review checkpoint, the
   naming is too generic.
6. Bump `metadata.version` → `3.1.0`.
7. Run `tests/validate.sh` (frontmatter must still parse; semver must
   still validate).
8. Run `scripts/install.sh`; verify `diff -rq` clean afterwards.
9. Run `scripts/sync-registry.sh`; confirm **no diff**.

## Acceptance criteria
- [ ] Template carries `## Inputs` and `## Outputs / handover`, both
      tabular, with an expected-state column.
- [ ] `## Outputs / handover` includes the `**Next task starts here**:`
      line.
- [ ] The head blockquote's before/after split accounts for both new
      sections.
- [ ] `metadata.version` is `3.1.0`.
- [ ] `diff -rq` between repo and deployed skill is clean after
      `install.sh`.
- [ ] `docs/registry.md` shows no diff.
- [ ] `tests/validate.sh` passes.
- [ ] Section names checked against the other templates and found
      TASK-specific.

## Mandatory validations
- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` — no diff expected; confirmed, not assumed
- [ ] `scripts/install.sh` then `diff -rq skills/project-workflow
      ~/.config/opencode/skills/project-workflow` — clean
- [ ] Grep the deployed copy for `3.1.0` — proves the deployed
      frontmatter actually changed, rather than trusting installer output

## Risks and rollback
- **Risk: repo/deployed drift, again.** This is the exact defect
  REVIEW-0002 found. Mitigation: `install.sh` + `diff -rq` + a grep of the
  deployed version string, all inside this task. Installer exit code 0 is
  not evidence the file changed — the repo's own recurring lesson.
- **Risk: `core.filemode=false` on this `/mnt/c` checkout.** Per
  `CURRENT_STATE.md:92-96`, `chmod` never reaches git's index here. This
  task edits only markdown, so no mode change should appear — but if
  `git status` shows one, it is the mount, not an intended change, and it
  is not to be committed silently.
- **Risk: the template grows into a form nobody fills in honestly.** Two
  new sections on a 43-line template is a real cost. Mitigation: tables
  with three short columns, not prose blocks; if a section needs a
  paragraph of guidance to be usable, the section is wrong.
- **Risk: `Next task starts here` invites speculation** about work not
  yet scoped. Mitigation: guidance says to name the *artifact state* the
  next task inherits, not to predict what that task will be.
- Rollback: revert the commit and re-run `install.sh`, which restores the
  deployed copy from the reverted repo state.

## Dependencies
TASK-0020 (its reference file is linked from the new sections). Blocks
TASK-0022 — this repo adopts a finished shape, not one still moving.

## Outputs / handover
| Artifact | End state |
|---|---|
| `skills/project-workflow/templates/tasks/0000_TEMPLATE.md` | Seven sections; carries the handover contract; head blockquote consistent with them. |
| `skills/project-workflow/SKILL.md` | `metadata.version: "3.1.0"`. |
| `~/.config/opencode/skills/project-workflow/` | Re-installed; byte-identical to the repo, verified by `diff -rq` **and** a version grep. |
| `docs/registry.md` | Unchanged, confirmed by regenerating. |

**Next task starts here**: the skill side is complete and canonical. The
skill is now *ahead* of this repo's own `.ai/templates/TASK.md`, which
still has the unmerged `Minimal context`/`Preconditions`/`Dependencies`/
`Expected result` shape. TASK-0022 closes that gap as a deliberate
adoption — the copy-never-symlink rule means it does not happen
automatically, and this task must not pre-emptively do it.

## Status
- Status: planned   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13

## Execution log
### Attempt 1
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
