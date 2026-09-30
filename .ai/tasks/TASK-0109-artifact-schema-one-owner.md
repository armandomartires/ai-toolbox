# TASK-0109 — Give artifact shape one owner, and generate the skeleton instead of copying a template

## Objective

Replace copy-a-template-and-fill with **generate-a-skeleton-and-fill** in
both governance frameworks. A schema file becomes the single owner of each
artifact's shape; the template files become derived artifacts with a
staleness gate; a generator emits the skeleton with identifiers, dates and
headings already correct; a checker proves a finished artifact matches the
schema.

The requirement that forced it, stated by the human on 2026-09-26: the
convention must hold for models from ~12b to frontier. Copy-and-imitate
degrades with model capability because every "what do I keep, what do I
delete" judgment is a place to drift. Fill-a-marked-slot does not.

**No sprint is open.** Taken up on the human's routing, the `Post-S4` /
`Post-S5` shape `SPRINT-CURRENT.md` already names for exactly this case.

## Minimal context

**The defect is measured, not asserted.** Three counts, taken 2026-09-26
against the tree as it stands:

1. **`project-workflow` already contradicts itself.** `SKILL.md` and
   `templates/00.CONVENTIONS.md` state task files are `S###.T###_Name.md`.
   `templates/tasks/0000_TEMPLATE.md`'s own H1 and copy-instruction state
   `S###_SprintName.T###_TaskName.md`. Two owners of one fact, already
   drifted — inside the skill whose governing rule is *"One owner per fact
   — link, never copy."*
2. **This repo's own task files have drifted.** 105 files in `.ai/tasks/`,
   min 102 / mean 272 / max 661 lines. `## Inputs` appears in 86 of 105,
   `## Outputs / handover` in 86, superseded `## Preconditions` in 23,
   `## Dependencies` in 23, `## Expected result` in 19, plus eleven
   one-off headings. **Heading order is entirely ungoverned** —
   `TASK-0108` puts `## Status` last, the template puts it second-to-last.
3. **`.ai/templates/ADR.md` is 71 bytes of bare headings** while real ADRs
   run to 37,140 bytes and carry `## Alternatives considered`,
   `### Why rejected`, `### Reopen trigger` and more that the template
   never names. The largest template/reality gap in the repo.

**Which framework this touches, and why both.** Per `ADR-0013` this repo
runs `project-migration`'s framework (`TASK-####`, `context/`,
`sessions/`); `project-workflow` (`S###.T###`, `00.CONVENTIONS.md`) is
shipped to *other* projects and has **zero instances here**. The human's
symptom report matches this repo's drift; the skill named matches the
other framework. Both have the same defect, so both get the fix.

**`ADR-0013` is not violated.** It decided the two frameworks stay
divergent and that neither is changed to match the other. This task keeps
two separate schema sets with their own IDs, filenames and heading lists.
It shares only the *engine* — a tool, not a shape. The ADR forbids
aligning the frameworks; it says nothing about a common generator, and
clause 4 ("B-009 closed as resolved-by-decision") is untouched.

**Two standing constraints this design routes around rather than
through:**

- **`ADR-0008`** — skill linting is frontmatter-only, *"Enforcing an
  invented number would make this gate the author of a requirement rather
  than the enforcer of one."* So **no byte or line cap is added
  anywhere.** Uniformity is enforced as heading-set and heading-order
  equality against a schema. That is a shape check against a declared
  list, not a size check against an invented number, so the ADR stands.
  File size falls as a consequence of the shape, not as a rule.
- **`ADR-0018` clause 7 / `ADR-0017` (rejected)** — model references
  belong in one place, and that place is `agent-tiers`' `models.jsonc` in
  `opencode-customization`, not here. `scripts/emit-agents.py` already
  emits an unresolved `{tier:<name>}` and the authoring guide explicitly
  forbids closing that gap locally. So the generator's flag is
  **`--guidance`**, describing prose density, and it **never names a
  model**. The mapping from guidance level to model size is a suggestion
  table in `SKILL.md`, not a resolver.

