# TASK-0167 — `repo-inventory` skill: every git repository under a root, and what is not pushed

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-11
- Updated: 2026-10-11
- Applies to: `skills/repo-inventory/` (new), `tests/validate.sh`, `docs/registry.md`
- Source: human request 2026-10-11 (team-working-model assessment, follow-up T-c: migration steps 1-3); human choice: one stdlib Python script, not a bash and PowerShell pair

## Objective

Before clones on several hosts can be retired, someone has to know which repositories exist and what in them exists nowhere else. Nothing here answers that. Ship a read-only skill that finds every repository under the given roots and reports, per repository, what is not on any remote.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `skills/_template/` | the skill shape to copy |
| `project-migration` Phase 1 | inventories one repository, not many |
| `tests/validate.sh` | `GIT-LOCATORS` check (`TASK-0165`) applies to `skills/*/scripts/check-*.sh` |

## Scope

- In: `scripts/repo_inventory.py` (walk, git queries, markdown or JSON, `--risky-only`, `--fail-on-risk`); `scripts/check-repo-inventory.sh` in the gate; `SKILL.md`, a reference on reading the report; registry.
- Out: fetching (it would write refs, so the report says how old each repository's remote refs are instead); acting on the report (push, archive, delete are the human's); scanning another host from this one.

## Likely files

- `skills/repo-inventory/{SKILL.md,scripts/repo_inventory.py,scripts/check-repo-inventory.sh,references/reading-the-report.md}`
- `tests/validate.sh`, `docs/registry.md`, `.ai/context/CURRENT_STATE.md`, `README.md`

## Execution plan

1. Walk the roots without following symlinks or junctions, pruning dependency and cache directories, to a depth limit; a directory with `.git`, or a bare repository, is a hit; group hits by common git dir.
2. Per repository, with the git locator variables cleared and `--no-optional-locks`: branch, remotes (credentials redacted), each working tree's status, stashes, worktrees, commits per branch not on any remote, upstream state, last commit, last fetch.
3. Derive risk flags; render markdown or JSON; a repository git refuses (ownership, corruption) is reported, not fatal.
4. Fixtures under mktemp for each risk and each refusal; prove the repositories are byte-identical before and after; red-prove by mutation; wire into the gate.

## Acceptance criteria

- [x] Finds plain, nested, worktree-linked and bare repositories once each, and skips symlinked or junctioned directories and pruned names.
- [x] Reports, per repository: no remote, dirty working trees, stashes, commits not on any remote per branch, gone upstreams, and the last-fetch age; a clean pushed repository has no flags.
- [x] Remote URLs never print credentials.
- [x] Running it changes nothing in any repository it reads, proven by a before/after comparison of every `.git` file.
- [x] `--fail-on-risk` exits 1 when any flag is set; a repository git refuses is reported with the reason, and the run continues.

## Mandatory validations

- [x] tests/validate.sh (WSL)
- [x] `bash skills/repo-inventory/scripts/check-repo-inventory.sh` (WSL and Git Bash)
- [x] mutation red-proof of the check

## Risks and rollback

- **The report is only as fresh as the last fetch.** "Not on any remote" means not on any remote-tracking ref this clone knows; the report prints each repository's last fetch time so a stale answer is visible.
- **It cannot see other hosts.** Each host runs it over its own disks.
- **Gate cost:** the check adds about 9 s to `tests/validate.sh` on AlmaLinux (35 s → 47 s), from five full scans of eleven fixture repositories.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `skills/repo-inventory/` | 1.0.0, in the registry |
| `check-repo-inventory.sh` | in the gate |

Next: T-d, the `repo-baseline` skill.

## Execution log

- 2026-10-11 · Claude Code (Opus 5.5) · done
  - Evidence: `bash skills/repo-inventory/scripts/check-repo-inventory.sh` → `OK (25 cases)` under WSL and Git Bash
  - Evidence: 14 mutants of `repo_inventory.py` → all killed; `no-group` first survived (a duplicate row carried the main path) and D2 now counts rows
  - Evidence: `tests/validate.sh` (AlmaLinux) → `validate.sh: OK`, 47 s
  - Evidence: a real run over `AI Workspaces/` → 8 repositories, 5 flagged, 3 WSL-registered worktrees reported unreadable from Windows
  - Deviation: numbered 0167; a concurrent session landed 0166 meanwhile
  - Deviation: a Windows-side fast-forward left 11 files CRLF in the working tree, which stopped the WSL gate; converted back where HEAD is LF (EOL only, no content change). The durable fix is the next task's `.gitattributes`
