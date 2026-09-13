# TASK-0010 — Pre-commit hook running validate.sh; optional CI workflow

## Objective
Make `tests/validate.sh` run automatically before every commit, satisfying
Phase 3's exit criterion as restated by ADR-0007. Ship a CI workflow
alongside, inert until a remote exists and labelled as such.

## Minimal context
Phase 3's criterion originally read "wired into CI or pre-commit", written
at scaffold time. ADR-0007 restated it after two findings:

1. **This repo has no remote and never has.** Nine tasks recorded "nothing
   to push". A CI-only gate would run nowhere.
2. **The performance objection to a hook does not survive measurement.**
   On this `/mnt/c` 9p tree, `validate.sh` costs ~275 ms against `git
   status`'s ~640 ms — the hook is cheaper than git's own overhead.

Human rule (2026-09-13): every project must have a local git repository; a
remote is recommended, not mandatory. So the hook is the primary
mechanism, not the fallback.

TASK-0011 ran first so the hook's first duty is guarding an already-
corrected generator.

## Scope

### Included
- `.githooks/pre-commit` — tracked, runs `tests/validate.sh`, blocks on
  failure, prints how to bypass.
- `scripts/install.sh` — activate via `git config core.hooksPath .githooks`,
  idempotently, announcing what it changed.
- `.github/workflows/validate.yml` — inert CI workflow, labelled unverified.
- `tests/validate.sh` — assert the hook is executable and that
  `core.hooksPath` guidance is discoverable (see design note).
- `AGENTS.md` Git rules (conditional push) and Commands (hook install,
  bypass); `docs/operations/runbook.md`.

### Not included
- **Adding `tests/smoke-mcp.sh` to the hook.** It needs the network and
  takes tens of seconds. ADR-0007 makes this an explicit prohibition, not
  an oversight: the whole reason TASK-0009 kept it separate.
- **A commit-msg hook** enforcing subject-line style. `AGENTS.md` has rules
  about it, but automating them is a separate decision and risks blocking
  legitimate commits over formatting.
- **A pre-push hook.** No remote; nothing to push to.
- **Adding a git remote** — a recommendation, and not the agent's call.
- **Husky/pre-commit framework.** A 12-line shell script needs no
  dependency, and adding one would contradict the repo's own
  self-contained-components principle.

## Preconditions
- Branch `master`, clean. TASK-0011 done (`e39ff5d`). ADR-0007 accepted.
- `git --version` 2.52.0 — `core.hooksPath` supported (git ≥ 2.9).
- `.git/hooks/` currently contains only `.sample` files; no active hook to
  preserve or overwrite.

## Design note
**Why `core.hooksPath` and a tracked directory**, not `.git/hooks/`:
`.git/` is not version-controlled. A hook written there exists on one
machine, is invisible to review, and vanishes on a fresh clone — the same
drift class as the stale hand-placed OpenCode skill TASK-0006 had to fix.
A tracked hook is reviewable and travels with the repo; `core.hooksPath` is
the one-line activation.

**The bypass must be documented.** `git commit --no-verify` will be needed
legitimately: a WIP commit on a scratch branch, or a commit that fixes the
gate itself. A hook nobody can bypass is a hook someone deletes. Printing
the bypass in the failure message is more honest than hiding it, and
cheaper than the alternative of it being rediscovered under pressure.

**What `validate.sh` can honestly assert about the hook.** It can check the
hook file exists and is executable. It cannot require
`core.hooksPath=.githooks` be *set*, because a fresh clone legitimately has
not run `install.sh` yet, and failing validation on an unconfigured clone
would block the very first commit someone makes. So: assert the hook is
present and runnable; leave activation to `install.sh` and document it.

## Execution plan
1. Write `.githooks/pre-commit`: run `tests/validate.sh` from the repo
   root, exit non-zero on failure, print the bypass hint. Keep it minimal —
   it runs on every commit.
2. `chmod +x` and confirm the executable bit is what git records (mode
   100755), since a non-executable hook is silently ignored.
3. Extend `scripts/install.sh` to set `core.hooksPath` idempotently,
   printing the change only when it actually changes something.
