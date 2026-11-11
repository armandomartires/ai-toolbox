#!/usr/bin/env bash
# Prove repo_inventory.py offline (TASK-0167).
#
# Builds fixture repositories under mktemp -- one per risk the report must
# name, plus a bare one, a nested one, a linked worktree, a pruned directory,
# a link to a repository, a corrupt one and a credential-bearing remote --
# then runs the inventory over them. Local git only, no network; run from
# tests/validate.sh.
#
# THE CASE THAT MATTERS is R1: the inventory must change nothing in any
# repository it reads. A fixture's tracked file is touched so that a plain
# `git status` WOULD rewrite its index; the check compares every file under
# the roots, contents and mtimes, before and after.
#
# WHAT THIS PROVES: discovery, each flag, redaction, the exit codes and that
# the run is read-only, on these fixtures.
# WHAT IT DOES NOT PROVE: that a real clone's remote refs are fresh -- the
# tool never fetches, and says so in its report.
#
# Usage: check-repo-inventory.sh [path/to/repo_inventory.py]
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
inv="${1:-$here/repo_inventory.py}"
[ -f "$inv" ] || { echo "FAIL: no script at $inv"; exit 1; }

# The fixtures must never reach a real repository (TASK-0165).
GIT_LOCATORS="GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_OBJECT_DIRECTORY"
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_OBJECT_DIRECTORY
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

tmp="$(mktemp -d)"
WIN=0; case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) WIN=1 ;; esac
cleanup() {
  if [ "$WIN" -eq 1 ] && [ -e "$tmp/roots/link-out" ]; then
    MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$tmp/roots/link-out")" >/dev/null 2>&1
  fi
  rm -rf "$tmp"
}
trap cleanup EXIT

fails=0; cases=0
check() {  # check <name> <condition-exit-status> [detail]
  cases=$((cases + 1))
  if [ "$2" -eq 0 ]; then echo "PASS $1"; else echo "FAIL $1${3:+ -- $3}"; fails=$((fails + 1)); fi
}
# Plain bash substring tests: a crashed grep inside `!` reads as a pass.
has() { [[ "$1" == *"$2"* ]]; }
lacks() { has "$1" "$2"; [ $? -eq 1 ]; }
# row <output> <repo-dir-name>: the report's table row for that repository.
row() { local l; while IFS= read -r l; do
  [[ "$l" == "| \`"*"$2\` |"* ]] && { echo "$l"; return; }; done <<<"$1"; }

R="$tmp/roots"; S="$tmp/server"
mkdir -p "$R" "$S"
g() { git -C "$1" "${@:2}" >/dev/null 2>&1; }
commit() { echo "$2" >> "$1/f.txt"; g "$1" add f.txt; g "$1" commit -qm "$2"; }
pushed_repo() {  # pushed_repo <dir>: one commit, pushed to its own bare origin
  git init -q -b master "$S/$(basename "$1").git" --bare
  git init -q -b master "$1"
  commit "$1" one
  g "$1" remote add origin "$S/$(basename "$1").git"
  g "$1" push -q -u origin master
}

