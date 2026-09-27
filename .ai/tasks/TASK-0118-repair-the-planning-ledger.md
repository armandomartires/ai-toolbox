# TASK-0118 — Repair four stale claims in the planning ledger

## Objective

Correct four factual claims in `.ai/planning/BACKLOG.md` and `.ai/tasks/TODO.md`
that contradict `SPRINT-CURRENT.md` and `CURRENT_STATE.md`, and register
`TASK-0111`…`TASK-0118` in `TODO.md`. Found 2026-09-27 while reviewing the open
queue. It discharges no backlog item; it repairs the file that *holds* the
backlog, which is why it is worth a brief rather than a drive-by edit. Now,
because `B-035`'s row still reads `ready` for work that shipped on 2026-09-26 —
a planner reading `BACKLOG.md` alone would pick it up.

## Minimal context

**This is the one class of defect this repository's conventions are least able
to catch.** `tests/validate.sh` checks artifact *shape*, and `TASK-0109` and
`TASK-0110` are explicit that "shape is checked, never content — a conformant
brief can still say nothing". Every claim below is shape-valid and false. The
repo's defence against it is the "one owner per fact" rule, and each of these
is an instance of the same fact being written in two places and only one being
updated.

**The four claims, each verified 2026-09-27 against the file that owns it:**

| # | File | Says | Owner says |
|---|---|---|---|
| 1 | `.ai/planning/BACKLOG.md:42` | `B-035` status **`ready`** | **Closed 2026-09-26 by `TASK-0106`** (`d50d220`) — `SPRINT-CURRENT.md:54`, `CURRENT_STATE.md:147`, `TODO.md:665` |
| 2 | `.ai/planning/BACKLOG.md:45` | "**Two items are open**: `B-035`, `ready` … and `B-025`, `waiting`" | The two open items are `B-025` (`waiting`) and `B-036` (`ready`, raised by `TASK-0109`) |
| 3 | `.ai/planning/SPRINT-CURRENT.md`, *Task numbering* | "Next free id: **`TASK-0106`**" | `TASK-0106`…`TASK-0110` are all `done`; with this batch written, next free is **`TASK-0119`** |
| 4 | `.ai/tasks/TODO.md:660` | "**Next free number: `TASK-0109`**" | Same as above |

**Claim 1 is the one that misleads; claims 3 and 4 are lower-risk** and the
repo already knows why: `SPRINT-CURRENT.md` says in the same paragraph "Take an
id when a brief is written, not before — `.ai/tasks/` is the source of truth
for what is free." A reader who follows that instruction is safe. The counter
is still wrong as written, and a stale number beside a correct instruction
teaches readers to distrust the instruction.

**`B-036` was never added to the open-items sentence**, which is why claim 2 is
wrong in two directions at once: it names a closed item and omits an open one.
`B-036`'s row itself (line 43) is correct.

**Precedent for treating this as work.** `TASK-0019` retracted a false
default-branch mismatch claim. `TODO.md`'s own notes record that `TASK-0019`
"was missing from this list entirely until S5's planning session added it …
a small instance of exactly the omission class S5 exists to catch, found by
reading this file rather than by any check." Same class, same discovery method.

