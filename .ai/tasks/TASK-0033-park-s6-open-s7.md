# TASK-0033 — Park sprint S6, open sprint S7, and repair two roadmap omissions

## Objective
Open sprint S7 from `PLAN-0004` without closing or abandoning S6, and fix
two omissions found while planning:

1. `ROADMAP.md` has **no Phase 6 section at all**.
2. The 2026-09-14 S6 planning session has **no `SESSION-*.md` record and no
   `INDEX.md` row**.

This is a sprint state change, not a lasting decision, so it gets no ADR.

## Minimal context

### Why S6 is parked rather than finished or absorbed
Human decision, 2026-09-15, recorded in `PLAN-0004`'s "Human decisions
required" table. S6 had **zero implementation** — ten planning artifacts and
two commits (`9528d13`, `cb0aa96`), no component touched. That makes this
the cheapest possible moment to park it: the archived sprint file is the
plan as written, not a partial execution needing reconciliation.

Parking is deliberately distinct from closing. A closed sprint gets a
`REVIEW-####` checkpoint and its backlog items resolve. A parked sprint
keeps its artifacts `planned`/`proposed` and its items **`ready`** —
parking does not un-scope a backlog item, because the gap it names is still
real.

### Why the roadmap omission is recorded rather than quietly backfilled
REVIEW-0007 found `ROADMAP.md`'s Phase 5 header still reading "in progress"
after completion, and its finding 6 concluded the lesson *"needs a
mechanism, not more prose."* No mechanism was added. One phase later the
roadmap skipped Phase 6 entirely — S6 existed in `SPRINT-CURRENT.md`,
`TODO.md`, `CURRENT_STATE.md` and `PLAN-0003`, but never in the roadmap.

So this is the same defect class recurring immediately after being
diagnosed, which is evidence *for* that finding. Writing the section
silently would destroy that signal. The Phase 6 section therefore states
that it was written one sprint late, and `## Risks` gains an entry noting
that nothing yet prevents a third instance.

### Why the missing session record matters more than it looks
`.ai/sessions/INDEX.md` ends at `SESSION-20260914-0300`. The S6 planning
session produced a plan, ten artifacts, four backlog items, a sprint file
and two commits, and left no session record. ADR-0012's invariant is that a
task must be startable cold from its own file plus **the two index files** —
so a missing index row is a hole in the mechanism the repo relies on for
resumability, not just an untidy log.

### What this task must not do
It must not touch any component. `skills/`, `mcp-servers/`, `loops/`,
`configs/`, `scripts/`, `tests/` and `docs/` stay untouched, so
`sync-registry.sh` must produce **no diff** — the same correctness
condition S6's own opening commit met.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/planning/plans/PLAN-0004-design-and-production-agent-loops.md` | this session | Written; 17 tasks, 3 ADRs, 4 backlog items, 8 findings |
| `.ai/planning/SPRINT-CURRENT.md` | TASK-0026's sprint (S6 opening) | 162 lines, `# Sprint S6 — Ansible agent guardrails`, all 10 artifacts planned/proposed |
| `.ai/planning/sprints/` | pre-existing | Holds S1–S5; **no S6 file** |
| `.ai/planning/ROADMAP.md` | pre-existing | 177 lines; Phases 1–5 complete; **no Phase 6 section**; `## Risks` at `:159` |
| `.ai/planning/BACKLOG.md` | pre-existing | 127 lines; B-001…B-009 done, B-010…B-013 **ready**; next free ID **B-014** |
| `.ai/tasks/TODO.md` | pre-existing | 148 lines; S6 block at `:64-127` with 7 task boxes + 3 ADR boxes unchecked |
| `.ai/sessions/INDEX.md` | pre-existing | Table `\| Session \| Date \| Agent \| Objective \| Tasks \| Result \|`; **ends at `SESSION-20260914-0300`** |
| `.ai/context/CURRENT_STATE.md` | pre-existing | 302 lines, header dated 2026-09-14 "after opening sprint S6" |
| `tests/validate.sh` | pre-existing | 474 lines; passing; requires `TASK-####-*.md` naming and non-empty handover sections for briefs ≥ 0020 |
| Git working tree | pre-existing | Clean at `cb0aa96`; remote `origin` configured, token-free URL |

