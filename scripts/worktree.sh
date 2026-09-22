#!/usr/bin/env bash
# Manage one git worktree per agent session, so two sessions never share a
# working tree or an index.
#
# Usage:
#   worktree.sh add <name>      create (or report) the worktree for <name>
#   worktree.sh list            list every worktree, marking this repo's
#   worktree.sh remove <name>   remove it, refusing if work would be lost
#
# WHY: a shared index is a single mutable resource with no locking between
# sessions. On 2026-09-23 two sessions in one checkout cost real work twice -
# TASK-0068 had to renumber, and TASK-0069 found sixteen of another session's
# files staged mid-commit-preparation. The failure mode is not a merge
# conflict; it is one session committing another's half-finished work, which
# no gate in this repo can detect. See ADR-0023.
#
# BRANCHES ARE NOT OPTIONAL HERE: git refuses to check out the same branch in
# two worktrees, so each gets `agent/<name>`. Land with a rebase and
# `git push origin HEAD:master` - master stays linear and keeps receiving one
# commit per task. The main checkout keeps `master` and is never a session's
# worktree. Runbook: docs/operations/runbook.md.
set -uo pipefail
cd "$(dirname "$0")/.."
REPO=$(pwd -P)
BRANCH_PREFIX="agent/"
# Sibling of the repo, never inside it: validate.sh and sync-registry.sh glob
# component directories, and `git status` would see a nested tree. Keeping it
# outside removes the whole class rather than guarding each case.
WT_ROOT="$(dirname "$REPO")/$(basename "$REPO")-worktrees"

usage() { sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; }

name_ok() {
  case "$1" in
    ""|*[!a-zA-Z0-9._-]*) return 1 ;;
    -*|.|..) return 1 ;;
    *) return 0 ;;
  esac
}

cmd="${1:-}"; shift 2>/dev/null || true

case "$cmd" in
  add)
    name="${1:-}"
    name_ok "$name" || { echo "worktree.sh: need a name of [A-Za-z0-9._-]" >&2; exit 2; }
    path="$WT_ROOT/$name"
    branch="$BRANCH_PREFIX$name"

    # Refuse to nest, even if someone edits WT_ROOT later.
    case "$path" in
      "$REPO"/*) echo "worktree.sh: refusing to create a worktree inside the repo ($path)" >&2; exit 2 ;;
    esac

    if git worktree list --porcelain | grep -qx "worktree $path"; then
      echo "worktree.sh: already exists: $path (branch $branch)"
      exit 0
    fi

    mkdir -p "$WT_ROOT" || exit 1
    if git show-ref --verify --quiet "refs/heads/$branch"; then
      git worktree add "$path" "$branch" || exit 1
    else
      git worktree add -b "$branch" "$path" || exit 1
    fi

    # A worktree whose gate cannot run is worse than no worktree, so say
    # plainly whether it can. Checked by running it, not by testing -x:
    # /mnt/c reports every file 0777 regardless of the recorded mode.
    if (cd "$path" && ./tests/validate.sh >/dev/null 2>&1); then
      gate="runs as a bare path"
    elif (cd "$path" && bash tests/validate.sh >/dev/null 2>&1); then
      gate="NEEDS 'bash tests/validate.sh' - the bare path is not executable here"
    else
      gate="DOES NOT PASS - investigate before working here"
    fi

    echo
    echo "  worktree : $path"
    echo "  branch   : $branch"
    echo "  gate     : $gate"
    echo
    echo "  cd \"$path\""
    echo "  # ... work, commit as usual; the pre-commit hook runs here too ..."
    echo "  git fetch origin && git rebase origin/master && git push origin HEAD:master"
    ;;

  list)
    git worktree list --porcelain | awk -v repo="$REPO" '
      /^worktree /{p=substr($0,10)}
      /^branch /{b=substr($0,8); sub("refs/heads/","",b)}
      /^detached$/{b="(detached)"}
      /^$/{if(p!=""){printf "  %-60s %s%s\n", p, b, (p==repo?"   <- main checkout":"")}; p="";b=""}
      END{if(p!=""){printf "  %-60s %s%s\n", p, b, (p==repo?"   <- main checkout":"")}}'
    ;;

  remove)
    name="${1:-}"
    name_ok "$name" || { echo "worktree.sh: need a name of [A-Za-z0-9._-]" >&2; exit 2; }
    path="$WT_ROOT/$name"
    branch="$BRANCH_PREFIX$name"

    git worktree list --porcelain | grep -qx "worktree $path" || {
      echo "worktree.sh: no such worktree: $path" >&2; exit 2; }

    # Uncommitted or unlanded work is the thing worth refusing over. Report
    # it and stop; --force is the caller's explicit decision, not a default.
    #
    # "Unlanded" means commits unique to THIS branch - reachable from it and
    # from neither master nor origin/master. Comparing against origin/master
    # alone reports a false positive: a fresh worktree inherits whatever the
    # main checkout has not pushed yet, which is not this session's work and
    # not this session's problem. Observed while verifying TASK-0070.
    dirty=$(cd "$path" && git status --porcelain | wc -l)
    ahead=$(git rev-list --count "$branch" --not master origin/master 2>/dev/null || echo 0)
    if [ "$dirty" -ne 0 ] || [ "$ahead" -ne 0 ]; then
      echo "worktree.sh: REFUSING to remove $path" >&2
      [ "$dirty" -ne 0 ] && echo "  $dirty uncommitted change(s)" >&2
      [ "$ahead" -ne 0 ] && echo "  $ahead commit(s) on $branch not yet on origin/master" >&2
      echo "  Land or discard them first, then re-run." >&2
      exit 1
    fi

    git worktree remove "$path" || exit 1
    git branch -d "$branch" 2>/dev/null || true
    rmdir "$WT_ROOT" 2>/dev/null || true
    echo "worktree.sh: removed $path and branch $branch"
    ;;

  ""|-h|--help|help) usage ;;
  *) echo "worktree.sh: unknown command '$cmd'" >&2; usage >&2; exit 2 ;;
esac