pushed_repo "$R/clean"
g "$R/clean" branch topic                          # local-only, but its tip is pushed
pushed_repo "$R/dirty"
echo staged > "$R/dirty/s.txt"; g "$R/dirty" add s.txt
echo more >> "$R/dirty/f.txt"; echo new > "$R/dirty/u.txt"
pushed_repo "$R/stashed"
echo wip >> "$R/stashed/f.txt"; g "$R/stashed" stash
pushed_repo "$R/ahead"
commit "$R/ahead" two
g "$R/ahead" worktree add -q "$R/ahead-wt" -b side
echo wt >> "$R/ahead-wt/f.txt"                    # a dirty linked worktree
git init -q -b master "$R/noremote"; commit "$R/noremote" one
pushed_repo "$R/gone"
g "$R/gone" checkout -q -b feature; commit "$R/gone" feat
g "$R/gone" push -q -u origin feature; g "$R/gone" checkout -q master
git -C "$S/gone.git" branch -D feature >/dev/null 2>&1; g "$R/gone" fetch -q --prune origin
pushed_repo "$R/detached"
g "$R/detached" checkout -q --detach; commit "$R/detached" loose
pushed_repo "$R/creds"
g "$R/creds" remote add mirror "https://someone:s3cret-token@example.test/x.git?private_token=qq9zz"
mkdir -p "$R/group/sub"; git init -q -b master "$R/group/sub/nested"; commit "$R/group/sub/nested" one
git init -q --bare -b master "$R/srv/thing.git"
mkdir -p "$R/node_modules"; git init -q -b master "$R/node_modules/hidden"
mkdir -p "$R/a/b/c/d"; git init -q -b master "$R/a/b/c/d/deep"
mkdir -p "$R/corrupt/.git"                         # a .git with nothing in it
# A link from inside the roots to a repository outside them: never walked.
mkdir -p "$tmp/outside"; git init -q -b master "$tmp/outside/beyond"
if [ "$WIN" -eq 1 ]; then
  MSYS_NO_PATHCONV=1 cmd /c mklink /J "$(cygpath -w "$R/link-out")" "$(cygpath -w "$tmp/outside")" >/dev/null
else
  ln -s "$tmp/outside" "$R/link-out"
fi
# Make a plain `git status` want to refresh an index: same content, new mtime.
touch -d '2001-01-01' "$R/clean/f.txt"

snapshot() {  # every file under the roots, with its mtime and contents
  (cd "$tmp" && find roots server -type f -print0 2>/dev/null | sort -z \
     | xargs -0 -I{} sh -c 'printf "%s %s " "{}" "$(stat -c %Y "{}")"; cksum < "{}"')
}
before="$(snapshot)"
out="$(python3 "$inv" "$R" 2>&1)"; rc=$?
after="$(snapshot)"

# R1: read-only.
check "R1 the run changes no file under the roots" "$([ "$before" = "$after" ]; echo $?)" \
  "$(diff <(echo "$before") <(echo "$after") | head -5)"
check "R1 exits 0 without --fail-on-risk" "$rc" "$out"

# D: discovery.
check "D1 plain, nested and bare repositories found" \
  "$(has "$out" 'clean` |' && has "$out" 'nested` |' && has "$out" 'thing.git` |'; echo $?)" "$out"
n_ahead=0; while IFS= read -r l; do [[ "$l" == "| \`"*"ahead\` |"* ]] && n_ahead=$((n_ahead + 1)); done <<<"$out"
check "D2 a linked worktree is not a second repository" "$([ "$n_ahead" -eq 1 ] && lacks "$out" 'ahead-wt` |'; echo $?)" "rows for ahead: $n_ahead"
check "D3 pruned directory and link are not walked" \
  "$(lacks "$out" hidden && lacks "$out" beyond; echo $?)" "$out"
check "D4 depth 6 still reaches a repository 5 levels down" "$(has "$out" 'deep` |'; echo $?)" "$out"
shallow="$(python3 "$inv" --max-depth 2 "$R" 2>&1)"
check "D4 --max-depth 2 does not" "$(lacks "$shallow" 'deep` |'; echo $?)" "$shallow"

# F: flags.
check "F1 a clean pushed repository has no flags" "$(has "$(row "$out" clean)" '| - |'; echo $?)" "$(row "$out" clean)"
check "F2 uncommitted work is counted" \
  "$(has "$(row "$out" dirty)" 'uncommitted: 1 staged, 1 modified, 1 untracked'; echo $?)" "$(row "$out" dirty)"
check "F3 a stash is named" "$(has "$(row "$out" stashed)" 'stash: 1'; echo $?)" "$(row "$out" stashed)"
check "F4 commits on no remote are counted per branch" \
  "$(has "$(row "$out" ahead)" 'master: 1 commit(s) on no remote'; echo $?)" "$(row "$out" ahead)"