**Verify the expected state; don't assume it.** In particular re-check the
next free IDs (`TASK-0033`, `ADR-0017`, `B-014`, `PLAN-0004`,
`REVIEW-0008`) by listing the directories rather than trusting this table —
a stale row here is the one failure this convention cannot catch.

## Scope

### Included
- `git mv` `SPRINT-CURRENT.md` → `.ai/planning/sprints/SPRINT-S6-ansible-agent-guardrails.md`,
  prepending a parking note that states the reason, that all ten artifacts
  keep their status, that B-010…B-013 stay `ready`, and the two S7
  connections (the pilot delivers 0029/0030; the `SIGMA-infrastructure`
  read-only constraint still binds).
- Write the S7 `SPRINT-CURRENT.md`.
- Add **Phase 6** and **Phase 7** sections to `ROADMAP.md`, plus three
  `## Risks` entries.
- Add B-014…B-017 to `BACKLOG.md` with per-item notes.
- Write ADR-0017, ADR-0018, ADR-0019 as **proposed** stubs.
- Write the 14 task briefs TASK-0033…0046.
- Rewrite `TODO.md`'s S6 block as parked; add the S7 block.
- Add `SESSION-20260914-0330` (the missing S6 record, reconstructed from
  its commits and artifacts, **labelled as reconstructed**) and
  `SESSION-20260915-*` for this session; add both `INDEX.md` rows.
- Update `CURRENT_STATE.md`.

### Not included
- **Any component change.** No `skills/`, `mcp-servers/`, `loops/`,
  `configs/`, `scripts/`, `tests/` or `docs/` edit. `sync-registry.sh` must
  produce no diff.
- **Executing any S7 task.** This opens the sprint; it does not start it.
  In particular it does not import `agent-tiers`, touch
  `~/.config/opencode/`, or create `agents/_template/`.
- **Accepting any ADR.** 0017 and 0018 are blocked on their spikes; 0019
  awaits human ratification.
- **Closing or resolving anything in S6.** No status changes to
  TASK-0026…0032, ADR-0014…0016, or B-010…B-013.
- Building out `prompts/`. Deliberately out of scope; see B-016.

## Likely files
- `.ai/planning/SPRINT-CURRENT.md` (new S7), and the S6 file moved to
  `.ai/planning/sprints/`
- `.ai/planning/ROADMAP.md`, `.ai/planning/BACKLOG.md`
- `.ai/planning/plans/PLAN-0004-*.md`
- `.ai/decisions/0017-*.md`, `0018-*.md`, `0019-*.md`
- `.ai/tasks/TASK-0033-*.md` … `TASK-0046-*.md` (14 files)
- `.ai/tasks/TODO.md`
- `.ai/sessions/SESSION-20260914-0330-*.md`, `SESSION-20260915-*.md`,
  `.ai/sessions/INDEX.md`
- `.ai/context/CURRENT_STATE.md`

## Execution plan
1. `git status --short`, `git log --oneline -3`, `git remote -v` — confirm
   clean at `cb0aa96` with a token-free remote.
2. List `.ai/tasks/`, `.ai/decisions/`, `.ai/planning/plans/`,
   `.ai/reviews/` to confirm the next free IDs.
3. Write `PLAN-0004`.
4. `git mv` the S6 sprint file; prepend the parking note.
5. Write the S7 `SPRINT-CURRENT.md`.
6. Add ROADMAP Phase 6, Phase 7, and the Risks entries.
7. Add B-014…B-017 and their notes to `BACKLOG.md`.
8. Write the three proposed ADRs.
9. Write the 14 briefs, each with non-empty `## Inputs` and
   `## Outputs / handover`; every unexecuted one labels its outputs as
   **intended**.
