# TASK-0117 — Make the artifact generator reachable from project-migration alone

## Objective

Close `B-036`: `skills/project-migration/schemas/` declares four artifact
shapes, but the engine that renders and checks them lives in
`skills/project-workflow/scripts/`. A consumer who installs only
`project-migration` gets schemas with no generator. This brief exists so the
route is written down and costed; it is **deliberately not scheduled**, and it
must not be executed until the trigger below fires.

## Minimal context

**Raised, not discovered.** `TASK-0109` named this in `ADR-0027`'s Consequences
rather than leaving it to be found later, and `B-036`'s backlog row records
both the reason for not building it and the route when someone must: "a
verbatim synced copy of `artifact_lib.py` into `project-migration/scripts/`
plus a drift gate, the `scripts/sync-decision-standard.sh` shape".

**Nothing is broken in this repository.** Both skills are present, so the
cross-skill reference resolves. `tests/validate.sh` invokes the engine at
`skills/project-workflow/scripts/artifact_lib.py` and passes over 152
artifacts, including every one generated from a `project-migration` schema.

**The reason it is not built now is a rule, not laziness.** `ADR-0027`'s own
argument: building for an absent consumer is how a second owner appears. The
repo has paid for that before — `ADR-0004` handed over one of two skills and
said nothing about the second, producing an orphan rather than a deferral, and
`ADR-0016` recorded what "later" has meant for `agents/` and `prompts/`:
indefinitely. The difference between a deferral and an orphan is that a
deferral has a reopen trigger. This file is that trigger.

**The precedent the route names, and what it actually costs.**
`scripts/sync-decision-standard.sh` (`TASK-0106`, `B-035`) is the working
instance of the shape: a generated sibling file whose header states why the
copy exists, that it is "concatenation, never paraphrase", and that
`tests/validate.sh` fails when it drifts from its sources. It exists because
`driver.py` is a template a consuming repository copies out, after which the
references sit at no known relative path — **exactly** this problem, one layer
up. So the route is proven, not speculative.

**`ADR-0013` constrains the answer.** The two frameworks stay separate; only the
engine is shared. So the copy is of the *engine*, never of a schema, and
`project-migration` must not acquire a second set of shape declarations.

**One thing `TASK-0106` learned the hard way, and it applies directly.** Its
staleness check was first written with `git diff`, which **could not fail** on
an untracked file. `ADR-0009`: a gate that quietly does nothing is worse than no
gate, because it is still trusted. Any drift gate written here is compared
in-memory or against a generated scratch path, never by `git diff`, and is
observed failing before it is trusted — `sync-templates.sh --check` and
`STANDARD_OUT` are both already built that way.

## Trigger — do not start without one of these

1. A consumer repository installs `project-migration` **without**
   `project-workflow` and cannot generate or check an artifact; or
2. `install.sh` gains a path that can deploy the two skills independently; or
3. A human schedules it explicitly.

Absent all three, this task stays `blocked`. Starting it early is the defect it
describes, committed deliberately.