4. Add the hook-present-and-executable check to `tests/validate.sh`.
5. Write `.github/workflows/validate.yml` — checkout, python3, run
   `validate.sh`. Comment it as unverified (no remote to run it).
6. Amend `AGENTS.md`: Git rules' push step becomes conditional on a remote
   existing; Commands documents hook installation and the bypass. Update
   the runbook.
7. Prove the hook actually blocks: stage a change that fails validation,
   attempt a real commit, confirm it is refused; then confirm `--no-verify`
   overrides; then confirm a valid commit passes.
8. Follow `release-check` to commit — which, from this task onward, means
   the hook itself runs on that commit. The task's own commit is the
   dogfood.

## Acceptance criteria
- [ ] `.githooks/pre-commit` exists, is tracked with mode 100755, and runs
      `tests/validate.sh`.
- [ ] A commit whose tree fails validation is **blocked**, with a message
      naming what failed and how to bypass.
- [ ] `git commit --no-verify` bypasses the hook (verified, not assumed).
- [ ] `scripts/install.sh` sets `core.hooksPath=.githooks`, is idempotent,
      and announces the change only when it makes one.
- [ ] `tests/validate.sh` fails if the hook is missing or not executable,
      but does **not** require `core.hooksPath` to be set (a fresh clone
      must still be able to commit).
- [ ] `tests/smoke-mcp.sh` is **not** invoked by the hook.
- [ ] `.github/workflows/validate.yml` exists and is labelled unverified.
- [ ] `AGENTS.md`'s push rule is conditional on a remote existing.
- [ ] This task's own commit passed through the hook.

## Mandatory validations
- [ ] `bash tests/validate.sh` → OK; still offline; still sub-second
      (re-measure, since it now runs on every commit).
- [ ] `git config --get core.hooksPath` → `.githooks` after install.
- [ ] `git ls-files -s .githooks/pre-commit` → mode `100755`.
- [ ] **Fails-when-broken proof**, each observed then reverted:
      1. hook missing → validate fails naming it;
      2. hook present but not executable → validate fails;
      3. a staged tree that fails validation → `git commit` **refused**,
         non-zero, with the failure and bypass shown;
      4. same tree with `--no-verify` → commit **succeeds** (then reset);
      5. a valid tree → commit succeeds through the hook.
      Record each observed message. Use a scratch branch or reset so no
      junk commit survives on `master`.
- [ ] `bash scripts/install.sh link` twice → second run reports no hook
      change (idempotent).
- [ ] `git status` clean at end; no leftover test commits.

## Risks and rollback
- **Risk: the hook blocks legitimate work.** Mitigated by documenting
  `--no-verify` in the failure message itself.
- **Risk: a junk commit or branch survives the hook proof.** The proof
  makes real commits deliberately. Mitigated by using a scratch branch and
  `git reset`, and by asserting a clean `master` and clean tree at the end.
- **Risk: `install.sh` writing repo config surprises someone.** Mitigated
  by announcing the change; it is already the post-clone entry point.
- **Risk: `validate.sh` becomes slow or network-dependent later**, making
  every commit painful. ADR-0007 records that its hermeticity is now
  load-bearing rather than merely nice.
- **Rollback**: `git revert` this task's commit, then
  `git config --unset core.hooksPath`. Note the revert alone does **not**
  deactivate the hook, because `core.hooksPath` lives in `.git/config`,
  which is not version-controlled — the unset is a required second step.
  Record this in the runbook.

## Dependencies
Depends on ADR-0007 and TASK-0011. Last task in sprint S3; satisfies
Phase 3's restated exit criterion.

## Expected result
`tests/validate.sh` stops being a step someone must remember and becomes a
gate that runs itself, with an honest, documented escape hatch — and a CI
workflow ready for the day a remote is added.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13
## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode (anthropic/claude-opus-5)
- Actions: wrote `.githooks/pre-commit`; wired `core.hooksPath` activation
  into `scripts/install.sh` (idempotent, announces only real changes);
  added hook presence/mode checks to `tests/validate.sh`; wrote the inert
  `.github/workflows/validate.yml`; amended `AGENTS.md` (conditional push,
  hook + bypass) and the runbook.
