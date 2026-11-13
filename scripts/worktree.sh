#!/usr/bin/env bash
# Manage one git worktree per agent session, so two sessions never share a
# working tree or an index.
#
# Usage:
#   worktree.sh add <TASK-nnnn|S###.T###|name>
#                                     create (or report) the worktree; a task id
#                                     gets <root>-worktrees/<id> on branch
#                                     agent/<id>, and an existing branch is
#                                     resumed, not recreated (S###.T### is the
#                                     ADR-0066 form, TASK-nnnn the older one)
#   worktree.sh list                  every worktree; marks the main checkout,
#                                     NESTED ones and foreign branch prefixes
#   worktree.sh remove <name|path>    remove it (a name, or a path to ANY
#                                     worktree: claude/*, codex/*, detached),
#                                     refusing if work would be lost
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
# commit per task - then the same to the `github` mirror (ADR-0028). The main
# checkout keeps `master` and is never a session's worktree. Runbook:
# docs/operations/runbook.md, which also has the credential header `origin`
# needs.
set -uo pipefail
# REPO is the MAIN checkout, resolved through git's common dir, not from where
# this file sits: run from a nested (.claude/worktrees/X) or sibling worktree,
# `dirname/..` is that worktree, and `add` then put new worktrees beside or
# inside it instead of beside the real repo (ADR-0023; TASK-0261).
common=$(git -C "$(dirname "$0")" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || {
  echo "worktree.sh: not inside a git repository" >&2; exit 1; }
REPO="${common%/.git}"
# Spell REPO the way `git worktree list` does, or the `worktree $path`
# matches below never succeed. Git for Windows prints C:/Users/..., while Git
# Bash's `pwd -P` says /c/Users/... - every `remove` then failed with "no such
# worktree" there. `pwd -W` exists only in MSYS/Git Bash; on Linux and WSL it
# fails and REPO is `pwd -P`, the form git prints on those hosts.
# `cygpath -m` gives exactly that C:/ form for the path git handed back.
if command -v cygpath >/dev/null 2>&1; then REPO=$(cygpath -m "$REPO"); fi
# The caller's cwd, before the cd: a relative `remove <path>` is theirs.
CALLER_PWD=$(pwd)
cd "$REPO" || exit 1
BRANCH_PREFIX="agent/"
# Sibling of the repo, never inside it: validate.sh and sync-registry.sh glob
# component directories, and `git status` would see a nested tree. Keeping it
# outside removes the whole class rather than guarding each case.
WT_ROOT="$(dirname "$REPO")/$(basename "$REPO")-worktrees"

usage() { sed -n '2,31p' "$0" | sed 's/^# \{0,1\}//'; }

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

    if git worktree list --porcelain | grep -Fqx "worktree $path"; then
      echo "worktree.sh: already exists: $path (branch $branch)"
      exit 0
    fi

    # TASK-nnnn and S###.T### (ADR-0066) are the normal forms: one branch per
    # task, so a later session on the same task continues it. Any other name is
    # allowed (tests, probes, hook slugs) but is not a task branch.
    case "$name" in
      TASK-[0-9][0-9][0-9][0-9]) ;;
      S[0-9][0-9][0-9].T[0-9][0-9][0-9]) ;;
      *) echo "note: not a task branch; land or remove it the same day (ADR-0023 clause 4)" ;;
    esac

    mkdir -p "$WT_ROOT" || exit 1
    if git show-ref --verify --quiet "refs/heads/$branch"; then
      echo "resuming existing branch $branch"
      git worktree add "$path" "$branch" || exit 1
    else
      git worktree add -b "$branch" "$path" || exit 1
    fi

    # A worktree whose gate cannot run is worse than no worktree, so say
    # plainly whether it can. Checked by running it, not by testing -x:
    # /mnt/c reports every file 0777 regardless of the recorded mode.
    # WORKTREE_SKIP_GATE=1 skips the probe: the gate takes minutes, and the
    # Claude Code WorktreeCreate hook must answer well inside its timeout.
    if [ "${WORKTREE_SKIP_GATE:-}" = 1 ]; then
      gate="not probed (WORKTREE_SKIP_GATE=1)"
    elif (cd "$path" && ./tests/validate.sh >/dev/null 2>&1); then
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
    echo "  git push github HEAD:master     # the public mirror; credentials: runbook"
    ;;

  list)
    git worktree list --porcelain | awk -v repo="$REPO" '
      function emit() {
        if (p == "") return
        m = ""
        if (p == repo) m = "   <- main checkout"
        else if (index(p, repo "/") == 1) m = "   <- NESTED (inside the repo; ADR-0023 forbids this)"
        if (p != repo && b != "(detached)" && index(b, "agent/") != 1) m = m "   <- foreign prefix"
        printf "  %-60s %s%s\n", p, b, m
      }
      /^worktree /{p=substr($0,10)}
      /^branch /{b=substr($0,8); sub("refs/heads/","",b)}
      /^detached$/{b="(detached)"}
      /^$/{emit(); p="";b=""}
      END{emit()}'
    ;;

  remove)
    arg="${1:-}"
    [ -n "$arg" ] || { echo "worktree.sh: need a worktree name or path" >&2; exit 2; }
    case "$arg" in
      */*|*\\*|.|..)
        # A path, absolute or relative: spelled the way git prints it.
        # Relative to where the caller stood, not to REPO (cd'd above).
        if (cd "$CALLER_PWD" && [ -d "$arg" ]); then
          path=$(cd "$CALLER_PWD" && cd "$arg" && { pwd -W 2>/dev/null || pwd -P; })
        else
          path="$arg"
        fi
        path="${path%/}" ;;
      *)
        name_ok "$arg" || { echo "worktree.sh: need a name of [A-Za-z0-9._-] or a path" >&2; exit 2; }
        path="$WT_ROOT/$arg" ;;
    esac

    # What git itself says this worktree is: its branch, or detached, and
    # whether it is locked. Not agent/<name>: claude/*, codex/* and detached
    # worktrees exist too.
    info=$(git worktree list --porcelain | awk -v t="$path" '
      /^worktree /{cur=substr($0,10); f=(cur==t); if(f)found=1}
      f && /^branch /{b=substr($0,8); sub("refs/heads/","",b)}
      f && /^detached$/{b="(detached)"}
      f && /^locked/{l=1}
      END{if(!found)exit 3; print b; print l+0}') || {
      echo "worktree.sh: no such worktree: $path" >&2; exit 2; }
    branch=$(sed -n 1p <<<"$info")
    locked=$(sed -n 2p <<<"$info")
    [ "$branch" = "(detached)" ] && branch=""
    [ "$path" = "$REPO" ] && { echo "worktree.sh: refusing to remove the main checkout" >&2; exit 2; }
    if [ "$locked" = 1 ]; then
      echo "worktree.sh: $path is locked; run: git worktree unlock \"$path\" first" >&2
      exit 1
    fi

    # Only branches this workflow creates are ever deleted, never a trunk.
    case "$branch" in
      master|main) bad=1 ;;
      ""|agent/*|claude/*|codex/*|worktree-*) bad=0 ;;
      *) bad=1 ;;
    esac
    if [ "$bad" = 1 ]; then
      echo "worktree.sh: REFUSING to remove $path" >&2
      echo "  branch '$branch' is not agent/, claude/, codex/ or worktree-*; remove it by hand" >&2
      exit 1
    fi

    # Uncommitted or unlanded work is the thing worth refusing over. Report
    # it and stop; --force is the caller's explicit decision, not a default.
    #
    # "Unlanded" means commits unique to THIS branch - reachable from it and
    # from neither master nor origin/master. Comparing against origin/master
    # alone reports a false positive: a fresh worktree inherits whatever the
    # main checkout has not pushed yet, which is not this session's work and
    # not this session's problem. Observed while verifying TASK-0070.
    dirty=$(cd "$path" && git status --porcelain | wc -l)
    # A missing master or origin/master must not read as "nothing ahead".
    tip="${branch:-HEAD}"
    ahead=$(git -C "$path" rev-list --count "$tip" --not master origin/master 2>/dev/null) || {
      echo "worktree.sh: REFUSING to remove $path" >&2
      echo "  cannot tell whether commits are landed (is master or origin/master missing? git fetch origin)" >&2
      exit 1; }
    if [ "$dirty" -ne 0 ] || [ "$ahead" -ne 0 ]; then
      echo "worktree.sh: REFUSING to remove $path" >&2
      [ "$dirty" -ne 0 ] && echo "  $dirty uncommitted change(s)" >&2
      [ "$ahead" -ne 0 ] && echo "  $ahead commit(s) on ${branch:-detached HEAD} not yet on origin/master" >&2
      echo "  Land or discard them first, then re-run." >&2
      exit 1
    fi

    git worktree remove "$path" || exit 1
    rmdir "$WT_ROOT" 2>/dev/null || true

    # Not `git branch -d`: it asks whether the branch is merged into HEAD, and
    # after the documented landing the main checkout's master is behind
    # origin/master, so -d refused every time while this line still claimed
    # the branch was gone (B-049, TASK-0135). The question that matters is
    # whether the branch's tip is already on master or origin/master; if it
    # is, -D loses nothing. Report what happened, never what was intended.
    if [ -z "$branch" ]; then
      echo "worktree.sh: removed $path (detached HEAD, no branch to delete)"
    elif ! git show-ref --verify --quiet "refs/heads/$branch"; then
      echo "worktree.sh: removed $path (branch $branch did not exist)"
    elif { git merge-base --is-ancestor "$branch" master 2>/dev/null ||
           git merge-base --is-ancestor "$branch" origin/master 2>/dev/null; } &&
         git branch -D "$branch" >/dev/null; then
      echo "worktree.sh: removed $path and branch $branch"
    else
      echo "worktree.sh: removed $path, but KEPT branch $branch:" >&2
      echo "  its tip is on neither master nor origin/master, or the delete failed." >&2
      exit 1
    fi
    ;;

  ""|-h|--help|help) usage ;;
  *) echo "worktree.sh: unknown command '$cmd'" >&2; usage >&2; exit 2 ;;
esac