10. Rewrite `TODO.md`'s S6 block as parked; add the S7 block.
11. Write both session records and both `INDEX.md` rows.
12. Update `CURRENT_STATE.md`.
13. `bash tests/validate.sh` — expect green. If the handover check fires on
    a new brief, fix the brief rather than the check.
14. `bash scripts/sync-registry.sh` — expect **no diff** to
    `docs/registry.md`. A diff here means a component was touched, which is
    out of scope.
15. `git diff --stat` and read the diff; confirm no component paths and no
    secrets.
16. Commit; record the hash here; push; confirm by `git fetch` +
    `git log origin/master`; record the push result.

## Acceptance criteria
- [ ] `.ai/planning/sprints/SPRINT-S6-ansible-agent-guardrails.md` exists,
      carries the parking note, and preserves the original content unedited
      below it
- [ ] `SPRINT-CURRENT.md` is S7 and names S6 as parked with its archive path
- [ ] `ROADMAP.md` has a Phase 6 section that **records having been written
      one sprint late**, and a Phase 7 section
- [ ] B-014…B-017 in `BACKLOG.md`, and the open-item count updated from
      four to eight with B-010…B-013 still `ready`
- [ ] ADR-0017, 0018, 0019 exist, all **proposed**, each naming what blocks
      it or what it awaits
- [ ] 14 briefs exist, all matching `TASK-####-*.md`, all with non-empty
      `## Inputs` and `## Outputs / handover`
- [ ] Every unexecuted brief labels its outputs as **intended**, not claimed
- [ ] Both session records exist with `INDEX.md` rows; the S6 one is
      labelled **reconstructed**
- [ ] `tests/validate.sh` green
- [ ] `scripts/sync-registry.sh` produces **no diff**
- [ ] No component directory appears in `git diff --name-only`
- [ ] Commit hash and confirmed push recorded in this brief

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — **run it anyway**,
      and the correct result is *no diff*. Running it proves the no-diff
      claim rather than asserting it.

## Risks and rollback
- **Risk: the handover check fires on the new briefs.** Fourteen briefs
  numbered ≥ 0020 each need two non-empty sections with real content — the
  blank template separator row does not count. Expected to be caught by
  step 13; the fix is always the brief, never the check.
- **Risk: a filename that does not match `TASK-####-*.md`.**
  `validate.sh:456-463` reports rather than skips these, deliberately. Any
  new artifact type in `.ai/tasks/` would break the gate.
- **Risk: parking reads as abandoning.** Mitigated by stating the
  distinction in four places — the archived sprint's note, S7's opening,
  `BACKLOG.md`, and the ROADMAP Phase 6 status line — because a future
  reader will find whichever one they open first.
- **Risk: quietly backfilling the roadmap.** Writing Phase 6 as though it
  had always been there would erase evidence for REVIEW-0007's finding 6.
  The section says when it was written and why that matters.
- **Risk: scope creep into executing S7.** Fourteen briefs describe
  appealing work, and `agent-tiers` is sitting right there, drifted. This
  task opens the sprint only.
- **Rollback:** every change is under `.ai/`, in one commit, with no
  component touched. `git revert` restores S6-as-current cleanly. The
  `git mv` reverses with it.

## Outputs / handover

**Written after the work. This task has run** — see the execution log.

| Artifact | End state |
|----------|-----------|
| `.ai/planning/sprints/SPRINT-S6-ansible-agent-guardrails.md` | S6, archived, parking note prepended, original content unedited below it |
| `.ai/planning/SPRINT-CURRENT.md` | Sprint S7, 17 artifacts, 5 plan-time decisions, 4 rejected proposals recorded as out of scope |
| `.ai/planning/ROADMAP.md` | Phase 6 (parked, and recording its own lateness) + Phase 7 (in progress) + 3 new Risks entries |
| `.ai/planning/BACKLOG.md` | B-014…B-017 added with notes; eight items open; B-010…B-013 unchanged and still `ready` |
| `.ai/planning/plans/PLAN-0004-*.md` | The S7 plan: 8 findings, 6 phases, 17 tasks, 3 human decisions |
| `.ai/decisions/0017,0018,0019-*.md` | Three **proposed** ADRs; 0017 and 0018 blocked on spikes, 0019 awaiting ratification |
| `.ai/tasks/TASK-0033…0046` | 14 briefs; 0033 is executed, the other 13 carry explicitly *intended* end states |
| `.ai/tasks/TODO.md` | S6 block marked parked; S7 block added |
| `.ai/sessions/` | Two records added, one reconstructed, both indexed |
| `.ai/context/CURRENT_STATE.md` | Updated for S7 |
| Components | **Untouched.** `sync-registry.sh` produced no diff |

