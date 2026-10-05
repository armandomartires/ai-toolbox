#!/usr/bin/env bash
# Prove scripts/worktree.sh's `remove` offline (TASK-0135, B-049).
#
# Builds a throwaway repository with a bare `origin`, copies the script into
# it, and walks the landing procedure the runbook documents: work in a
# worktree, push its branch to origin/master, leave the main checkout's
# `master` behind, then `remove`. Hermetic: a mktemp directory, local git
# only, no network; tests/validate.sh runs it.
#
# THE CASE THAT MATTERS is W1: after a normal landing, `git branch -d` refuses
# (the branch is not merged into the main checkout's HEAD), and the script
# used to print "removed ... and branch ..." anyway.
#
# WHAT THIS PROVES: the branch is deleted exactly when its work is already on
# master or origin/master, the message matches what happened, and unlanded
# work is still refused.
# WHAT IT DOES NOT PROVE: behaviour on /mnt/c, where the real repo lives;
# the fixture is on the Linux side for speed.
#
# Usage: tests/test-worktree.sh [path/to/worktree.sh]   (a copy, for red proofs)
set -uo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
script="${1:-$here/scripts/worktree.sh}"
[ -f "$script" ] || { echo "FAIL: no script at $script"; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

fails=0; cases=0
check() {  # check <name> <condition-exit-status> [detail]
  cases=$((cases + 1))
  if [ "$2" -eq 0 ]; then echo "PASS $1"; else echo "FAIL $1${3:+ -- $3}"; fails=$((fails + 1)); fi
}

git init -q --bare -b master "$tmp/origin.git"
git init -q -b master "$tmp/repo"
cd "$tmp/repo" || exit 1
mkdir -p scripts tests
cp "$script" scripts/worktree.sh
printf '#!/bin/sh\nexit 0\n' > tests/validate.sh
chmod +x scripts/worktree.sh tests/validate.sh
git add -A && git commit -qm init
git remote add origin "$tmp/origin.git"
git push -q origin master
git fetch -q origin

wt="$tmp/repo-worktrees"

# W1: the documented landing. The worktree's commit reaches origin/master; the
# main checkout's master stays behind it.
scripts/worktree.sh add w1 >/dev/null 2>&1
(cd "$wt/w1" && echo a > a && git add a && git commit -qm a \
  && git push -q origin HEAD:master) >/dev/null 2>&1
git fetch -q origin
out="$(scripts/worktree.sh remove w1 2>&1)"; rc=$?
check "W1 remove exits 0 after landing" "$rc" "$out"
git show-ref --verify --quiet refs/heads/agent/w1; gone=$?
check "W1 landed branch agent/w1 is deleted" "$([ "$gone" -ne 0 ]; echo $?)" "$out"
check "W1 message claims the branch only if it is gone" \
  "$( { [ "$gone" -ne 0 ] || ! grep -q 'and branch agent/w1' <<<"$out"; }; echo $?)" "$out"
check "W1 worktree directory is gone" "$([ ! -e "$wt/w1" ]; echo $?)"

# W2: work merged into the local master but not pushed is still safe to drop
# the branch for - its commits are on master.
git merge -q --ff-only origin/master >/dev/null 2>&1
scripts/worktree.sh add w2 >/dev/null 2>&1
(cd "$wt/w2" && echo b > b && git add b && git commit -qm b) >/dev/null 2>&1
git merge -q --ff-only agent/w2 >/dev/null 2>&1
out="$(scripts/worktree.sh remove w2 2>&1)"; rc=$?
check "W2 branch merged into local master is deleted" \
  "$( [ "$rc" -eq 0 ] && ! git show-ref --verify --quiet refs/heads/agent/w2; echo $?)" "$out"

# W3: unlanded work is refused, and nothing is removed.
scripts/worktree.sh add w3 >/dev/null 2>&1
(cd "$wt/w3" && echo c > c && git add c && git commit -qm c) >/dev/null 2>&1
out="$(scripts/worktree.sh remove w3 2>&1)"; rc=$?
check "W3 unlanded commit makes remove exit 1" "$([ "$rc" -eq 1 ]; echo $?)" "$out"
check "W3 refusal keeps the branch and the worktree" \
  "$(git show-ref --verify --quiet refs/heads/agent/w3 && [ -d "$wt/w3" ]; echo $?)"
check "W3 refusal says why" "$(grep -q 'REFUSING' <<<"$out"; echo $?)" "$out"

if [ "$fails" -ne 0 ]; then
  echo "test-worktree.sh: $fails of $cases case(s) FAILED"; exit 1
fi
echo "test-worktree.sh: OK ($cases cases)"
