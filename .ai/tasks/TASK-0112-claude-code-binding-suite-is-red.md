# TASK-0112 — The Claude Code binding's own consistency check fails, and no gate noticed

## Objective

Repair `skills/unattended-ops/templates/bindings/claude-code/binding.md` so
`check-binding.sh` accepts it again, and decide what — if anything — brings the
two binding suites under a gate. The suite is **red on `master` today**, has
been since `98ce299` (`TASK-0103`, 2026-09-25), and `tests/validate.sh` exits
`OK` throughout. This was found on 2026-09-27 while scoping the never-run-live
work (`TASK-0113`); it blocks that task, because exercising a binding whose own
checker rejects it would measure the wrong thing. Discharges no backlog item —
it raises one.

## Minimal context

**The failure, reproduced verbatim on 2026-09-27:**

```
$ cd skills/unattended-ops/templates/bindings/claude-code
$ node --test tests/unattended-run.test.mjs
# tests 25 / # pass 24 / # fail 1

not ok 25 - check-binding.sh accepts a filled binding.md and rejects the template
    BINDING NOT ACCEPTED: /tmp/cc-binding-KkC7gb/binding.md
      UNCITED RULE: line 126: '**Two things are cross-checked by a second agent
      because the script cannot run git**: t...' states a rule ('must') and cites
      nothing (a binding cites the loop, the skill, an ADR or AGENTS.md; it
      states no rule of its own)
```

**The cause is a two-line edit, and the checker is not at fault.**
`skills/unattended-ops/scripts/check-binding.sh` has **one commit in its entire
history** (`c677f43`) and has not moved since. `binding.md`'s last commit is
`98ce299`, `TASK-0103`, closing `B-032`. Its diff:

```
-preflight role) and a park's clean tree (the park-steward's reported
+preflight role — including the commit's file list, every entry of which must
+be a declared path or the run halts, `TASK-0103`) and a park's clean tree (…
```

That inserted a `must` into a paragraph that previously had none, and cited
`TASK-0103`. `check-binding.sh:519` defines what counts as a citation:

```python
CITE = re.compile(r"(?:ADR-\d{4}|AGENTS\.md|loops/[a-z0-9-]+|"
                  r"skills/[a-z0-9-]+|agents/[a-z0-9-]+|"
                  r"references/[a-z0-9-]+\.md|templates/[a-z0-9-]+\.md|"
                  r"\brule [1-5]\b)", re.I)
```

`TASK-\d{4}` is **not** in it, and its absence looks deliberate rather than
accidental: the checker's own message says a binding "cites the loop, the
skill, an ADR or `AGENTS.md`; it states no rule of its own". A task brief is a
record of one unit of work, not a source of standing authority, so citing one
is exactly the move the rule exists to reject. **That reading has to be
confirmed against the skill before it is acted on** — if it is right, the fix
is to cite the real authority and `CITE` is left alone; if it is wrong, `CITE`
gains a form and the reason goes in the skill.

**Why nothing caught it.** `tests/validate.sh` does not run either binding
suite — confirmed by grep for `node --test` and `.test.mjs`, which return
nothing, and by the gate exiting `OK` with the suite red. This is **stated
doctrine, not an oversight**: `docs/development/authoring-guide.md:111` says
"Nothing in this repository runs it automatically — 'tests required' is a
convention here, not a gate." What is new is the **evidence of what that
costs**: a binding shipped, reviewed and sprint-closed with its own consistency
check failing, undetected for two days across three subsequent commits.

**This is the repo's most-repeated lesson in a new place.** `TASK-0106` found a
staleness check written with `git diff` that could not fail on an untracked
file. `ADR-0009` states that a gate which quietly does nothing is worse than no
gate, because it is still trusted. Here the check is real and does fail — it is
simply never invoked by anything that runs.

