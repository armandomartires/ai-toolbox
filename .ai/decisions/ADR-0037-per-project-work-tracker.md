# ADR-0037 — Each project declares its work tracker: files, GitLab or GitHub; the dashboard is files-only

**Status**: accepted
**Date**: 2026-10-18
**Task**: TASK-0171

## Context

Both planning skills assumed that work is tracked in the `.ai/` layer they scaffold, and the delivery dashboard renders that layer. On 2026-10-18 the human asked that initialization offer three choices:
- the file-based `.ai/` structures;
- GitLab Plan: work items, issues, milestones, and the wiki for user documentation;
- GitHub: Projects, milestones, issues, and the wiki for user documentation.

The human also observed that forge tracking should make the dashboard unnecessary there.

## Decision

1. **A project declares its tracker** in a tracked `tracker.conf` at the repository root: `tracker = files | gitlab | github`, plus `gitlab_project` or `github_repo` for a forge. The path is a name, never a host or URL. **A missing conf means `files`.** New scaffolds write it anyway, so the answer is visible. `project-workflow`'s `tracker.sh` reads, checks and writes it, and `init` never overwrites.
2. **What stays in the repository in every mode:** `AGENTS.md`, the entry point and references, ADRs, `CURRENT_STATE.md` and `PROJECT_MAP.md`, and developer and operations docs. **What moves to a forge:** tasks become issues, sprints become milestones, and the plan is the board. Backlog, ad-hoc and review items become labelled issues. A session record becomes the issue's closing comment. The table is `templates/reference/tracker.md`.
3. **The dashboard applies only to `files`.** On a forge:
   - `build-dashboard.sh` exits 2;
   - `publish-dashboard.sh decision` answers `not applicable`;
   - `render --check` exits 1 while a conf still declares targets or a generated pipeline still deploys.
4. **The wiki holds end-user documentation only.** Developer and operations docs stay in `docs/`, versioned with the code.
5. **This is a convention plus a declaration, with no tooling over the forge.**
   - Agents use `glab` and `gh` by hand, following the reference.
   - Tokens come by name through the project's secrets backend (`ADR-0034`).
   - Issue bodies are still generated from the task schema and checked (`ADR-0027`).
6. **On a forge, the commit subject names the issue:** `(#123)`, with no closing keyword. The issue is closed by hand once the push to every remote is confirmed, with the task report as its last comment. `ADR-0033` holds otherwise: git is the record.
7. **ai-toolbox declares `files`.** Its gate asserts it, since its dashboard is published (`ADR-0029`).

## Alternatives considered

- **A `tracker` key in `.ai-layout.json`:** rejected. That file says where the layer is, not whether its planning half exists. `project-migration` never reads it, and its resolver refuses unknown keys.
- **Mixing modes per artifact,** for example tasks on the forge and the roadmap in files: rejected. "What's next" would have two owners, and the board could not show work that lives in files.
- **The dashboard reading the forge's API:** rejected. It needs a token and the network, which a gate must not. It duplicates the forge's own boards, and the generator is vendored from `sigma-llmwiki`, not ours to extend.
- **The wiki holding all docs:** rejected. `docs/` is "what is" and changes with the code in one commit. A wiki is a second repository with no review on the same diff.
- **`gh`/`glab` wrappers now:** deferred by the human. The convention should be used on one real project before tooling encodes it.

## Consequences

- An existing project is unaffected: no conf means `files`, and every earlier suite stays green.
- `check-tracker.sh` is in the gate, and so is a check that the scaffold's `tracker.conf` is the one `tracker.sh` reads.
- `loops/unattended-run/` and the agent roles still read a task file and a `TODO.md` row. A forge project runs tasks by hand until `B-055`.
- Nothing proves a forge project works until one is scaffolded: `gh` and `glab` are not on the authoring host.
- `project-workflow` is 7.0.0 and `project-migration` is 5.0.0. Briefs become issues in a declared mode, which changes how artifacts are produced.
