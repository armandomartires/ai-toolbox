# TASK-0120 — Settle whether a migrated repository can regenerate its templates

## Objective

Close `B-041`. `skills/project-migration/SKILL.md` line 23 tells a migrator
that *"`.ai/templates/*.md` are generated from these schemas by
`scripts/sync-templates.sh` and carry a do-not-edit banner."* In a repository
this skill has just migrated, **no such script exists**, and the one it names
lives at `ai-toolbox`'s repo root with `ai-toolbox`'s paths hard-coded in it.
The sentence describes a mechanism the reader cannot run. Either ship the
mechanism or stop claiming it — and record which, and why.

## Minimal context

**Found 2026-09-27 by the same review that raised `B-040`.** It is a distinct
defect from `B-040` and from `B-036`, and the three are easy to conflate:

| Item | Who is stranded | What is missing | Route |
|---|---|---|---|
| `B-040` | every newly migrated repo | correct templates **at birth** | `TASK-0119` |
| `B-041` *(this)* | every migrated repo, thereafter | a way to **keep** them correct | this task |
| `B-036` | a consumer installing one skill without the other | the **engine** | `TASK-0117`, `blocked` |

`TASK-0119` makes a migrated repository's four templates correct on the day it
is scaffolded. From the following day they are frozen: the schemas that own
them live in the skill and will move, and the migrated repository has no
regenerator, no drift gate, and a banner telling it not to hand-edit the only
copy it has. That is a **stated-but-unrunnable** instruction, which is a worse
failure than an absent one — it reads as a safeguard and is not.

**The claim's provenance.** `TASK-0109` added the sentence while bumping
`SKILL.md` to `1.2.0`. It is true *in this repository*, where
`scripts/sync-templates.sh` does regenerate `.ai/templates/{TASK,ADR,REVIEW,SESSION}.md`
and `tests/validate.sh` fails on drift. Read from inside `ai-toolbox` it is
correct; read by the audience `SKILL.md` is written for — someone migrating a
different repository — it is not. This is the ordinary failure mode of a
document that serves two readers, and `ADR-0013` exists because this repo has
paid for it before.

**Why this is a decision and not a fix.** Every route changes what the skill
*promises*, and two of the three make `project-migration` ship code it does not
ship today. `ADR-0027`'s own argument cuts both ways here: building for an
absent consumer is how a second owner appears, and the consumer for this one is
also hypothetical — **no repository has been migrated by this skill and then
outlived a schema change.** But unlike `B-036`, the cost of doing nothing is not
zero, because the false sentence is already published. So the minimum action is
non-zero even if the maximum is declined.

**`ADR-0013` constrains every route.** The two frameworks stay separate. Any
shipped regenerator copies the **engine and the templates**, never a schema into
the other framework, and never merges the two schema sets.

**`ADR-0009` constrains any gate that ships with it.** A regenerator that a
target repository cannot actually run — wrong Python floor, missing sibling,
silently skipping — is the gate-that-does-nothing this repo has ruled worse
than none. Whatever ships must be demonstrated running **inside a scratch
migrated repository**, not inside `ai-toolbox`.