**A second, smaller thing the same diff did:** the replacement line runs to 98
characters where the file's prose wraps near 76. Cosmetic, fixed in passing,
not a reason for this task to exist.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/unattended-ops/templates/bindings/claude-code/binding.md` | TASK-0087, amended TASK-0089 and TASK-0103 | 167 lines; line 126 states `must` and cites `TASK-0103`; rejected by `check-binding.sh` |
| `skills/unattended-ops/scripts/check-binding.sh` | TASK-0102 (`c677f43`) | Unchanged since creation; `CITE` at line 519, `MODAL` at 517 |
| `skills/unattended-ops/templates/bindings/claude-code/tests/unattended-run.test.mjs` | TASK-0087, extended by TASK-0103 | 25 tests; 24 pass, test 25 fails |
| `skills/unattended-ops/SKILL.md` | TASK-0102 | Carries the "a binding states no rule of its own" doctrine this fix must be checked against |
| `.ai/tasks/TASK-0103-claude-code-commit-paths-check.md` | TASK-0103 | `done`, commit `98ce299`; records `B-032` closed |
| `skills/unattended-ops/templates/bindings/opencode/tests/` | TASK-0086, extended through TASK-0100 | **Green** — `39 passed, 13 subtests` via `uv run --with pytest`, confirmed 2026-09-27. Only the Claude Code suite is red |
| `docs/development/authoring-guide.md` | pre-existing | Line 111 states component tests are a convention, not a gate |
| `tests/validate.sh` | pre-existing | Exits `OK` on the current tree — confirmed 2026-09-27 with the suite red |
| `node` | pre-existing | `v22.23.2`. Pass the test **file**, not the directory: `node --test tests/` fails `MODULE_NOT_FOUND` (already recorded in `TASK-0087`) |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

One prose repair, one decision about gating, and whatever the decision implies.

### Included

- Confirm the diagnosis by reverting the `98ce299` hunk in a scratch copy and
  observing test 25 pass — the defect must be proved before it is fixed.
- Repair `binding.md` line 126 so `check-binding.sh` accepts it, **without
  losing the rule `TASK-0103` added**. The commit-file-list check is real
  behaviour and its statement must survive the edit.
- Re-wrap the paragraph to the file's prose width.
- Decide and record whether `CITE` is correct to exclude `TASK-\d{4}`, and
  state the answer wherever the skill already explains what a binding may cite.
- Run **both** binding suites and record both results.
- Raise a backlog item for the gating gap, with the evidence above.

### Not included

- **No change to `unattended-run.js`.** The defect is in prose; the behaviour
  `TASK-0103` shipped is not in question and its 24 passing tests cover it.
- **No widening of `CITE` unless the skill says a task brief is a legitimate
  citation.** Widening a checker to accept the thing that broke it is how a
  gate stops meaning anything — `ADR-0009`'s argument, applied here.
- **Not wiring the suites into `tests/validate.sh` in this task.** The gate is
  documented as fast, offline and hermetic, and `node`/`pytest` availability is
  not guaranteed on a fresh clone; changing what the gate requires is a
  decision with its own consequences and belongs in an ADR, not in a bug fix.
  This task raises it and stops.
- **Nothing about the OpenCode binding's content**, beyond running its suite and
  recording whether it is green.

## Likely files

- `skills/unattended-ops/templates/bindings/claude-code/binding.md` — the fix
- `skills/unattended-ops/SKILL.md` — possibly, if the citation rule needs stating
- `.ai/planning/BACKLOG.md` — a new item for the gating gap
- `.ai/tasks/TASK-0112-claude-code-binding-suite-is-red.md` — this file
- `.ai/context/CURRENT_STATE.md` — a dated section

`check-binding.sh` and the `.test.mjs` suite are expected **not** to change. If
either does, the diagnosis was wrong and that belongs in Outputs / handover.

## Execution plan

1. Reproduce: run the suite, paste the failure. Record `git rev-parse HEAD`.
2. Prove the cause rather than infer it — in a scratch copy, revert only the
   `98ce299` hunk and re-run. Test 25 must pass. If it does not, stop; the
   diagnosis is wrong and the rest of this plan is built on it.
3. Read `skills/unattended-ops/SKILL.md` on what a binding may cite, and settle
   whether `TASK-\d{4}`'s absence from `CITE` is intended. Write the answer down
   before editing anything.
4. Rewrite the paragraph: keep the file-list rule, cite an authority `CITE`
   accepts, re-wrap to the file's width.
5. Re-run the Claude Code suite: 25/25.
6. Run the OpenCode suite and record its result, green or not.
7. Run `tests/validate.sh`, and confirm it still exits `OK` — it did so with the
   suite red, so a pass here proves nothing about the fix and is recorded as
   the control it is.
8. Raise the gating item in `.ai/planning/BACKLOG.md`, citing this task's dates
   and the three commits that landed while the suite was red.
9. Update `CURRENT_STATE.md`.

## Acceptance criteria

- [x] `node --test tests/unattended-run.test.mjs` in the Claude Code binding
      directory reports 25 tests, 25 pass, 0 fail — output pasted in.
- [x] Step 2's revert experiment is recorded, showing test 25 passing without
      the `98ce299` hunk. The defect is proved, not asserted.
- [x] `binding.md` still states that every entry of the commit's file list must
      be a declared path or the run halts — quote the new sentence in the log.
- [x] The citation-form question has a written answer, in this file and, if the
      answer is that the exclusion is intended, in `skills/unattended-ops/SKILL.md`.
- [x] The OpenCode suite's result is recorded, whatever it is.
- [x] `tests/validate.sh` exits 0, recorded as a control rather than as evidence.
- [x] A backlog item exists for the ungated suites, naming the two-day window.
- [x] `check-binding.sh` is byte-identical to its pre-task state, unless step 3
      concluded otherwise and said why.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed)
- [x] `node --test skills/unattended-ops/templates/bindings/claude-code/tests/unattended-run.test.mjs`
- [x] The OpenCode binding's pytest suite

## Risks and rollback

- **Fixing the symptom by widening the checker.** The cheapest edit is to add
  `TASK-\d{4}` to `CITE`, and it would be wrong if the exclusion is deliberate —
  it would retire a real rule to make one sentence pass. Mitigated by step 3
  happening before step 4, and by the last acceptance criterion.
- **Losing `TASK-0103`'s rule while re-wording.** The whole paragraph is being
  rewritten to satisfy a linter, which is exactly when a rule quietly
  evaporates. Mitigated by a criterion that requires the new sentence quoted.
- **Treating `validate.sh: OK` as proof.** It exited `OK` with the suite red;
  that is the finding. Step 7 records it as a control.
- **The OpenCode suite turns out to be red too**, widening the task. Measured
  green on 2026-09-27 (`39 passed`), so this is a re-check rather than an
  open question — but it runs in ~2m20s and pulls `pytest` through `uv`, so
  budget for that. If it is red at execution time, record it and **raise
  it**; do not fix both bindings in one commit.
- **Rollback:** `git revert` of a single documentation commit. No behaviour
  changes, no migration, nothing deployed.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `skills/unattended-ops/templates/bindings/claude-code/binding.md` | Line 126's paragraph cites `loops/unattended-run/loop.md` step 10 instead of `TASK-0103`; the file-list rule is unchanged in substance and re-wrapped to the file's prose width. Accepted by `check-binding.sh`. **Nothing else in the file touched** |
| `skills/unattended-ops/scripts/check-binding.sh` | **Unchanged, deliberately.** `CITE`'s exclusion of `TASK-\d{4}` was confirmed intended, so the binding was fixed rather than the checker widened |
| `skills/unattended-ops/SKILL.md` | **Unchanged.** The plan allowed for stating the citation rule here; it turned out to be stated already, in `templates/binding.md` ("What a binding is") and `ADR-0022` clause 1.4. Adding a third statement would have created the second owner the rule exists to prevent |
| `skills/unattended-ops/templates/bindings/claude-code/tests/unattended-run.test.mjs` | **Unchanged.** 25 tests, 25 pass |
| `.ai/planning/BACKLOG.md` | `B-037` added: neither binding's suite is run by anything. `ready`, unbuilt, with the ADR-level decision it needs spelled out |
| `.ai/context/CURRENT_STATE.md` | New dated section; header date 2026-09-26 → 2026-09-27 |

**Deviation from the plan, and it shortened the task.** Step 3 asked whether
`CITE`'s exclusion of task ids was intended and said the answer might need
writing into `SKILL.md`. It was intended, and it was already written down
twice — `templates/binding.md`'s "What a binding is" enumerates the four
legitimate rule sources, and `ADR-0022` clause 1.4 states the rule. So the
plan's conditional edit was **not** made, on the plan's own logic.

**Next task starts here**: the Claude Code binding is accepted by its own
checker and its suite is 25/25, which is `TASK-0113`'s stated precondition.
`B-037` is open and unbuilt. The summary sentence at `BACKLOG.md:45` now has a
**third** error — it already named a closed item and omitted `B-036`, and
`B-037` is now missing from it too; repairing that sentence is `TASK-0118`'s
scope and was deliberately not done here.

## Status

- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-27
- Updated: 2026-09-27

## Execution log

### Attempt 1

- Date: 2026-09-27
- Agent: Claude Opus 5 (1M context), Claude Code
- Actions:
  1. Reproduced at `1496cc8`: `node --test tests/unattended-run.test.mjs` →
     `# tests 25 / # pass 24 / # fail 1`, test 25
     (`check-binding.sh accepts a filled binding.md and rejects the template`).
  2. **Proved the cause rather than inferring it.** Extracted
     `git show 98ce299^:.../binding.md`, applied the test's own `<FILL:…>`
     substitution to both it and the current file, and ran the checker on each:

     ```
     PRE-98ce299 binding.md -> exit 0
       BINDING OK: … (20 slots answered, all 14 loop steps declared, no uncited rule)
     CURRENT     binding.md -> exit 1
       UNCITED RULE: line 126: … states a rule ('must') and cites nothing
     ```
  3. Settled the citation question before editing. `check-binding.sh:519`'s
     `CITE` accepts `ADR-\d{4}`, `AGENTS.md`, `loops/…`, `skills/…`,
     `agents/…`, `references/*.md`, `templates/*.md`, `rule [1-5]`.
     `templates/binding.md` ("A binding … **carries no rule of its own**",
     `ADR-0022` clause 1.2) then enumerates the four sources a binding may
     draw a rule from: the loop, the skill, `agents/`, and the consuming
     repository's `AGENTS.md`. A task brief is not among them, so the
     exclusion is **intended** and widening `CITE` was rejected.
  4. Found the rule's real authority: `loops/unattended-run/loop.md` step 10 —
     "re-check `git status --porcelain` against the paths this task declared
     and **refuse on anything unexpected**". Rewrote the paragraph to cite it,
     kept the rule, re-wrapped to 52–77 columns. The rule as it now reads,
     quoted verbatim:

     > …the closer's commit (`verifyHead()` before and after, from the
     > preflight role — including the commit's file list, **every entry of
     > which must be a declared path or the run halts**, which is
     > `loops/unattended-run/loop.md` step 10's *"refuse on anything
     > unexpected"* applied to the commit rather than to the working tree)…
  5. Ran both suites, `tests/validate.sh`, raised `B-037`, updated
     `CURRENT_STATE.md`.
