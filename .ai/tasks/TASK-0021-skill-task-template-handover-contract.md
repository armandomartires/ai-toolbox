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
- ~~`diff -rq` between repo and deployed skill clean **before** starting,
  so any drift found afterwards is known to be this task's.~~
  **Struck at execution time (2026-09-13).** TASK-0020's handover showed
  this precondition is vacuous, and verifying it confirmed why: **both**
  deployment targets are symlinks to the repo, so `diff -rq` compares a
  path with itself and cannot fail. Replaced by the deployment-shape
  check below. Kept struck rather than deleted — it was written in
  PLAN-0002 on a false assumption, and the correction is the useful
  record.

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
- [x] Template carries `## Inputs` and `## Outputs / handover`, both
      tabular, with an expected-state column.
- [x] `## Outputs / handover` includes the `**Next task starts here**:`
      line.
- [x] The head blockquote's before/after split accounts for both new
      sections.
- [x] `metadata.version` is `3.1.0`.
- [x] ~~`diff -rq` between repo and deployed skill is clean after
      `install.sh`.~~ **Struck as unfailable** — both targets are
      symlinks to the repo. Replaced by recording the deployment shape of
      every client; see Mandatory validations.
- [x] `docs/registry.md` shows no diff.
- [x] `tests/validate.sh` passes.
- [x] Section names checked against the other templates and found
      TASK-specific.
- [x] **No section duplicates another's ownership** — added during
      execution, after `Files touched` was found to overlap
      `Outputs / handover`. See log.

## Mandatory validations
- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` — no diff expected; confirmed, not assumed
- [x] **Deployment shape recorded for every client in `install.sh`'s
      `CLIENTS` list** — `LinkType` and `readlink -f` per target, so the
      record states what was actually verified. Both `claude-code`
      (`~/.claude/skills`) and `opencode` (`~/.config/opencode/skills`)
      are `SymbolicLink` → the repo path. `CLIENTS` holds exactly these
      two; LM Studio is deliberately absent (ADR-0006).
- [x] `scripts/install.sh` runs clean and is idempotent — ran twice,
      second run reported the same four `(link)` deployments and changed
      nothing.
- [x] `tests/validate.sh` — OK, with the frontmatter semver check passing
      on `3.1.0`.
- [x] `scripts/sync-registry.sh` — **no diff**, confirmed via
      `git diff --name-only docs/registry.md` returning empty.

### Replaced, and why
Two checks from PLAN-0002 are struck as **unfailable**, per TASK-0020's
handover and confirmed by measurement this session:

- ~~`diff -rq` repo vs. deployed → clean~~ — both `claude-code` and
  `opencode` targets are `SymbolicLink`s whose `readlink -f` is the repo
  path itself. The diff compares a directory with itself.
- ~~Grep the deployed copy for `3.1.0`~~ — same reason: the "deployed
  copy" *is* the repo file, so the grep passes the moment the repo is
  edited, whether or not `install.sh` ever runs.

**No `copy`-installed client exists on this machine** to check against —
`install.sh` supports `copy` as a fallback for symlink-less checkouts,
but neither client here uses it. So the honest finding is recorded rather
than a substitute test invented: **repo↔deployed drift is structurally
impossible in this environment**, and any future check claiming to detect
it is checking nothing. This is a property of the install mode
(ADR-0002 symlink-first), not of this task.

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
| `skills/project-workflow/templates/tasks/0000_TEMPLATE.md` | **Six** sections (not seven — `Files touched` merged into `Outputs / handover`), 68 lines. Head blockquote lists the before/after split for both new sections. |
| `skills/project-workflow/SKILL.md` | `metadata.version: "3.1.0"`; lines 34-38 describe the new split and link `session-handover.md`. 2231 bytes. |
| `.ai/decisions/0012-…md` | **Corrected in place** with a dated Correction paragraph: its claim that the skill's template "has no equivalent sections" was false. |
| `~/.claude/skills/project-workflow`, `~/.config/opencode/skills/project-workflow` | Both `SymbolicLink` → the repo. Serving `3.1.0` and `session-handover.md`. Drift is structurally impossible; no `copy`-installed client exists here. |
| `docs/registry.md` | Unchanged, confirmed by regenerating. |
| `skills/project-workflow/templates/00.CONVENTIONS.md` | **Untouched**, still 3060/3072. |

**Next task starts here**: the skill side is complete and canonical, and
the headings are final — `## Inputs` and `## Outputs / handover`.
TASK-0022 adopts them in `.ai/templates/TASK.md`, which still has the
unmerged `Minimal context`/`Preconditions`/`Dependencies`/
`Expected result` shape.

