# TASK-0144 — Report the estate's stale ansible.cfg claims to the estate (B-039)

## Objective

Close `B-039` by the route the human chose on 2026-10-05: **an entry in the
estate's own `.ai/35.AD_HOC_TASKS.md`**, written under the estate's
conventions and committed there locally, not pushed. This repository must
not edit the estate's `ansible.cfg`. The report must be accurate, so each
claim is re-measured first, not copied from the row.

## Minimal context

- The estate is `/home/armando.martires/SIGMA-infrastructure`, a separate
  repository with its own governance. Its conventions route "noticed, out of
  scope" items to `35.AD_HOC_TASKS.md` (`00.CONVENTIONS.md`), as numbered
  entries with *Found during*, *What's true*, *Why it matters* and *Next
  step*. The highest open entry is `#96`.
- **Re-measured 2026-10-05, and one claim corrected.** `B-039` said claim
  (a), *"`ansible-config validate` rejects `gather_subset` as an unknown
  [defaults] key outright"*, is false, because 2.21.4 accepts it silently.
  - That conflates two things `TASK-0069` measured separately. Under 2.21.4
    `ansible-config validate` **does** reject the key. What is silent is a
    playbook run: exit 0, no warning, and `ansible_mounts` still collected.
  - Re-run here, against a throwaway `ansible.cfg` holding only that key,
    with the estate's venv: `ansible-config validate` printed `[ERROR]: Found
    unknown key 'gather_subset' in section 'defaults'`, exit 1.
  - So claim (a) is **true as written, but incomplete**, and the report says
    so rather than calling it false.
- **The other claims, re-checked by reading** `ansible.cfg` at the estate's
  `6e8a173` (lines 34-76, last changed 2026-10-04):
  - (b) *"in ansible-core 2.20.8"*: the estate's venv is `ansible [core
    2.21.4]`. The sentence it dates, that there is no global mechanism, still
    holds there (`TASK-0069`: `ansible-config list` has no such setting).
    So it is dated, not false.
  - (c) *"It has five now"* playbooks: `playbooks/*.yml` counts **19**.
  - (d) the cluster *"currently runs at 3-of-4 quorum … the cluster's current
    normal operating condition"*: `TASK-0116`'s health gate on 2026-09-28
    reported 6 nodes, 6/6 votes, quorate, `OVERALL: PASS`. That is **not
    re-measured here**, since it would touch hosts. `forks = 2`'s own reason,
    a recovering pvedaemon/PAM path, is historical and stands.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| the estate's `ansible.cfg` | the estate | lines 34-76 as quoted above |
| the estate's `.ai/35.AD_HOC_TASKS.md` | the estate | `## Open` starts at `#96` |
| the estate's working tree | the estate | clean, at `6e8a173`; unpushed commits already waiting for the human |
| `.ai/planning/BACKLOG.md` | `TASK-0143` | `B-039` `ready`; three open |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. In the estate: entry `#97` at the top of `## Open`, in its format, one
   commit there (doc only), with its secrets scan run on the changed file.
   **Not pushed**; the estate's push waits for the human.
2. Here: `B-039` closed, with the claim-(a) correction recorded on the row,
   plus `TODO.md`, `CURRENT_STATE.md` and this brief.

### Not included

- Editing the estate's `ansible.cfg`, or anything else there.
- Pushing the estate.
- Re-measuring quorum, which would touch hosts.

## Likely files

The estate's `.ai/35.AD_HOC_TASKS.md`; here, the ledger and this brief.

## Execution plan

1. This brief first.
2. Write `#97`; run the estate's `detect-secrets-hook` on the file; commit
   there.
3. The ledger here; `tests/validate.sh`; commit; push both remotes; record
   commit.

## Acceptance criteria

- [x] The estate has `#97`, committed locally, unpushed, stating each claim
      as re-measured, including that (a) is true.
- [x] `B-039` is closed here, and its row records the correction.
- [x] The estate's tree is otherwise untouched.

## Mandatory validations

- [x] tests/validate.sh
- [x] the estate's `detect-secrets-hook` on the changed file
- [x] `git -C <estate> status --porcelain` empty after the commit

## Risks and rollback

- **Writing to another repository.** The human chose this route. The change
  is one appended entry in a file the estate's conventions reserve for
  exactly this, committed and not pushed.
- **Rollback**: in the estate, `git reset` of that one unpushed commit
  needs the human's word, as it is a history change there. Here,
  `git revert`.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| estate `.ai/35.AD_HOC_TASKS.md` | `#97`, one local commit |
| `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md` | `B-039` done; two open |

**Next task starts here**: `master` at the record commit.

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-05
- Updated: 2026-10-05

## Execution log

### Attempt 1

- Date: 2026-10-05
- Agent: Claude Code (Opus 5.5), main checkout; the estate, read and
  written by absolute path
- Actions: re-measured claim (a), read `ansible.cfg` and the estate's
  ad-hoc format, wrote this brief, then `#97`, then the estate commit.
- Observations:
  - **Claim (a)**: `ansible-config validate`, with `ANSIBLE_CONFIG` pointing
    at a `mktemp` config holding `[defaults] gather_subset = !mounts`,
    printed `[ERROR]: Found unknown key 'gather_subset' in section
    'defaults'`, exit 1, under `ansible [core 2.21.4]`. `TASK-0069`'s table
    agrees, and so does its note that validate reports it.
  - **The estate**: `detect-secrets-hook --baseline .secrets.baseline
    .ai/35.AD_HOC_TASKS.md` exited 0, the only file staged was that one,
    and the commit is `b92e2a9`, *Record ansible.cfg's stale mounts and
    forks claims as #97*. Its `git status --porcelain` is empty afterwards.
    It is not pushed. The estate has no pre-commit hook installed, so the
    secrets scan was run by hand on the one changed file.
- Validation: `tests/validate.sh` printed `validate.sh: OK`, including
  `check-backlog-closures.py`.
- Result: done.
- Commit: `a52f020` — *Report the estate's stale ansible.cfg claims to the estate (TASK-0144)*, plus the record-keeping commit after it
- Push: **confirmed to both remotes** — `8ad497e..a52f020 master -> master` to
  `origin` and to `github`; `HEAD`, `origin/master` and `github/master` all
  read `a52f020`, and `git remote -v` is token-free
