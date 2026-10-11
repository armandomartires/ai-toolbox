# TASK-0159 — Rebuild the dashboard at plan approval and on push; ask about Pages

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-11
- Updated: 2026-10-11
- Applies to: `skills/project-workflow/`, `skills/project-migration/`
- Source: human request 2026-10-11 ("The dashboard file needs to be updated when ... All projects that use remote git github and / or gitlab should request the user ..."); `ADR-0035`

## Objective

The agent rebuilds the dashboard when an approved plan's files are written and after a confirmed push. Every project with a remote is asked once whether to publish to GitHub Pages and/or GitLab Pages, and a "no" is recorded so it is not asked again.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `project-workflow` | 6.1.0; builds on demand, no rebuild points; publishing only if a conf is written |
| `publish_lib.py` | `render` and `guard`; refuses an empty `targets`; no remote detection |
| `ADR-0029` | only CI builds the published page; `AGENTS.md`: not run by any hook |

## Scope

- In: `targets = none`; `publish-dashboard.sh decision`; rebuild points and the question in both planning skills; `git-workflow.md`.
- Out: any git hook; a GitLab schedule; the vendored generator; this repo's conf (already answered).

## Likely files

- `skills/project-workflow/{SKILL.md,references/dashboard.md,scripts/publish_lib.py,scripts/publish-dashboard.sh,scripts/check-publish.sh,templates/reference/git-workflow.md}`
- `skills/project-migration/SKILL.md`, `AGENTS.md`, `.ai/` live files

## Execution plan

1. `load_conf` accepts `none` alone; `render` writes nothing for it and still reports orphans.
2. `decision`: remotes as host plus forge, exit 1 while unanswered, never a URL.
3. Add cases to `check-publish.sh`, and prove them red against `HEAD`'s `publish_lib.py`.
4. Add the rebuild points and the question to both skills (6.2.0, 4.2.0), plus `ADR-0035`.

## Acceptance criteria

- [x] `targets = none` renders nothing; mixed with a target, or with a `status.` line, it is refused.
- [x] Switching from a yes to `none` reports the pipeline left deploying.
- [x] `decision` exits 1 for a remote without a conf, names `github.com` as github and a self-hosted host as unknown, and prints no userinfo.
- [x] Both skills name the two rebuild points and ask the question without choosing for the human.

## Mandatory validations

- [x] tests/validate.sh
- [x] check-publish.sh against `HEAD`'s `publish_lib.py` (red proof)

## Risks and rollback

- **The forge guess is a hint.** `unknown` is asked about, never assumed.
- **A rebuild point is a step, not a mechanism.** An agent that skips it leaves a stale local file. The published page does not depend on it.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `project-workflow` | 6.2.0: step 7, *Rebuild it*, `decision`, `targets = none` |
| `project-migration` | 4.2.0: Phase 1 step 6, Phase 2 step 7, rebuild points |
| `check-publish.sh` | 59 cases |

Next: the first project scaffolded or migrated after this asks the question live.

## Execution log

- 2026-10-11 · Claude Code (Opus 5.5) · done
  - Evidence: `bash skills/project-workflow/scripts/check-publish.sh` (Git Bash) → `1 of 59 case(s) FAILED`, the known symlink case (`TASK-0148`)
  - Evidence: the same suite against `git show HEAD:…/publish_lib.py` → `11 of 59 case(s) FAILED`; ten new cases red
  - Evidence: `publish-dashboard.sh decision` on this repo → exit 0, `answered github-pages github-pages-daily gitlab-pages`
  - Deviation: none
