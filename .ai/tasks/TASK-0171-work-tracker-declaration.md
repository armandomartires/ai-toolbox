# TASK-0171 — Each project declares its work tracker: files, GitLab or GitHub

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-18
- Updated: 2026-10-18
- Applies to: `skills/project-workflow/`, `skills/project-migration/`
- Source: human request 2026-10-18 ("We need to choose in the initialization if we want to use … file based … Gitlab Plan … Github projects"); `ADR-0037`

## Objective

At initialization both planning skills ask which work tracker a project uses: `files` (the `.ai/` layer), `gitlab` or `github` (issues, milestones, boards, wiki for end-user docs). The answer is a tracked `tracker.conf`; absent means `files`. The dashboard applies only to `files`.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `project-workflow` | 6.3.0; files only; no tracker question |
| `project-migration` | 4.2.0; scaffold always writes `planning/`, `tasks/`, `sessions/`, `reviews/` |
| `check-publish.sh` | 59 cases |
| `00.CONVENTIONS.md` | 3056 bytes of a self-declared 3072 |

## Scope

- In: `tracker.sh` (`check`, `decision`, `init`); files-only guards in `build-dashboard.sh` and `publish_lib.py`; scaffold `--tracker`; `reference/tracker.md`; both skills' docs; this repo's `tracker.conf`.
- Out: `gh`/`glab` wrappers (human's choice); forge-aware loops and agent roles (`B-055`); the vendored generator; wiki tooling.

## Likely files

- `skills/project-workflow/{SKILL.md,references/dashboard.md,scripts/{tracker.sh,tracker_lib.py,check-tracker.sh,build-dashboard.sh,publish_lib.py,check-publish.sh},templates/00.CONVENTIONS.md,templates/reference/*.md}`
- `skills/project-migration/{SKILL.md,references/governance-spec.md,scripts/ai-project-scaffold.sh}`
- `tests/validate.sh`, `tracker.conf`, `AGENTS.md`, `.ai/` live files, `docs/registry.md`

## Execution plan

1. `tracker_lib.py` + `tracker.sh`: grammar, `check`, `decision`, `init` (never overwrites).
2. `build-dashboard.sh` exits 2 on a forge; `publish_lib.py` `decision` is not applicable there and `render --check` reports a stale conf.
3. `check-tracker.sh`, wired into `tests/validate.sh`; prove it red against `HEAD`'s scripts.
4. Scaffold `--tracker`: write the conf; skip the forge-owned directories on a forge.
5. Docs: both skills (7.0.0, 5.0.0), `reference/tracker.md`, `ADR-0037`; `B-055`.

## Acceptance criteria

- [x] No `tracker.conf`: `check` prints `files` and every existing suite is unchanged.
- [x] `init` writes only when absent, refuses a different conf, and refuses a host or URL as the project path.
- [x] On a forge, `build-dashboard.sh` exits 2 and `publish-dashboard.sh decision` says not applicable.
- [x] A forge scaffold has `tracker.conf` and no `.ai/tasks/`; a files scaffold is as before.
- [x] Both skills ask the question without choosing for the human.

## Mandatory validations

- [x] tests/validate.sh
- [x] check-tracker.sh against `HEAD`'s `build-dashboard.sh` and `publish_lib.py` (red proof)

## Risks and rollback

- **The forge mapping is unexercised.** No project has run on it; `gh` and `glab` are not on this host.
- **Loops still read files.** `loops/unattended-run/` cannot drive a forge project until `B-055`.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `project-workflow` | 7.0.0: Scaffolding step 3 asks the tracker; *The work tracker*; `tracker.sh`; `reference/tracker.md` |
| `project-migration` | 5.0.0: Phase 1 step 5; scaffold `--tracker`; forge rules in `governance-spec.md` |
| `check-tracker.sh` | 49 cases, in the gate; `check-publish.sh` 60 |
| `00.CONVENTIONS.md` | 3063 bytes |
| ai-toolbox | `tracker.conf` = `files`; `B-055` open |

Next: scaffold the first project on a forge tracker and exercise `tracker.md` live.

## Execution log

- 2026-10-18 · Claude Code (Opus 5.5) · done
  - Evidence: `bash skills/project-workflow/scripts/check-tracker.sh` → `OK (49 cases)`; `check-publish.sh` → `OK (60 cases)`
  - Evidence: the suite against `HEAD`'s skill plus the three new files → `11 of 49 case(s) FAILED`, every build and publish case; without `tracker_lib.py` → `39 of 49`
  - Evidence: `tests/validate.sh` → `validate.sh: OK`; with this repo's conf set to `gitlab` → `TRACKER: … must say files`
  - Evidence: a files scaffold diffs from `HEAD`'s only by `tracker.conf` and one ADR-0001 sentence
  - Deviation: the tracker question is Scaffolding step 3, not 6, because its answer decides what step 4 copies
