# Reference: the work tracker (files, GitLab or GitHub)

Read this when `tracker.conf` names `gitlab` or `github`, or before touching an issue, a milestone or the wiki.

## The declaration

The project chooses at scaffolding where its work is tracked, and `scripts/tracker.sh init` writes the answer to a tracked `tracker.conf` at the repository root:

```
tracker = files                       # this .ai/ layer, as the rest of this convention describes
tracker = gitlab                      # GitLab issues, milestones, boards, labels, wiki
gitlab_project = group/subgroup/name
tracker = github                      # GitHub issues, milestones, Projects, wiki
github_repo = owner/name
```

- **Absent means `files`.** Every project governed before the question existed tracks its work in files.
- **The path is a name, never a host or URL.** `glab` and `gh` take the host from their own configuration.
- `tracker.sh check` prints the declaration, and `tracker.sh decision` lists it beside the remotes.
- Changing tracker is a decision: record an ADR, then migrate in its own task.

## What stays in the repository, in every mode

`AGENTS.md`, this convention's entry point, `reference/`, `decisions/` (ADRs) and developer and operations docs in `docs/`. These are the rules and the *why*. They are versioned with the code, and an agent can start a session from them offline.

## What moves to the forge

| `.ai` artifact (project-workflow / project-migration) | GitLab | GitHub |
|---|---|---|
| Task brief `S###.T###_Name.md` / `TASK-####-*.md` | Issue; body = the task schema; `status::` label; milestone = its sprint | Issue; same; an item in the Project |
| Sprint (`30.ROADMAP.md` row / `SPRINT-CURRENT.md`, a `TODO.md` heading) | Milestone `S###_Name` (or `S#`); due date = sprint end | Milestone; optionally a Project iteration |
| Plan in flight (`20.PLAN.md` / `plans/PLAN-*.md`) | The issue board, one column per `status::` label | The Project's board view |
| Roadmap phases and deferred work (`30.ROADMAP.md` / `ROADMAP.md`) | Milestones ordered by due date; `phase::N` label; deferred = `status::deferred` | Same; the Project's roadmap view |
| Backlog (`35.AD_HOC_TASKS.md` promoted / `BACKLOG.md`) | Issue `type::backlog` with `priority::`, `value::`, `risk::`; *Ready when* is its first line | Same, with `priority: x` labels |
| Ad-hoc note (`35.AD_HOC_TASKS.md`) | Issue `type::adhoc`; promoting it = relabel `type::task` and set the milestone | Same |
| Review checkpoint (`reviews/`) | Issue `type::review` in the milestone, closed when written | Same |
| Session record (project-migration `sessions/`) | The task report, as the issue's closing comment | Same |
| End-user documentation | The project wiki | The repository wiki |
| Dashboard | Not applicable: boards and milestone progress | Not applicable: Project views |

The forge's object is then the only owner. Do not keep a copy in `.ai/`.

## Identifiers and commits

- A task's id is its issue number. The commit subject is `<Imperative summary> (#123)`, and `git log --grep '#123'` finds it. Git is still the record: the issue never carries the hash.
- **No closing keywords** (`Closes #123`) in a commit. They close the issue before the push to every remote is confirmed. Close it by hand, with the task report as the last comment.
- A cross-project reference is `group/name#123` (GitLab) or `owner/name#123` (GitHub).

## The issue body

Generate it as a file and check it, exactly as a brief: `scripts/new-artifact.sh --kind task --out /tmp/brief.md`, then `scripts/check-artifact.sh /tmp/brief.md`. Paste the result as the description. The schema's headings keep their names on the forge. Its after-the-work sections are filled when the work is done, and the issue description is edited.

## Labels and statuses

| Status (project-workflow / project-migration) | On the forge |
|---|---|
| `not started` / `planned` | open, no `status::` label |
| `ready` | open, `status::ready` |
| `in progress` / `in_progress` | open, `status::in_progress` |
| `blocked` | open, `status::blocked`, with a `Blocked by #N` line |
| `review` | open, `status::review` |
| `completed` / `done` | closed |
| `cancelled` | closed with `cancelled` (GitHub: closed as *not planned*) |

GitLab scoped labels (`status::x`) make the statuses exclusive. GitHub has no scoped labels, so use `status: x` and keep one per issue by hand. `type::` takes `task`, `adhoc`, `backlog` or `review`.

## The wiki

The wiki holds **end-user documentation only**: how to install and use what the project ships. Rules, decisions and developer or operations docs stay in the repository.

The wiki is a separate git repository, `<project>.wiki.git`. Clone it beside the project, commit there, and push it like any repository. `AGENTS.md` links the wiki's home.

## Access

1. `command -v glab` (GitLab) or `command -v gh` (GitHub). If it is absent, stop and say so; do not fall back to the web UI on the human's behalf.
2. `glab auth status` or `gh auth status`.
3. The token is a secret like any other (`reference/environments-and-secrets.md`). Name it and never print it: `GITLAB_TOKEN` for `glab`, `GH_TOKEN` for `gh`. With a `local` or `vault` secrets backend, run each call through `vault_secrets.py exec GITLAB_TOKEN -- glab …`. With a `gitlab` or `github` backend, values are CI-only, so the human exports the token for the session.
4. A self-hosted GitLab: `glab` reads `GITLAB_HOST`. Set it in the shell from the instance's URL. It never goes in a tracked file.

## What the forge's tier gives you

- **GitLab Free:** issues, tasks (child work items), milestones, boards, labels and wiki. Burndown and burnup charts, epics, iterations and the *blocks* link are paid tiers. On Free, a dependency is a related issue plus a `Blocked by #N` line.
- **GitHub Free:** issues, sub-issues, milestones, Projects (board, table and roadmap views, iteration fields) and wiki. Historical Project charts need a paid plan. A private repository's wiki needs a paid plan.

## Not yet covered

`loops/unattended-run/` and the agent roles in ai-toolbox read a task file and a `TODO.md` row. A forge-tracked project runs tasks by hand until they learn to read an issue.
