# TASK-0119 — Generate the scaffold's planning templates from the schemas that own them

## Objective

Close `B-040`. `skills/project-migration/scripts/ai-project-scaffold.sh`
writes `.ai/templates/{TASK,PLAN,SESSION,ADR,REVIEW}.md` into every repository
it migrates, as five inline heredocs. Those heredocs are a **second owner of
artifact shape** — the mechanism `ADR-0027` clause 1 removed everywhere else —
and two of the five have already drifted far enough to **fail the schemas they
are supposed to embody**. Make the scaffold emit the four schema-backed
templates from the schemas, gate them against drift, and stop the closing
instruction from telling the author to `cp` one.

## Minimal context

**Found 2026-09-27 by a review of whether `project-workflow` and
`project-migration` share their libraries.** They do — `artifact_lib.py`,
`new-artifact.sh --framework`, `check-artifact.sh --framework` and
`scripts/sync-templates.sh` are all genuinely shared, and
`tests/validate.sh` exits `OK` over every artifact in this repository. The
scaffold is the one site the sharing never reached.

**The drift is measured, not inferred.** Each heredoc was extracted to a file
and run through the skill's own checker against its own schema:

```
$ check-artifact.sh <scaffold TASK.md> --kind task --framework project-migration
    - missing required section: ## Inputs
    - missing required section: ## Outputs / handover
    - superseded section: ## Preconditions -- replaced by the current schema
    - superseded section: ## Dependencies -- replaced by the current schema
    - superseded section: ## Expected result -- replaced by the current schema
    - line 15: unfilled generator marker still present
$ check-artifact.sh <scaffold REVIEW.md> --kind review --framework project-migration
    - missing required section: ## Findings
    - missing required section: ## Validation results
    - missing required section: ## Verdict
    - missing required section: ## Follow-up tasks
```

`SESSION.md` and `ADR.md` pass. So the standing claim is: **two of five are
wrong today**, and nothing can tell you which two without running the check by
hand, because nothing runs it.

**The three superseded headings are the exact ones `ADR-0012` retired and
`ADR-0027` recorded in `schemas/task.md`'s `superseded:` line.** A repository
migrated by this skill today therefore receives, on day one, a task template
carrying three headings its own gate rejects and missing two it requires. The
first brief written in that repository inherits the defect, and the second,
until someone notices — which is precisely the accumulation `ADR-0027` cites
as its own justification: *23 stale `## Preconditions` sections*, in this
repository, produced the same way.

**Why this repository never saw it.** `scripts/sync-templates.sh` regenerates
`.ai/templates/*.md` here from the four schemas, and `tests/validate.sh` fails
on drift. The scaffold's heredocs are never written into this checkout — the
script's `mkfile` refuses to overwrite an existing file, and all five already
exist. The gate is real and the copies it guards are correct; the divergent
copies live inside a script that only runs against *other* repositories, where
no gate of ours reaches.

**`TASK-0109` excluded this, and the exclusion was not wrong — its line was
drawn in the wrong place.** Its *Not included* reads: *"`ai-project-scaffold.sh`'s
layout scaffolding, which is a different job and stays as it is."* Layout **is**
a different job and should stay. But the script does two jobs, and only one of
them is layout: `mkfile .ai/templates/TASK.md <<'EOF'` is a declaration of
*shape*, and shape is the thing `ADR-0027` had just given a single owner. The
boundary was drawn around **the script** when the decision drew it around
**the job**. `SKILL.md` line 23 already states the correct division in words —
*"The scaffold script still owns the layout; the schemas own the shape"* — so
the rule exists and the script simply does not implement it.

**A second, smaller contradiction in the same file.** The scaffold's closing
report (line 581) prints:

```
2. Replace TODO.md's placeholder with your first executable task
   (cp .ai/templates/TASK.md .ai/tasks/TASK-0001-*.md).
```

