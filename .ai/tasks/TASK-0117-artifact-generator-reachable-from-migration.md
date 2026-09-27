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

- [ ] The trigger that fired is named and dated in this file.
- [ ] The copy is byte-identical to `skills/project-workflow/scripts/artifact_lib.py`,
      proved by a hash comparison pasted in.
- [ ] The drift gate is **observed failing** on a mutated copy and passing on a
      restored one; both outputs recorded.
- [ ] The gate does not use `git diff`, and the log says which mechanism it uses.
- [ ] Step 7's reachability proof covers all four kinds with `project-workflow`
      absent.
- [ ] No file under `skills/project-migration/schemas/` changed.
- [ ] `tests/validate.sh` exits 0, and its artifact count is recorded before and
      after so the added cost is visible.
- [ ] `ADR-0027`'s Consequences records the arrival; `B-036` is closed with the
      commit hash.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed)
- [ ] The new regenerator's `--check` mode, run twice: clean, then mutated

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
|          | what it now contains, plus anything deliberately *not* changed |

**Next task starts here**: one line naming the state the next task picks
up from — not a prediction of what that task will be. Record any
deviation from the Plan here too: the next task may have been scoped
against the original.

## Status

- Status: blocked   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: human
- Created: 2026-09-27
- Updated: 2026-09-27

Blocked by design, on the Trigger section above. `B-036` stays `ready` in the
backlog; this file is its written route, not a schedule. Owner is `human`
because only a human decides the trigger has fired.

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
