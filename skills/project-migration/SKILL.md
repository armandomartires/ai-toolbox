---
name: project-migration
description: "Retrofit an existing repository into project-workflow's one planning convention (ADR-0066: AGENTS.md, CLAUDE.md, the numbered .ai/ files, decisions, S###.T### tasks, sessions, reviews), or scaffold that structure in a new repo, including the choice of a files, GitLab or GitHub work tracker. Use when asked to migrate, retrofit, restructure, or onboard a project for multi-agent work, or to move a repository still on the older .ai/context + .ai/planning + TASK-#### layout. Not for ordinary feature work inside an already-governed repo."
license: MIT
metadata:
  author: armando.martires
  version: 6.0.0
---

# Project migration to the one planning convention

Retrofit a live repository so a human, a planning model, and a weaker executor model can all resume work from files instead of conversation history.

**The convention is `project-workflow`'s** (ADR-0066 in `ai-toolbox`, which superseded ADR-0013's two frameworks): `.ai/00.CONVENTIONS.md`, `10.CURRENT_STATE.md`, `20.PLAN.md`, `30.ROADMAP.md`, `35.AD_HOC_TASKS.md`, `40.RISK_REGISTER.md`, `decisions/ADR-NNNN-title.md`, `tasks/S###.T###_Name.md`, `reviews/`, `sessions/` and `reference/`; entry point `AGENTS.md`. This skill does not define it: it is the **retrofit path into it**. It writes the convention into a repository that has none (the scaffold), or moves one on the older layout onto it (`.ai/context/`, `.ai/planning/`, `.ai/templates/`, `tasks/TODO.md`, `TASK-####` briefs; Phase 3). Maintaining the convention in a repository that already follows it, and every artifact's shape, belong to `project-workflow`, which must be installed beside this skill: the scaffold reads its `templates/` and the migration calls its `scripts/migrate-layout.py`. On a forge tracker, tasks, the roadmap, the ad-hoc list and reviews live on the forge instead. The additive scaffold in this skill's own `scripts/ai-project-scaffold.sh` is the canonical structure for a new repository: never hand-create the file layout, and never propose a big-bang reorganization. Invoke the script from the skill's own directory, never from a path relative to the target repo: `bash "<skill dir>/scripts/ai-project-scaffold.sh" …`. The script is not marked executable in every checkout, so always run it via `bash`, not by direct execution.

## Hard rules

- Phase 1 modifies nothing. Do not create, move, or delete files until the user approves the proposal.
- The scaffold is additive only: it skips every file that already exists. Run it with `--force` inside an existing repo; that flag permits adding into a non-empty directory, it does not overwrite.
- Relocate existing files with `git mv`, never copy-then-delete, so `git log --follow` survives.
- Never delete the old structure until the new one is validated and free of broken references.
- Never invent requirements, commands, or environments. Leave `<!-- FILL -->` markers rather than guessing, and ask the user when ambiguity is material.
- Generate planning artifacts; never copy a template and imitate it. `project-workflow`'s `schemas/` own each artifact's shape: `skills/project-workflow/scripts/new-artifact.sh --kind task` emits a skeleton (`--guidance literal` suits a smaller model), and `check-artifact.sh` checks the finished one, including its `max_lines` budget. This skill keeps no schema of a task, ADR, review or session and no engine copy. Its one remaining schema, `schemas/plan.md`, shapes the retired `PLAN-####` file and is rendered to `templates/PLAN.md`; use it only to read an old plan. The scaffold script owns which files exist and the schemas own their shape (ADR-0027).
- The scaffold writes the numbered files, `reference/` and the forge variant of `20.PLAN.md` by reading `project-workflow`'s `templates/` at run time: no second copy exists to drift, and the migrated repository gets a point-in-time copy with no regenerator and no drift gate (B-051). To compare it with the installed skill: `T=$(mktemp -d); bash <skill dir>/scripts/ai-project-scaffold.sh "$T/fresh" --no-git && diff -r "$T/fresh/.ai" .ai`. `scripts/check-scaffold.sh` proves the scaffold end to end in a throwaway directory.
- Keep artifacts small (ADR-0033). A brief is one module: Status first, then the procedure, then the record. Live files hold state, not history. Git is the record, so no brief carries its own hash. Budgets and contents: `references/governance-spec.md` and `.ai/reference/size-budgets.md`.
- Never commit secrets, tokens, or `.env` files; run a secrets scan before the first push.
- Secrets move only if the user chooses it (Phase 1, step 6). Never open, print or quote a value; name variables only.
- Never force-push. If a push fails, diagnose and report — do not declare the task done.
- The work tracker is declared once, in `tracker.conf` (files, GitLab or GitHub; ADR-0037 in `ai-toolbox`). Changing it later is an ADR plus a migration task, never a quiet edit.