`SKILL.md`'s hard-rules section forbids exactly this: *"Generate planning
artifacts; do not copy a template and imitate it."* `grep -c
'new-artifact\|schema\|sync-templates' ai-project-scaffold.sh` returns **0** —
the script has no knowledge that the generator or the schemas exist. So the
last thing a migration prints is an instruction to use the mechanism
`ADR-0027` replaced.

**The gate this task adds must compare bytes, not run the checker.** A rendered
*template* legitimately contains `<!-- FILL: … -->` markers — `.ai/templates/TASK.md`
carries 15 — and `check-artifact.sh` rejects a surviving marker by design.
Running the artifact checker over a template therefore fails on a correct file,
which is the *fires-on-correct-text* failure mode `artifact_lib.py`'s own
comments say gets a check deleted rather than fixed. The correct gate is the
one `sync-templates.sh --check` already implements: render from the schema in
memory and compare. **Not `git diff`** — `TASK-0106` shipped that form and it
could not fail on an untracked file (`ADR-0009`: a gate that quietly does
nothing is worse than no gate).

**This does not fire `TASK-0117`'s trigger, and the distinction matters.**
`B-036` is about a consumer who installs `project-migration` **without**
`project-workflow` and so has no engine. The scaffold runs on a machine where
`scripts/install.sh` deployed both skills in one loop, so the sibling is
present; and under the recommended route below the scaffold does not need the
engine at run time at all. `TASK-0117` stays `blocked` on its own trigger. What
*would* fire it is a consumer installing the skills independently — route A
below would create that dependency, which is one reason it is not the
recommendation.

**Not covered here, and raised rather than absorbed.** `PLAN.md` is the fifth
heredoc and has **no schema anywhere** — neither framework declares a `plan`
kind, yet `.ai/planning/plans/` holds six real `PLAN-000*.md` files in this
repository. Inventing a schema for it is a larger piece of work with its own
evidence to gather, filed as `B-042`. This task leaves `PLAN.md`'s heredoc
where it is and says so in the script.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/project-migration/scripts/ai-project-scaffold.sh` | pre-existing, predates `ADR-0027` | 590 lines; five template heredocs at lines 376–458; `cp` instruction at line 581; zero references to the generator or schemas |
| `skills/project-migration/schemas/{task,adr,review,session}.md` | `TASK-0109` | Four schemas, unchanged by this task. `task.md` carries `superseded: Preconditions, Dependencies, Expected result` |
| `skills/project-migration/SKILL.md` | `TASK-0109` (v1.1.0 → 1.2.0) | Hard rule *"Generate planning artifacts; do not copy a template and imitate it"* present; `author: amartires` |
| `skills/project-workflow/scripts/artifact_lib.py` | `TASK-0109` | The engine. `sync` mode honours `OUT`, `BANNER`, `TARGETS`, `CHECK` |
| `scripts/sync-templates.sh` | `TASK-0109` | Seven targets across both frameworks; `--check` compares in memory; `TEMPLATES_OUT` redirects a real write |
| `tests/validate.sh` | `TASK-0110` | Exits `OK`; runs `sync-templates.sh --check`; checks 152 artifacts in one interpreter; `FIRST_GENERATED_TASK = 24` |
| `.ai/decisions/0027-artifact-shape-has-one-owner.md` | `TASK-0109`, clarified `TASK-0110` | `Accepted`; clause 2 lists the derived templates and does **not** name the scaffold |
| `.ai/tasks/TASK-0109-artifact-schema-one-owner.md` | `TASK-0109` | *Not included* names the scaffold's **layout** scaffolding |
| `docs/development/authoring-guide.md` | `TASK-0109` | Line 42, *Templates are derived*, enumerates the derived set |
| `scripts/sync-decision-standard.sh` | `TASK-0106` | The precedent: generated sibling + in-memory drift check, never `git diff` |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. **The four schema-backed templates stop being heredocs.** `TASK.md`,
   `ADR.md`, `REVIEW.md` and `SESSION.md` as emitted by the scaffold are
   rendered from `skills/project-migration/schemas/*.md`, byte-for-byte what
   `sync-templates.sh` already renders into this repository's `.ai/templates/`.
2. **A drift gate in `tests/validate.sh`**, comparing the scaffold's emitted
   templates against the schema render in memory, **observed failing before it
   is trusted**.
3. **The closing instruction is corrected** — step 2 of the scaffold's report
   names the generator instead of `cp`, and the wording works whether or not
   the generator is on the machine.