Three things TASK-0022 must carry from here:

1. **Read the finished template, not ADR-0012's prose, for the section
   list.** The ADR was wrong once already about what sections exist; this
   task corrected it but the lesson stands. TASK-0022's own plan already
   says to read the file — do it.
2. **`Files touched` merged into `Outputs / handover` on the skill
   side.** This repo's `.ai/templates/TASK.md` has no `Files touched`
   section, so there is nothing equivalent to merge — but check, rather
   than trusting this sentence.
3. **TASK-0022's step 2 anticipates that `Minimal context` may not fit a
   three-column table** (TASK-0018 used it for a provenance *narrative*).
   That concern is real and unresolved. The skill's `Inputs` table is
   strictly artifact-shaped, so if narrative context is needed here, it
   needs somewhere to live — likely prose retained beside the table.
   Decide it explicitly and record the deviation.

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
  - Verified every declared input before starting, per the read order
    TASK-0020 wrote: version `3.0.0`, `session-handover.md` present,
    `00.CONVENTIONS.md` 3060 bytes, template 43 lines, tree clean at
    `9a154be`. All as declared.
  - Read `install.sh`'s `CLIENTS` list and checked **both** targets'
    deployment shape before running any validation, then amended this
    task's Preconditions and Mandatory validations to strike the two
    unfailable checks — *before* performing them, so the record shows the
    decision preceding the action rather than a rationalisation after a
    convenient pass.
  - Added `## Inputs` (after Goal) and `## Outputs / handover` (after
    Verification), both tabular.
  - **Merged `Files touched` into `Outputs / handover`** — see
    Observations.
  - Updated the head blockquote's before/after split, and `SKILL.md:34-35`
    which still described the old "Goal+Plan before, Verification+Status
    after" shape.
  - Bumped `metadata.version` → `3.1.0`.
- Observations:
  - **ADR-0012 contained a false statement, and following it literally
    created the defect it forbids.** The ADR said the two sections are
    "added" to the skill's template because it "has no equivalent
    sections". But `Files touched` is output-shaped: after adding
    `Outputs / handover` the template had two owners for "what this task
    changed" — the precise duplication the ADR's own Decision 1 prohibits.
    Caught by reading the rendered 71-line template, not by any check.
    Merged the two and **corrected ADR-0012 in place with a dated
    Correction paragraph** rather than quietly editing it.
  - The ADR's error is worth more than the fix: it asserted a fact about
    a five-section file *without enumerating those five sections against
    the rule it was stating*. Both TASK-0020 and TASK-0021 have now hit
    the same class of defect — a confident claim about a small, readable
    artifact that nobody actually read. That is twice in two tasks.
  - Net section count went 5 → 6, not 5 → 7 as PLAN-0002 implied. The
    plan-level acceptance criterion said "no net growth" only for *this
    repo's* template (TASK-0022); the skill's grows by one. Worth stating
    because the two numbers are easy to conflate when reviewing.
  - **Both clients are symlinked, so this environment cannot exhibit
    repo↔deployed drift at all.** `install.sh` supports `copy`, but
    neither client uses it here. Rather than invent a substitute test, the
    finding is recorded as a property of the install mode (ADR-0002).
    The "deployed serves 3.1.0" check is a tautology and is labelled one.
  - Re-checked `00.CONVENTIONS.md` per TASK-0020's headroom warning: this
    task did not touch it, still 3060/3072.
  - The registry was unaffected, as predicted — the `description` was
    deliberately left alone, so the generated row is byte-identical.
- Validation:
  - `tests/validate.sh` — OK (semver check passes on `3.1.0`).
  - `scripts/sync-registry.sh` — no diff, confirmed by
    `git diff --name-only`, not inferred.
  - `scripts/install.sh link` run twice — idempotent; four `(link)`
    deployments both times.
  - Deployment shape, both clients: `LinkType = SymbolicLink`,
    `readlink -f` = the repo path, identical to
    `readlink -f skills/project-workflow`.
  - `session-handover.md` reachable through both client paths.
  - Section names checked against `reviews/0000_TEMPLATE.md` and
    `decisions/0000-TEMPLATE.md`: neither would host `Inputs`/`Outputs`
    naturally (they use "State of the project", "Context",
    "Consequences"), confirming the names are TASK-specific and will not
    leak.
- Result: success. The skill's task template now carries the handover
  contract in 6 sections rather than 7, because executing the task
  exposed a false premise in the ADR that planned it. Version `3.1.0`
  live in both clients.
- Commit: `0f36d66`
- Push: `origin master`, confirmed — local and
  `git ls-remote origin master` both `0f36d66`.