**The shape this follows is the repo's own.** A derived artifact plus a
staleness gate is how `docs/registry.md` (`scripts/sync-registry.sh`) and
`skills/unattended-ops/templates/bindings/opencode/decision-standard.md`
(`scripts/sync-decision-standard.sh`) already work, including the
`STANDARD_OUT`-style env var that lets the gate regenerate to a scratch
path and `cmp` rather than rewriting the tracked file to test it. The
generator/checker pair, the `fixtures/{complete,incomplete}-*` evidence
pair, and the `WHAT THIS PROVES` / `WHAT IT DOES NOT PROVE` header
paragraphs are how `skills/ansible-ops/scripts/check-change-record.sh` and
`skills/unattended-ops/scripts/check-binding.sh` are already built.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/project-workflow/` | pre-existing, v3.2.0 | 13 files, no `scripts/`, no `references/`; `SKILL.md` 2,590 B; the `S###.T###` vs `S###_SprintName.T###_TaskName` contradiction present |
| `skills/project-migration/` | pre-existing, v1.1.0 | `SKILL.md` + `references/governance-spec.md` + `scripts/ai-project-scaffold.sh` (590 lines); **no `templates/`** — it emits the layout |
| `.ai/templates/{TASK,ADR,REVIEW,SESSION,PLAN}.md` | pre-existing | TASK 1,911 B / 57 lines; ADR 71 B / 6 lines; the rest under 200 B |
| `.ai/tasks/TASK-0001…0108` | 105 files | Unchanged and **to stay unchanged** — see Risks |
| `tests/validate.sh` | pre-existing | 1,357 lines; `FIRST_CONTRACT_TASK = 20`; skills checked for frontmatter only; `skills/*/scripts/*` wiring-claim scanner active |
| `scripts/sync-decision-standard.sh` | `TASK-0106` (`d50d220`) | The precedent to copy: generated banner, `STANDARD_OUT` scratch-path override, gated by `validate.sh:1331-1355` |
| `scripts/sync-registry.sh` | pre-existing | 200 lines; the `_template*` skip lives in `emit_section()` **once**, deliberately |
| `.ai/decisions/0008,0013,0017,0018` | pre-existing | Accepted / Accepted / **Rejected** / Accepted — the four constraints above |
| git | — | clean tree, `master`, next IDs `TASK-0109` / `ADR-0027` confirmed 2026-09-26 |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

- A schema file format, and schema files for both frameworks'
  copy-and-fill artifacts.
- `new-artifact.sh` (generator) and `check-artifact.sh` (checker) in
  `skills/project-workflow/scripts/`, plus a `fixtures/` evidence pair.
- `scripts/sync-templates.sh`, regenerating both frameworks' template
  files from their schemas.
- `tests/validate.sh`: template-staleness check, and a heading-shape check
  bounded by a new `FIRST_GENERATED_TASK`.
- `ADR-0027`; `SKILL.md` edits in both skills; authoring-guide, registry,
  `CURRENT_STATE.md`.

### Not included

- **Rewriting any of the 105 existing task files.** See Risks.
- **Unifying the two frameworks.** `ADR-0013` stands; two schema sets.
- **Resolving `{tier:<name>}` or defining any tier→model mapping.**
- **Any byte or line cap.** `ADR-0008` stands.
- **A synced engine copy into `project-migration`.** Named as a known gap
  and filed in `BACKLOG.md`; not built, because no consumer has hit it.
- `ai-project-scaffold.sh`'s layout scaffolding, which is a different job
  and stays as it is.

## Likely files

A forecast, written before the work.

**New** — `skills/project-workflow/scripts/{new-artifact,check-artifact}.sh`;
`skills/project-workflow/schemas/{task,adr,review,adhoc}.md`;
`skills/project-workflow/fixtures/{complete,incomplete}-task.md`;
`skills/project-migration/schemas/{task,adr,review,session}.md`;
`scripts/sync-templates.sh`;
`.ai/decisions/0027-artifact-shape-has-one-owner.md`.

**Regenerated** — `skills/project-workflow/templates/{tasks,decisions,reviews}/*TEMPLATE.md`;
`.ai/templates/{TASK,ADR,REVIEW,SESSION}.md`.

**Edited** — both `SKILL.md`s; `tests/validate.sh`;
`docs/development/authoring-guide.md`; `.ai/planning/BACKLOG.md`;
`.ai/context/CURRENT_STATE.md`; `docs/registry.md` (generated).

## Execution plan

1. This file, then `ADR-0027`. The "`--guidance` is not a tier" claim must
   be settled **before** a flag named after it exists.
2. Schema format + `project-workflow` schemas. **Transcription only** — no
   heading is invented; every one exists in the tree today.