**Fired 2026-09-30: trigger 3.** The human (Armando Martires) scheduled it
explicitly, asked alongside `TASK-0120`'s route choice with "leave blocked" as
the recommended option, and chose *"Schedule it now"*. Triggers 1 and 2 have
**not** fired: no consumer has been observed stranded, and `install.sh` still
deploys every skill together. `TASK-0120` took route 1 the same day, so this
engine copy does not arrive through that task's route 3; it is this task's own
schedule.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/project-migration/schemas/` | TASK-0109 | Four schemas: `task.md`, `adr.md`, `review.md`, `session.md`. No `scripts/` directory |
| `skills/project-workflow/scripts/artifact_lib.py` | TASK-0109 | The engine: `check`, `check-many`, `check-groups`, `sync` |
| `skills/project-workflow/scripts/new-artifact.sh` | TASK-0109 | Resolves schemas script-relative, never CWD-relative, so it survives `install.sh` symlinking |
| `skills/project-workflow/scripts/check-artifact.sh` | TASK-0109 | Reads headings from the schema, so it cannot become their second owner |
| `scripts/sync-decision-standard.sh` | TASK-0106 | The precedent shape: generated sibling + in-memory drift check via `STANDARD_OUT` |
| `scripts/sync-templates.sh` | TASK-0109 | `--check` compares in memory, not by `git diff` |
| `.ai/decisions/0027-artifact-shape-has-one-owner.md` | TASK-0109 | `Accepted`; carries a dated clarification, two of its statements now false |
| `.ai/decisions/0013-two-governance-frameworks.md` | TASK-0025 | `Accepted`; the two frameworks stay separate |
| `tests/validate.sh` | TASK-0110 | Checks 152 artifacts in one interpreter; `FIRST_GENERATED_TASK = 24` |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

- A verbatim synced copy of the engine into
  `skills/project-migration/scripts/`, with the thin wrappers it needs.
- A header on the copy stating what it is, why it exists, that it is a copy and
  not an owner, and which gate catches drift.
- A drift gate in `tests/validate.sh`, **observed failing before it is
  trusted** — mutate the copy, watch the gate fail, restore, watch it pass.
- A `scripts/sync-*.sh` regenerator, matching the two that already exist.
- `ADR-0027`'s Consequences updated to record that the deferred case arrived,
  with the trigger that fired.

### Not included

- **No copy of any schema.** `ADR-0013` keeps the frameworks separate; only the
  engine is shared. A schema in two places is the exact defect `ADR-0027` exists
  to prevent.
- **No refactor of the engine into a shared third location.** That is a bigger
  decision, it needs its own ADR, and it is not justified by one consumer.
- **No change to what the engine does.** This is a reachability fix. Behaviour
  changes ride in a different commit.
- **Nothing that runs before a trigger fires.**
- **No `git diff`-based staleness check**, for the reason stated above.

## Likely files

- `skills/project-migration/scripts/artifact_lib.py` — the synced copy
- `skills/project-migration/scripts/new-artifact.sh`,
  `skills/project-migration/scripts/check-artifact.sh` — wrappers
- `scripts/sync-artifact-engine.sh` — the regenerator
- `tests/validate.sh` — the drift gate
- `.ai/decisions/0027-artifact-shape-has-one-owner.md` — Consequences updated
- `.ai/planning/BACKLOG.md` — `B-036` closed
- `docs/development/authoring-guide.md` — possibly, if it describes where the
  engine lives

## Execution plan

1. Record which trigger fired, with its date and evidence. Without this the
   task should not have started.
2. Re-read `scripts/sync-decision-standard.sh` and `scripts/sync-templates.sh`
   and follow their shape rather than inventing a third one.
3. Write the regenerator, with an output-path override so the gate can generate
   to scratch instead of rewriting the tracked file.
4. Generate the copy. Confirm it is byte-identical to its source.
5. Add the drift gate to `tests/validate.sh`.
6. **Prove the gate fails.** Mutate the copy, run the gate, observe the
   failure, restore, observe the pass. Paste both.
7. Prove reachability positively: from a tree with `project-workflow` removed,
   generate and check one artifact of each of the four kinds.
8. Update `ADR-0027` and close `B-036`.

## Acceptance criteria

- [x] The trigger that fired is named and dated in this file.
- [x] The copy is byte-identical to `skills/project-workflow/scripts/artifact_lib.py`,
      proved by a hash comparison pasted in.
- [x] The drift gate is **observed failing** on a mutated copy and passing on a
      restored one; both outputs recorded.
- [x] The gate does not use `git diff`, and the log says which mechanism it uses.
- [x] Step 7's reachability proof covers all four kinds with `project-workflow`
      absent.
- [x] No file under `skills/project-migration/schemas/` changed.
- [x] `tests/validate.sh` exits 0, and its artifact count is recorded before and
      after so the added cost is visible.
- [x] `ADR-0027`'s Consequences records the arrival; `B-036` is closed with the
      commit hash.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed)
- [x] The new regenerator's `--check` mode, run twice: clean, then mutated

## Risks and rollback

- **The copy becomes a second owner.** The failure this whole design exists to
  prevent. Mitigated by verbatim generation, a stated header, and a gate that
  fires on any drift — and by copying only the engine, never a schema.
- **A drift gate that cannot fail.** `TASK-0106` shipped one and the gate caught
  it. Step 6 is non-negotiable.
- **Building it before a consumer exists.** `ADR-0027` says this is how the
  second owner appears; the Trigger section is the defence.
- **Gate cost.** `TASK-0110` measured 1.25 ms per artifact and 152 artifacts;
  a file-hash comparison is far cheaper, but it is recorded rather than assumed.
- **Rollback:** `git revert`. The copy is generated, so deleting it and its gate
  restores the prior state exactly; no artifact depends on the copy existing.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `skills/project-migration/scripts/{artifact_lib.py,new-artifact.sh,check-artifact.sh}` | **New.** Byte-identical copies of the owners in `project-workflow/scripts/` |
| `scripts/sync-artifact-engine.sh` | **New.** Writes the copies; `--check` `cmp`s them in memory; `ENGINE_OUT` redirects a real write |
| `tests/validate.sh` | Runs `sync-artifact-engine.sh --check` **unconditionally**, with no `[ -x ]` guard that could skip it |
| `skills/project-workflow/scripts/{artifact_lib.py,new-artifact.sh,check-artifact.sh}` | An OWNER AND COPY header in each. The wrappers resolve "my own schemas" from their own directory name (`SELF`), and their `--help` ranges now end at the header's end. **Engine behaviour unchanged** |
| `skills/project-migration/SKILL.md` | `3.1.0`: names its own `scripts/new-artifact.sh` / `check-artifact.sh` |
| `skills/project-migration/scripts/ai-project-scaffold.sh` | The closing report prints the skill's own generator path; the "if that skill is not installed" fallback is gone |
| `skills/project-workflow/SKILL.md` | `5.1.1` (headers and self-resolution only) |
| `.ai/decisions/0027-*.md` | Dated clarification; the original Consequences text is left as written |
| `skills/*/schemas/` | **Unchanged** |

**Next task starts here**: `project-migration` generates and checks its own
artifacts with nothing else installed. The copies move only when
`sync-artifact-engine.sh` is re-run after an owner edit.

**Deviations from the plan.**
1. **The wrappers are copied verbatim too**, rather than written as
   migration-specific thin wrappers. A hand-written wrapper would have been a
   second owner of the CLI. Making a verbatim copy correct needed the `SELF`
   change (item 4 of the log).
2. **The header lives in the owner**, so the copy can be byte-identical *and*
   say what it is. The brief asked for both, and a header added only to the
   copy would have broken the hash criterion.
3. **The scaffold's closing report changed**, which the Likely files did not
   list. It still named `<project-workflow skill>` and a fallback for its
   absence, and that stopped being true once this task landed.

## Status

- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-27
- Updated: 2026-09-30

Was blocked by design on the Trigger section. Trigger 3 fired on 2026-09-30,
when the human scheduled it.

## Execution log

### Attempt 1

- Date: 2026-09-30
- Agent: Claude Opus 5.5, Claude Code
- Actions:
  1. **Trigger recorded** in the Trigger section, before any code: trigger 3,
     human, 2026-09-30.
  2. Re-read `sync-decision-standard.sh` and `sync-templates.sh`. The new
     regenerator follows the latter: `--check` compares in memory and writes
     nothing, and an `*_OUT` variable redirects a real write.
  3. **Owner-side, behaviour-neutral.** An OWNER AND COPY paragraph went into
     all three owner files, so a verbatim copy states what it is. In both
     wrappers, `[ "$FRAMEWORK" != "project-workflow" ]` became `!= "$SELF"`,
     with `SELF="$(basename "$(dirname "$HERE")")"`, and the `--help` ranges
     were moved to the header's new end.
  4. **Generated, then hashed** (sha256, owner = copy for all three):

     ```
     1555e07f…052171a7  artifact_lib.py
     7044a910…43a1af6f  new-artifact.sh
     21ceae7b…6a3cfe    check-artifact.sh
     ```

  5. **Gate observed failing before it was trusted.** `--check` before
     generation → exit 1, three `ENGINE: … differs from its owner` lines.
     After generation → exit 0. Through `tests/validate.sh`, with `# local
     edit` appended to the copied `artifact_lib.py`:

     ```
     ENGINE: skills/project-migration/scripts/artifact_lib.py differs from its owner skills/project-workflow/scripts/artifact_lib.py —
     ENGINE: run scripts/sync-artifact-engine.sh and commit the result
     mutated: exit=1
     validate.sh: OK
     restored: exit=0
     ```

     **Mechanism: `cmp -s`, byte for byte, in memory. Not `git diff`.**
  6. **Reachability, with `project-workflow` absent.** `skills/project-migration`
     alone copied into an empty `mktemp -d` tree:

     ```
     task:    generate exit=0 (identical to owner's output) | check skeleton exit=1 | check TASK-0120 exit=0
     adr:     generate exit=0 (identical to owner's output) | check skeleton exit=1 | check 0027 exit=0
     review:  generate exit=0 (identical to owner's output) | check skeleton exit=1 | check REVIEW-0011 exit=0
     session: generate exit=0 (identical to owner's output) | check skeleton exit=1 | check SESSION-20260930-0100 exit=0
     --framework project-migration (self): exit=0
     --framework project-workflow (absent): exit=1, "cannot read schema: …/project-workflow/schemas/task.md"
     ```

     Each skeleton is rejected for the right reason: a surviving `<!-- FILL:`
     marker. The first review tried, REVIEW-0012, failed. **The owner fails it
     identically**, and `validate.sh` exempts it by name (the one review using
     `## Closing`/`## Follow-ups`), so it is a property of that artifact, not of
     the copy.
  7. `SKILL.md` line 23 and the scaffold's closing report now name the
     skill's own scripts; `ADR-0027` has a dated clarification; `B-036` is
     closed.
- Observations:
  - **The brief's two demands on the copy were in tension**: byte-identical,
    and carrying a header. Putting the header in the owner satisfies both,
    and it tells an editor of the owner that a copy exists — which is the
    reader who most needs to know.
  - **A verbatim copy of a self-referencing file is wrong in its new
    location.** The wrappers named their own skill in a string. Copied,
    `--framework project-workflow` would have silently read
    `project-migration`'s schemas. The same failure applies to any future
    verbatim copy of a file that names where it lives.
  - **Gate cost**: `tests/validate.sh` 7.65 s before, 7.59 s after, both
    single runs on `/mnt/c`, so noise. The artifact count it checks is
    unchanged: the task adds files, not artifacts.
- Validation:
  - `scripts/sync-artifact-engine.sh --check` → exit 1 before, exit 0 after
  - `tests/validate.sh` → `validate.sh: OK`, and exit 1 on a mutated copy
  - `scripts/sync-registry.sh` → no diff
  - `git diff --stat -- skills/*/schemas/` → empty
- Result: **done.** `B-036` closed.
- Commit: `1de2115` — *Ship the artifact engine inside project-migration
  (TASK-0117)*, plus the record-keeping commit after it
- Push: **confirmed to both remotes** — `51e7632..1de2115 master -> master` to
  `origin` and to `github` (the range carries `TASK-0120`'s record commit
  `a306e33` too); `HEAD`, `origin/master` and `github/master` all read
  `1de2115`, and `git remote -v` is token-free
