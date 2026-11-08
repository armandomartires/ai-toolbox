#!/usr/bin/env bash
# Prove scripts/worktree.sh's `remove` offline (TASK-0135, B-049), and, since
# TASK-0261, `add`'s task form, `remove` by path for any branch prefix, REPO
# resolution from a worktree, and the Claude Code WorktreeCreate/Remove hooks
# in configs/claude-code/hooks/.
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

has_s() { [[ "$1" == *"$2"* ]]; }
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
mkdir -p configs/claude-code/hooks
cp "$here"/configs/claude-code/hooks/*.sh configs/claude-code/hooks/
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

# W4: the task form. `add TASK-0001` makes agent/TASK-0001 at <root>-worktrees/
# TASK-0001 and is silent about "not a task branch".
out="$(scripts/worktree.sh add TASK-0001 2>&1)"; rc=$?
check "W4 add TASK-0001 creates branch and sibling worktree"   "$( [ "$rc" -eq 0 ] && git show-ref --verify --quiet refs/heads/agent/TASK-0001 && [ -d "$wt/TASK-0001" ]; echo $?)" "$out"
check "W4 task form prints no free-name note" "$(! grep -q 'not a task branch' <<<"$out"; echo $?)" "$out"
out="$(scripts/worktree.sh add free1 2>&1)"
check "W4 free name prints the ADR-0023 note" "$(grep -q 'not a task branch' <<<"$out"; echo $?)" "$out"
git worktree remove "$wt/free1" >/dev/null 2>&1; git branch -D agent/free1 >/dev/null 2>&1

# W5: adding again reports the existing worktree; with the worktree gone but
# the branch kept, it says it is resuming that branch.
out="$(scripts/worktree.sh add TASK-0001 2>&1)"; rc=$?
check "W5 second add reports already exists"   "$( [ "$rc" -eq 0 ] && grep -q 'already exists' <<<"$out"; echo $?)" "$out"
git worktree remove "$wt/TASK-0001" >/dev/null 2>&1
out="$(scripts/worktree.sh add TASK-0001 2>&1)"; rc=$?
check "W5 add on an existing branch says resuming"   "$( [ "$rc" -eq 0 ] && grep -q 'resuming existing branch agent/TASK-0001' <<<"$out"; echo $?)" "$out"
scripts/worktree.sh remove TASK-0001 >/dev/null 2>&1

# W6: a worktree made by plain git, on a foreign prefix, is removed by PATH and
# its branch deleted; list flags the prefix.
git worktree add -q -b codex/x "$wt/cx" >/dev/null 2>&1
out="$(scripts/worktree.sh list 2>&1)"
check "W6 list flags a foreign prefix" "$(grep 'codex/x' <<<"$out" | grep -q 'foreign prefix'; echo $?)" "$out"
out="$(scripts/worktree.sh remove "$wt/cx" 2>&1)"; rc=$?
check "W6 remove <path> removes a codex/ worktree and its branch"   "$( [ "$rc" -eq 0 ] && [ ! -e "$wt/cx" ] && ! git show-ref --verify --quiet refs/heads/codex/x; echo $?)" "$out"
git worktree add -q --detach "$wt/dt" >/dev/null 2>&1
out="$(scripts/worktree.sh remove "$wt/dt" 2>&1)"; rc=$?
check "W6 remove <path> removes a detached worktree" "$( [ "$rc" -eq 0 ] && [ ! -e "$wt/dt" ]; echo $?)" "$out"

# W7: an unpushed commit on a foreign-prefix worktree is refused by path too.
git worktree add -q -b claude/y "$wt/cy" >/dev/null 2>&1
(cd "$wt/cy" && echo d > d && git add d && git commit -qm d) >/dev/null 2>&1
out="$(scripts/worktree.sh remove "$wt/cy" 2>&1)"; rc=$?
check "W7 remove refuses an unpushed commit by path"   "$( [ "$rc" -eq 1 ] && [ -d "$wt/cy" ] && git show-ref --verify --quiet refs/heads/claude/y; echo $?)" "$out"

# W8: run from inside a worktree, the script still resolves the main repo: the
# main checkout carries the mark and the worktree it ran from does not. (A bare
# count of marks would pass vacuously if the worktree were mistaken for it.)
# The repo as git spells it (C:/Users/... long form on Git Bash); cygpath -m
# would give 8.3 short names for a mktemp dir.
repo_g="$(git -C "$tmp/repo" rev-parse --show-toplevel)"
mm() { local x="${1//\\//}"; echo "$x"; }   # backslashes to slashes
out="$(cd "$wt/w3" && bash scripts/worktree.sh list 2>&1)"
main_line="$(grep -F "$repo_g " <<<"$out" | head -1)"
w3_line="$(grep -F "repo-worktrees/w3" <<<"$out" | head -1)"
check "W8 from a worktree, the main checkout line carries the mark"   "$(has_s "$main_line" 'main checkout'; echo $?)" "$out"
check "W8 from a worktree, that worktree's own line does not"   "$([ -n "$w3_line" ] && ! has_s "$w3_line" 'main checkout' && ! has_s "$w3_line" NESTED; echo $?)" "$out"
out="$(cd "$wt/w3" && bash scripts/worktree.sh add w8probe 2>&1)"
check "W8 add from a worktree puts the new one beside the real repo"   "$([ -d "$wt/w8probe" ]; echo $?)" "$out"
git worktree remove "$wt/w8probe" >/dev/null 2>&1; git branch -D agent/w8probe >/dev/null 2>&1

# W9: a relative path is the caller's, not the repo's; a branch outside the
# workflow's prefixes is refused before anything is removed.
git worktree add -q -b claude/z "$wt/cz" >/dev/null 2>&1
out="$(cd "$wt" && bash "$tmp/repo/scripts/worktree.sh" remove ./cz 2>&1)"; rc=$?
check "W9 remove ./relative resolves against the caller's cwd"   "$( [ "$rc" -eq 0 ] && [ ! -e "$wt/cz" ] && ! git show-ref --verify --quiet refs/heads/claude/z; echo $?)" "$out"
git worktree add -q -b feature/q "$wt/fq" >/dev/null 2>&1
out="$(scripts/worktree.sh remove "$wt/fq" 2>&1)"; rc=$?
check "W9 a branch outside agent/claude/codex/worktree-* is refused"   "$( [ "$rc" -eq 1 ] && [ -d "$wt/fq" ] && git show-ref --verify --quiet refs/heads/feature/q; echo $?)" "$out"
git worktree remove --force "$wt/fq" >/dev/null 2>&1; git branch -D feature/q >/dev/null 2>&1

# W10: the hooks, fed JSON the way Claude Code does, through this host's python3.
slug=bold-oak-a3f2
so="$tmp/hook.stderr"
out="$(printf '{"name":"%s","cwd":"%s"}' "$slug" "$tmp/repo" | CLAUDE_PROJECT_DIR="$tmp/repo" bash configs/claude-code/hooks/worktree-create.sh 2>"$so")"; rc=$?
nl="$(printf '%s' "$out" | grep -c '')"
check "W10 create hook exits 0 and prints exactly one stdout line" "$([ "$rc" -eq 0 ] && [ "$nl" -eq 1 ]; echo $?)" "rc=$rc [$out] $(cat "$so")"
check "W10 that line is the sibling worktree path, no stray CR" "$([ "$(mm "$out")" = "$repo_g-worktrees/$slug" ] && [ "$(printf '%s' "$out" | tr -d '\r' | wc -c)" -eq "$(printf '%s' "$out" | wc -c)" ]; echo $?)" "[$out]"
check "W10 create hook made branch agent/$slug and said the gate was not probed"   "$(git show-ref --verify --quiet "refs/heads/agent/$slug" && [ -d "$wt/$slug" ] && has_s "$(cat "$so")" 'not probed'; echo $?)" "$(cat "$so")"
out="$(printf '{"name":"bad name"}' | CLAUDE_PROJECT_DIR="$tmp/repo" bash configs/claude-code/hooks/worktree-create.sh 2>&1)"; rc=$?
check "W10 create hook refuses an invalid name" "$([ "$rc" -ne 0 ] && has_s "$out" invalid; echo $?)" "$out"
hp="$repo_g-worktrees/$slug"
out="$(printf '{"worktree_path":"%s"}' "$hp" | CLAUDE_PROJECT_DIR="$tmp/repo" bash configs/claude-code/hooks/worktree-remove.sh 2>&1)"; rc=$?
check "W10 remove hook removes it and its branch"   "$([ "$rc" -eq 0 ] && [ ! -e "$wt/$slug" ] && ! git show-ref --verify --quiet "refs/heads/agent/$slug"; echo $?)" "$out"
git worktree add -q -b claude/hk "$wt/hk" >/dev/null 2>&1
(cd "$wt/hk" && echo h > h && git add h && git commit -qm h) >/dev/null 2>&1
out="$(printf '{"worktree_path":"%s"}' "$repo_g-worktrees/hk" | CLAUDE_PROJECT_DIR="$tmp/repo" bash configs/claude-code/hooks/worktree-remove.sh 2>&1)"; rc=$?
check "W10 remove hook on an unpushed commit exits 0 and leaves the worktree"   "$([ "$rc" -eq 0 ] && [ -d "$wt/hk" ] && has_s "$out" REFUSING; echo $?)" "$out"

if [ "$fails" -ne 0 ]; then
  echo "test-worktree.sh: $fails of $cases case(s) FAILED"; exit 1
fi
echo "test-worktree.sh: OK ($cases cases)"