4. **A pointer inside the script** stating that shape belongs to the schemas,
   which file owns it, and which gate catches drift — the header
   `sync-decision-standard.sh` already carries.
5. **`PLAN.md`'s heredoc is labelled, not moved**: one comment naming `B-042`
   and saying why this one stays.
6. **Version and authorship.** `project-migration` goes to **`2.0.0`** — the
   skill's own maintenance rule makes a change to how artifacts are produced a
   major bump, and this changes what every future migration emits. `author:
   amartires` is normalised to `armando.martires`, matching the other four
   skills, in the same commit because it is one line in the same frontmatter.
7. **`ADR-0027` gets a dated note** in the shape `TASK-0110`'s clarification
   already uses: clause 2's list of derived templates was complete for this
   repository and incomplete for the scaffold, recorded rather than edited.
8. **`docs/development/authoring-guide.md` line 42** extended to name the
   scaffold's emitted set, so the normative list matches what is gated.

### Not included

- **No schema for `PLAN.md` or `BACKLOG.md`.** `B-042`. Inventing a `plan`
  schema here would make this task the author of a shape rather than the
  enforcer of one — `ADR-0008`'s rule, and the reason `ADR-0027` transcribed
  its schemas from artifacts that already existed instead of designing them.
- **No change to the layout half of the scaffold.** `TASK-0109`'s exclusion
  stands for the job it actually names: directories, `AGENTS.md`, `README.md`,
  `CURRENT_STATE.md`, `ROADMAP.md`, `BACKLOG.md`, `SPRINT-CURRENT.md`,
  `TODO.md`, `docs/`, the language-specific stubs. None of those is an
  instance of a schema.
- **No vendored copy of `artifact_lib.py`.** That is `B-036`/`TASK-0117`, still
  `blocked` on its own trigger, which this task does not fire.
- **No change to `SKILL.md`'s claim that a migrated repo can run
  `scripts/sync-templates.sh`.** That claim is false today and is `B-041` /
  `TASK-0120`. This task makes a migrated repository's templates correct **at
  birth**; whether it can keep them correct is the other task's decision.
- **No retroactive edit of any already-scaffolded repository.** `ADR-0027`
  settles this: *"nothing here retroactively edits a scaffolded project."*
- **No schema edits.** Any change under `skills/project-migration/schemas/`
  means the task has misdiagnosed itself — the schemas are already right; the
  script disagrees with them.
- **No new template engine or dependency.** `ADR-0027` rejected jinja and
  friends; the hermetic gate cannot `pip install`.

## Likely files

A forecast, written before the work.

- `skills/project-migration/scripts/ai-project-scaffold.sh` — heredocs 376–458
  replaced for four kinds, `PLAN.md` labelled, closing report step 2 reworded,
  header note added
- `skills/project-migration/templates/{TASK,ADR,REVIEW,SESSION}.md` — **new**,
  generated, banner-carrying, under the drift gate (route B below)
- `scripts/sync-templates.sh` — four targets added
- `tests/validate.sh` — the gate proving what the scaffold emits matches the
  schema render
- `skills/project-migration/SKILL.md` — version `1.2.0` → `2.0.0`, author
  normalised, one line on where the emitted templates come from
- `.ai/decisions/0027-artifact-shape-has-one-owner.md` — dated note appended
- `docs/development/authoring-guide.md` — line 42's derived list extended
- `.ai/planning/BACKLOG.md` — `B-040` closed with the commit hash
- `.ai/context/CURRENT_STATE.md` — a section, per `AGENTS.md`
- `.ai/tasks/TODO.md` — this task checked off
- `docs/registry.md` — only if `sync-registry.sh` reports a change

**Not expected to change**: anything under
`skills/project-migration/schemas/`, `skills/project-workflow/`, or
`.ai/templates/`. If one of those moves, stop and re-scope.

## Execution plan

**Step 0 — choose the route. This is the one open decision in the task.**

The scaffold has to produce four schema-derived files on a machine that may or
may not have the generator reachable. Three mechanisms:

| Route | Mechanism | Cost |
|---|---|---|
| **A** | Scaffold calls `../../project-workflow/scripts/new-artifact.sh --template` at run time | Zero new files. **Creates a hard cross-skill dependency at migration time** — the scaffold hard-fails wherever `project-workflow` is absent, which is `B-036` arriving through the back door, and `install.sh`'s one-loop deployment is the only reason it works today |
| **B** *(recommended)* | Ship `skills/project-migration/templates/*.md`, generated by `sync-templates.sh`, gated for drift, and have the scaffold `cat` them | Four generated files and four gate targets. **Adds no new pattern** — it is `sync-decision-standard.sh` exactly: a generated sibling that exists because the consumer copies the parent out to where the source is at no known relative path. Scaffold stays standalone |
| **C** | B, with an A-style regeneration when the generator is reachable | Both mechanisms, two code paths, one of them rarely exercised. Rejected unless step 6 shows B cannot hold |

**Recommendation: B.** It is the only route that leaves the scaffold runnable
on its own — which `SKILL.md` already promises (*"Invoke the script from the
skill's own directory"*, run via `bash`, no assumption of a sibling) — and it
reuses a precedent this repository has already shipped and already gates.
Record the choice and the date in the Execution log before step 1; if the human
picks A or C instead, record that and re-cost steps 2–4.

**Steps (route B; renumber if the route changes):**

1. **Re-verify every Inputs row.** Line numbers in particular: this brief cites
   376–458 and 581 from a reading on 2026-09-27 and nothing pins them.
2. **Reproduce the defect before fixing it.** Extract all five heredocs to a
   scratch directory, run `check-artifact.sh` over the four with schemas, and
   paste the output. Two must fail and two must pass. A different result means
   the tree moved and the brief needs re-scoping, not the fix.
3. **Read `scripts/sync-decision-standard.sh` and `scripts/sync-templates.sh`
   and follow their shape.** Do not invent a third generated-sibling idiom.
4. **Add the four targets to `sync-templates.sh`**, rendering into
   `skills/project-migration/templates/`. Run it. Confirm each output is
   byte-identical to the corresponding `.ai/templates/*.md` already tracked —
   same schema, same renderer, so any difference is a bug in the wiring.
5. **Rewrite the four heredocs as reads of those files.** `mkfile`'s
   never-overwrite contract must survive: an existing file in the target repo
   is still skipped. Preserve the `--force` semantics exactly (`--force`
   permits adding into a non-empty directory; it does not overwrite).
6. **Prove the scaffold is still standalone.** Run it into an empty scratch
   directory with `project-workflow` moved aside, and confirm it completes and
   emits all four templates. If it cannot, route B has failed and the route
   decision reopens.
7. **Add the drift gate to `tests/validate.sh`.** In-memory comparison of what
   the scaffold emits against the schema render. **Not `git diff`.** State in
   the gate's header what it proves and what it does not.
8. **Observe the gate fail.** Mutate one emitted template — a superseded
   heading is the honest mutation, since that is the real defect — run the
   gate, paste the failure, restore, paste the pass. Non-negotiable: this is
   the *Definition of Done* clause 2 and `TASK-0106`'s lesson.
9. **Prove the end-to-end result.** Scaffold into a scratch repo, then run
   `check-artifact.sh` over a **filled** artifact generated from each of the
   four kinds. Do not run it over the templates themselves — they carry `FILL:`
   markers by design and the checker rejects those, correctly.
10. **Correct the closing report** (step 2 of its output) to name
    `new-artifact.sh` instead of `cp`, with the `--framework project-migration`
    flag spelled out, and wording that does not assume the generator is
    installed.
11. **Add the script header note** and the `PLAN.md` comment naming `B-042`.
12. **Bump `SKILL.md` to `2.0.0`, normalise the author**, and add the one line
    saying where the emitted templates come from.
13. **Append the dated note to `ADR-0027`** — appended, never edited, in
    `TASK-0110`'s clarification shape.
14. **Extend `docs/development/authoring-guide.md` line 42.**
15. **Run `tests/validate.sh` and `scripts/sync-registry.sh`.** Record the
    artifact count before and after so the added gate cost is visible, as
    `TASK-0110` did.
16. **Close `B-040`** with the commit hash; update `CURRENT_STATE.md`, check
    this task off in `TODO.md`, fill Outputs / handover and the Execution log.

## Acceptance criteria

- [x] The route chosen in step 0 is named and dated in the Execution log, with
      its reason.
- [x] Step 2's before-state is pasted: two of four heredocs failing, two
      passing, from this tree.
- [x] `skills/project-migration/scripts/ai-project-scaffold.sh` contains **no
      heredoc** for `TASK.md`, `ADR.md`, `REVIEW.md` or `SESSION.md`.
- [x] What the scaffold emits for those four kinds is **byte-identical** to
      what their schemas render, proved by a hash comparison pasted in.
- [x] The drift gate is **observed failing** on a mutated template and passing
      on a restored one; both outputs recorded, and the log names the
      comparison mechanism and states it is not `git diff`.
- [x] Step 6's standalone proof is recorded: the scaffold completes with
      `project-workflow` moved aside.
- [x] Step 9's end-to-end proof covers all four kinds from a scratch scaffold.
- [x] The scaffold's closing report no longer instructs `cp` of a template.
- [x] `PLAN.md`'s remaining heredoc carries a comment naming `B-042` and why it
      stays.
- [x] No file under `skills/project-migration/schemas/` changed —
      `git diff --stat` on that path is empty.
- [x] `SKILL.md` reads `version: "2.0.0"` and `author: armando.martires`.
- [x] `ADR-0027` carries an appended dated note; **no line of it is edited or
      deleted**.
- [x] `tests/validate.sh` exits 0, with the artifact/target count recorded
      before and after.
- [x] `B-040` is closed in `BACKLOG.md` with the commit hash, and the
      open-items sentence agrees with the rows above it.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed)
