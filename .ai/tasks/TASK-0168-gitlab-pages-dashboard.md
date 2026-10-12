# TASK-0168 — Publish the dashboard to GitLab Pages as well, rebuilt daily

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-12
- Updated: 2026-10-12
- Applies to: `dashboard-publish.conf`, `.gitlab/ci/dashboard-pages.yml` (re-rendered), `README.md`, `.ai/context/CURRENT_STATE.md`
- Source: human request 2026-10-12 ("we need the dashboard published to both GitLab and GitHub"); human routing: a runner already exists, check whether Pages is enabled, add a daily GitLab rebuild by pipeline schedule

## Objective

`TASK-0127` declared both destinations. GitHub published; GitLab never did, because no runner was online. Make GitLab publish, observe it, and give it the daily rebuild GitHub has.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `dashboard-publish.conf` | `gitlab-pages` declared, `UNVERIFIED` (pipeline 10 pending) |
| `.gitlab/ci/dashboard-pages.yml` | `pages` job, untagged, rule `$CI_COMMIT_BRANCH == "master"` |
| `origin`, project 17 | `pages_access_level: private`, shared runners enabled |

## Scope

- In: diagnosing why the job never ran; a pipeline schedule on `master`; recording the observed runs.
- Out: any change to the job template (none was needed); moving `validate` or `ci-alert` to GitLab (`ADR-0028`); making the page public.

## Likely files

- `dashboard-publish.conf`, `.gitlab/ci/dashboard-pages.yml`, `README.md`, `.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`

## Execution plan

1. Probe project 17 read-only: runners, recent pipelines, Pages, schedules.
2. Explain the failed job before changing anything.
3. Create schedule 1 and play it; read the job log for the guard line and the Pages deployment.
4. Move the status label against the observed run; re-render; document.

## Acceptance criteria

- [x] A `pages` job on `origin` succeeds from a full clone, and the guard line says so.
- [x] Pages holds a deployment from it.
- [x] A daily schedule on `master` exists and its played pipeline succeeded.
- [x] `status.gitlab-pages` names the observed run; the rendered STATUS line agrees.
- [x] No tracked file names the Pages host.

## Mandatory validations

- [x] `bash skills/project-workflow/scripts/publish-dashboard.sh render --check`
- [x] tests/validate.sh (WSL)

## Risks and rollback

- **The schedule is not in the tree.** It lives in GitLab's settings; `dashboard-publish.conf` names it in a comment. Deleting it there stops the daily rebuild silently, and only the page's *as of* date shows it.
- **Two daily rebuilds, two hosts.** The GitLab schedule fires at 00:47 UTC; GitHub's at 00:23, started hours late. The two pages can carry different *as of* dates on the same commit.
- **The page is private** (`pages_access_level: private`): readers need a GitLab login.
- Rollback: git revert the task commit; deactivate schedule 1.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `gitlab-pages` | `VERIFIED` on scheduled pipeline 165 |
| schedule 1 | `master`, `47 0 * * *` UTC, active |

Next: confirm the first unattended scheduled run (2026-10-13 00:53 UTC) succeeds.

## Execution log

- 2026-10-12 · Claude Code (Opus 5.5) · done
  - Evidence: GitLab API, project 17 → runner 3 (instance, docker), online, `run_untagged: true`, `access_level: not_protected`; Pages enabled, 0 deployments; 0 schedules
  - Evidence: pipeline 119 (`b150660`, push) → job 201 `failed`, `stuck_or_timeout_failure`, no runner, empty log, 95 min queued. Runner 3's current manager first ran jobs 2026-10-12 ~01:01, after that; the job was dropped as stuck, not refused. Pipelines 113–116 were canceled
  - Evidence: schedule 1 played → pipeline 165 (`b150660`, schedule) → job 278 `success` on runner 3, 59 s; log: `history OK: 356 commits, 164 task briefs, shape numbered_task, full clone`; pipeline 166 the same (job 280); Pages deployment created 2026-10-12 10:07:30 UTC
  - Deviation: the GitLab API probes were run by the human, from WSL: the agent's own call was denied by the auto-mode classifier as credential exploration, as in `TASK-0126`
  - Deviation: the schedule script ran twice, so the schedule was played twice (pipelines 165 and 166); harmless