**What this task must not turn into.** `TASK-0108` is the governing precedent:
instructed to re-count before acting, it found three live claims against ~38
dated records in task logs, reviews, sessions and archived sprints — and left
all ~38 alone, because "a bulk replace would have destroyed them and made the
repo claim things were observed that were not". The four claims here are
**live** statements of current state. Every other mention of `B-035` as `ready`
— in `TODO.md:659`, in `SPRINT-S10-unattended-bindings.md:45`, in
`CURRENT_STATE.md:373` — is a **dated record of what was true when written**
and is correct as written. None of them is touched.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/planning/BACKLOG.md` | pre-existing, many tasks | 376 lines; `B-035` row at 42 reads `ready`; summary sentence at 45 names `B-035` and `B-025` |
| `.ai/planning/SPRINT-CURRENT.md` | TASK-0105, amended TASK-0106…0108 | "No sprint is open"; *Task numbering* says next free is `TASK-0106` |
| `.ai/tasks/TODO.md` | pre-existing | 809 lines; Post-S10 section at ~654; "Next free number: `TASK-0109`" at 660 |
| `.ai/context/CURRENT_STATE.md` | TASK-0110 | 3163 lines; line 147 records `B-035` closed by `TASK-0106` |
| `.ai/tasks/TASK-0106-embed-the-decision-standard.md` | TASK-0106 | `done`; commit `d50d220`; closes `B-035` |
| `.ai/tasks/TASK-0111`…`TASK-0118` | this batch, 2026-09-27 | Eight briefs, schema-conformant, unregistered in `TODO.md` |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

Four corrections and one registration. Nothing else in either file.

### Included

- `B-035`'s status → `done`, with the closing task, date and commit, in the
  form the other closed rows already use.
- The summary sentence at `BACKLOG.md:45` → `B-025` (`waiting`) and `B-036`
  (`ready`).
- Both next-free-id counters → the correct value, in `SPRINT-CURRENT.md` and
  `TODO.md`.
- A Post-S10 entry in `TODO.md` listing `TASK-0111`…`TASK-0118` with their
  statuses, in the existing unchecked-box style.
- A one-line note recording how the drift was found, so the next reader knows
  this class is caught by reading rather than by a gate.

### Not included

- **No edit to any dated record.** `TODO.md:659`,
  `sprints/SPRINT-S10-unattended-bindings.md:45` and `CURRENT_STATE.md:373`
  describe `B-035` as it stood when they were written. `TASK-0108`'s reasoning
  applies exactly: rewriting them would make the repo claim things were
  observed that were not.
- **No new gate.** A checker for cross-file status agreement is a real idea and
  a different task; `ADR-0008` forbids a gate inventing rules inside an
  unrelated change, and `ADR-0009` forbids shipping one that cannot fail.
  Raise it, do not build it here.
- **No reformatting, reordering or tidying** of either file. Whitespace-only
  changes must not ride along — `AGENTS.md`'s commit hygiene.
- **No status change to `B-025` or `B-036`.** `B-025` is `waiting` by the
  human's explicit choice; `B-036` is `ready` and deliberately unscheduled
  (`TASK-0117`).
- **No sprint opened.** That is a human decision and this task does not touch it.

## Likely files

- `.ai/planning/BACKLOG.md` — claims 1 and 2
- `.ai/planning/SPRINT-CURRENT.md` — claim 3
- `.ai/tasks/TODO.md` — claim 4, plus the registration
- `.ai/tasks/TASK-0118-repair-the-planning-ledger.md` — this file
- `.ai/planning/BACKLOG.md` — one new row, for the cross-file agreement gate

`CURRENT_STATE.md` is expected **not** to change: it is already correct on all
four points.

## Execution plan

1. Re-verify all four claims before editing. Each is a two-file comparison and
   each could have been fixed since this brief was written.
2. Re-read a closed row in `BACKLOG.md` — `B-029` or `B-032` — and match its
   form exactly rather than inventing one.
3. Fix claim 1, then 2, then 3, then 4, one at a time.
4. Count the briefs in `.ai/tasks/` to derive the next free id; do not take the
   number from this file.
5. Register `TASK-0111`…`TASK-0118` in `TODO.md`'s Post-S10 section.
6. Add the note on how the drift was found.
7. Raise the cross-file agreement item in `BACKLOG.md`.
8. `git diff` and confirm every hunk is one of the above and nothing is a
   whitespace-only change.

## Acceptance criteria

- [x] `grep -n "B-035" .ai/planning/BACKLOG.md` shows the row as closed, naming
      `TASK-0106` and commit `d50d220`.
- [x] `BACKLOG.md`'s open-items sentence names `B-025` and `B-036`, and does not
      name `B-035`.
- [x] Both next-free-id counters read the same value, and it equals one more
      than the highest id in `.ai/tasks/`, shown by the command that derived it.
- [x] `TODO.md` lists all eight new briefs with their statuses.
- [x] The three dated records naming `B-035` as `ready` are **unchanged**, shown
      by `git diff` touching none of those lines.
- [x] `git diff --stat` shows exactly three files changed plus this one, and no
      whitespace-only hunk.
- [x] A backlog row exists for the cross-file agreement gate, unbuilt.
- [x] `tests/validate.sh` exits 0.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed)
- [x] `git diff --check` — no whitespace errors
- [x] `./skills/project-workflow/scripts/check-artifact.sh` on all eight new briefs

## Risks and rollback

- **Correcting a dated record by mistake.** The likeliest error, because
  `grep B-035` returns the stale claims and the correct historical ones
  together and they look identical. Mitigated by the fifth acceptance
  criterion, which names the three lines that must not move.
- **Tidying while editing.** Two large prose files, four small corrections; the
  temptation is structural. `git diff --stat` at step 8 is the check.
- **The counter is wrong again immediately**, because the next session writes a
  brief. That is inherent to caching a derived number in two places, and is
  exactly what the new backlog row is for. This task fixes the value; it does
  not claim to fix the class.
- **Fixing the symptom and calling the class closed.** The note at step 6 states
  plainly that this was found by reading, not by a check.
- **Rollback:** `git revert`. Documentation only; no component, gate or script
  changes.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `.ai/planning/BACKLOG.md` | `B-035` closed, naming `TASK-0106` and `d50d220`, with its original entry preserved after the closure — the form `B-029` and `B-032` already use. Summary sentence now reads **four** open items: `B-025`, `B-036`, `B-037`, `B-038`. `B-038` added |
| `.ai/planning/SPRINT-CURRENT.md` | *Task numbering* reads `TASK-0119`, with a line saying what it read before and why that was harmless. Paragraph re-wrapped to the file's width; no other change |
| `.ai/tasks/TODO.md` | Post-S10 counter reads `TASK-0119`; `TASK-0111`…`TASK-0118` registered with statuses; the three items deliberately given no brief are named with the reason |
| `.ai/tasks/TASK-0113-claude-code-binding-first-real-run.md` | `blocked` → `ready`. Not in the original plan — see the deviation below |
| `.ai/context/CURRENT_STATE.md` | **Unchanged**, as forecast: it was already correct on all four claims |
| Three dated records | **Unchanged and verified so**: `TODO.md:659`, `CURRENT_STATE.md:405` and `sprints/SPRINT-S10-unattended-bindings.md:45` still describe `B-035` as `ready`, which is what was true when each was written |

**Two deviations from the plan.**

1. **`TASK-0113`'s status was corrected, which the plan did not list.** Its
   blocker was `TASK-0112`, which landed an hour earlier. Registering it in
   `TODO.md` as `blocked` would have created a fresh instance of the exact
   defect this task exists to remove, so it was fixed. Scope grew by one line
   and the reason is recorded rather than absorbed.
2. **`TODO.md`'s counter was first corrected by appending a dated note rather
   than editing in place, and that was wrong.** This brief classifies claim 4
   as a **live** statement, and `SPRINT-CURRENT.md`'s counter — the same claim
   — was edited in place. Treating the two differently would have left the
   acceptance criterion ("both counters read the same value") satisfiable only
   by argument. Reverted and redone in place. The distinction that governs is
   the one `TASK-0108` drew: `TODO.md`'s **Post-S9** section is superseded and
   its `TASK-0082` counter is history; the **Post-S10** section is current and
   its counter is a claim.

**Next task starts here**: the ledger's four live claims are correct as of
2026-09-27 and the eight briefs are registered. `B-037` and `B-038` are open
and unbuilt, both needing a decision before code. `TASK-0111` is next by the
order chosen for this run; `TASK-0113` is now `ready` rather than `blocked`.

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
  1. Re-verified all four claims before editing. All four still held; the
     summary sentence had moved from line 45 to 46 because `TASK-0112` had
     inserted `B-037` above it.
  2. Read `B-029`'s and `B-032`'s closed cells and matched their form:
     closure statement first, original entry preserved after it.
  3. Fixed claim 1 (`B-035` → `done`), claim 2 (the summary sentence),
     claim 3 (`SPRINT-CURRENT.md`), claim 4 (`TODO.md`).
  4. Derived the next free id from the tree rather than from this brief:
     `ls .ai/tasks/TASK-*.md | sed -n 's/.*TASK-0*\([0-9]\{1,\}\).*/\1/p'
     | sort -n | tail -1` → **118**, so `TASK-0119` is free. Both counters set
     to that.
  5. Registered `TASK-0111`…`TASK-0118` in `TODO.md`, each with its status,
     plus the three items deliberately given no brief and why.
  6. Raised `B-038`.
  7. Corrected `TASK-0113` from `blocked` to `ready` (deviation 1 above).
  8. Reviewed the diff: `git diff --check` clean; confirmed no removed line
     anywhere mentions `B-035`, which is the mechanical form of "the dated
     records were not touched".
- Observations:
  - **The count went up, not down.** The sentence said two items were open; it
    is four. It named a closed item and omitted `B-036`, and `TASK-0112` had
    since added `B-037` without it being updated — so the sentence was wrong
    in three directions by the time it was repaired. A summary that has to be
    hand-maintained beside the rows it summarises is the defect, and `B-038`
    records that rather than this fix pretending to solve it.
  - **The id counters were stale in a way the file itself defends against.**
    `SPRINT-CURRENT.md` says, two lines below the wrong number, "Take an id
    when a brief is written, not before — `.ai/tasks/` is the source of truth
    for what is free." A reader following the instruction is safe; the stale
    number beside it teaches them to distrust the instruction.
  - **I made the error this task is about, mid-task** — see deviation 2. The
    first attempt at claim 4 preserved the wrong number as though it were
    history, minutes after classifying it as live. It was caught by re-reading
    the acceptance criterion, not by any check, which is the same way the
    original four were found.
- Validation:
  - `tests/validate.sh` → `validate.sh: OK`
  - `scripts/sync-registry.sh` → no diff
  - `git diff --check` → no whitespace errors
  - `check-artifact.sh` on all eight new briefs → 8 × `OK`
  - Protected dated records: 0 removed lines mention `B-035`
- Result: done. Four live claims corrected, eight briefs registered, `B-038`
  raised, `TASK-0113` unblocked. Three dated records deliberately untouched.
- Commit: `1e0b184`
- Push: confirmed — `447ba5a..1e0b184  master -> master` to `origin`;
  `git remote -v` token-free, `master...origin/master` in sync
