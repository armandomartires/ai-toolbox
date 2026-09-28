# TASK-0124 — Tell someone when CI fails

## Objective

Make a failing workflow reach a person. `TASK-0123` found `validate` red for
fourteen consecutive commits with nobody aware, and closed leaving that
deliberately open as a decision rather than a fix. The human chose: on
failure, open a GitHub Issue from the built-in token — no secrets, no
third-party action — and close it again when CI recovers.

## Minimal context

### Why not the thing that already exists

GitHub emails on workflow failure natively, and that setting's default is
*on*. It was therefore almost certainly on during all fourteen red commits,
and it did not work — the mail went somewhere unread. **Turning on a channel
that already failed is not a fix**, which is why the human picked a second,
durable one instead.

There is also no REST API for Actions notification preferences: `GET
/notifications/settings` and `/user/notifications/settings` both return 404
and `/user/emails` returns 403 for this token. So that channel cannot be
verified, set, or tested from here at all. An alert nobody can test is the
same class of thing as a gate nobody reads.

### Why an issue rather than SMTP

An issue costs **no secret and no dependency**: `GITHUB_TOKEN` with
`issues: write` is already in the runner. SMTP would put credentials in
repository secrets, in a repo whose first security rule is never to commit
one and which is **public** (`TASK-0123`), and would add a marketplace action
where `ADR-0021` says third-party extensions are wired, not vendored.

An issue is also **durable in a way an email is not**: it persists until
closed, it is visible in the repo next to the badges `TASK-0123` added, and
it can be *closed automatically when CI goes green*, which makes it a state
indicator rather than a notification. GitHub then emails about the issue
through the normal notification path, so the human still gets mail — but the
record does not depend on the mail being read.

### One issue, not one per failure

A fourteen-commit red streak must produce **one thread with fourteen
comments**, not fourteen issues. The job therefore looks for an open issue
carrying a fixed marker in its title before creating one. Without that, the
alert becomes noise and gets muted, which is how it ends up as useless as the
email it replaced.

### `workflow_run`, and its one trap

A separate workflow on `workflow_run` covers both existing workflows from one
place and still fires when the failing workflow broke during setup. The trap:
**`workflow_run` only triggers for the workflow file on the default branch**,
so this cannot be tested on a side branch, and a change to it takes effect
only once merged to `master`.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.github/workflows/validate.yml` | `TASK-0010` | `success` on `master`; header records the fourteen red commits |
| `.github/workflows/dashboard.yml` | `TASK-0123` | `VERIFIED` on both triggers; `success` on `master` |
| `README.md` | `TASK-0123` | Carries both badges; both URLs verified HTTP 200 |
| Repository issues | pre-existing | **Enabled** (`has_issues: true`), **0 open** — verified 2026-09-28, so the first issue this creates is unambiguous |
| `GITHUB_TOKEN` in Actions | pre-existing | Grantable `issues: write`; no repository secret is added by this task |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. `.github/workflows/ci-alert.yml`, triggered by `workflow_run` on
   `validate` and `dashboard` completing.
2. On failure: reuse the open marker issue if there is one and comment,
   otherwise create it.
3. On success: if a marker issue is open, comment and **close** it.
4. A `workflow_dispatch` simulation input, so the alert can be exercised
   without breaking `master` to test it.
5. Proof by running it, not by reading it.

### Not included

- **No SMTP, no repository secret, no third-party action.** The reasons are
  above and they are the point of the chosen route.
- **No change to what either existing workflow does.** This observes them.
- **No alerting on a non-default branch.** `workflow_run` cannot, and
  pretending otherwise would be a claim the mechanism does not support.
- **No auto-retry, no auto-revert.** Notifying is not fixing.

## Likely files

A forecast, written before the work.

- `.github/workflows/ci-alert.yml` — new
- `README.md` — a line on what a red badge now also produces
- `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`, this file

**Not expected to change**: `validate.yml`, `dashboard.yml`, any script, any
skill.

## Execution plan

1. Confirm issues are enabled and count what is already open, so the test is
   readable. Done — enabled, zero open.
2. Write the workflow with the failure and recovery paths and a dispatch
   simulation.
3. Merge to `master` — `workflow_run` ignores any other branch.
4. **Exercise it**: simulate a failure, read the created issue back from the
   API; simulate a second failure, confirm it comments rather than creating a
   second issue; simulate success, confirm it closes.
5. Record the issue number and what each call returned.
6. Update `README.md`, `CURRENT_STATE.md`, `TODO.md`.

## Acceptance criteria

- [ ] A simulated failure creates exactly one issue, read back from the API.
- [ ] A second simulated failure adds a comment and creates **no** second
      issue, proven by the open-issue count staying at one.
- [ ] A simulated success closes that issue, proven by its `state`.
- [ ] The workflow requests `issues: write` and nothing wider, and adds no
      repository secret.
- [ ] No third-party action appears in it; every call is `curl` or `python3`
      against the REST API with the built-in token.
- [ ] `validate.yml` and `dashboard.yml` are unchanged.
- [ ] `tests/validate.sh` exits `OK`.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed)
- [ ] The three simulated runs, each conclusion read from the API
- [ ] The issue's state read back after each

## Risks and rollback

- **Alert fatigue.** One issue per failing commit would get muted, leaving
  the project exactly where it started but noisier. Mitigated by reuse, and
  it is criterion 2.
- **A stuck-open issue.** If the recovery path fails, a green project carries
  a red issue and the signal inverts. Mitigated by testing the close path
  explicitly rather than only the open path.
- **Testing by breaking `master`.** Tempting and wrong: it would put a real
  red commit in history to test an alert. The dispatch simulation exists to
  avoid it.
- **An alert that cannot itself fail.** If the issue call errors, the alert
  job must fail visibly rather than exit 0 — otherwise this becomes another
  unread second opinion, which is the defect it exists to answer.
- **Rollback:** delete the workflow and close any open marker issue. Nothing
  else is touched.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          | what it now contains, plus anything deliberately *not* changed |

**Next task starts here**: one line naming the state the next task picks
up from — not a prediction of what that task will be. Record any
deviation from the Plan here too: the next task may have been scoped
against the original.

## Status

- Status: in_progress   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-28
- Updated: 2026-09-28

Routed by the human on 2026-09-28 from the open question `TASK-0123` left,
choosing the issue route over SMTP and over relying on the account setting.

## Execution log

### Attempt 1

- Date: 2026-09-28
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
