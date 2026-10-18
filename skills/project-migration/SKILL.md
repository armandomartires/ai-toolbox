---
name: project-migration
description: "Harmonize an existing repository with the .ai agent-governance framework (AGENTS.md, CLAUDE.md, .ai/ context, decisions, planning, tasks, sessions, reviews). Use when asked to migrate, retrofit, restructure, or onboard a project for multi-agent work, or to scaffold that structure in a new repo, including the choice of a files, GitLab or GitHub work tracker. Not for ordinary feature work inside an already-governed repo."
license: MIT
metadata:
  author: armando.martires
  version: 5.0.0
---

# Project migration to the .ai governance framework

Retrofit a live repository so a human, a planning model, and a weaker executor model can all resume work from files instead of conversation history.

**Not `project-workflow`.** These scaffold two different frameworks, deliberately (ADR-0013 in `ai-toolbox`). This one: `.ai/context/`, `.ai/planning/`, `.ai/sessions/`, `.ai/templates/`, `TASK-####-*.md`, `ADR-NNNN-*.md`, entry point `AGENTS.md` — for migrating an existing repo. On a forge tracker, planning, tasks, sessions and reviews live on the forge instead. The other: `00.CONVENTIONS.md` + `20.PLAN.md`/`30.ROADMAP.md`/`35.AD_HOC_TASKS.md` + `reference/`, `S###.T###` tasks, `NNNN-title.md` ADRs — for maintaining the planning convention in a project that already has one. Pick one per project; do not mix them, and do not "align" the ADR filenames. The additive scaffold in this skill's own `scripts/ai-project-scaffold.sh` is the canonical structure — never hand-create the file layout, and never propose a big-bang reorganization. Invoke the script from the skill's own directory, never from a path relative to the target repo: `bash "<skill dir>/scripts/ai-project-scaffold.sh" …`. The script is not marked executable in every checkout, so always run it via `bash`, not by direct execution.

## Hard rules

- Phase 1 modifies nothing. Do not create, move, or delete files until the user approves the proposal.
- The scaffold is additive only: it skips every file that already exists. Run it with `--force` inside an existing repo; that flag permits adding into a non-empty directory, it does not overwrite.
- Relocate existing files with `git mv`, never copy-then-delete, so `git log --follow` survives.
- Never delete the old structure until the new one is validated and free of broken references.
- Never invent requirements, commands, or environments. Leave `<!-- FILL -->` markers rather than guessing, and ask the user when ambiguity is material.
- Generate planning artifacts; never copy a template and imitate it. `schemas/{task,adr,review,session,plan}.md` own each artifact's shape, and `schemas/backlog.md` owns one `BACKLOG.md` row. `scripts/new-artifact.sh --kind task` emits a skeleton (`--guidance literal` suits a smaller model), and `scripts/check-artifact.sh` checks the finished one, including its `max_lines` budget. Both, and `scripts/artifact_lib.py`, are byte-identical copies of `project-workflow`'s engine: never edit them here (B-036). The scaffold script owns the *layout* and the schemas own the *shape* (ADR-0027).
- The scaffold emits `.ai/templates/*.md` from this skill's `templates/`. In the migrated repository they are a point-in-time copy with no regenerator and no drift gate (B-051). To compare them with the installed skill: `T=$(mktemp -d); bash <skill dir>/scripts/ai-project-scaffold.sh "$T/fresh" --no-git && diff -r "$T/fresh/.ai/templates" .ai/templates`.
- Keep artifacts small (ADR-0033). A brief is one module: Status first, then the procedure, then the record. Live files hold state, not history. Git is the record, so no brief carries its own hash. Budgets and contents: `references/governance-spec.md`.
- Never commit secrets, tokens, or `.env` files; run a secrets scan before the first push.
- Secrets move only if the user chooses it (Phase 1, step 6). Never open, print or quote a value; name variables only.
- Never force-push. If a push fails, diagnose and report — do not declare the task done.
- The work tracker is declared once, in `tracker.conf` (files, GitLab or GitHub; ADR-0037 in `ai-toolbox`). Changing it later is an ADR plus a migration task, never a quiet edit.

## Phase 1 — Inventory and mapping (read-only)