## Phase 1 — Inventory and mapping (read-only)

1. Inspect repo structure, `git status`, branch, remotes, uncommitted changes, and recent commits.
2. Locate existing instruction and planning artifacts: `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.ai/`, `.ai/workflow/`, `CONVENTIONS`/`PLAN`/`ROADMAP`/`AD_HOC_TASKS` files, README, docs, CI config, test and build commands, and secrets exposure. Note which `.ai/` layout it already has: none, the older one (`.ai/context/`, `.ai/planning/`, `tasks/TODO.md` or `TASK-####` briefs) or the numbered one (`00.CONVENTIONS.md`).
   - For secrets, list **where they live today, by variable name only**: `.env*` files, shell profiles that a README tells people to edit, CI variables, and values a scan finds in tracked files.
   - Never open or quote a value.
3. Build the mapping table — one row per existing artifact: `| Current path | Responsibility | Proposed destination | Action (move/merge/keep/archive) |`.
4. Flag duplicated, contradictory, and obsolete information, and which content becomes `AGENTS.md` rules, history, tasks, or ADRs.
5. Run `skills/project-workflow/scripts/tracker.sh decision`. Unless it reads `declared`, ask which work tracker the project will use:
   - **files**: the convention's `.ai/20.PLAN.md`, `30.ROADMAP.md`, `35.AD_HOC_TASKS.md`, `tasks/`, `sessions/` and `reviews/`;
   - **gitlab**: GitLab issues, milestones, boards, labels, and the wiki for end-user docs;
   - **github**: GitHub issues, milestones, Projects, and the wiki for end-user docs.

   Never assume the answer. On a forge, the mapping table sends old roadmaps, backlogs, plans, task and session files to the forge objects in `skills/project-workflow/templates/reference/tracker.md`, and end-user docs to the wiki. Developer and operations docs stay in `docs/`.

   On a forge, also ask (a separate choice, never assumed): **file the completed tasks as closed issues too?** **No** (default): only the open work becomes issues, and the finished briefs, reviews and sessions stay reachable through the `pre-forge-migration` tag (Phase 3). **Yes:** each completed task also becomes a closed issue with a `migrated` label, body from the task schema, so the forge holds the full history. Put the answer under *Risks and pending decisions*.
6. Ask whether to migrate secrets as part of this migration. If yes, ask which backend:
   - **local**: a git-ignored `.env`;
   - **vault**: HashiCorp Vault, in the project's own KV mount;
   - **gitlab**: GitLab CI variables;
   - **github**: GitHub Actions secrets.

   Never assume either answer. Put the choice under *Risks and pending decisions*.
7. Files tracker only: with a remote, run `skills/project-workflow/scripts/publish-dashboard.sh decision`. On exit 1, ask whether to publish the dashboard to **GitHub Pages**, **GitLab Pages**, both or neither, and which forge each `unknown` host is. Never assume the answer; put it under *Risks and pending decisions*.
8. Present the proposal using the response format below and stop for approval.

