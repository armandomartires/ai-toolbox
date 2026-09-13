# REVIEW-0007 — Sprint S5, Session handover contract

- Task(s) reviewed: TASK-0020, TASK-0021, TASK-0022, TASK-0023
  (+ ADR-0012, PLAN-0002)
- Reviewer: opencode (agent self-review), scope decisions by the human
- Date: 2026-09-13

## Diff summary
Ten commits, `1ce3740..1fbfe4d`:

| Commit | Subject |
|--------|---------|
| d3146c9 | Plan Phase 5: task handover contract for the project-workflow skill |
| 1f5544e | Document git push authentication in the runbook |
| c240f02 | Add session-handover reference to project-workflow; restore byte budget |
| 9a154be | Record TASK-0020 commit hash and confirmed push |
| 0f36d66 | Add handover contract to the skill's task template; version 3.1.0 |
| 68b7648 | Record TASK-0021 commit hash and confirmed push |
| cdedb45 | Adopt the handover contract in .ai/templates/TASK.md |
| 75c5ebf | Record TASK-0022 commit hash and confirmed push |
| 7106f9c | Enforce handover sections in validate.sh; complete sprint S5 |
| 1fbfe4d | Record TASK-0023 commit hash and S5 commit list |

20 files, +2252/−82. New: ADR-0012, PLAN-0002, four task briefs,
`skills/project-workflow/templates/reference/session-handover.md`,
`SESSION-20260914-0300`. Changed: the skill's `SKILL.md` (→`3.1.0`),
`00.CONVENTIONS.md`, `templates/tasks/0000_TEMPLATE.md`,
`.ai/templates/TASK.md`, `tests/validate.sh` (+101), the four planning
files, `docs/operations/runbook.md`.

## Findings

**1. The sprint's own convention caught a defect in all four tasks — and
the check it built caught none of them.** This is the finding; everything
else is secondary.

| Task | The claim, confidently written | The artifact |
|---|---|---|
| 0020 | the deployed skill copy is "now stale" | a symlink to the repo |
| 0021 | ADR-0012: the skill's template "has no equivalent sections" | `Files touched` was output-shaped |
| 0022 | PLAN-0002: four sections are mergeable into `Inputs` | one carried up to 82 lines of narrative |
| 0023 | the new check covers task briefs | `.ai/tasks/completed/` escaped it |

Every one was caught by the same act — opening the file named in a
declaration instead of trusting the declaration. Three of the four claims
were written *by this same agent, one session earlier*, which is the
useful part: the defect is not carelessness about someone else's work but
**the ordinary decay of a claim between being written and being acted
on.** That is precisely the gap a handover contract exists to cover, and
S5 is its own best evidence — accidentally.

**2. The value delivered was the verification discipline, not the
enforcement.** `validate.sh`'s new check would have caught none of the
four defects above: all four were *wrong content*, and the check tests
only *presence*. This is not a criticism of the check — the regression it
prevents is silent and real — but the sprint must not be credited to it.
If a future sprint drops the read-order step and keeps the gate, it keeps
the part that found nothing.

**3. Two checks were inherited, unfailable, and would have passed.**
PLAN-0002 specified `diff -rq` between repo and deployed skill, plus a
grep of the deployed copy for `3.1.0`. Both targets are symlinks to the
repo, so both compare a thing with itself. Had TASK-0021 executed its
brief as written, both would have reported success and the task would
have recorded a verified deployment it never verified.

They were struck **before** being run, which matters: the record shows a
decision, not a rationalisation after a convenient green. But the
mechanism deserves attention — this is the fourth consecutive sprint
whose recurring lesson is *a check that cannot fail is worse than no
check*, and this time the unfailable check was **authored inside the
sprint that cites that lesson**, by an agent that had just written it
down. Knowing the rule is not the control. Running the check against a
deliberately broken input is the control.

**4. The check found a real defect in itself, one level down.**
TASK-0023's proofs exposed that a flat `os.listdir()` let a brief evade
the gate entirely by being archived to `.ai/tasks/completed/` — a
directory `.ai/README.md` documents for exactly that purpose. So the
repo's own workflow would have silently disabled the check. Confirmed
with a fixture that passed at one level down, fixed with `os.walk()`,
re-confirmed failing. **A check that can be disabled by moving a file is
not a check.**

Worth noting *how* it surfaced: not from the five planned proof cases,
but from listing `.ai/tasks/` to confirm no fixture remained and
noticing an unexpected directory. The cleanup step found the defect.