3. `new-artifact.sh`. Verify by generating the current template at
   `--guidance standard` and diffing against the tracked file; iterate
   until the diff is cosmetic, then commit the regenerated file.
4. `check-artifact.sh` + the two fixtures.
5. `project-migration` schemas, transcribed from `.ai/templates/` and the
   heading census above.
6. `scripts/sync-templates.sh`; regenerate all templates.
7. Gate wiring in `tests/validate.sh`.
8. Docs, `BACKLOG.md`, registry, `CURRENT_STATE.md`.

## Acceptance criteria

- [x] `tests/validate.sh` exits 0; runtime not materially above the ~920 ms
      this `/mnt/c` checkout already records.
- [x] `check-artifact.sh` **fails** on `fixtures/incomplete-task.md` naming
      the specific missing heading, and **passes** on
      `fixtures/complete-task.md`. Both messages recorded verbatim.
- [x] A stale heading injected into a scratch task file at or above
      `FIRST_GENERATED_TASK` **fails** the gate for the expected reason;
      removing it returns green. Failure text recorded.
- [x] A hand-edited regenerated template **fails** the gate;
      `scripts/sync-templates.sh` returns it to green.
- [x] **Guidance equivalence**: the same task generated at all four levels,
      with every `<!-- … -->` stripped, is byte-identical across all four.
      If not, the levels are changing the artifact and the design is wrong.
- [x] The 105 pre-existing task files are untouched and still pass;
      `TASK-0001`'s superseded `## Preconditions` / `## Dependencies` is
      **not** flagged.
- [x] No byte or line cap is introduced anywhere (`ADR-0008`).
- [x] No tier→model mapping is introduced anywhere (`ADR-0018` clause 7).
- [x] Cold end-to-end: generate at `--guidance literal`, fill following
      **only** the emitted comments without reading `SKILL.md`, checker
      passes.
- [x] `metadata.version` bumped in both edited skills; registry regenerated.

## Mandatory validations

- [x] `tests/validate.sh`
- [x] `scripts/sync-registry.sh` (components changed)
- [x] `scripts/sync-templates.sh` (new; templates are now derived)
- [x] `bash skills/project-workflow/scripts/check-artifact.sh` against both fixtures

## Risks and rollback

**Risk 1 — retro-fitting the 105 existing briefs.** The single largest
risk, and the reason `FIRST_GENERATED_TASK` exists. `validate.sh` already
carries the argument at `FIRST_CONTRACT_TASK = 20`: *"Task briefs numbered
below this predate the convention… They are records of what happened, not
instances of the current template; rewriting them to satisfy a rule
invented afterwards would fabricate compliance."* The same applies here
with a new boundary. **A heading-shape check that flags pre-existing files
is a defect in this task, not a finding about those files.**

**Risk 2 — the generator becomes a second owner of shape.** Mitigated by
the checker reading headings **from the schema file, never from a copy held
in the script** — the explicit design rule in `check-binding.sh`, which
resolves step numbers out of `loop.md` for exactly this reason.

**Risk 3 — `--guidance` reads as a model tier and reopens `ADR-0017`.**
Mitigated by naming (`--guidance`, not `--tier`), by the levels being
prose densities (`terse|standard|explicit|literal`) rather than parameter
counts, and by `ADR-0027` stating the non-equivalence explicitly.

**Risk 4 — a wiring claim in a new script that nothing honours.**
`validate.sh`'s `skills/*/scripts/*` scanner will read both new scripts.
Every "run from `…`" sentence must be true or phrased as the negative it
is. This is W1's failure mode and the gate exists because of it.

**Risk 5 — gate runtime.** Two new passes on a `/mnt/c` checkout. Measure;
do not delete checks to buy back time the filesystem is spending.

