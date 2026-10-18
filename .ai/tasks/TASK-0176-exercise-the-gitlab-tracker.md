# TASK-0176 — Exercise the GitLab tracker and a forge unattended run for real

## Status

- Status: blocked
- Owner: agent, with the human for the forge and secret steps
- Created: 2026-10-19
- Updated: 2026-10-19
- Applies to: `skills/project-workflow/` (`tracker.sh`, `reference/tracker.md`), `loops/unattended-run/`, the OpenCode binding; a scratch GitLab project outside this repository
- Source: `B-056` (`ADR-0039`); human decisions 2026-10-19: intranet GitLab, the OpenCode binding, the agent installs `glab`

## Objective

`B-056` holds the cap's first slot: the `gitlab` tracker and the unattended run's issue snapshot (`ADR-0037`, `ADR-0038`) have run against fixtures only. Run each step once against a real GitLab project: scaffold, issue, snapshot lock, one OpenCode unattended run, then the after-push forge updates. Close `B-056` on what that shows, and raise a row for every defect found.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `glab` | absent from this host |
| GitLab API token | none mapped; `GITLAB_PUSH_TOKEN` reaches `origin` only, and `GITLAB_TOKEN` is in no map (`AGENTS.md`) |
| `opencode` | 1.18.35; 15 roles in `~/.config/opencode/agents/`; no default model, and the pilot's Perplexity provider is gone |
| `tracker.md` *Unattended runs* | snapshot commands marked "not run from this skill yet" |
| OpenCode driver | forge-aware since `TASK-0172`; 48 stub tests |

## Scope

- In: a pinned `glab` in `~/.local/bin`; a scratch repository `forge-tracker-pilot`, scaffolded with `tracker = gitlab`; one issue as the run's task; snapshot, lock, run, handover; the forge updates after a confirmed push; doc fixes this repository owns where the pilot proves a claim false; `B-056` closed.
- Out: creating the project, its token, the Vault value and the map line (the human's); a second task or run; fixing driver or role defects beyond a doc correction (each becomes a row); GitHub.

## Likely files

- Here: `.ai/planning/BACKLOG.md`, `.ai/context/CURRENT_STATE.md`, `skills/project-workflow/templates/reference/tracker.md`, `.ai/tasks/TODO.md`
- There (scratch, not tracked here): `tracker.conf`, `.ai/`, `.ai/run-queue/<n>.md`, the filled binding, a gate map outside the repo

## Execution plan

1. Install a pinned `glab` release into `~/.local/bin` and verify its checksum.
2. **Human:** create a private project `forge-tracker-pilot`, plus a project access token (scopes `api`, `write_repository`), written to Vault and mapped as `PILOT_GITLAB_TOKEN` in a per-host map. Name the model for the run.
3. Clone it under `~/work/sigmarecon/`; scaffold with `project-workflow`, answering `gitlab`; commit and push.
4. With `glab` (token through `vault_secrets.py exec`; `GITLAB_HOST` from `$GITLAB_URL`): create the labels, then one issue whose body comes from `new-artifact.sh --kind task` (a small code change with a unit test), labelled `status::ready`.
5. Snapshot it per `tracker.md`, check it with `check-artifact.sh`, commit the lock.
6. Fill the OpenCode binding (`tracker_path: not-applicable`, `(#{id})`, gate map outside the repo); `check-binding.sh`; run the driver once.
7. Verify: the commit carries `#<n>`, the gates passed, and the handover lists *Forge updates, NOT taken*. Push and confirm.
8. With the human present: replace the issue description with the snapshot, post the task report, close the issue, `git rm` the snapshot.
9. Fix what this repo's docs got wrong; raise a row per other finding; close `B-056`.

## Acceptance criteria

- [ ] Each snapshot command in `tracker.md` has run for real, or is corrected to one that has.
- [ ] One issue went ready → locked → run → closed, and its commit is found by `git log --grep '#<n>'`.
- [ ] No role ran `glab` or `gh`, shown by the run's journal.
- [ ] `B-056` is closed by this task; the `Unexercised:` count is 2.
- [ ] Every finding is fixed here or is a backlog row.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] `check-binding.sh` on the filled binding; `check-artifact.sh` on the snapshot
- [ ] `git ls-remote` on the scratch project equals its `HEAD` before step 8

## Risks and rollback

- **The run fails before the forge steps.** That still counts as an exercise: record it, park, and raise rows. `B-056` closes only if steps 5–8 each ran once.
- **A token leaks into the scratch repo.** It is private; the private-names and secrets rules apply there too, and it is never pushed to `github`.
- Rollback: git revert the task commit; the human deletes the scratch project

## Outputs / handover

| Artifact | End state |
|----------|-----------|
|          |           |

Next:

## Execution log

- 2026-10-19 · Claude Code (Opus 5.5) · blocked at step 2: paused by the human
  - Evidence: `glab --version` → `glab 1.119.0 (f5016eda2)`, from `~/.local/bin`, release checksum `OK`
  - Evidence: `vault_secrets.py exec PILOT_GITLAB_TOKEN -- …` → `not in secrets.map, …/ai-toolbox.map: PILOT_GITLAB_TOKEN`
  - Deviation: reusing `GITLAB_PUSH_TOKEN` was declined: it is `read_repository` + `write_repository` on ai-toolbox only (`ADR-0028`), so it reaches neither the pilot project nor the API. Resume at step 2 once the pilot's own token is mapped
