# TASK-0130 — Close the CI alert only when no watched workflow is red

## Objective

Make `.github/workflows/ci-alert.yml` close its single alert issue only when
no watched workflow's latest default-branch run is red. That is what the
issue body already promises: it *"will close itself when `validate` and
`dashboard` next report success on the default branch"*. Today any green run
closes it.

This is the third decision the human made on 2026-09-30. With it comes their
answer to a follow-up question: failures off the default branch are
ignored, so they neither open nor comment on the default-branch issue. That
covers side branches and pull requests, forks' included.

The task also makes ci-alert watch `dashboard-daily` (`TASK-0129`), because a
nightly build's failure reaches ci-alert no other way. Discharges no backlog
item.

## Minimal context

### The defect, measured 2026-09-30

- **Any green run closes the alert.** On a success, the `else` branch
  comments "Recovered" on any open issue and closes it. On the last six
  pushes, `validate` took 10-13 s and `dashboard` 26-48 s. So a push whose
  `validate` failed would have its alert closed about half a minute later,
  by the same push's green `dashboard`.
- **This is latent, not yet seen.**
  - 34 of 235 `validate` runs and 3 of 37 `dashboard` runs are red. Every one
    predates ci-alert's first run (`36443923514`, 2026-09-28T15:29:05Z).
  - The latest red runs are at 14:48:54Z and 14:59:11Z that day.
  - ci-alert has run 62 times, all green, all on `master`.
- **Nothing checks the branch.**
  - `validate.yml` runs on a push to every branch, on `pull_request` and on
    `workflow_dispatch`.
  - `workflow_run` fires for the triggering run on any branch unless it is
    filtered.
  - A job started by `workflow_run` gets write access even for a fork's run
    (GitHub docs, *Events that trigger workflows*, `workflow_run`).

  So a side-branch failure would open "CI is failing on the default branch",
  and a fork's pull request could get its own commit text posted into this
  repository's issue with a write token. This is latent too: every measured
  run is a push to `master`.
- **A correction.** `TASK-0124`'s brief and its `CURRENT_STATE.md` section
  say a side-branch failure "raises nothing" because of how `workflow_run`
  fires. That misreads the mechanism: the default-branch rule concerns where
  the *listener* file lives, not the triggering run's branch. `TASK-0124` is
  left as written, and this task's `CURRENT_STATE.md` section corrects it.

### What `TASK-0129` established, measured the same day

A dashboard run dispatched with the workflow token started **no** ci-alert
run. That was run `36774619004`, dispatched by dispatcher run `36774605074`,
with `triggering_actor` `github-actions[bot]`. The last ci-alert runs were
at 20:42:33Z and 20:42:47Z, for the preceding push, and none came after the
dispatched run finished at 20:43:58Z.