**Rollback.** One commit, no history rewrite, no data migration, no
existing file's content semantically changed except the regenerated
templates — which are reproducible from their schemas by re-running the
sync script. `git revert` is sufficient and complete.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `skills/project-workflow/scripts/artifact_lib.py` | the parser, renderer and checker. Four modes: `render`, `check`, `sync`, `check-many`. Both CLIs and the gate go through it, so nothing holds a second copy of what a schema means |
| `skills/project-workflow/scripts/new-artifact.sh` | generator CLI; `--kind`/`--framework`/`--guidance`/`--out`. Refuses to overwrite. Resolves schemas script-relative so it survives being symlinked into a client dir |
| `skills/project-workflow/scripts/check-artifact.sh` | checker CLI, one artifact at a time. Five rejection rules, each observed firing |
| `skills/project-workflow/schemas/` | `README.md` (the format) + `task`, `adr`, `review`, `adhoc` |
| `skills/project-migration/schemas/` | `task`, `adr`, `review`, `session`. Transcribed from `.ai/templates/` **and** from a census of the real artifacts — the ADR and review schemas follow the 27 ADRs and 12 reviews, not the impoverished templates |
| `skills/project-workflow/fixtures/` | `complete-task.md` (passes) and `incomplete-task.md` (fails five ways, one per rule) |
| `scripts/sync-templates.sh` | regenerates all seven templates; `--check` compares in memory and writes nothing |
| 7 template files | now **generated**, each carrying a do-not-edit banner naming its schema |
| `tests/validate.sh` | two passes added: template staleness, and brief shape at or above `FIRST_GENERATED_TASK = 109` |
| `.ai/decisions/0027-*.md` | the decision, incl. why `--guidance` is not `--tier` and why no size gate was added |
| `.ai/planning/BACKLOG.md` | `B-036` — the engine is not reachable from `project-migration` alone |
| `skills/project-workflow/SKILL.md` | v3.2.0 → **4.0.0**; generate-don't-copy, the `--guidance` table, and the `S###.T###` contradiction removed by pointing at the schema |
| `skills/project-migration/SKILL.md` | v1.1.0 → 1.2.0; one rule added. `ai-project-scaffold.sh` still owns the *layout* and is unchanged |
| `docs/development/authoring-guide.md` | new "Artifact schemas" subsection with a Gated column |
| `.ai/context/CURRENT_STATE.md`, `docs/registry.md` | updated / regenerated |
| **Deliberately not changed** | the 105 pre-existing briefs; `20.PLAN.md`/`30.ROADMAP.md`/`35.AD_HOC_TASKS.md` (indexes, not instances); `00.CONVENTIONS.md` (already said `S###.T###_Name.md`, and sits at 3060 of its self-declared 3072-byte budget) |

**Next task starts here**: planning artifacts in both frameworks are
generated from schemas and the templates are derived. Task briefs from
`TASK-0109` onward are shape-gated; everything below the boundary is exempt
and untouched. ADR, review and session schemas generate but are **not**
gated. `B-036` is open and deliberately unbuilt.

## Deviation from the Plan

Three, all recorded rather than folded in silently.

1. **The plan asserted the gate runs in ~920 ms on this checkout.** That
   number came from `validate.sh`'s own header and did not reproduce: the
   measured baseline today is **2.25 s** on `/mnt/c`. The acceptance
   criterion was written against a stale figure, so it was re-measured from
   scratch, A/B and in place, and on a native copy as the repo's own rule
   requires. There is **no native checkout** — the second working directory
   is a symlink to the same `/mnt/c` path — so the native figure came from a
   copy into `/tmp`.
2. **The first implementation was 1.4 s slower than it needed to be**,
   spawning a bash+python3 pair per template. Both new passes were batched
   into one interpreter each. Not a plan deviation so much as a plan step
   that turned out to have a wrong first answer.
3. **The checker's marker pattern was too broad, twice.** A bare `FILL:`
   fired on `incomplete-task.md`'s own blockquote, which *names* the rule
   while explaining the defect — the fires-on-correct-text failure mode this
   repo already deletes checks over. Narrowed to the emitted comment form.
   It then fired again on **this file**, where the sentence above shows that
   form inside a code span. A marker inside inline backticks is being shown,
   not left behind, so code spans are now exempt — the same "quoted claims
   are discussion" carve-out `validate.sh`'s wiring scanner already needs.
   Both were found by using the checker on real artifacts, not by reading it.
4. **The empty-after-section rule mis-read parent headings.** It flagged
   `## Execution log` on this very file as empty, because its content lives
   under `### Attempt 1`. A heading immediately followed by a deeper one is a
   parent and is now reported as its children's content rather than as empty.
   Also found by running the gate against a real brief.

## Unsettled, for the human

**The task ID format.** `project-workflow` disagreed with itself; the fix
picked `S###.T###_Name.md`, because `templates/reference/task-lifecycle.md`
is the declared owner of the ID scheme and states it twice, and
`00.CONVENTIONS.md` and `SKILL.md` agree. The outvoted form,
`S###_SprintName.T###_TaskName.md`, is the one the **global `CLAUDE.md`**
uses. Three sources including the owner beat one, so the schema went with
the short form — but the global file is a fifth source and a human wrote it.
Flipping it is one line: `filename_pattern` in
`skills/project-workflow/schemas/task.md`.
## Status