**Next task starts here**: sprint S7 is open with all 17 artifacts written
and none executed. The two Phase-1 spikes (TASK-0034, TASK-0036) are
mutually independent and both unblocked, so either may start cold from its
own brief.

Deviations from the plan, recorded because later briefs were scoped against
the original: **none to the plan's content.** One ordering note — the
briefs were written in phase order rather than numeric order, which is
immaterial to the result. The plan's task count of 17 comprises 14 briefs
and 3 ADRs; the ADRs are not `.ai/tasks/` files, which is why the brief
count is 14.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-15
- Updated: 2026-09-15

## Execution log
### Attempt 1
- Date: 2026-09-15
- Agent: opencode (anthropic/claude-opus-5)
- Actions: Verified clean tree at `cb0aa96` and a token-free `origin`.
  Confirmed next free IDs by listing `.ai/tasks/`, `.ai/decisions/`,
  `.ai/planning/plans/` and `.ai/reviews/`. Wrote `PLAN-0004`. `git mv`'d
  the S6 sprint file to `.ai/planning/sprints/` and prepended its parking
  note. Wrote the S7 `SPRINT-CURRENT.md`. Added ROADMAP Phase 6 and Phase 7
  plus three Risks entries. Added B-014…B-017 with per-item notes. Wrote
  ADR-0017/0018/0019 as proposed stubs. Wrote 14 task briefs. Rewrote
  `TODO.md`'s S6 block as parked and added the S7 block. Wrote two session
  records and their `INDEX.md` rows. Updated `CURRENT_STATE.md`.
- Observations: Recorded in the Outputs table and in `PLAN-0004`'s findings.
  Three worth restating here. **(1)** The roadmap had no Phase 6 at all —
  the same drift REVIEW-0007 caught for Phase 5, recurring immediately
  after being diagnosed, which is why it is recorded rather than
  backfilled. **(2)** The S6 planning session left no session record, so
  the `INDEX.md` chain that ADR-0012's cold-start invariant depends on had
  a hole in it. **(3)** Parking cost nothing precisely because S6 had zero
  implementation; the same decision one sprint later would have needed
  reconciliation.
- Validation: `bash tests/validate.sh` → `validate.sh: OK`, run twice
  (once manually, once by `.githooks/pre-commit` during the commit).
  `bash scripts/sync-registry.sh` → **no diff** to `docs/registry.md`,
  confirming no component was touched. `git status --porcelain` filtered
  for `skills/|mcp-servers/|loops/|configs/|scripts/|tests/|docs/` →
  **no matches**. Secret scan across `.ai/` for `ghp_`, `github_pat_`, PEM
  headers, bearer tokens and assignment patterns → only pre-existing
  matches in `REVIEW-0006`, `REVIEW-0007` and `TASK-0015`, all of which
  *describe* scan patterns rather than containing secrets. `git remote -v`
  verified token-free before and after the push.
- Result: **done.** 27 files, +5814/−152, all under `.ai/`. Sprint S7 is
  open with 17 artifacts written and none executed; S6 is archived as
  parked with its ten artifacts and four backlog items unchanged.
- Commit: `9105246`
- Push: **confirmed.** Pushed to `origin/master`
  (`cb0aa96..9105246`) using basic auth with `GITHUB_TOKEN` supplied from
  the environment — never in the remote URL or any tracked file, per
  ADR-0009 and `docs/operations/runbook.md`. Verified by re-fetch:
  `git log --oneline -2 origin/master` shows `9105246` at the tip.
