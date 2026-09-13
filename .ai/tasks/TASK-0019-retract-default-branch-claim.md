# TASK-0019 — Retract the false default-branch mismatch claim

## Objective
Correct a factual error introduced by TASK-0015 and propagated into four
documents: the claim that GitHub's default branch is `main` while this repo
uses `master`. **No such mismatch exists and never did.** There is nothing
to fix in the repository; the defect is entirely in the record.

## Minimal context
Asked to fix the mismatch, I verified the remote before acting. Observed
state (2026-09-13):

| Check | Result |
|-------|--------|
| `GET /repos/:repo` → `default_branch` | **`master`** |
| `GET /repos/:repo/branches` | `master` only, at `d0b9836` |
| `GET /repos/:repo/git/ref/heads/main` | **404 Not Found** |
| `git ls-remote --symref origin HEAD` | `ref: refs/heads/master` |
| Pull requests (all states) | 0 |

So the repo is, and has always been, consistent. The claim was false when
written and stayed false through three restatements.

### Root cause
`/tmp/opencode/gh-create.py` printed `default_branch` from the **repository
creation response**. The repo was created with `auto_init: false`, so it had
no commits and no refs at that moment. GitHub returned its *account-level
default branch name preference* — `main` — as a forward-looking placeholder,
not a description of an existing ref.

When `master` was pushed minutes later, GitHub set `default_branch` to
`master` automatically, because the first branch pushed to an empty
repository becomes its default. Nothing needed fixing even in principle.

**The error was reading a field that expresses an intention as one that
reports a state.** I then wrote, without re-checking:

- *"`main` exists only as the repo's nominal default and holds nothing"* —
  `TASK-0015`, execution log. Asserts existence; `main` never existed.
- *"`main` exists but is empty, so a PR opened against the default base
  would target nothing"* — `REVIEW-0006`, follow-up 3. Compounds the error
  into a consequence that cannot occur.
- Carried again into `CURRENT_STATE.md` and `SPRINT-CURRENT.md` as an open
  item *needing human authorization*.

Two aggravating factors worth recording:

1. **The claim grew more specific with each restatement** while never being
   re-verified. "Nominal default holding nothing" became "empty branch"
   became "a PR would target nothing" — increasing confidence, constant
   evidence.
2. **It was labelled as needing authorization**, which made it look
   deliberately deferred rather than unverified. That framing discouraged
   exactly the re-check that would have caught it. Had the human authorized
   the rename, it would have failed against a nonexistent ref.

### Why the existing checks did not catch it
Correctly, and this is worth being precise about rather than treating as a
gap to plug. `tests/validate.sh` is hermetic and offline by design
(ADR-0007, ADR-0009); it must never query a remote. The statement was about
external state, so no local gate could have falsified it. The only
sufficient control is the one that failed here: **verify a claim about
external state against that state before recording it, and again before
acting on it.**

## Scope
### Included
- Correct all four documents. Strike the false claim and state what is true,
  rather than deleting it silently — the error and its root cause are the
  useful record.
- Remove the item from open-item lists, since there is nothing to do.
- Add a short runbook note on how to verify remote branch state, including
  the `auto_init: false` trap.

### Not included
- Any change to git, the remote, or branch configuration. Nothing is
  misconfigured. Renaming or deleting `main` is impossible — it does not
  exist.
- A `validate.sh` check on remote branch state. That would break the gate's
  hermeticity to guard against a documentation error, and would fail on
  every offline clone and in CI.
- Rewriting history to erase the false claim. The claim is in committed task
  files and reviews; amending them away would destroy the audit trail that
  makes this correction meaningful.
- Editing `SESSION-20260914-0100.md`'s narrative beyond appending the
  correction. A session log is a point-in-time record of what was believed
  then; it gets an addendum, not a revision.

## Preconditions
- Working tree clean at `d0b9836`; `validate.sh` passing.
- Remote state verified (done, above).

## Likely files
- `.ai/tasks/TASK-0015-env-requirements-and-remote.md`
- `.ai/reviews/REVIEW-0006-sprint-s4-closing-open-loops.md`
- `.ai/context/CURRENT_STATE.md`
- `.ai/planning/SPRINT-CURRENT.md`
- `.ai/sessions/SESSION-20260914-0100.md`
- `docs/operations/runbook.md`

## Execution plan
1. Verify remote state via the API and `git ls-remote`. **Done.**
2. Correct each document, marking the retraction visibly.
3. Add the runbook note with the exact commands.
4. Validate, commit, push, confirm CI.