- Status: done
- Owner: agent
- Created: 2026-09-26
- Updated: 2026-09-26

## Execution log

### Attempt 1

- Date: 2026-09-26
- Agent: Claude Opus 5 (1M context), Claude Code
- Actions: wrote this brief and `ADR-0027` before any code, per the plan's
  step 1-2 ordering. Then: schema format + `README.md`; four
  `project-workflow` schemas; `artifact_lib.py`; the two CLIs; the fixture
  pair; four `project-migration` schemas; `sync-templates.sh`; two passes in
  `tests/validate.sh`; `SKILL.md` in both skills; authoring guide; `B-036`;
  `CURRENT_STATE.md`; registry regenerated.
- Observations: the `project-workflow` template's H1 said
  `S###_SprintName.T###_TaskName` while `SKILL.md`, `00.CONVENTIONS.md` and
  `templates/reference/task-lifecycle.md` all said `S###.T###_Name` — the
  contradiction the ADR cites, confirmed by reading all four. The ADR and
  review schemas could not be transcribed from `.ai/templates/`: those files
  describe an artifact nobody writes (`ADR.md` is four bare headings; real
  reviews use H2 sections the flat-bullet template never names), so both were
  transcribed from a census of the 27 real ADRs and 12 real reviews instead.
- Validation: all nine acceptance criteria exercised, not asserted.
  **(1)** `tests/validate.sh` → `validate.sh: OK`. Timing A/B, alternating
  and in place: `/mnt/c` 2.25 s → 2.79 s; native `/tmp` copy 1.03 s → 1.32 s.
  The two passes in isolation cost 0.151 s and 0.074 s.
  **(2)** `check-artifact.sh` on `fixtures/complete-task.md` →
  `OK …/complete-task.md`, exit 0. On `fixtures/incomplete-task.md` → exit 1
  with all five: `missing required section: ## Plan`; `superseded section:
  ## Preconditions`; `sections out of schema order` printing found-vs-expected;
  `line 32: unfilled generator marker still present`; `## Verification is
  empty but the artifact is marked complete`.
  **(3)** Fails-when-reverted on the gate: appended `## Preconditions` to this
  brief, `tests/validate.sh` → exit 1, `FAIL .ai/tasks/TASK-0109-…` /
  `superseded section: ## Preconditions`. Restored → OK.
  **(4)** Hand-edited `.ai/templates/ADR.md`; gate → `TEMPLATES:
  .ai/templates/ADR.md is stale against skills/project-migration/schemas/adr.md`.
  `scripts/sync-templates.sh` → OK.
  **(5)** Guidance equivalence: all four levels generated, every comment
  stripped, all four `md5sum` → `ba3e77d3b849c7cf47073d0cfe7100c2`. With
  guidance the four differ (1892 / 2655 / 2598 / 3310 bytes); without it they
  are one file. This is the claim the design rests on.
  **(6)** Boundary: `git status .ai/tasks/` shows no pre-existing brief
  modified. `TASK-0001` checked *directly* fails three ways (missing
  `## Inputs`, missing `## Outputs / handover`, superseded
  `## Preconditions`) and the gate is green — the exemption works and is
  load-bearing, not decorative.
  **(7)** The wiring-claim scanner reads all three new scripts and passes.
  Each positive claim was written to be true: `sync-templates.sh` does run
  `new-artifact.sh`'s parser, and `tests/validate.sh` does run the checker.
  **(8)** Cold end-to-end: generated `S003.T001_RateLimit` at
  `--guidance literal` into a scratch tree and filled it following **only**
  the emitted comments — no `SKILL.md`, no schema, no template. 73 lines,
  checker → `OK`, exit 0.
  **(9)** `scripts/sync-registry.sh` re-run; `metadata.version` bumped in both
  skills.
- Result: done. Both frameworks generate from schemas; the templates are
  derived and gated; the `S###.T###` contradiction is gone. Two limits carried
  forward deliberately: only task briefs are shape-gated, and `B-036` is open.
- Commit: `85ca681`
- Push: confirmed — `6762e52..85ca681  master -> master`,
  `origin/master` verified at `85ca681`