- [x] `scripts/sync-templates.sh --check`, run clean and then against a
      mutated template — it must pass, then fail
- [x] The new gate, run against a mutated emitted template — observed failing
- [x] `bash skills/project-migration/scripts/ai-project-scaffold.sh <scratch>
      --force --type generic`, into an empty directory, with
      `skills/project-workflow/` moved aside
- [x] `check-artifact.sh` over one generated-and-filled artifact of each of the
      four kinds, from that scratch tree

## Risks and rollback

- **The new `templates/` directory becomes the second owner it replaces.** The
  whole point of the change, inverted. Mitigated by: generation only, a
  do-not-edit banner, a gate observed failing, and copying **templates only,
  never a schema** (`ADR-0013` — the frameworks share an engine, not a shape).
- **A gate that cannot fail.** The repository's most-repeated lesson: `git
  diff` cannot fail on an untracked file (`TASK-0106`), and a silently-skipping
  gate is worse than none (`ADR-0009`). Step 8 is the defence and is not
  optional.
- **Building the wrong gate** — running `check-artifact.sh` over a template and
  watching it fail on the `FILL:` markers that belong there, then "fixing" it
  by deleting the markers or weakening the checker. Both would be regressions.
  The gate is a byte comparison; this is stated in Minimal context and must be
  stated in the gate's own header.
- **Route A chosen without noticing it creates `B-036`'s consumer.** A scaffold
  that needs its sibling skill is the exact configuration `TASK-0117` is
  blocked on. If A is chosen, `TASK-0117`'s trigger 1 has fired and must be
  recorded there in the same commit.
- **Scope creep into `PLAN.md`.** It is the one heredoc with no schema and the
  temptation is to write one. `ADR-0008` forbids inventing the requirement;
  `B-042` is the route.
- **Migrated repositories already in the wild keep the old templates.**
  Accepted, and `ADR-0027` already states the rule. Anyone who wants the fix
  re-scaffolds — `mkfile` will skip their existing files, so re-scaffolding
  alone will **not** update them. Say so in the Outputs section; do not build a
  migration for a population of unknown size.
- **`git mv` is not involved and no file is deleted**; the change is additive
  plus an in-place edit of one script.
- **Rollback:** `git revert` of the single commit. The generated templates have
  no dependents, the gate is new, and no artifact in this repository is
  produced by the scaffold.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `skills/project-migration/scripts/ai-project-scaffold.sh` | 590 → 562 lines. Four heredocs replaced by `mkfile .ai/templates/<K>.md < "$TEMPLATE_DIR/<K>.md"`. `SKILL_DIR`/`TEMPLATE_DIR` resolved **before** the `cd` into the target, with a named-file readability guard up front. Header states shape is owned by `../schemas/`. Closing report step 2 now names `new-artifact.sh` instead of `cp`. `PLAN.md`'s heredoc **unchanged**, carrying a six-line comment naming `B-042` |
| `skills/project-migration/templates/{TASK,ADR,REVIEW,SESSION}.md` | **New**, generated, do-not-edit banner naming the schema. Byte-identical to `.ai/templates/*.md` — same schema, same renderer |
| `scripts/sync-templates.sh` | 7 → 11 targets, plus a comment on why the same four schemas render to a second destination |
| `tests/validate.sh` | New `SCAFFOLD:` block — four kinds × (reads-template, no-heredoc), template presence, and the `cp` prohibition. Header states what it proves and what it does not, and why the staleness gate above cannot see any of it |
| `skills/project-migration/SKILL.md` | `1.2.0` → `2.0.0`; `author: amartires` → `armando.martires`; one sentence on where the emitted templates come from and that `PLAN.md` is exempt |
| `.ai/decisions/0027-artifact-shape-has-one-owner.md` | 41 lines appended above `## Provenance`, **0 deleted** (`git diff --numstat`: `41 0`) |
| `docs/development/authoring-guide.md` | Derived list extended to the scaffold's set; a second row added for the reads-the-template rule, marked as a separate gate |
| `.ai/planning/BACKLOG.md` | `B-040` **CLOSED**; open-items sentence recounted from the rows |
| `docs/registry.md` | **Unchanged, and correct** — the registry carries name/description/path, no version column, so the `2.0.0` bump does not reach it. Verified rather than assumed |

**Deliberately not changed**: anything under `skills/project-migration/schemas/`
(`git diff --stat` empty on that path), `skills/project-workflow/`,
`.ai/templates/`, and `SKILL.md`'s claim that a migrated repo can run
`scripts/sync-templates.sh` — that is `B-041`/`TASK-0120`, still open. No
already-scaffolded repository was edited; `ADR-0027` forbids it, and because
`mkfile` never overwrites, **re-scaffolding will not update them either** —
an existing wrong template is skipped, not replaced. Anyone wanting the fix in
a live repo must delete the four files first.

**Next task starts here**: a migrated repository's four schema-backed
templates are now correct *at birth*. Whether it can **keep** them correct is
untouched — it still has no regenerator, which is `B-041`/`TASK-0120`,
`blocked` on the human's route choice.

**Deviation from the Plan**: none in substance. Step 7 added no new gate
*mechanism* — the four new render targets fall under the existing
`sync-templates.sh --check`, so only the scaffold-reads-the-template half
needed new code, which is what step 3's "do not invent a third idiom"
required. Step 8 ran three mutations rather than one, because the second
(re-inlining a heredoc) is the only one that demonstrates the two gates are
independent; that demonstration is now the argument recorded in both the gate
header and `ADR-0027`.

## Status

- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-27
- Updated: 2026-09-28

`ready`, not `planned`: nothing blocks it. The one decision it contains —
route A/B/C in step 0 — is costed with a recommendation and does not need a
human before the work starts, though a human may overrule it. No sprint is
open; scheduling is the human's, as with `TASK-0111`…`TASK-0118`.

## Execution log

### Attempt 1

- Date: 2026-09-28
- Agent: Claude Opus 5 (1M context), Claude Code
- Actions:
  **Step 0 — route B, chosen 2026-09-28**, as the brief recommended and for
  its stated reason: it is the only route leaving the scaffold runnable on
  its own, which `SKILL.md` already promises, and it reuses the
  generated-sibling shape `sync-decision-standard.sh` already ships and
  already gates. Route A was not taken because it would create the very
  consumer `TASK-0117` is blocked on; C was not needed.
  Then: all ten Inputs rows re-verified; defect reproduced; four render
  targets added; four heredocs replaced by reads; `SKILL_DIR`/`TEMPLATE_DIR`
  resolved before the `cd`; guard added; `PLAN.md` labelled; closing report
  reworded; `SCAFFOLD:` gate added; `SKILL.md` bumped; `ADR-0027` appended;
  authoring guide extended; `B-040` closed.
- Observations:
  **Every Inputs row was accurate** — 590 lines, heredocs at 376–458, `cp` at
  581, `grep -c 'new-artifact\|schema\|sync-templates'` = 0. Nothing had moved.

  **Step 2 reproduced the defect exactly as forecast**: `TASK.md` six problems
  (missing `## Inputs`, `## Outputs / handover`; superseded `## Preconditions`,
  `## Dependencies`, `## Expected result`; an unfilled `FILL:` marker),
  `REVIEW.md` four (missing `## Findings`, `## Validation results`,
  `## Verdict`, `## Follow-up tasks`), `ADR.md` and `SESSION.md` `OK`.

  **Byte-identity, md5, scaffold output vs schema render:** `TASK.md`
  `1cea777fd9809f3d95ae09baceb1c487`, `ADR.md` `37167e956168013831ebcb7c5bcfbb9b`,
  `REVIEW.md` `5ab1b612509199fb8dd89231fcb51004`, `SESSION.md`
  `b9923f888e921be5a67472e79fa55eac` — all four equal on both sides.

  **The finding worth keeping is about gate independence, and it was observed
  rather than reasoned.** Re-inlining a heredoc for `REVIEW.md` left
  `sync-templates.sh --check` **passing** — the shipped templates were still
  correct; they had simply stopped being what a migrated repository gets. One
  gate cannot cover both halves, and that is exactly how the original defect
  survived a gate that was real and working. Recorded in the gate's header,
  in `ADR-0027`'s note and in `B-040`'s closing entry, because the next person
  to see two checks over one subject will otherwise read it as duplication and
  delete one.

  **The scaffold is standalone, proved the strong way**: the skill was copied
  **alone** to a scratch directory outside the repo — no `project-workflow`,
  no `ai-toolbox`, no generator — and run there. Exit 0, all five templates
  emitted. Route B holds.

  Noted in passing: `.ai/templates/PLAN.md` still has no schema, and the
  scaffold's `PLAN.md` heredoc is untouched and labelled. `B-042` is not
  closed and this task does not claim it.
- Validation:
  - `tests/validate.sh` — `OK`, exit 0, ~31 s. Run clean before and after
    every mutation.
  - **Gate observed failing, three mutations, each restored to `OK`:**
    (1) superseded `## Preconditions` reinstated in the shipped `TASK.md` →
    `TEMPLATES: … is stale against … schemas/task.md`, exit 1;
    (2) heredoc re-inlined for `REVIEW.md` → `sync-templates.sh --check`
    **passed**, new gate fired with both messages, exit 1;
    (3) `cp .ai/templates/…` restored to the closing report → `SCAFFOLD: …
    tells the author to cp a template`, exit 1.
    Comparison mechanism is in-memory render-and-compare plus a grep on the
    script; **not `git diff`**, which cannot fail on an untracked file
    (`TASK-0106`, `ADR-0009`).
  - `scripts/sync-templates.sh --check` — clean; targets 7 → 11.
  - Standalone run: `bash <scratch>/skill/scripts/ai-project-scaffold.sh .
    --force --type generic --no-git` with `project-workflow` absent → exit 0.
  - End-to-end: one generated-and-filled artifact of each of the four kinds
    from the scratch scaffold → `check-artifact.sh` `OK` on all four.
  - `scripts/sync-registry.sh` — no change to `docs/registry.md` (no version
    column), verified by inspecting the row.
  - `git diff --stat skills/project-migration/schemas/` — empty.
  - `git diff --numstat` on `ADR-0027` — `41 0`: additive only.
- Result: **done.** All acceptance criteria met. `B-040` closed.
- Commit: `91b85e5` — *Generate the scaffold's planning templates from the schemas (TASK-0119)*
- Push: **confirmed** to `origin/master` (`e204754..91b85e5`); `git rev-parse HEAD origin/master` returns the same SHA, and `git remote -v` is token-free.
