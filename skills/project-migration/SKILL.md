---
name: project-migration
description: "Harmonize an existing repository with the .ai agent-governance framework (AGENTS.md, CLAUDE.md, .ai/ context, decisions, planning, tasks, sessions, reviews). Use when asked to migrate, retrofit, restructure, or onboard a project for multi-agent work, or to scaffold that structure in a new repo. Not for ordinary feature work inside an already-governed repo."
license: MIT
metadata:
  author: amartires
  version: 1.1.0
---

# Project migration to the .ai governance framework

Retrofit a live repository so a human, a planning model, and a weaker executor model can all resume work from files instead of conversation history.

**Not `project-workflow`.** These scaffold two different frameworks, deliberately (ADR-0013 in `ai-toolbox`). This one: `.ai/context/`, `.ai/planning/`, `.ai/sessions/`, `.ai/templates/`, `TASK-####-*.md`, `ADR-NNNN-*.md`, entry point `AGENTS.md` — for migrating an existing repo. The other: `00.CONVENTIONS.md` + `20.PLAN.md`/`30.ROADMAP.md`/`35.AD_HOC_TASKS.md` + `reference/`, `S###.T###` tasks, `NNNN-title.md` ADRs — for maintaining the planning convention in a project that already has one. Pick one per project; do not mix them, and do not "align" the ADR filenames. The additive scaffold in this skill's own `scripts/ai-project-scaffold.sh` is the canonical structure — never hand-create the file layout, and never propose a big-bang reorganization. Invoke the script from the skill's own directory, never from a path relative to the target repo: `bash "<skill dir>/scripts/ai-project-scaffold.sh" …`. The script is not marked executable in every checkout, so always run it via `bash`, not by direct execution.

## Hard rules

- Phase 1 modifies nothing. Do not create, move, or delete files until the user approves the proposal.
- The scaffold is additive only: it skips every file that already exists. Run it with `--force` inside an existing repo; that flag permits adding into a non-empty directory, it does not overwrite.
- Relocate existing files with `git mv`, never copy-then-delete, so `git log --follow` survives.
- Never delete the old structure until the new one is validated and free of broken references.
- Never invent requirements, commands, or environments. Leave `<!-- FILL -->` markers rather than guessing, and ask the user when ambiguity is material.
- Never commit secrets, tokens, or `.env` files; run a secrets scan before the first push.
- Never force-push. If a push fails, diagnose and report — do not declare the task done.

## Phase 1 — Inventory and mapping (read-only)

1. Inspect repo structure, `git status`, branch, remotes, uncommitted changes, and recent commits.
2. Locate existing instruction and planning artifacts: `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.ai/`, `.ai/workflow/`, `CONVENTIONS`/`PLAN`/`ROADMAP`/`AD_HOC_TASKS` files, README, docs, CI config, test and build commands, and secrets exposure.
3. Build the mapping table — one row per existing artifact: `| Current path | Responsibility | Proposed destination | Action (move/merge/keep/archive) |`.
4. Flag duplicated, contradictory, and obsolete information, and which content becomes `AGENTS.md` rules, history, tasks, or ADRs.
5. Present the proposal using the response format below and stop for approval.

Answer in these sections: **Understanding**, **Project inventory**, **Diagnosis**, **Current → proposed mapping**, **Proposed structure**, **Migration plan**, **Risks and pending decisions**, **Next step**.

## Phase 2 — Additive overlay (after approval)

1. `git checkout -b chore/ai-governance-migration` — the merge commit is the single rollback point.
2. Run the scaffold against the repo root, using the skill's own script path (never the target repo's `scripts/`): `bash "<skill dir>/scripts/ai-project-scaffold.sh" . --force --type python|node|generic`. Add `--no-git` when the repo already has history you do not want touched.
3. Fill `AGENTS.md` from reality: the project's actual install/run/test/lint/build commands and real conventions. Keep it lean — invented or generic requirements make agent tasks measurably worse. Read `references/governance-spec.md` for its required contents.
4. Create `CLAUDE.md` as a symlink (`ln -s AGENTS.md CLAUDE.md`), confirm git recorded mode `120000`, and on Windows/WSL where symlinks are unreliable use a documented alternative plus an ADR. Two divergent sources of truth are the failure to avoid.
5. Backfill only `CURRENT_STATE.md`, `PROJECT_MAP.md`, and `ROADMAP.md`, as a snapshot of today. Do not reconstruct history.
6. Commit the scaffold as one commit; each later migration step gets its own.

## Phase 3 — Move content selectively

- Do not repackage working code into `src/` unless the project is under heavy active development. Leave the layout, document it in `PROJECT_MAP.md`, and record the deliberate choice in an ADR.
- Merge old roadmaps and task files into `.ai/planning/` and `.ai/tasks/`, or archive them — never leave two competing sources of truth.
- Prune scaffold directories that do not apply (e.g. `docs/deployment/` for a library). A smaller final structure is correct; bureaucracy without value is not.
- Adopt task discipline forward only: the first `TASK-0001.md` is the first new work after migration, not a rewrite of past work.

## Phase 4 — Validate and finalize

Run the project's real test/lint/build suite; start a fresh agent session from `AGENTS.md` + `CURRENT_STATE.md` and confirm it can state the objective and next action; grep for references to moved files; scan for secrets; then merge and push and report the commit hash. From here every task follows the definition of done in `references/governance-spec.md`.

## Adapting the framework

Read `references/governance-spec.md` when writing or reviewing any governance file — it holds the required contents of each file, the task template, allowed task statuses, the seven-step work cycle, and the definition of done. Two adaptations are required on every new project: replace the environment model with the tiers that actually exist (delete staging/production for a local tool), and map planning/execution roles onto whatever models and subagents the current client provides instead of naming specific ones.