1. Inspect repo structure, `git status`, branch, remotes, uncommitted changes, and recent commits.
2. Locate existing instruction and planning artifacts: `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.ai/`, `.ai/workflow/`, `CONVENTIONS`/`PLAN`/`ROADMAP`/`AD_HOC_TASKS` files, README, docs, CI config, test and build commands, and secrets exposure.
   - For secrets, list **where they live today, by variable name only**: `.env*` files, shell profiles that a README tells people to edit, CI variables, and values a scan finds in tracked files.
   - Never open or quote a value.
3. Build the mapping table — one row per existing artifact: `| Current path | Responsibility | Proposed destination | Action (move/merge/keep/archive) |`.
4. Flag duplicated, contradictory, and obsolete information, and which content becomes `AGENTS.md` rules, history, tasks, or ADRs.
5. Run `skills/project-workflow/scripts/tracker.sh decision`. Unless it reads `declared`, ask which work tracker the project will use:
   - **files**: this framework's `.ai/planning/`, `.ai/tasks/`, `.ai/sessions/`, `.ai/reviews/`;
   - **gitlab**: GitLab issues, milestones, boards, labels, and the wiki for end-user docs;
   - **github**: GitHub issues, milestones, Projects, and the wiki for end-user docs.

   Never assume the answer. On a forge, the mapping table sends old roadmaps, backlogs, task and session files to the forge objects in `skills/project-workflow/templates/reference/tracker.md`, and end-user docs to the wiki. Developer and operations docs stay in `docs/`.
6. Ask whether to migrate secrets as part of this migration. If yes, ask which backend:
   - **local**: a git-ignored `.env`;
   - **vault**: HashiCorp Vault, in the project's own KV mount;
   - **gitlab**: GitLab CI variables;
   - **github**: GitHub Actions secrets.

   Never assume either answer. Put the choice under *Risks and pending decisions*.
7. Files tracker only: with a remote, run `skills/project-workflow/scripts/publish-dashboard.sh decision`. On exit 1, ask whether to publish the dashboard to **GitHub Pages**, **GitLab Pages**, both or neither, and which forge each `unknown` host is. Never assume the answer; put it under *Risks and pending decisions*.
8. Present the proposal using the response format below and stop for approval.

Answer in these sections: **Understanding**, **Project inventory**, **Diagnosis**, **Current → proposed mapping**, **Proposed structure**, **Migration plan**, **Risks and pending decisions**, **Next step**.

## Phase 2 — Additive overlay (after approval)

1. `git checkout -b chore/ai-governance-migration` — the merge commit is the single rollback point.
2. Run the scaffold against the repo root, using the skill's own script path (never the target repo's `scripts/`): `bash "<skill dir>/scripts/ai-project-scaffold.sh" . --force --type python|node|generic`, plus `--tracker gitlab --gitlab-project group/name` or `--tracker github --github-repo owner/name` for a forge. The scaffold writes `tracker.conf`; on a forge it skips `.ai/planning/`, `.ai/tasks/`, `.ai/sessions/` and `.ai/reviews/`. Add `--no-git` when the repo already has history you do not want touched.
3. Fill `AGENTS.md` from reality: the project's actual install/run/test/lint/build commands and real conventions. Keep it lean — invented or generic requirements make agent tasks measurably worse. Read `references/governance-spec.md` for its required contents.
4. Create `CLAUDE.md` as a symlink (`ln -s AGENTS.md CLAUDE.md`), confirm git recorded mode `120000`, and on Windows/WSL where symlinks are unreliable use a documented alternative plus an ADR. Two divergent sources of truth are the failure to avoid.
5. Backfill only `CURRENT_STATE.md`, `PROJECT_MAP.md`, and `ROADMAP.md`, as a snapshot of today. Do not reconstruct history.
6. Commit the scaffold as one commit; each later migration step gets its own.
7. Confirm the tracker with `skills/project-workflow/scripts/tracker.sh check`. An existing repo the scaffold did not touch gets it with `tracker.sh init`, in its own commit.
8. Files tracker only: record the Phase-1 publishing answer in `dashboard-publish.conf`, in its own commit. **No:** `targets = none` under a dated comment. **Yes:** the targets, then `publish-dashboard.sh render` (`skills/project-workflow/references/dashboard.md`, *Publishing it*).

## Phase 3 — Move content selectively

