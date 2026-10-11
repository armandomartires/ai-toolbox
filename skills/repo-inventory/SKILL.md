---
name: repo-inventory
description: "Find every git repository under one or more directories and report, per repository, what exists nowhere else - uncommitted work, stashes, commits on no remote, detached commits, gone upstreams, no remote at all - read-only and offline. USE FOR: taking stock of the clones on a host before consolidating, archiving or deleting any; checking a machine for unpushed work; the inventory, classify and rescue steps of a repository migration. DO NOT USE FOR: pushing, archiving or deleting what it finds (those are the human's, repository by repository); fetching or checking a remote's live state; a single repository's governance overlay, which is project-migration."
license: MIT
metadata:
  author: armando.martires
  version: "1.0.0"
---

# repo-inventory

Before clones on several hosts can be retired, someone has to know which
repositories exist and what in them exists nowhere else. This skill answers
that for one host at a time, without changing anything.

## Instructions

1. Run the script over the directories that hold clones, on each host, under
   that host's own shell (a WSL path from WSL, a Windows path from Windows: a
   worktree one side registered can be unreadable from the other):

   ```bash
   python3 scripts/repo_inventory.py ~/work /srv
   python3 scripts/repo_inventory.py --format json --risky-only ~/work > inventory.json
   ```

2. Read the report as `references/reading-the-report.md` describes. A
   repository with no flags is safe to re-clone from its remote; every flag
   names something a delete would lose.
3. Rescue before anything else: commit or stash-pop, push each flagged branch,
   then run the inventory again. Only a repository that reads clean on a
   fresh run is a candidate for deletion, and the deletion is the human's.
4. Remote state is as of each repository's last fetch, which the report
   prints. If it matters that a remote has not moved, `git fetch` that
   repository yourself first: the script never fetches, because fetching
   writes refs.

## Scripts

- `scripts/repo_inventory.py ROOT...`: walks the roots (no symlinks or
  junctions, dependency and cache directories pruned, `--max-depth`, default
  6), groups linked worktrees under their repository, and prints markdown or
  `--format json`. `--risky-only` lists only flagged repositories;
  `--fail-on-risk` exits 1 when anything is flagged or unreadable. It runs only
  git read commands with optional locks off, and clears inherited `GIT_DIR`
  and friends. Stdlib only, Python 3.8+.
- `scripts/check-repo-inventory.sh`: fixture repositories for every flag, a
  read-only proof (every file under the roots compared before and after), and
  the redaction and exit-code cases. Run from `tests/validate.sh`.

## Limits

- **Only what this clone knows.** "On no remote" means not reachable from any
  remote-tracking ref here. A branch pushed from another clone since the last
  fetch still counts as unpushed.
- **One host per run.** It cannot see another machine's disks.
- **The report names paths and remote hosts.** It prints remote URLs with
  credentials and query strings removed, but the host names stay. Keep reports
  out of public repositories.

## References

- `references/reading-the-report.md`: each flag, what it would lose, and how
  to clear it.