The layout found sets the path: none, Phase 2; the older one, Phase 3 (a dry run of `migrate-layout.py` is a read-only step, so Phase 1 may include its printed map); the numbered one, nothing to migrate. Answer in these sections: **Understanding**, **Project inventory**, **Diagnosis**, **Current → proposed mapping**, **Proposed structure**, **Migration plan**, **Risks and pending decisions**, **Next step**.

## Phase 2 — Additive overlay (after approval)

1. `git checkout -b chore/ai-governance-migration` — the merge commit is the single rollback point.
2. Run the scaffold against the repo root, using the skill's own script path (never the target repo's `scripts/`): `bash "<skill dir>/scripts/ai-project-scaffold.sh" . --force --type python|node|generic`, plus `--tracker gitlab --gitlab-project group/name` or `--tracker github --github-repo owner/name` for a forge. The scaffold writes `tracker.conf` and the numbered `.ai/` files from `project-workflow`'s templates; on a forge it writes the forge variant of `20.PLAN.md` and skips `30.ROADMAP.md`, `35.AD_HOC_TASKS.md`, `tasks/`, `sessions/` and `reviews/`. A repository on the older layout skips this step: Phase 3 moves it. Add `--no-git` when the repo already has history you do not want touched.
3. Fill `AGENTS.md` from reality: the project's actual install/run/test/lint/build commands and real conventions. Keep it lean — invented or generic requirements make agent tasks measurably worse. Read `references/governance-spec.md` for its required contents.
4. Create `CLAUDE.md` as a regular file whose first line is `@AGENTS.md`, followed only by Claude-only notes (ADR-0061); a symlink breaks on checkouts without `core.symlinks`. Never copy `AGENTS.md` into it: two divergent sources of truth are the failure to avoid.
5. Backfill only `10.CURRENT_STATE.md`, `docs/project-map.md` and `30.ROADMAP.md`, as a snapshot of today. Do not reconstruct history.
6. Commit the scaffold as one commit; each later migration step gets its own.
7. Confirm the tracker with `skills/project-workflow/scripts/tracker.sh check`. An existing repo the scaffold did not touch gets it with `tracker.sh init`, in its own commit.
8. Files tracker only: record the Phase-1 publishing answer in `dashboard-publish.conf`, in its own commit. **No:** `targets = none` under a dated comment. **Yes:** the targets, then `publish-dashboard.sh render` (`skills/project-workflow/references/dashboard.md`, *Publishing it*).

## Phase 3 — Move content selectively

