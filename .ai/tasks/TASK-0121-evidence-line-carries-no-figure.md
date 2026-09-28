# TASK-0121 — The evidence line carries no figure, so the closer cannot copy one

## Objective

Close `B-043`. `loops/unattended-run/loop.md` step 10 orders the closer to
update a task's acceptance criteria *"copying **every figure from the evidence
file**"*, and `references/evidence.md` makes the evidence file the **only**
admissible source for a figure. The evidence file contains no figure and
structurally cannot: its entry point emits exactly one line per gate, with no
figure slot, for any gate, ever. The instruction is unsatisfiable as written,
and it is handed to **the only role in the run with git and tracker rights**.

**This is not a Claude Code defect.** The Claude Code binding's
`gate_entry_point` slot is documented in its own `binding.md` as *"path of
`run-gate.sh` (the OpenCode binding's)"* — one shared entry point, so both
bindings carry it identically.

Raised 2026-09-28 by `TASK-0113`, the Claude Code binding's first real run,
which **parked** rather than accept; the adjudicator's stated reason was that
accepting would hand an unsatisfiable instruction to the closer. Rated
high/high in `BACKLOG.md` and the highest-value of that run's three findings.

## Minimal context

**The fact is settled.** It was verified by `TASK-0113`'s adjudicator, again
by hand afterwards, and a third time while writing this brief on 2026-09-28.
What is **not** settled is the scope of the evidence standard, and that is the
decision this task exists to take.

### What the entry point actually emits

`skills/unattended-ops/templates/bindings/opencode/run-gate.sh` is 203 lines.
`summary()` begins at line 65 and ends at line 73 with exactly one format:

```
GATE $handle NAME=$name STATE=$state EXIT=$code ELAPSED=${elapsed}s LOG=$dir/log
```

Line 170 is `summary >> "$EVIDENCE_FILE" || true` — that line and nothing
else. **State, exit code, elapsed time, and a path. No figure slot.**

### What the loop asks for

| Site | Text | Satisfiable? |
|---|---|---|
| `loop.md:194` (step 7, gate-runner) | "the verbatim evidence line, **and any figure** the task's criteria would want, **quoted from the gate's own log**" | **Yes** — it names the *log* as the source |
| `loop.md:234-235` (step 10, closer) | update criteria "copying **every figure from the evidence file**" | **No** — the evidence file has no figures |
| `references/evidence.md`, *What is admissible* | "For each gate: its state, its **exit code**, its **elapsed time**, the verbatim evidence line, **and any figure the task's criteria would want**" | **No** — asserts of the evidence file something its writer never puts there |

The two loop steps **disagree with each other about the source**, and step 7
is the one that matches reality.

### The sharper finding, and it is not in `B-043`'s row

`B-043` describes this as a missing slot. It is worse than that: **the figures
are collected and then discarded.**

Both bindings already carry a `figures` array in the gate-runner's output
schema — `unattended-run.js:200` (`GATE_SCHEMA`, `figures: STRS`) and
`driver.py:529` (`"figures": ["<verbatim>"]`). The Claude Code binding's
gate-runner prompt (`unattended-run.js:258`) even resolves the ambiguity
unilaterally and in the sensible direction, telling the role to quote figures
**"from the gate's log"**.

Then the closer is invoked, in both bindings, as `step10_close(self, task,
impl)` / `step10Close(task, impl)` — **the gate results are not a parameter**.
The closer gets the task file, the implementer's report, the declared paths,
the tracker, and the evidence file *path*. It never sees `figures[]`. So the
role that carefully quoted every figure verbatim hands them to a caller that
drops them, and the role that must write them is pointed at a file that never
had them.

**That reframes the cheapest fix.** The figures already exist, already
verbatim, already captured at the right moment. This may be a **wiring**
defect — the closer is handed the wrong source — rather than a missing
capability in `run-gate.sh`. Route B below is built on that, and it is why
this brief does not simply assume `run-gate.sh` must grow a field.

### Why the standard's scope is genuinely open

`evidence.md`'s exclusion list rejects *"a gate result recovered from a
terminal scrollback, a CI page or **a log the run did not write**"*. The
gate's log **is** written by the run, and the evidence line names it by
`LOG=`. So the log is **not** in the exclusion list — yet the standard's
headline sentence still says the evidence file is *the only* admissible
source. A log the evidence file points at is neither clearly admissible nor
clearly excluded, and no text anywhere resolves it.

This is a question about what the rule is *for*. Its stated purpose is that
**"what is claimed was observed"** — a figure must not enter the chain from a
recollection. A figure quoted from a log the run itself wrote, named by the
evidence line, at the moment the gate ran, satisfies that purpose exactly. A
reading that excludes it protects nothing and makes step 7 dead text.

**A human takes this decision, not an implementer mid-run.** It changes what
"admissible" means for every future run. `ADR-0009`'s lesson applies directly:
the wrong resolution produces a rule that *quietly does nothing* — criteria
silently going unfilled — which is worse than no rule, because it is still
trusted.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/unattended-ops/templates/bindings/opencode/run-gate.sh` | `TASK-0086` | 203 lines; `summary()` at 65-73 emitting one format; line 170 appends it to `$EVIDENCE_FILE`; no figure slot |
| `loops/unattended-run/loop.md` | `TASK-0077` and successors | 388 lines; step 7 at ~194 sourcing figures from the gate's log; step 10 at ~234-235 sourcing them from the evidence file |
| `skills/unattended-ops/references/evidence.md` | S9 | 86 lines; headline "only admissible source"; *What is admissible* asserts the evidence file carries figures; exclusion list rejects "a log the run did not write" |
| `skills/unattended-ops/templates/bindings/opencode/driver.py` | `TASK-0086`, amended `TASK-0096`…`TASK-0102` | `step10_close(self, task, impl)` at ~603 — no gates parameter; gate-runner schema at ~529 carries `figures` |
| `skills/unattended-ops/templates/bindings/claude-code/unattended-run.js` | `TASK-0087`, amended `TASK-0112` | `GATE_SCHEMA` with `figures: STRS` at ~200; gate-runner prompt at ~258 says "from the gate's log"; `step10Close(task, impl)` at ~329; closer prompt at ~335 says "from `${EVIDENCE}`" |
| `skills/unattended-ops/templates/bindings/claude-code/binding.md` | `TASK-0087` | `gate_entry_point` documented as "path of run-gate.sh (the OpenCode binding's)" — the shared-entry-point fact |
| `skills/unattended-ops/templates/bindings/opencode/decision-standard.md` | `TASK-0106`, generated | Concatenation of `verdicts.md` + `evidence.md`; **regenerates from them**, so an `evidence.md` edit must be followed by `scripts/sync-decision-standard.sh` |
| `.ai/tasks/TASK-0113-claude-code-binding-first-real-run.md` | `TASK-0113` | `done`; records the park and the three findings |
| `.ai/planning/BACKLOG.md` | ongoing | `B-043` **ready**, high/high; `B-044`, `B-045` open alongside it |
| `tests/validate.sh` | `TASK-0110` and successors | Exits `OK`; gates the generated `decision-standard.md` against its two sources |
| Binding test suites | `TASK-0112` | `opencode/tests/` — **green**, `39 passed, 13 subtests` via `uv run --with pytest`, confirmed 2026-09-27; `claude-code/tests/unattended-run.test.mjs` — repaired green by `TASK-0112`. **Re-run both before changing anything.** Invoke the node suite by **file**: `node --test tests/` fails `MODULE_NOT_FOUND` (`TASK-0087`) |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. **The route decision is taken and recorded** — see step 0. This is the
   task's substance; the code change is small once it is made.
2. **`loop.md` steps 7 and 10 agree with each other** about where a figure
   comes from, and both agree with what the code does.
3. **`references/evidence.md` states the rule's scope explicitly**, including
   whether a log named by an evidence line is admissible — so the next reader
   does not have to re-derive it from an exclusion list.
4. **The closer can actually obtain the figures it is told to copy**, by
   whichever mechanism the route selects.
5. **`decision-standard.md` regenerated** if `evidence.md` changes, with the
   staleness gate confirming it.
6. **Both bindings stay in agreement.** Whatever the route, the OpenCode and
   Claude Code bindings must end up saying the same thing; today they do not,
   and `unattended-run.js:258` is already ahead of the standard.

### Not included

- **`B-044` (no repo-root parameter) and `B-045` (`--all` matches the stash
  commit).** Separate items with separate rows, both raised by the same run.
  `B-045` in particular is a one-line constraint note and will look tempting;
  bundling it breaks one-task-one-commit.
- **No new gate capability in `run-gate.sh` unless route A is chosen.** Under
  route B nothing about the entry point changes.
- **No change to what any gate measures.** `references/gate-map.md` rule B is
  untouched; this is about transporting a figure, not producing one.
- **No re-running of `TASK-0113`'s pilot.** It parked, it recorded why, and
  its record stands. Re-running it is a separate decision and would not
  validate this change any better than the binding suites do.
- **No relaxation of the evidence rule's purpose.** No route may make a
  *recollected* figure admissible. If a proposed wording would, it is wrong
  regardless of how convenient it is.

## Likely files

A forecast, written before the work.

- `loops/unattended-run/loop.md` — steps 7 and 10 reconciled
- `skills/unattended-ops/references/evidence.md` — scope stated explicitly
- `skills/unattended-ops/templates/bindings/opencode/decision-standard.md` —
  regenerated, never hand-edited
- `skills/unattended-ops/templates/bindings/opencode/driver.py` — closer call
  gains the figures (route B), or unchanged (route C)
- `skills/unattended-ops/templates/bindings/claude-code/unattended-run.js` —
  the same change, kept in step
- `skills/unattended-ops/templates/bindings/opencode/run-gate.sh` — **only**
  under route A
- Binding test suites — a case proving the closer receives a figure
- `.ai/planning/BACKLOG.md` — `B-043` closed with the commit hash
- `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`, this file

**Not expected to change**: `references/gate-map.md`, `references/verdicts.md`,
`agents/*`, any `ADR`. If an ADR turns out to be needed — and route A or a
redefinition of "admissible" may well need one — **stop and write it**, rather
than making a lasting decision inside a task file.

## Execution plan

**Step 0 — take the route decision. This is the task, and it is the human's.**

| Route | Mechanism | Cost / consequence |
|---|---|---|
| **A** | `run-gate.sh` grows a figure slot: gates declare what to extract, the entry point writes it into the evidence line | The evidence file becomes literally sufficient and the headline rule needs no reinterpretation. **But** it puts extraction logic in the entry point, which must then know each gate's output format — close to what `gate-map.md` rule B warns about, and a new per-gate configuration surface. Almost certainly needs an ADR |
| **B** *(recommended)* | The closer is handed the gate-runner's `figures[]`, which is already collected verbatim. `evidence.md` says explicitly that a log named by an evidence line's `LOG=` is admissible when quoted verbatim at run time | Smallest change; uses data that already exists and is already verbatim. Makes step 7 and step 10 agree, and ratifies what `unattended-run.js:258` already does. Requires the standard's scope to be **stated**, which is the part needing human sign-off |
| **C** | Weaken step 10: the closer copies only the fields the evidence line carries; a criterion wanting anything else becomes an unevidenced criterion, which the refuter reports and which parks the task | Ships almost no code and is the most conservative reading. **But** it means any task whose criteria cite a figure can never close unattended — which is most real tasks, and would make the loop far less useful than it looks |

**Recommendation: B.** The figures are already captured verbatim at the right
moment and then thrown away; that is a wiring defect with a small fix. It is
also the only route that makes step 7 meaningful rather than dead text. A
carries real risk of putting format knowledge in the entry point; C is honest
but quietly guts the loop's usefulness, and "quietly" is the word that should
stop it.

**Record the choice and the date in the Execution log before step 1.** If the
human picks A or C, re-cost steps 2-6 — they are written for B.

**Steps (route B; renumber if the route changes):**

1. **Re-verify every Inputs row**, line numbers included. This brief cites
   them from a reading on 2026-09-28 and nothing pins them.
2. **Re-run both binding suites before touching anything**, and record the
   counts. `TASK-0112` found this repo shipping a red suite once already; a
   change made on top of an unknown baseline cannot be attributed.
3. **Write the scope sentence in `evidence.md` first**, before any code. It is
   the thing being decided; the code follows from it. State explicitly that a
   log is admissible **only** when named by its gate's evidence line, quoted
   verbatim, and written by this run — and that a recollection, a paraphrase
   and a rounded figure stay inadmissible however they were obtained.
4. **Regenerate `decision-standard.md`** with `scripts/sync-decision-standard.sh`
   and confirm `tests/validate.sh` gates it. Never hand-edit it.
5. **Reconcile `loop.md` steps 7 and 10** to that sentence, and check the
   whole file for any third site — `grep -n figure loop.md` returns six hits
   today and only two are these.
6. **Wire the figures through in both bindings**, in the same commit, so they
   cannot drift: pass the gate results into the closer call and change the
   closer's prompt to name them as the source.
7. **Prove the closer receives a figure**, with a test that **fails when the
   wiring is reverted**. Stash the change, run the new test, confirm it fails
   for the right reason, restore. Definition of Done clause 2.
8. **Check the other roles' prompts for the same assumption** — the refuter
   checks criteria "against evidence in the diff or the evidence file", which
   inherits this ambiguity and may need the same sentence.
9. **Run `tests/validate.sh`, both binding suites, and
   `scripts/sync-registry.sh`.** Record counts before and after.
10. **Close `B-043`** with the commit hash; update `CURRENT_STATE.md`, tick
    `TODO.md`, fill Outputs / handover and the Execution log. If `B-045`'s
    constraint became relevant while editing step 12's resume guard, **note it
    in `B-045`'s row rather than fixing it here**.

## Acceptance criteria

- [ ] The route chosen in step 0 is named and dated in the Execution log, with
      its reason, and the two rejected routes are recorded as rejected.
- [ ] `references/evidence.md` states, in one findable place, whether a gate's
      log is an admissible source and under exactly what conditions.
- [ ] `loop.md` steps 7 and 10 name the **same** source for a figure, quoted
      in the Execution log side by side.
- [ ] `grep -n figure loops/unattended-run/loop.md` shows no remaining site
      that contradicts the chosen rule.
- [ ] The closer can obtain a figure it is asked to copy, demonstrated by a
      test, not by reading the code.
- [ ] That test is **observed failing** with the wiring reverted, and the
      failure output is pasted in.
- [ ] Both binding suites pass, with counts recorded before and after.
- [ ] `decision-standard.md` is regenerated, not hand-edited, and
      `tests/validate.sh` passes its staleness check.
- [ ] Both bindings say the same thing about where a figure comes from;
      `unattended-run.js`'s prompt no longer leads the standard.
- [ ] No change to `run-gate.sh` (route B), or an ADR exists (route A).
- [ ] `B-043` closed in `BACKLOG.md` with the commit hash, and the open-items
      sentence recounted from the rows rather than adjusted by one.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed)
- [ ] OpenCode suite, from that binding's directory:
      `uv run --with pytest python -m pytest tests/` — before and after,
      counts recorded (`39 passed, 13 subtests` as of `TASK-0112`)
- [ ] Claude Code suite: `node --test tests/unattended-run.test.mjs` — the
      **file**, never the directory. `node --test tests/` fails
      `MODULE_NOT_FOUND`, recorded in `TASK-0087` and again in `TASK-0112`
- [ ] The new closer-receives-a-figure test, **run against the reverted
      wiring** and observed failing
- [ ] `scripts/sync-decision-standard.sh` followed by `tests/validate.sh`, if
      `evidence.md` changed

## Risks and rollback

- **Redefining "admissible" too broadly.** The failure mode is a rule that
  still reads strict and now permits a recollection. Mitigation: the scope
  sentence is written **first** (step 3) and names the conditions —
  named by the evidence line, verbatim, written by this run — rather than
  saying "logs are fine".
- **A rule that quietly does nothing.** Route C's real risk: criteria go
  unfilled, every task parks, and the loop looks strict while delivering
  nothing. `ADR-0009`. If C is chosen, that consequence must be stated in the
  ADR, not discovered on the next run.
- **The two bindings drift apart.** They already have —
  `unattended-run.js:258` says "from the gate's log" while the standard says
  otherwise. Mitigation: both change in the same commit, and a criterion above
  requires it.
- **Hand-editing `decision-standard.md`.** It is generated and gated; editing
  it makes `evidence.md` a non-owner and `validate.sh` will fail. Named here
  because it is the obvious shortcut when only one sentence changed.
- **Fixing `B-044`/`B-045` while in the neighbourhood.** Both are open, both
  are cheap, both touch these files. Bundling them breaks one-task-one-commit
  and makes the change unattributable.
- **Testing against a stub and calling it proven.** `REVIEW-0012` finding 3,
  and `TASK-0113` is the evidence: the pilot found in one real run what stubs
  had not in a sprint. A passing binding suite here is necessary and **not**
  sufficient; say so in Outputs rather than implying coverage this cannot have.
- **Rollback:** `git revert` of the single commit, then
  `scripts/sync-decision-standard.sh` to restore the generated file. No
  artifact is produced by this change and no history is rewritten.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          | what it now contains, plus anything deliberately *not* changed |

**Next task starts here**: one line naming the state the next task picks
up from — not a prediction of what that task will be. Record any
deviation from the Plan here too: the next task may have been scoped
against the original.

## Status

- Status: ready   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-28
- Updated: 2026-09-28

`ready`, not `blocked`: the route decision in step 0 is costed with a
recommendation, which is the same shape `TASK-0119` carried and discharged.
It differs from `TASK-0120`'s block in that **no route here ships nothing** —
every one of A, B and C is a real change, so an agent can start on the
recommendation and a human can overrule it at step 0 without work being
wasted. A human who wants the decision made before any code is written should
answer step 0 first; that is a preference, not a precondition.

No sprint is open; scheduling is the human's, as with `TASK-0111`…`TASK-0120`.

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