- Do not repackage working code into `src/` unless the project is under heavy active development. Leave the layout, document it in `PROJECT_MAP.md`, and record the deliberate choice in an ADR.
- Merge old roadmaps and task files into `.ai/planning/` and `.ai/tasks/`, or archive them — never leave two competing sources of truth.
- Prune scaffold directories that do not apply (e.g. `docs/deployment/` for a library). A smaller final structure is correct; bureaucracy without value is not.
- Adopt task discipline forward only: the first `TASK-0001.md` is the first new work after migration, not a rewrite of past work.
- **On a forge tracker**, following `skills/project-workflow/templates/reference/tracker.md`:
  - create the labels and the first milestone by hand with `glab` or `gh`, using the token through the declared secrets backend;
  - file the open work as issues, with bodies generated by `new-artifact.sh` and checked by `check-artifact.sh`;
  - only once those issues exist, remove the old planning, task and session files with `git rm` in their own commit, never before;
  - move end-user docs into the wiki's own repository (`<project>.wiki.git`). Developer and operations docs stay in `docs/`.

## Phase 3b — Secrets (only if the user chose to migrate them)

This phase uses the `vault-secrets` skill's `scripts/vault_secrets.py`. Each step below is its own commit.

1. **Declare:** `vault_secrets.py init --backend <choice> --project <name>`, plus `--gitlab-project` or `--github-repo` for those backends.
   - It writes `secrets.conf` and the `.env` ignores, and creates `.env.example`; for `vault` it also creates `secrets.map`.
   - It never overwrites a file.
2. **Name the variables:** list every variable from the inventory in `.env.example`. For `vault`, also map each one in `secrets.map`.
   - A Vault admin runs `provision` to create the project's mount; it is never the agent's step.
3. **Move the values:** `vault_secrets.py import --from <old env file> --dry-run` lists which names would move and which are skipped. An agent may run it.
   - The real `import` writes values, so the human runs it.
   - A value that lives only in a shell profile or a CI settings page is written with `put VAR`, by the human.
4. **Confirm:** `vault_secrets.py check` must pass.
5. **Repoint the docs:** instructions that say to export a variable from a shell profile now say to run the command through `vault_secrets.py exec VAR -- <command>`. That applies to the `local` and `vault` backends. With `gitlab` or `github`, the values belong to CI.
6. **Clean up:**
   - The old file stays until the human deletes it.
   - A secret that was ever committed is **rotated**, not just moved: moving it leaves it in history.

If the user declined, record "secrets not migrated" in `CURRENT_STATE.md`, so the next session does not ask again.

## Phase 4 — Validate and finalize

Run the project's real test/lint/build suite. Then start a fresh agent session from `AGENTS.md` and `CURRENT_STATE.md` and confirm it can state the objective and the next action. On a forge, that session must also pass `glab auth status` or `gh auth status` under the declared secrets backend, and name the next issue from the board. Grep for references to moved files, scan for secrets, then merge and push. Finish with the task report in `references/governance-spec.md`. From here on, every task follows that file's definition of done.

## Seeing the layer

**Files tracker only.** On a forge, `build-dashboard.sh` exits 2 with `not applicable` and the board is the view; `publish-dashboard.sh decision` answers `not applicable`.

`skills/project-workflow/scripts/build-dashboard.sh --root .ai --out docs/dashboard.html` renders the briefs as one self-contained HTML dashboard. It reads this framework natively:
- `TASK-####` briefs and their `## Status` fields
- `## Objective`, `## Acceptance criteria`, `## Mandatory validations`, `## Likely files`
- `tasks/TODO.md` sprint headings
- `BACKLOG.md`'s table
- `TASK-####` in commit subjects

Keep those names when you edit a schema. The dashboard lives in the sibling skill, and the reference is `skills/project-workflow/references/dashboard.md`. It is a view, not a gate.

Rebuild it as a step, never from a hook:
- when a `PLAN-####` is approved **and** its `TODO.md` entries and `TASK-####` briefs are written;
- after the push to every remote is confirmed. Before that push, if `publish-dashboard.sh decision` exits 1, ask the Phase-1 publishing question once (step 7).

## Adapting the framework

Read `references/governance-spec.md` when writing or reviewing any governance file — it holds the required contents of each file, the task template, allowed task statuses, the seven-step work cycle, and the definition of done. Two adaptations are required on every new project: replace the environment model with the tiers that actually exist (delete staging/production for a local tool), and map planning/execution roles onto whatever models and subagents the current client provides instead of naming specific ones.