## Acceptance criteria
- [x] No document asserts that `main` exists or that a mismatch exists. The
      three remaining textual matches are all inside `~~`-struck retraction
      blocks with the correction immediately following — verified by reading
      each in context, not by grep alone.
- [x] Each correction states the verified reality and the root cause, and is
      marked as a retraction rather than quietly edited away.
- [x] The item no longer appears as open or as needing authorization.
- [x] `docs/operations/runbook.md` gives the commands to verify remote
      branch state and names the `auto_init: false` trap.
- [x] No change to git configuration, branches, or the remote.
- [x] `tests/validate.sh` passes and stays hermetic.
- [x] REVIEW-0006 carries the error as finding 8, since a false finding in a
      checkpoint is itself a review finding.

## Mandatory validations
- [x] tests/validate.sh — OK
- [x] scripts/sync-registry.sh — no diff
- [x] `git branch -vv` → `master [origin/master]`;
      `git ls-remote --symref origin HEAD` → `ref: refs/heads/master`
- [x] CI green after push

## Risks and rollback
- Risk: over-correcting into self-flagellation that obscures the useful
  lesson. Mitigation: state the error once per document, plainly, with the
  root cause and the transferable rule.
- Risk: a future reader finds the old claim in git history and re-opens the
  item. Mitigation: the retraction lives in the same files, so the history
  and the correction are read together.
- Rollback: documentation-only; revert the commit.

## Dependencies
TASK-0015 introduced the error.

## Expected result
The record matches reality. The repo is unchanged because it was never
wrong. The failure mode — recording an unverified claim about external state,
then restating it with increasing specificity — is documented where the next
session will encounter it.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13

## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode
- Actions:
  - Verified remote state before touching anything: API `default_branch`,
    branch list, `heads/main` ref, `ls-remote --symref`, PR count.
  - Corrected five documents with visible retractions: TASK-0015 (origin),
    REVIEW-0006 (follow-up 3 *and* new finding 8), CURRENT_STATE,
    SPRINT-CURRENT, SESSION-20260914-0100 (addendum, narrative left intact).
  - Added a "Verifying remote branch state" runbook section naming the
    `auto_init: false` trap and the three commands that falsify such a claim.
- Observations:
  - **The task as requested could not be done, because the problem did not
    exist.** The correct action was to verify first and report the retraction
    rather than perform a plausible-looking rename. A rename would have
    failed against a nonexistent ref — the failure would have been the first
    honest signal.
  - Root cause is a category error: the repo-creation response's
    `default_branch` expresses an *intention* (the account's preferred name)
    when `auto_init: false` leaves the repo refless. I read it as *state*.
  - The aggravating pattern is worse than the original mistake. The claim was
    restated three times — TASK-0015 → REVIEW-0006 → CURRENT_STATE/
    SPRINT-CURRENT — growing more specific each time ("nominal default
    holding nothing" → "exists but is empty" → "a PR would target nothing")
    while acquiring no new evidence. Confidence rose as verification stayed
    at zero.
  - Labelling it "needs authorization" actively concealed it. That framing
    reads as a deliberate deferral, so it invited approval rather than
    scrutiny. **An item awaiting authorization should still have its premise
    verified** — otherwise the authorization request is the first time anyone
    looks, and by then the claim has been repeated enough to seem settled.
  - No repo-side check could have caught this and none should be added:
    `validate.sh` must stay hermetic (ADR-0007, ADR-0009). A check that
    queried GitHub would fail on every offline clone and in CI. The control
    is procedural, and it now lives in the runbook.
  - Grep alone was insufficient to confirm the cleanup — three matches
    remained and all three were inside struck-through blocks. Read each in
    context. The same lesson as TASK-0009's "confirm by listing, not by a
    clean `git status`".
- Validation:
  - `GET /repos/:repo` → `default_branch: master`; branches → `master` only
    at `d0b9836`; `GET .../git/ref/heads/main` → **404**;
    `git ls-remote --symref origin HEAD` → `ref: refs/heads/master`; 0 PRs.
  - `git branch -vv` → `master [origin/master]`, in sync.
  - `tests/validate.sh` OK, still offline; `sync-registry.sh` no diff.
  - No git configuration, branch, or remote was modified — this commit
    touches documentation only.
- Result: success, in the sense that matters — the record now matches
  reality. The repository needed no change because it was never
  misconfigured. Net effect of the original error: three documents carrying
  a fabricated open item for one day, and one runbook section that did not
  exist before.
- Commit: see below
- Push: to `origin master`
