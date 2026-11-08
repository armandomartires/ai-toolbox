# TASK-0261 — Session branches are named by task, and Claude Code's worktrees follow the sibling rule

## Status

- Status: review
- Owner: agent (Claude Code)
- Branch: agent/TASK-0261
- Created: 2026-11-08
- Updated: 2026-11-08
- Applies to: `scripts/worktree.sh`, `tests/test-worktree.sh`, `configs/claude-code/`, `scripts/install.sh`, ADR-0023, ADR-0018, `AGENTS.md`, the runbook, the task schema
- Source: the person's question of 2026-11-08 (concurrent agents on their own branch, resumed by a later session) and `B-061`

## Objective

ADR-0023 gives each session a sibling worktree on `agent/<name>` but leaves the name free and the branch unrecorded, and Claude Code's own worktrees sit inside the repo untouched by it. Name the branch after the task so a later session resumes it, record it in the brief and on the board, and bring Claude Code's worktrees under the rule.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `scripts/worktree.sh`, `tests/test-worktree.sh` | free names, prefix `agent/`, REPO from the script's own folder, `remove` by name only |
| `.claude/worktrees/` (gitignored) | nested worktrees on `claude/*`, `worktree-agent-*` and detached HEADs (seven at planning, five by the build: the desktop prunes its own), several with unlanded commits |
| `skills/project-migration/schemas/task.md` | Status block without a branch field |

## Scope

- In: `worktree.sh` (`add TASK-nnnn` resumes; `list` marks nested and foreign-prefix entries; `remove <name|path>` reads the branch from the worktree; REPO from `git rev-parse --git-common-dir`); its test; a tracked `WorktreeCreate`/`WorktreeRemove` hook pair under `configs/claude-code/hooks/` and its emission by `install.sh`; `Branch:` in the task schema and regenerated templates; ADR-0023 amendment, ADR-0018 note, `AGENTS.md`, runbook; `B-061` narrowed to its live check.
- Out: removing or landing any existing worktree or branch (the human's, from the inventory below); a `validate.sh` check of the field (ADR-0023 clause 5: where a session sits is not observable from the tree); any Compass change (the board renders detail lines already).

## Likely files

- `scripts/worktree.sh`, `tests/test-worktree.sh`, `scripts/install.sh`, `configs/claude-code/hooks/*`, `configs/claude-code/settings.hooks.json`, `configs/claude-code/README.md`
- `.ai/decisions/0023-*.md`, `.ai/decisions/0018-*.md`, `AGENTS.md`, `docs/operations/runbook.md`, `skills/project-migration/schemas/task.md` and the templates it renders

## Execution plan

1. Create this task's worktree with `worktree.sh add TASK-0261` (done; the gate it runs took ~8 min on this host).
2. Tooling: script, test, hooks, install merge, client README.
3. Governance text and the schema; `scripts/sync-templates.sh`.
4. `tests/validate.sh` in the worktree; `worktree.sh list` from the worktree and from the main checkout.
5. Land by rebase once the human has pushed local `master` (16 commits ahead of `origin/master`, which has `TASK-0259` and a merge commit).

## Acceptance criteria

- [x] `worktree.sh add TASK-0001` twice in the test repo: the second reports the branch resumed (W5)
- [x] `worktree.sh list` marks the five `.claude/worktrees` entries as nested and the main checkout as such, run from the worktree and from the main checkout
- [x] `tests/test-worktree.sh` covers the task form, the resume, a foreign-prefix and a detached removal, and a refused unpushed commit (18 cases)
- [x] `install.sh --client claude-code` merges the hooks beside an existing hook, is a no-op the second time, and leaves an unparsable file untouched (temp directory; `tests/test-install.sh`, 49 cases)
- [ ] A worktree-isolated subagent lands in `../ai-toolbox-worktrees`; a desktop Code-tab worktree session likewise, or ADR-0023's falsifiable line is corrected. **Not yet run against the real project** (`B-061` waits on it)

## Mandatory validations

- [x] `tests/validate.sh` in the worktree (includes `test-worktree.sh` and the template-drift check)
- [x] `scripts/sync-templates.sh --check`

## Risks and rollback

- Git-Bash and Windows path forms differ (`pwd -W`, `cygpath -m`); `list` and `remove` matching is tested in both.
- `WorktreeCreate` may not fire for desktop sessions; then the desktop settings alone carry clause 1b.
- Rollback: revert the task commit; hook-made worktrees are plain git worktrees either way.

## Outputs / handover

- Inventory for the human, 2026-11-08, from `git worktree list` (nothing removed by this task):
  - `.claude/worktrees/agent-a0d2…` (locked, `worktree-agent-a0d2…`): `TASK-0254`/`0255` commits whose content is on `master` as `135cdb2`/`18a7091` → unlock, `remove <path>`.
  - `agent-a360…`, `a76f…`, `a8ec…`: ancestors of `master` → first point `.claude/launch.json`'s `mod-preview-review` at `scripts/preview-mods.py`, then remove.
  - `claude/amazing-noether-d4c07f`: `84806bf` closes `TASK-0251` (task-compass 0.12.2), not on `master` → review, land or drop.
  - `claude/beautiful-dubinsky`, `epic-greider`, `epic-ritchie`, `gifted-visvesvaraya` and two detached worktrees: four one-line `TASK-0201` doc notes; the gate-cost note is now in the runbook → drop.
  - Siblings `agent/ai-control-deck{,-review,-proof-qa}`, `agent/harness-mod-layout`: reuse `TASK-0239` and ADR-0055/0056, dirty → the human's call.
  - `vault-session-tokens` (`codex/…`) and `agent/vault-session-tokens`: landed → `remove <path>`.

## Execution log

- 2026-11-08 · Claude Code (Fable 5.1) · renumbered from TASK-0260: another session had taken that number in the main checkout while this ran (the collision ADR-0023 says branches do not fix).
- 2026-11-08 · Claude Code (Fable 5.1) · plan approved; worktree created; governance text, schema and brief written; tooling built by a builder subagent (Sonnet 5.5), tests green; the hook pair smoke-tested in a temp repo only, so `B-061` is narrowed, not closed, and the brief sits in review until the live check.