check "F5 a linked worktree's uncommitted work is named under its repository" \
  "$(has "$(row "$out" ahead)" 'ahead-wt: 1 modified'; echo $?)" "$(row "$out" ahead)"
check "F6 no remote is flagged" "$(has "$(row "$out" noremote)" 'no remote'; echo $?)" "$(row "$out" noremote)"
check "F7 a gone upstream is flagged" "$(has "$(row "$out" gone)" 'feature: upstream gone'; echo $?)" "$(row "$out" gone)"
check "F8 detached commits on no branch are flagged" \
  "$(has "$(row "$out" detached)" 'detached HEAD: 1 commit(s)'; echo $?)" "$(row "$out" detached)"
check "F9 a local branch whose tip is pushed is not flagged" "$(lacks "$(row "$out" clean)" topic; echo $?)" "$(row "$out" clean)"

# X: redaction, errors, formats, exit codes.
check "X1 no credential or token in the report" \
  "$(lacks "$out" s3cret-token && lacks "$out" qq9zz && lacks "$out" someone; echo $?)" "$out"
check "X2 a repository git refuses is listed with a reason" \
  "$(has "$out" '## Could not be read' && has "$out" 'corrupt`:'; echo $?)" "$out"
json="$(python3 "$inv" --format json "$R" 2>&1)"
check "X3 JSON parses and carries the same flags" "$(printf '%s' "$json" | python3 -c '
import json, re, sys
d = json.load(sys.stdin)
r = {re.split(r"[\\/]", x["path"])[-1]: x for x in d["repositories"]}
assert r["clean"]["flags"] == [], r["clean"]["flags"]
assert "no remote" in r["noremote"]["flags"]
assert all("s3cret" not in u for u in r["creds"]["remotes"].values())
assert d["errors"] and d["errors"][0]["reason"]
' 2>&1; echo $?)" "$json"
# One run for both: each full scan of the fixtures costs about a second.
risky="$(python3 "$inv" --risky-only --fail-on-risk "$R" 2>&1)"; rc=$?
check "X4 --risky-only hides clean repositories" "$(lacks "$risky" 'clean` |' && has "$risky" 'noremote` |'; echo $?)" "$risky"
check "X5 --fail-on-risk exits 1 on risk" "$([ "$rc" -eq 1 ]; echo $?)"
python3 "$inv" --fail-on-risk "$S" >/dev/null 2>&1; rc=$?
check "X6 --fail-on-risk exits 1 when a bare server repo has no remote" "$([ "$rc" -eq 1 ]; echo $?)"
mkdir -p "$tmp/only-clean"; git clone -q "$S/clean.git" "$tmp/only-clean/c" 2>/dev/null
python3 "$inv" --fail-on-risk "$tmp/only-clean" >/dev/null 2>&1; rc=$?
check "X7 --fail-on-risk exits 0 when nothing needs attention" "$rc"
python3 "$inv" "$tmp/no-such-dir" >/dev/null 2>&1; rc=$?
check "X8 a missing root exits 2" "$([ "$rc" -eq 2 ]; echo $?)"

# E: an inherited GIT_DIR (a pre-commit hook's) must not redirect the queries.
eout="$(GIT_DIR="$R/noremote/.git" python3 "$inv" "$R" 2>&1)"
check "E1 an inherited GIT_DIR changes nothing in the report" \
  "$(has "$(row "$eout" clean)" '| - |' && has "$(row "$eout" ahead)" 'master: 1 commit(s)'; echo $?)" "$(row "$eout" clean)"

if [ "$fails" -ne 0 ]; then
  echo "check-repo-inventory.sh: $fails of $cases case(s) FAILED"; exit 1
fi
echo "check-repo-inventory.sh: OK ($cases cases)"
