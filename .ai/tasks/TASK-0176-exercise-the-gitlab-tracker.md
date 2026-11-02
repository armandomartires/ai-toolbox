# TASK-0176 — Exercise the GitLab tracker and a forge unattended run for real

## Status

- Status: done
- Owner: agent, with the human for the forge and secret steps
- Created: 2026-10-19
- Updated: 2026-11-02
- Applies to: `skills/project-workflow/` (`tracker.sh`, `reference/tracker.md`), `loops/unattended-run/`, the OpenCode binding; a scratch GitLab project outside this repository
- Source: `B-056` (`ADR-0039`); human decisions 2026-10-19: intranet GitLab, the OpenCode binding, the agent installs `glab`; 2026-11-02: the run's model is `xai/grok-4.7`, through opencode's own xAI login, since no omniroute, LM Studio or OpenRouter endpoint answers

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

- [x] Each snapshot command in `tracker.md` has run for real, or is corrected to one that has.
- [x] One issue went ready → locked → run → closed, and its commit is found by `git log --grep '#<n>'`.
- [x] No role ran `glab` or `gh`, shown by the run's journal.
- [x] `B-056` is closed by this task; the `Unexercised:` count is 2.
- [x] Every finding is fixed here or is a backlog row.

## Mandatory validations

- [x] tests/validate.sh
- [x] `check-binding.sh` on the filled binding; `check-artifact.sh` on the snapshot
- [x] `git ls-remote` on the scratch project equals its `HEAD` before step 8

## Risks and rollback

- **The run fails before the forge steps.** That still counts as an exercise: record it, park, and raise rows. `B-056` closes only if steps 5–8 each ran once.
- **A token leaks into the scratch repo.** It is private; the private-names and secrets rules apply there too, and it is never pushed to `github`.
- Rollback: git revert the task commit; the human deletes the scratch project

## Outputs / handover

Next: none. The stale project path in the handover is the pilot's own `tracker.conf`; the two superseded park stashes in the pilot are the human's.

## Execution log

- 2026-10-19 · Claude Code (Opus 5.5) · blocked at step 2: paused by the human
  - Evidence: `glab --version` → `glab 1.119.0 (f5016eda2)`, from `~/.local/bin`, release checksum `OK`
  - Evidence: `vault_secrets.py exec PILOT_GITLAB_TOKEN -- …` → `not in secrets.map, …/ai-toolbox.map: PILOT_GITLAB_TOKEN`
  - Deviation: reusing `GITLAB_PUSH_TOKEN` was declined: it is `read_repository` + `write_repository` on ai-toolbox only (`ADR-0028`), so it reaches neither the pilot project nor the API. Resume at step 2 once the pilot's own token is mapped
- 2026-10-22 · Claude Code (Opus 5.5), session `WIP - AI development methodology review` (recorded 2026-11-02 from its transcript) · steps 2–6 except the run
  - Evidence: the human made `forge-tracker-pilot` and mapped `PILOT_GITLAB_TOKEN` (pilot `secrets.conf`: `local`); `f54cd5b` scaffold, `tracker = gitlab`; issue #1 `status::ready` + `type::task`, milestone `S001_Pilot`; `tracker.md`'s `glab` snapshot ran unchanged, byte-identical to the issue body; `6ea48b7` lock; `a1b8ef6` binding (`omniroute/cc/claude-sonnet-5`).
  - Blocked at step 6: the omniroute model call hung 90 s; no run.
- 2026-11-02 · Claude Code (Opus 5.5) · resumed at step 6
  - Evidence: no omniroute, LM Studio or OpenRouter; the human chose `xai/grok-4.7` and re-logged xAI; `check-binding.sh` → `BINDING OK`; smoke → `ok`; pilot `3bf39d2`.
  - Deviation: the GitLab reorganization had moved the project to `sigmarecon/archive/` and archived it (push → `403`); the human unarchived it; pushed through the redirect, `ls-remote` → `3bf39d2`. Re-pointing the clone's `origin` was refused by auto mode, left to the human. A `--dry-run` still makes model calls; a 120 s limit stopped it (kept as `pilot-20261022.dryrun-sigterm/`).
  - Run `pilot-20261022`, 15:34–16:29: attempt 1 unit PASSED, `retry`; attempt 2 unit PASSED (4 tests), `park` ("criterion 5 is unevidenced"); park-steward stashed the two files, tree clean, then the driver halted. No commit.
  - Finding: opencode denied compound commands (`echo "---NAME-ONLY---"; git diff …`) for the `echo` (fixed by `TASK-0209`); the journal's `tool-denied` counts every tool error, not only denials.
  - Finding: the handover's forge text names the pilot's stale `tracker.conf` path.
  - Rerun `pilot-20261102` after `TASK-0209`, 16:52–17:35: no compound-command denial recurred (3 real denials: `git rev-parse HEAD`, the gate map outside the repo, a `python3 -c`); unit PASSED twice; `retry`, then `park` on criterion 5 again; halted again at the park check. Parked work: `stash@{0}`, the first run's `stash@{1}`.
  - Finding (fixed by `TASK-0210`): no role could evidence criterion 5, and the park check matched the whole reason in `git stash list`, which shows one line, so a clean park halted.
  - Run `pilot-20261102b` on `TASK-0210`'s driver (pilot `f28c1e3`), 20:57–21:11: `changes` → `pilot/text.py`, `tests/test_text.py`; unit PASSED; `accept` on attempt 1; closer `5333c6c Add slugify that collapses non-alnum runs (#1)` (3 files: the two and the snapshot); `git log --grep '#1'` finds it; journal and opencode log show no `glab` or `gh`; handover lists the forge update for #1 as NOT taken.
  - Step 8, with the human: pushed `5333c6c`, `ls-remote` equal; through `glab` and `PILOT_GITLAB_TOKEN`: description replaced (equal to the snapshot), task report posted (note 1183), issue closed, `status::ready` removed; `b77698e Remove the closed #1's snapshot`, pushed. `tracker.md` said nothing of the label: fixed (`project-workflow` 7.1.3). `B-056` closed; `Unexercised:` rows 2; the `tool-denied` finding is `B-067`; `check-artifact.sh` on the snapshot (`git show 6ea48b7:…`) → `OK`.