**5. Case 7 is the only proof that establishes the boundary works.**
TASK-0019's content copied verbatim to `TASK-0020-probe.md` — identical
bytes, higher number — flips pass to fail. The planned proof ("a file
numbered 0019 with neither section passes") is also satisfied by a check
that never fires at all. The distinction is easy to miss and was not in
the plan; it came from asking what else would explain a pass.

**6. A budget that nobody measured was not a budget — and the number was
ambiguous.** `00.CONVENTIONS.md` declared "≲3 KB" in its own header and
sat at 3087 bytes for four sprints. "≲3 KB" resolves to either 3000 or
3072 depending on the reader, so the overage was not merely unnoticed but
**unnoticeable**: two readers could disagree about whether it existed.
Now `≤3072 bytes` exactly, measured at 3060, **12 bytes of headroom**.
That margin is itself a finding — the next edit to that file will breach
it, so the next task touching it must move content out, not squeeze.

**7. The one-owner rule was violated twice while implementing it.**
Drafting `session-handover.md` produced a third copy of the failed-push
rule (`00.CONVENTIONS.md:61`, `git-workflow.md:8`, and the new file);
`Likely files` vs `Outputs / handover` reproduced the `Files touched`
ambiguity a task later. Both caught by reading the rendered file. The
pull toward restating a rule for the reader's convenience is strong
enough to survive having just written the rule forbidding it.

**8. The central claim of the sprint is UNTESTED.** S5 exists so a task
can be picked up cold in a fresh session. **All four tasks ran in one
session** (`SESSION-20260914-0300`), which is the exact condition under
which a handover contract looks unnecessary and its defects stay
invisible. Every `Inputs` table was written and read by the same context
that created it.

So the contract is *proven to be writable* and *proven to catch stale
declarations within a session*. It is **not** proven to make a cold start
cheap. The first genuine test is the next task picked up after a real
gap — and until that happens, S5's headline benefit is a hypothesis with
supporting mechanism, not a result. Recorded here rather than in a
follow-up because it is a limitation of the evidence, not a task.

**9. No fabricated verification.** The absence of a `copy`-installed
client is recorded as a structural property of this machine rather than
substituted with an invented test. The untested cold-start claim is
stated as untested (finding 8). Both are cases where the honest record
was available and cheaper than the impressive one.

## Validation results
Independently re-run for this review, not copied from the task logs:

- `tests/validate.sh`: **OK**. 425/497/416 ms across three runs
  (pre-sprint baseline 393/398/381 ms) — sub-second, +~17% for the new
  `.ai/` walk.
- **Hermetic**: `env -i /bin/bash -c '… bash tests/validate.sh'` → exit 0
  with the entire environment unset.
- **Offline**: no `curl|wget|urllib|requests|ls-remote|npx|npm` primitive
  anywhere in `validate.sh`.
- **Fails-when-reverted, re-proved during this review**: renamed
  `## Inputs` → `## Inputz` in `.ai/templates/TASK.md` → exit 1,
  `HANDOVER: templates/TASK.md: missing '## Inputs'`; restored → exit 0;
  restoration byte-identical by `Get-FileHash`.
- TASK-0023's seven cases re-read and found to cover: missing vs empty as
  *distinct* messages, template vs brief, the boundary in both directions
  (0019 passes / same content at 0020 fails), and an unrecognised
  filename reported rather than skipped.
- Sizes/versions confirmed: `00.CONVENTIONS.md` 3060/3072; skill
  `3.1.0`; repo template 15 sections, skill template 6; both contract
  headings byte-identical across the two templates.
- `scripts/sync-registry.sh`: no diff at any point in the sprint —
  correct, since no component `description` changed.
- Secrets: `git diff 1ce3740..HEAD` scanned for `ghp_`, `github_pat_`,
  `glpat-`, `AKIA`, PEM headers — clean. `git remote -v` token-free.
- Pushes: all ten commits confirmed on the remote by comparing
  `git rev-parse HEAD` against `git ls-remote origin master`, per
  `reference/git-workflow.md`. The final commit was itself gated by the
  new check via `.githooks/pre-commit`, so the check is live rather than
  merely written.

## Verdict
**Approve.** All five Phase 5 exit criteria are met and independently
re-verified: the skill states a session boundary and read order it never
had; `00.CONVENTIONS.md` is under a budget that is now unambiguous; both
templates carry the contract with matching heading strings; and the gate
detects omission while stating in its own source what it does not prove.

Approved **with finding 8 on the record**: the sprint's headline benefit
is unproven by construction, because nothing here was picked up cold.

## Follow-up tasks
1. **The first cold pickup is the real test.** The next task started
   after a genuine session gap should record, in its execution log,
   whether its `Inputs` table was sufficient to begin without
   re-derivation — and name anything it had to go looking for. That
   observation is worth more than any check S5 shipped. Not a task in
   itself; an instruction to whichever task is next.
2. **`00.CONVENTIONS.md` has 12 bytes of headroom.** The next edit
   breaches it. Move content to `reference/`; never raise the cap
   (`reference/size-budgets.md:35-38`).
3. **Roadmap Phase 5 still reads "in progress"** while every criterion is
   met — the same stale-status defect S5 itself found in Phase 4 and
   catalogued as `CURRENT_STATE.md` lesson 6. Corrected in the same
   commit as this review. That it recurred *within* the sprint that
   named it is evidence the lesson needs a mechanism, not more prose;
   a phase-status check is plausible but unscoped, and should not be
   invented here.
4. **B-008** (`.ai/decisions/` dual naming, `ADR-NNNN-*` vs `NNNN-*`)
   remains open and deliberately out of S5's scope. Low value, genuinely
   unblocked: a rename plus a link sweep.
5. **The `≥ 0020` boundary will look like a bug** to a reader who sees
   TASK-0019 pass without the sections. It is commented at its
   definition. If a future scheme changes task filenames, the check
   reports the file as unverifiable rather than skipping it — verified by
   fixture, and the correct behaviour, but it means a rename sweep will
   fail the gate loudly until the pattern is updated.
6. `skills/*.zip` remain untracked pre-existing artifacts, still out of
   scope, still deliberately untouched.