**This task is `blocked` on the human's route choice, by design.** The routes
are costed below rather than ranked-and-executed, because the cheapest one
(Route 1) is a documentation retraction that closes the defect honestly, and
choosing it over building something is a judgement about how much
`project-migration` is meant to promise — which is the human's, not the agent's.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/project-migration/SKILL.md` | `TASK-0109` | Line 23's hard rule contains the `scripts/sync-templates.sh` claim. Version `1.2.0` — or `2.0.0` if `TASK-0119` has landed first |
| `scripts/sync-templates.sh` | `TASK-0109` | Repo-root only; `TARGETS` hard-code `skills/…` and `.ai/templates/…`; `TEMPLATES_OUT` redirects the write; `--check` compares in memory |
| `skills/project-workflow/scripts/artifact_lib.py` | `TASK-0109` | The engine, `python3` stdlib only. `sync` mode reads `TARGETS`, `OUT`, `BANNER`, `CHECK` |
| `skills/project-migration/schemas/*.md` | `TASK-0109` | Four schemas — the thing a migrated repo would need to reach |
| `skills/project-migration/templates/` | `TASK-0119`, **if route B was taken** | Four generated templates. **Verify whether this exists**; it changes this task's cheapest route materially |
| `.ai/tasks/TASK-0117-artifact-generator-reachable-from-migration.md` | 2026-09-27 | `blocked`; owns the engine-reachability question and its trigger list |
| `.ai/tasks/TASK-0119-scaffold-templates-from-schemas.md` | 2026-09-27 | Owns correctness-at-birth. **Should land first** |
| `.ai/decisions/0013-two-governance-frameworks.md` | `TASK-0025` | `Accepted`; frameworks separate, engine shared |
| `.ai/decisions/0027-artifact-shape-has-one-owner.md` | `TASK-0109` | `Accepted`; clause 2 and the *one stated gap* consequence |
| `scripts/sync-decision-standard.sh` | `TASK-0106` | The copied-out-template precedent, one layer down |
| `docs/development/authoring-guide.md` | `TASK-0109` | Line 42's derived-templates row — the normative statement any route must keep true |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

- **A decision, recorded.** Which of the routes below is taken, by whom, on
  what date, with the rejected ones and their reasons kept.
- **An ADR if the route is 2 or 3.** Either ships new capability in a skill and
  changes what `project-migration` promises a target repository — `AGENTS.md`'s
  rule: *decisions with lasting impact get an ADR*. Route 1 needs none; it
  retracts a claim, which `TASK-0019` is the precedent for treating as ordinary
  work.
- **`SKILL.md` line 23 made true**, whichever route is chosen.
- **A demonstration inside a scratch migrated repository**, not inside
  `ai-toolbox` — the claim is about what a target repo can do.

### Not included

- **No vendored `artifact_lib.py` unless route 3 is chosen.** `B-036` /
  `TASK-0117` owns the engine copy and its trigger. If route 3 is chosen,
  **that trigger has fired** and `TASK-0117` must be updated in the same commit
  rather than left reading `blocked`.
- **No schema changes, and no schema copied between frameworks.** `ADR-0013`.
- **No change to what the scaffold emits.** `TASK-0119`.
- **No retroactive update of already-migrated repositories.** `ADR-0027`
  settles it; anyone wanting the new behaviour re-runs the scaffold, and
  `mkfile` will skip their existing files.
- **No second tier of promise for `project-workflow`.** Its templates ship
  inside the skill and are copied by its own scaffolding step, which is a
  different mechanism and is not in question here.

## Likely files

A forecast, written before the work. Route-dependent — the union, not a
prediction that all of it changes.

**All routes**
- `skills/project-migration/SKILL.md` — line 23 rewritten; version bumped
- `.ai/planning/BACKLOG.md` — `B-041` closed
- `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md` — the ledger

**Route 1 only (retract)**
- `docs/development/authoring-guide.md` — if it repeats the claim

**Routes 2 and 3 (ship something)**
- `skills/project-migration/scripts/sync-templates.sh` — **new**, the shipped
  regenerator, schema paths resolved script-relative
- `skills/project-migration/scripts/artifact_lib.py` — **new, route 3 only**,
  the verbatim synced engine copy
- `scripts/sync-artifact-engine.sh` — **new, route 3 only**, its regenerator
- `tests/validate.sh` — drift gate for whatever is copied
- `.ai/decisions/00NN-*.md` — **new** ADR; take the number when the file is
  written, not before
- `.ai/tasks/TASK-0117-*.md` — **route 3 only**: trigger fired, status changed
- `skills/project-migration/scripts/ai-project-scaffold.sh` — if the
  regenerator is to be dropped into the target repo at scaffold time

## Execution plan

**Step 0 — do not start without a route.** Present the table below, take the
human's choice, record it with the date. The rest of the plan is conditional on
it.

| # | Route | What ships | What `SKILL.md` then says | Cost |
|---|---|---|---|---|
| **1** | **Retract the claim** | nothing | *"Your templates were rendered from the schemas in this skill at scaffold time. They are a point-in-time copy: this repository has no regenerator, and if the skill's schemas change your templates will not. Re-run the scaffold into a scratch directory and diff if you want to check."* | One paragraph. **Closes the defect honestly and buys nothing else.** Leaves a migrated repo permanently frozen — which is arguably correct, since `ADR-0027` already says a scaffolded project is not retroactively edited |
| **2** | **Ship a regenerator, no engine** | `skills/project-migration/scripts/sync-templates.sh`, resolving schemas and the engine script-relative | *"run `bash <skill dir>/scripts/sync-templates.sh <target repo>`"* | Moderate. **Still needs `project-workflow` present** — so it helps the migrating operator, not the migrated repository standing alone. Does **not** fire `TASK-0117`'s trigger |
| **3** | **Ship a regenerator and the engine** | route 2, plus a verbatim `artifact_lib.py` copy and its own drift gate | *"…and it works with `project-migration` installed alone"* | Highest. **Fires `TASK-0117`'s trigger 1**, so the two tasks merge or sequence. This is `B-036`'s route arriving through a second consumer, which is itself evidence the deferral has expired |

**A note the decision should weigh, not a recommendation.** Route 1 is the only
one that adds no code, and `ADR-0027`'s deferral logic — *building for an absent
consumer is how a second owner appears* — argues for it until a real migrated
repository has actually outlived a schema change. The counter-argument is that
routes 2 and 3 are the same work `TASK-0117` has already costed, so doing them
together may be cheaper than twice. **Both readings are defensible; that is why
this is `blocked`.**

**Steps, after a route is recorded:**

1. **Re-verify the Inputs table**, especially whether `TASK-0119` landed and
   whether `skills/project-migration/templates/` now exists. Route 2's cost
   falls sharply if it does.
2. **Reproduce the defect.** Scaffold a scratch repository, then attempt
   literally what `SKILL.md` line 23 instructs from inside it. Paste the
   failure. A claim is retracted on evidence, not on reasoning.
3. *(Routes 2/3)* **Write the ADR before the code.** Statement, context,
   decision, alternatives — including the two routes not taken and why.
4. *(Routes 2/3)* **Build the regenerator**, following `sync-templates.sh` and
   `sync-decision-standard.sh` rather than inventing a third idiom. Resolve
   every path script-relative, never CWD-relative — `new-artifact.sh`'s rule,
   and the reason it survives `install.sh` symlinking.
5. *(Route 3)* **Sync the engine copy**, verbatim, with a header stating it is
   a copy and naming its gate. Record that `TASK-0117`'s trigger fired, in
   `TASK-0117` itself.
6. *(Routes 2/3)* **Add the drift gate** to `tests/validate.sh`; in-memory
   comparison, never `git diff`.
7. *(Routes 2/3)* **Observe the gate fail** on a mutated copy and pass on a
   restored one. Paste both.
8. **Demonstrate inside the scratch migrated repository** — route 1: that the
   new wording matches what actually happens there; routes 2/3: that the
   regenerator runs there and reproduces the four templates byte-for-byte.
   **Not from inside `ai-toolbox`**; that is the reading that produced the
   false claim in the first place.
9. **Rewrite `SKILL.md` line 23** to the chosen wording. Bump the version — a
   change to what the skill promises about artifact production is a major bump
   under its own maintenance rule.
10. **Run `tests/validate.sh` and `scripts/sync-registry.sh`.**
11. **Close `B-041`** with the commit hash; update `CURRENT_STATE.md` and
    `TODO.md`; fill Outputs / handover and the Execution log.

## Acceptance criteria

- [x] The route is named, dated and attributed in the Execution log, with the
      rejected routes and their reasons.
- [x] Step 2's reproduction is pasted: the instruction attempted from inside a
      scratch migrated repository, and its failure.
- [x] `SKILL.md` line 23 describes something the reader can do, verified by
      step 8 from inside that scratch repository — not reasoned about from
      inside `ai-toolbox`.
- [ ] *(Routes 2/3)* An ADR exists, is `Accepted`, and names the two routes not
      taken.
- [ ] *(Routes 2/3)* The drift gate is **observed failing** and then passing;
      both outputs recorded; the log names the mechanism and states it is not
      `git diff`.
- [ ] *(Route 3)* The engine copy is byte-identical to its source, proved by a
      hash, and `TASK-0117` records that its trigger fired and no longer reads
      `blocked`.
- [x] No file under either `schemas/` directory changed.
- [x] `tests/validate.sh` exits 0.
- [x] `B-041` is closed in `BACKLOG.md` with the commit hash, and the
      open-items sentence agrees with the rows above it.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed)
- [x] A scaffold into a scratch directory, and the chosen route's instruction
      executed **from inside it**
- [ ] *(Routes 2/3)* The new regenerator's `--check` mode, run clean and then
      mutated — it must pass, then fail

## Risks and rollback

- **Retracting the claim reads as a downgrade.** It is not: the capability was
  never there. The wording must say what a migrated repository *does* get — a
  correct point-in-time copy, which after `TASK-0119` is a real guarantee — and
  not merely what it lacks.
- **Building routes 2 or 3 for a consumer that does not exist.** `ADR-0027`'s
  named failure mode. The defence is that the *false sentence* exists today
  even if the consumer does not, and route 1 discharges that alone.
- **Route 3 silently absorbing `TASK-0117`.** Two tasks closing one backlog
  item without either saying so is how `B-035` sat at `ready` for a day after
  it closed (`TASK-0118`). If route 3 is taken, `TASK-0117` and `B-036` are
  updated in the same commit or the task is not done.
- **A regenerator that cannot run in the target.** `ADR-0009`. The gate floor
  is `python3` ≥ 3.11 in *this* repo for `tomllib`; the engine itself is
  stdlib-only and older-friendly, and the difference must be stated rather than
  assumed, or a target repo gets a script that fails on its interpreter.
- **Scope collision with `TASK-0119`.** Both touch `SKILL.md`. Land `TASK-0119`
  first; if they must overlap, one commit per task still, and rebase rather
  than bundle (`ADR-0023`).
- **Rollback:** `git revert`. Route 1 is a prose change. Routes 2/3 add files
  with no dependents plus a gate; deleting them restores the prior state, and
  the ADR would be marked `Superseded` rather than deleted.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `skills/project-migration/SKILL.md` | `3.0.0`. Line 23 no longer claims the migrated repo regenerates; it says the emitted templates are a point-in-time copy, names the banner's three ai-toolbox paths as absent there, and gives a check the reader can run |
| `.ai/planning/BACKLOG.md` | `B-041` **done**; `B-051` raised; open count unchanged at 14 |
| `docs/development/authoring-guide.md` | **Deliberately unchanged.** Its line-42 row describes ai-toolbox's own templates to ai-toolbox's developers, and is true for them |
| `scripts/sync-templates.sh`, `skills/project-migration/templates/`, both `schemas/` | **Unchanged** — route 1 ships nothing, and the banner fix is `B-051`'s |
| `.ai/tasks/TASK-0117-*.md` | **Not touched by this task.** Route 1 does not fire its trigger; it was scheduled separately, by the human, the same day |

**Next task starts here**: a migrated repository is told the truth about its
templates and can check them against the installed skill. The banner inside
those templates still names ai-toolbox paths (`B-051`).

**Deviation from the plan**: none in the route. One addition — the banner
finding. Step 2 was planned to reproduce `SKILL.md`'s claim and did; it also
showed the emitted files making the same claim. `SKILL.md` now warns about the
banner, and fixing the banner is left to `B-051`.

## Status

- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-27
- Updated: 2026-09-30

Was blocked on step 0's route choice; the human chose route 1 on 2026-09-30.
The `TASK-0119` sequencing was satisfied — it landed 2026-09-28 (`91b85e5`).

## Execution log

### Attempt 1

- Date: 2026-09-30
- Agent: Claude Opus 5.5, Claude Code
- **Route: 1, retract the claim** — chosen by the human (Armando Martires),
  2026-09-30, asked with the three routes costed above. **Rejected**: route 2
  (ship a regenerator) — it cures a problem no migrated repository has yet
  had, since none has outlived a schema change, and `ADR-0027` names building
  for an absent consumer as how a second owner appears; route 3 (regenerator
  plus engine) — the same, plus `artifact_lib.py` copied in for this purpose.
  *The engine copy is being built anyway, as `TASK-0117`, on its own trigger
  3 — a separate decision, not this task's route.*
- Actions:
  1. **Inputs re-verified.** `TASK-0119` done (`91b85e5`);
     `skills/project-migration/templates/{TASK,ADR,REVIEW,SESSION}.md` exist;
     `SKILL.md` at `2.1.0`, not the `1.2.0`/`2.0.0` the table forecast.
  2. **Reproduced from inside a scratch migrated repository.**
     `ai-project-scaffold.sh demo --no-git` → exit 0; then, from `demo/`,
     literally what line 23 names:

     ```
     $ bash scripts/sync-templates.sh
     bash: scripts/sync-templates.sh: No such file or directory
     exit=127
     ```

     **And the same claim, in the emitted file.** `demo/.ai/templates/TASK.md`
     opens: *"GENERATED by scripts/sync-templates.sh — DO NOT EDIT. Shape is
     owned by skills/project-migration/schemas/task.md; edit that and re-run.
     tests/validate.sh fails on drift."* — none of the three exists in
     `demo/`. Raised as `B-051`; not fixed (Scope: no change to what the
     scaffold emits).
  3. **The replacement procedure proved before it was written down**, from
     inside `demo/`: scaffold to a `mktemp -d` path, `diff -r` the two
     `.ai/templates/` → exit 0; append one line to `ADR.md` → exit 1 naming
     `ADR.md` and the added line; restore → exit 0.
  4. **Line 23 rewritten, `3.0.0`.** It keeps the true sentence about the
     scaffold reading shipped `templates/` and says where those templates are
     rendered (ai-toolbox). It states that the target has a point-in-time
     copy with no regenerator or gate, names the banner's three absent paths
     (`B-051`), and gives the check. Major bump because the skill now promises
     less, as `TASK-0119`'s `1.2.0` → `2.0.0` was major for a change to
     artifact production.
  5. **Step 8** — the command copied out of the new `SKILL.md` text by `grep`,
     `<skill dir>` substituted, `eval`'d inside `demo/` → exit 0. Again
     through the installed path `~/.claude/skills/project-migration`
     (a symlink into this tree) → exit 0.
- Observations:
  - **What a migrated repository gets is now stated, not only what it
    lacks** (the brief's first risk). After `TASK-0119` the point-in-time copy
    is a real guarantee: correct on the day, and checkable.
  - **The defect had two sites, and only one was in the brief.** `SKILL.md`
    made the claim to the migrator; the banner makes it to everyone who later
    opens the template. Reproducing from inside the target is what exposed
    the second, as the brief predicted: reading from inside `ai-toolbox` is
    the reading that produced the false claim.
  - `docs/development/authoring-guide.md` line 42 does **not** repeat the
    claim; it describes ai-toolbox's own templates and is true there.
- Validation:
  - `git diff --stat -- skills/*/schemas/` → empty
  - `tests/validate.sh` → `validate.sh: OK`
  - `scripts/sync-registry.sh` → no diff (the registry carries no skill version)
- Result: **done.** `B-041` closed; `B-051` raised.
- Commit: recorded in the follow-up record commit
- Push: recorded in the follow-up record commit