So a nightly build reaches ci-alert only through the dispatcher's own run,
which mirrors it (`TASK-0129`'s wait). That is why `dashboard-daily` joins
the watched list.

### The design

- **Stateless close rule.** On every green default-branch run, ci-alert reads
  each watched workflow's latest *conclusive* default-branch run from the
  Actions API. It counts the triggering run itself before the API shows it
  finished. It closes only if none of those runs is a failure; otherwise it
  comments, naming what is still red.
  - The state is re-derived from the runs each time. So a missed, failed or
    out-of-order ci-alert run cannot hold the issue open past the next green
    run that finds nothing red, and cannot let it close while something is
    red.
  - Rejected: keeping the failing set in the issue. Every lost update would
    become a lasting wrong state.
- **What counts, stated.**
  - Only `success` and `failure` count. `cancelled`, `skipped`, `timed_out`
    and unfinished runs are not evidence either way, which is how opening
    already treats them.
  - A workflow that has never run on the default branch does not hold the
    issue open.
  - If a watched workflow's first page of runs (30) holds no conclusive
    default-branch run, the program refuses to call it green and fails
    loudly.
- **Evidence.** A run counts only if it is on the default branch, is of this
  repository, and is not for a pull request. The triggering run is filtered
  the same way. A trigger that fails this filter changes nothing: no issue
  is opened, commented on or closed.
- **Every green run evaluates**, even with nothing open, and logs one verdict
  line per watched workflow. So each green push exercises the query, and a
  broken query fails loudly.
- **`queue: max`**, beside `cancel-in-progress: false`. By default a
  concurrency group keeps one pending run and cancels it when the next one
  arrives, which would drop an alert (GitHub docs, *Control the concurrency
  of workflows and jobs*; changelog 2026-05-07). It is one line, and it makes
  the header's own reason true: *"a cancelled alert is a missed one"*.
- **`actions: read`**, because permissions not listed are none.
- **Offline proof.**
  - The embedded program is restructured into functions, with the HTTP call
    injected (`run(env, call)`), behind `if __name__ == "__main__":`.
  - A new hermetic `tests/test-ci-alert.sh`, wired into `tests/validate.sh`,
    extracts the program and drives it with a fake call. It checks both the
    decisions and the side effects: which POSTs and PATCHes happen.
  - That includes the path no live run can show without a red default
    branch: a green run that must not close while another watched workflow
    is red.
  - The alert path keeps no `uses:` (`TASK-0124`, `ADR-0021`).
- **A simulated success is not evidence.** It re-reads the real runs.
- **Live proof**, approved by the human on 2026-09-30: a simulated failure
  opens a test issue, a second one comments on it, and the record commit's
  real green runs close it. A simulated success is used only as a fallback.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.github/workflows/ci-alert.yml` | `TASK-0124` | 194 lines, unchanged since `cafbfe3`. `STATUS: VERIFIED` on six runs. Closes on any success, with no branch check. Grants `contents: read` and `issues: write`, with the default concurrency queue |
| `.github/workflows/validate.yml` | `TASK-0010`, `TASK-0123` | `push: branches: ["**"]`, `pull_request`, `workflow_dispatch`; untouched |
| `.github/workflows/dashboard.yml` | `TASK-0127`, header by `TASK-0128` | `VERIFIED on run 36608693753`; untouched |
| `.github/workflows/dashboard-daily.yml` | `TASK-0129` | `name: dashboard-daily`; `schedule` plus `workflow_dispatch`; waits for and mirrors its run; `UNVERIFIED`; untouched |
| `tests/validate.sh` | ongoing | `validate.sh: OK` at `dde2a98` |
| The GitHub mirror | pre-existing | 0 open issues (#1 and #2 closed). The latest conclusive `master` run of each watched workflow is a success. ci-alert is active |
| `.ai/tasks/TODO.md` | `TASK-0129` | Post-S10 counter `TASK-0130` |
| `master` | `dde2a98` (`TASK-0129`'s record commit) | equal on local, `origin` and `github` |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. `.github/workflows/ci-alert.yml`:
   - the close rule;
   - the default-branch filter, for both the trigger and the evidence;
   - evaluation on every green run;
   - `dashboard-daily` watched;
   - `actions: read` and `queue: max`;
   - the program restructured, with the HTTP call injected and a
     `__main__` guard;
   - the issue and comment texts matched to the rule;
   - the header rewritten, with `STATUS: UNVERIFIED`.
2. `tests/test-ci-alert.sh`, new and `100755`, wired unconditionally into
   `tests/validate.sh`.
3. `CURRENT_STATE.md`: a new section that also corrects `TASK-0124`'s
   side-branch reading.
4. `TODO.md`: the entry and the counter.

### Not included

- **`validate.yml`, `dashboard.yml`, `dashboard-daily.yml` and `skills/`.**
- **SMTP, a repository secret, or any `uses:`.**
- **Re-opening from green runs.** A missed failure is not re-raised by a
  later green run. That is a stated limit.
- **Changing which conclusions count.** `timed_out` and `startup_failure`
  raise nothing today, and still won't.
- **A deliberately red `master`.** The do-not-close path is proven offline
  only.
- **Alerting on side branches**: the human's answer.

## Likely files

A forecast, written before the work.

- `.github/workflows/ci-alert.yml`
- `tests/test-ci-alert.sh` (new)
- `tests/validate.sh`
- `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`
- this brief

**Not expected to change**:

- `AGENTS.md`, which does not mention ci-alert;
- `README.md`, whose "closes itself when CI recovers" stays true;
- `docs/`;
- `skills/`;
- `docs/registry.md`;
- the other three workflows.

## Execution plan

1. Measure: done, and quoted above.
2. Write this brief first.
3. Edit `ci-alert.yml`.
4. Write the test, then the red proofs:
   - the revert proof, against `dde2a98`'s `ci-alert.yml`;
   - M1, the old rule (any green run closes) inside the new structure;
   - one mutation per rule;
   - an unmutated control.
5. Wire the test into `tests/validate.sh`. Prove the wiring: the gate must
   fail with M1 applied to the staged file.
6. Docs.
7. Validate, stage, run the leak scan, commit, and land.
8. **L0**, passive: the landed commit's green runs make ci-alert evaluate
   and log its verdicts, with nothing open.
9. **L1 and L2**, approved: simulated failures open issue #N and then comment
   on it.
10. Make the record commit. Its real green runs close #N: **L3**.
11. An observation commit:
    - `STATUS: VERIFIED`, naming L0-L3;
    - a line naming what is proven offline only;
    - this brief marked done.

## Acceptance criteria

- [x] T1 `tests/test-ci-alert.sh` prints `OK`, and `tests/validate.sh` runs it
      unconditionally.
- [x] T2 Against `dde2a98`'s `ci-alert.yml`, the test fails for the right
      reason: the old program defines none of the tested names. It must not
      crash, and it must not pass.
- [x] T3 M1, the old rule inside the new structure, fails the do-not-close
      cases.
- [x] T3b Each other mutation fails exactly its own cases, and the control
      passes.
- [x] T4 With M1 applied to the staged file, the gate fails and prints
      `CI-ALERT: FAIL …`. Restored, it passes.
- [x] T5 `ci-alert.yml` has no `uses:`, and no `${{` inside the program.
- [x] T5b It declares `actions: read` and `queue: max`.
- [x] T5c Its trigger list equals the watched list: `validate`, `dashboard`,
      `dashboard-daily`.
- [x] T6 These files are identical to `dde2a98`: `validate.yml`,
      `dashboard.yml`, `dashboard-daily.yml`, `skills/`, `README.md`,
      `AGENTS.md` and `docs/`.
- [ ] L0 After landing, the landed commit's green `validate` and `dashboard`
      runs each start a ci-alert run that succeeds.
- [ ] L0b Each of those ci-alert runs logs three verdict lines and "nothing
      was open".
- [ ] L1 A simulated failure opens exactly one marker issue.
- [ ] L1b Its body states the rule and names the three watched workflows.
- [ ] L2 A second simulated failure comments on that issue, and no second
      issue is opened.
- [ ] L3 The record commit's real green run closes it, with `state_reason`
      `completed`.
- [ ] L3b The closing *Recovered* comment lists three green verdicts.
- [ ] L4 `ci-alert.yml`'s `STATUS:` reads `VERIFIED`, naming L0-L3's runs,
      with a line naming what is proven offline only.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed): no component
      changed; expect no diff
- [x] `tests/test-ci-alert.sh`, the revert proof and the mutations, run on
      scratch copies
- [x] The gate-wiring proof (T4)
- [x] `skills/project-migration/scripts/check-artifact.sh` on this brief
      (`--kind task`)
- [x] `git diff --stat dde2a98 -- <the T6 list>` is empty, and
      `git ls-files -s tests/test-ci-alert.sh` shows `100755`
- [x] The staged-diff and commit-message leak scans
- [ ] The landed runs and the simulations, read back from the API

## Risks and rollback

- **A YAML error or an unaccepted key** (`queue`) silences every alert until
  it is fixed. The offline test does not parse YAML: there is no YAML parser
  in the standard library. L0 runs straight after landing and is the real
  check. Fix forward at once.
- **The query fails**: a missing permission, a renamed file or an outage.
  Every green run's ci-alert run then goes red, and an open issue cannot
  close. That is the safe direction.
- **A wrong predicate on real payloads** would make the alert ignore `master`
  runs. The fixtures use a real run's field names, and L0's log would show
  `ignore-branch`.
- **Noise**: while something is red, every green run adds one "Not closing"
  comment.
- **Stated limits**:
  - a stale failure opens an issue that the next green run closes;
  - a missed failure is not re-raised.
- **The test issue** stays closed as the record, as #1 and #2 did.
- **Rollback**: a targeted commit that restores `dde2a98`'s `ci-alert.yml`
  and unwires the test. Never use `git revert`, which would delete this
  brief.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `.github/workflows/ci-alert.yml` | **Rewritten close rule**: a green default-branch run closes the issue only when no watched workflow's latest conclusive default-branch run is a failure, and otherwise comments naming what is still red. It also ignores runs that are off the default branch, of other repositories or for pull requests, both as the trigger and as evidence. Every green run evaluates and logs its verdicts. It watches `validate`, `dashboard` and `dashboard-daily`. It declares `actions: read` and `queue: max`. The program is split into functions, with `run(env, call)` taking an injected HTTP call, behind a `__main__` guard. The issue text states the rule. The header is rewritten, with `STATUS: UNVERIFIED` naming `TASK-0124`'s six runs. There is no `uses:` |
| `tests/test-ci-alert.sh` | **New**, `100755`. 33 cases, 0.12 s: 26 behaviour cases run `run()` against a fake API, recording every request, and 7 check the workflow around the program |
| `tests/validate.sh` | Runs the test unconditionally, after `check-publish.sh`; failures print with `CI-ALERT:` |
| `.ai/context/CURRENT_STATE.md` | A new top section, which also corrects `TASK-0124`'s side-branch reading |
| `.ai/tasks/TODO.md` | The `TASK-0130` entry, unticked; the counter reads `TASK-0131` |
| **Not changed** (identical to `dde2a98`) | `validate.yml`, `dashboard.yml`, `dashboard-daily.yml`, `skills/`, `README.md`, `AGENTS.md`, `docs/` (`docs/registry.md` unchanged after `sync-registry.sh`) |

**Next task starts here**: ci-alert's rule is gated offline, and it lands
`UNVERIFIED`. The follow-up commits record the live runs and move the label.

## Status

- Status: in_progress   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent (the decisions are the human's)
- Created: 2026-09-30
- Updated: 2026-09-30

## Execution log

### Attempt 1

- Date: 2026-09-30
- Agent: Claude Code (claude-opus-5-5), worktree `agent/ci-alert-close`
- Actions:
  - `scripts/worktree.sh add ci-alert-close` reported
    `gate : runs as a bare path`.
  - Wrote the brief first, then rewrote `ci-alert.yml` and wrote the test.
    The test was staged, and made `100755` with
    `git update-index --chmod=+x`.
  - Checked GitHub's changelog (2026-05-07). It says: add `queue: max` to the
    concurrency block for "up to 100 queued jobs or workflow runs per
    concurrency group", valid "when `cancel-in-progress` is `false` or not
    set".
- Observations:
  - **Revert proof (T2)**: against `dde2a98`'s `ci-alert.yml`, the test printed
    `FAIL … the embedded program ran at load time (KeyError: 'API'); it must
    only define names behind a __main__ guard` and exited 1. The old program
    does its work at import. The environment is scrubbed first, so this is
    the reason it fails, not an accident.
  - **Mutations**, each on a scratch copy; the worktree's `git status` was
    unchanged afterwards:

    | Mutation | Cases that fail |
    |---|---|
    | M1, the old rule (any green closes) inside the new structure | 8 of 33: C1, C2, C5, C6, both newest-red C7, C11, C15a |
    | M2, every run counts as evidence | C9, C10, C11 |
    | M3, conclusion filter removed | C5, C6, C17 |
    | M4, first run instead of newest | C3, both reversed C7, C8 |
    | M5, triggering run not counted | C3, C8 |
    | M6, no evaluation when nothing is open | C14 |
    | M7, `dashboard-daily` dropped from the trigger list | S1 |
    | M8, `queue: max` removed | S3 |
    | M9, `actions: read` removed | S4 |
    | M10, missing default branch defaulted | C16 |
    | M11, keep-open's side effects routed to close | the same 8 as M1, each failing on its PATCH |
    | M12, an API error swallowed | C18 |
    | M13, full-page guard removed | C17 |
    | Unmutated control | none: `OK (33 cases)` |

    M5 first failed 11 cases. That was a fault in the proof, not in the
    code: its search text matched a substring of a deeper-indented line and
    changed the program's structure. Corrected to remove the whole line, it
    fails exactly C3 and C8.
  - **Gate wiring (T4)**: with M1 applied to the staged file's working copy,
    `tests/validate.sh` printed eight `CI-ALERT: FAIL …` lines and
    `CI-ALERT: test-ci-alert.sh: 8 of 33 case(s) FAILED`, and exited 1.
    `git checkout -- .github/workflows/ci-alert.yml` restored the staged
    version (empty diff), and the gate printed `validate.sh: OK`.
  - **Mirror, measured before landing**: 0 open issues. The latest
    conclusive `master` run of each watched workflow was a success:
    - `validate` `36774481232`;
    - `dashboard` `36774619004`;
    - `dashboard-daily` `36774605074`.
- Validation:
  - `bash tests/test-ci-alert.sh` printed `test-ci-alert.sh: OK (33 cases)`
    in 0.12 s.
  - `tests/validate.sh` printed `validate.sh: OK` in 8.0 s.
  - `sync-registry.sh` left `docs/registry.md` unchanged.
  - `check-artifact.sh --kind task` printed `OK`.
  - `git diff --stat dde2a98 -- <T6 list>` was empty.
  - `grep -c 'uses:' .github/workflows/ci-alert.yml` printed 0.
  - `git ls-files -s tests/test-ci-alert.sh` showed `100755`.
  - After staging the 6 paths, the leak scan found 0 hits for the
    intranet host and both parent domains (case-insensitive), 0 for each
    of the three token values, and 0 for the token prefixes.
    `git diff --check --staged` printed nothing. The commit message is
    scanned the same way after committing.
- Result: built and gated. L0-L4 (the landed runs, the approved simulations,
  the real close, and the label) are pending, and are recorded in later
  commits.
- Commit: `2de6f52` — *Close the CI alert only when no watched workflow is red
  (TASK-0130)*, plus the record-keeping commit after it
- Push: **confirmed to both remotes** — `dde2a98..2de6f52 HEAD -> master` to
  `origin` and to `github`; `HEAD`, `origin/master` and `github/master` all
  read `2de6f52`, and `git remote -v` is token-free