- **Three defects found, two of them in my own new code.** All three were
  found by the fails-when-broken proof, not by the happy path:
  1. **`chmod +x` does not reach git's index here.** `core.filemode` is
     `false` on this `/mnt/c` checkout, so the hook was staged as mode
     `100644`. Git silently ignores a non-executable hook, so the gate
     would have been dead on arrival for anyone who cloned it onto a
     filesystem that honours the bit. Fixed with
     `git update-index --chmod=+x`; the recorded mode is now `100755`.
  2. **My first `validate.sh` hook check was unfalsifiable.** I guarded it
     with `[ -d .githooks ]` intending leniency; the effect was that
     *deleting the hook directory made the check pass*. A check that
     cannot detect the thing it exists to detect is worse than none. Now
     unconditional.
  3. **My first check also tested the wrong property.** It used `[ -x ]`,
     but on this 9p mount every file reports `rwxrwxrwx` and `chmod -x`
     is silently ignored — so `[ -x ]` can never fail here, and the check
     was both untestable and useless on the platform it runs on. It now
     inspects the mode **git records**, which is the portable truth and
     the thing that actually disables a hook.
- **The first proof run was itself broken, and that mattered.** It began
  with `git stash -u`, which stashed the then-untracked hook, silently
  disarming every subsequent case — the commit that should have been
  refused sailed through, which looked like a hook failure but was a test
  failure. Rewritten to require a clean tree and to run after the hook is
  committed, so there is nothing to stash and nothing to disarm. Recorded
  because "the test was wrong" is the most tempting thing to quietly fix
  and move on from.
- Observations:
  - Tracked `.githooks/` over `.git/hooks/` because `.git/` is not
    version-controlled: a hook there is unreviewable, unversioned, and
    absent on a fresh clone — the drift class TASK-0006 already had to fix
    once for OpenCode's hand-placed skill.
  - `validate.sh` deliberately does **not** require `core.hooksPath` to be
    set. A fresh clone has not run `install.sh` yet, and failing there
    would block the first commit someone makes.
  - Rollback needs two steps, now documented: `git revert` does not
    deactivate the hook, because `core.hooksPath` lives in `.git/config`.
- Validation:
  - `bash tests/validate.sh` → OK; still offline; 266–283 ms.
  - `git config --get core.hooksPath` → `.githooks`;
    `git ls-files -s .githooks/pre-commit` → `100755`.
  - **Fails-when-broken proof** (second, corrected run, on a scratch
    branch from a clean tree):
    1. hook removed → `MISSING hook: .githooks/pre-commit (ADR-0007
       requires the tracked pre-commit gate)`, exit 1;
    2. git mode flipped to `100644` → `HOOK NOT EXECUTABLE IN GIT: ...
       recorded as 100644, needs 100755`, exit 1 (proven separately, since
       the filesystem bit cannot be changed on this mount);
    3. staged tree failing validation → `git commit` exit **1**, hook
       printed `MISSING description: skills/hook-proof-bad/SKILL.md` plus
       the refusal and bypass hint, and **HEAD did not move**;
    4. same tree with `--no-verify` → commit exit 0, HEAD moved;
    5. corrected tree → normal commit exit 0 with `validate.sh: OK` in the
       output, i.e. it passed *through* the hook rather than around it.
    Scratch branch deleted; HEAD back at base; tree clean; no junk commit
    on `master`.
  - `bash scripts/install.sh link` twice → hook message on the first run
    only (idempotent).
  - **Dogfood:** this task's own commit was gated by the hook —
    `validate.sh: OK` appears in the commit output.
- Result: success.
- Commit: `8c8c010` "Add tracked pre-commit hook running validate.sh;
  inert CI workflow"; the two check fixes found by the proof landed in
  `153cbe1` "Close sprint S3 and Phase 3; fix hook validation checks".
- Push: no remote configured — nothing to push, which ADR-0007 now makes
  an expected outcome rather than an incomplete step.