- Do not repackage working code into `src/` unless the project is under heavy active development. Leave the layout, document it in `PROJECT_MAP.md`, and record the deliberate choice in an ADR.
- **A repository on the older layout** (`.ai/context/`, `.ai/planning/`, `.ai/templates/`, `tasks/TODO.md`, `TASK-####` briefs) moves with `skills/project-workflow/scripts/migrate-layout.py` (ADR-0066), never by hand:
  1. Dry run first: `python3 "<skill dir>/../project-workflow/scripts/migrate-layout.py" --repo .`. It prints the old-to-new map (layout, `S###.T###` ids taken from the repository's own `TODO.md` sprint headings, `ADR-NNNN-` file names) and changes nothing. Show the map to the person and stop for approval; resolve every brief it lists as unassigned (a brief no sprint heading names is never guessed).
  2. On a clean tree and a migration branch, `python3 "<skill dir>/../project-workflow/scripts/migrate-layout.py" --repo . --write` (`--skip-unassigned` leaves unassigned briefs where they are). It moves every file with `git mv`, writes `.ai/id-map.tsv`, rewrites path references but never an id written in prose, and removes `tasks/TODO.md` and `templates/`. Commit that alone.
  3. The tool leaves the live files' content: the roadmap's sprint table, `35.AD_HOC_TASKS.md` entries from the old backlog rows, `GOALS.md` ids. The dry run lists what is left; do it in its own commit, then run the project's checks and grep for the old paths.
  4. Add what the move does not create: `40.RISK_REGISTER.md` and `.ai/reference/` from `project-workflow`'s templates, with `bash "<skill dir>/scripts/ai-project-scaffold.sh" . --force --no-git`, which only adds missing files.
- Merge any other roadmaps and task files into `20.PLAN.md`, `30.ROADMAP.md` and `tasks/`, or archive them under `.ai/archive/` — never leave two competing sources of truth.
- Prune scaffold directories that do not apply (e.g. `docs/deployment/` for a library). A smaller final structure is correct; bureaucracy without value is not.
- Adopt task discipline forward only: the first `S001.T001_Name.md` (generated by `new-artifact.sh`) is the first new work after migration, not a rewrite of past work. A repository moved by `migrate-layout.py` keeps its old ids in history; they resolve through `.ai/id-map.tsv`.
- **On a forge tracker**, following `skills/project-workflow/templates/reference/tracker.md`:
  - create the labels and the first milestone by hand with `glab` or `gh`, using the token through the declared secrets backend;
  - file the open work as issues, with bodies generated by `new-artifact.sh` and checked by `check-artifact.sh`;
  - if the person chose it in Phase 1, also file each completed task as an issue with the `migrated` label, body generated from the task schema, then close it;
  - **before the `git rm` commit**, tag the last commit that still holds the old files, annotated, and push the tag with the branch: `git tag -a pre-forge-migration -m "Planning, task and session files before the move to <forge>"`. Never move or delete the tag. Then add one line to `.ai/20.PLAN.md` (*History*) naming it and how to read it: `` Earlier planning, tasks, reviews and sessions are in tag `pre-forge-migration`: `git show pre-forge-migration:.ai/tasks/` ``;
  - only once those issues exist, the tag is pushed and that line is written, remove the old planning, task and session files with `git rm` in their own commit, never before;
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

If the user declined, record "secrets not migrated" in `10.CURRENT_STATE.md`, so the next session does not ask again.

## Phase 4 — Validate and finalize

Run the project's real test/lint/build suite. Then start a fresh agent session from `AGENTS.md` and `10.CURRENT_STATE.md` and confirm it can state the objective and the next action. On a forge, that session must also pass `glab auth status` or `gh auth status` under the declared secrets backend, and name the next issue from the board. Grep for references to moved files, scan for secrets, then merge and push. Finish with the task report in `references/governance-spec.md`. From here on, every task follows that file's definition of done.

## Seeing the layer

**Files tracker only.** On a forge, `build-dashboard.sh` exits 2 with `not applicable` and the board is the view; `publish-dashboard.sh decision` answers `not applicable`.

`skills/project-workflow/scripts/build-dashboard.sh --root .ai --out docs/dashboard.html` renders the briefs as one self-contained HTML dashboard. It reads the convention natively: `S###.T###` briefs and their `**Status**` fields, `30.ROADMAP.md`'s sprint table, `35.AD_HOC_TASKS.md`, `ADR-NNNN` decisions, `.ai/id-map.tsv` and the task ids in commit subjects. The dashboard lives in the sibling skill, and the reference is `skills/project-workflow/references/dashboard.md`. It is a view, not a gate.

Rebuild it as a step, never from a hook:
- once an approved plan's task briefs are written;
- after the push to every remote is confirmed. Before that push, if `publish-dashboard.sh decision` exits 1, ask the Phase-1 publishing question once (step 7).

## Adapting the framework

Read `references/governance-spec.md` when writing or reviewing any governance file — it holds the target structure, the required contents of `AGENTS.md`, the work cycle, the task report and the definition of done; the convention itself is `project-workflow`'s `templates/00.CONVENTIONS.md`. Two adaptations are required on every new project: replace the environment model with the tiers that actually exist (delete staging/production for a local tool), and map planning/execution roles onto whatever models and subagents the current client provides instead of naming specific ones.