- Observations:
  - **The checker was right and the binding was wrong**, which is the opposite
    of the cheap fix. Adding `TASK-\d{4}` to `CITE` would have made the suite
    green by retiring the rule that caught a real defect.
  - **`TASK-0103`'s own change was sound**; only its citation was not. The
    behaviour it shipped is covered by the 24 tests that never failed.
  - **The gate is the finding.** Three commits landed on a red suite and
    `tests/validate.sh` exited `OK` at every one of them. It still exits `OK`
    now — recorded as a control, not as evidence the fix worked.
  - `SKILL.md` needed no edit: the rule was already stated twice. Adding a
    third statement would have been the second-owner defect itself.
- Validation:
  - `node --test .../claude-code/tests/unattended-run.test.mjs` →
    `# tests 25 / # pass 25 / # fail 0`
  - OpenCode binding suite → ``39 passed, 13 subtests passed in 138.44s`,
    exit 0 (green before and after this task; it was never implicated)`
  - `tests/validate.sh` → `validate.sh: OK` (control: it also exited `OK`
    while the suite was red)
  - `git diff --check` → no whitespace errors
  - `git diff --stat` → 4 files, +38 −3; `check-binding.sh` and the test file
    byte-identical to their pre-task state
- Result: done. Suite 25/25; `check-binding.sh` accepts the binding; `B-037`
  raised for the gating gap; `TASK-0113` unblocked.
- Commit: `0b6ec40` (briefs landed separately as `1496cc8`)
- Push: confirmed — `1ceb6fa..0b6ec40  master -> master` to
  `origin` (`armandomartires/ai-toolbox`); `git remote -v` verified
  token-free afterwards, and `master...origin/master` reports in sync
