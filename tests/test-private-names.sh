#!/usr/bin/env bash
# Prove scripts/check-private-names.sh offline (TASK-0162).
#
# Each case builds a throwaway repository with a made-up origin URL and a
# tracked file, then runs the check. Hermetic: a mktemp directory, local git
# only, no network; tests/validate.sh runs it. Every host name here is
# invented (`.test` is reserved, RFC 2606), so this file trips nothing.
#
# THE CASE THAT MATTERS is N5: a pattern must never appear in the check's own
# output, because that output reaches CI logs and chat transcripts.
#
# WHAT THIS PROVES: what the check derives from each origin shape, that it
# reads info/private-patterns from the common git dir (so worktrees share it),
# that it sees staged files but not untracked ones, and its exit codes.
# WHAT IT DOES NOT PROVE: that the real origin and patterns file cover every
# private host. That is configuration, and each host owns its own.
#
# Usage: tests/test-private-names.sh [path/to/check-private-names.sh]
set -uo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
script="${1:-$here/scripts/check-private-names.sh}"
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

HOST=corpgit7.lan.example-corp.test
LABEL=corpgit7
PARENT=lan.example-corp.test
all_out=""

# repo <name> <origin-url|-> [file-content]: a committed repository whose one
# tracked file holds the content; "-" means no origin remote. Named by its
# case, since it runs in a $(...) subshell where a counter would not advance.
repo() {
  local d="$tmp/$1"
  git init -q -b master "$d"
  [ "$2" = "-" ] || git -C "$d" remote add origin "$2"
  printf '%s\n' "${3:-nothing to see}" > "$d/notes.md"
  git -C "$d" add notes.md && git -C "$d" commit -qm init
  echo "$d"
}
# has/lacks <text> <needle>: case-insensitive substring tests in bash itself.
# grep -iF aborted under Git Bash, and a crashed or missing command inside `!`
# reads as a pass -- so `lacks` succeeds only on a clean "not found".
has() { [[ "${1,,}" == *"${2,,}"* ]]; }
lacks() { has "$1" "$2"; [ $? -eq 1 ]; }
count_hits() { local c=0 l; while IFS= read -r l; do [[ "$l" == "PRIVATE NAME:"* ]] && c=$((c + 1)); done <<<"$1"; echo "$c"; }
run() { out="$(bash "$script" "$1" 2>&1)"; rc=$?; all_out+="$out"$'\n'; }

# N1-N3: each derived pattern is caught, and the source is named.
d="$(repo n1 "http://$HOST/grp/proj.git" "clone from $HOST please")"; run "$d"
check "N1 full origin host fails" "$([ "$rc" -eq 1 ]; echo $?)" "$out"
check "N1 names file:line and the source" "$(has "$out" 'PRIVATE NAME: notes.md:1 (origin host)'; echo $?)" "$out"
d="$(repo n2 "http://$HOST/grp/proj.git" "the box is $LABEL")"; run "$d"
check "N2 first label alone fails" "$([ "$rc" -eq 1 ] && has "$out" 'first label'; echo $?)" "$out"
d="$(repo n3 "http://$HOST/grp/proj.git" "anything under $PARENT")"; run "$d"
check "N3 parent domain alone fails" "$([ "$rc" -eq 1 ] && has "$out" 'parent domain'; echo $?)" "$out"

# N4: a clean tree passes and says how many patterns it checked.
d="$(repo n4 "http://$HOST/grp/proj.git")"; run "$d"
check "N4 clean tree passes" "$([ "$rc" -eq 0 ] && has "$out" 'OK (3 patterns)'; echo $?)" "$out"

# N6: hostnames are case-insensitive.
d="$(repo n6 "https://$HOST/grp/proj.git" "see ${LABEL^^}")"; run "$d"
check "N6 upper-case label fails" "$([ "$rc" -eq 1 ]; echo $?)" "$out"

# N7: a staged file is checked (that is what pre-commit sees); an untracked
# one is not, since it is not published.
d="$(repo n7 "http://$HOST/grp/proj.git")"
echo "$LABEL" > "$d/untracked.md"; run "$d"
check "N7 untracked file is ignored" "$([ "$rc" -eq 0 ]; echo $?)" "$out"
echo "$LABEL" > "$d/staged.md"; git -C "$d" add staged.md; run "$d"
check "N7 staged file fails" "$([ "$rc" -eq 1 ] && has "$out" 'staged.md:1' && lacks "$out" untracked; echo $?)" "$out"

# N8: info/private-patterns -- comments, blanks and CRLF ignored; a prefix
# catches every host that shares it.
d="$(repo n8 "https://github.com/o/r.git" "nodes fakepve1 and fakepve4")"
printf '# a comment naming nothing\r\n\r\n  fakepve  \r\n' > "$d/.git/info/private-patterns"; run "$d"
check "N8 patterns-file prefix fails" "$([ "$rc" -eq 1 ] && has "$out" 'private-patterns #1'; echo $?)" "$out"
check "N8 the comment line is not a pattern" "$(lacks "$out" 'private-patterns #2'; echo $?)" "$out"

# N9: a linked worktree reads the same patterns file.
git -C "$d" worktree add -q "$tmp/n9-wt" -b agent/n9 2>/dev/null; run "$tmp/n9-wt"
check "N9 worktree uses the common patterns file" "$([ "$rc" -eq 1 ] && has "$out" 'private-patterns #1'; echo $?)" "$out"

# N10-N11: nothing configured is said out loud, and is not a failure.
d="$(repo n10 "https://github.com/o/r.git" "github.com is fine")"; run "$d"
check "N10 public forge says nothing is configured" "$([ "$rc" -eq 0 ] && has "$out" 'nothing private configured'; echo $?)" "$out"
d="$(repo n11 - "no remote")"; run "$d"
check "N11 no origin says nothing is configured" "$([ "$rc" -eq 0 ] && has "$out" 'nothing private configured'; echo $?)" "$out"

# N12: a generic first label is not a pattern; the parent domain still is.
d="$(repo n12 "http://gitlab.corp.example.test/g/p.git" "we use gitlab")"; run "$d"
check "N12 generic label 'gitlab' is not a pattern" "$([ "$rc" -eq 0 ] && has "$out" 'OK (2 patterns)'; echo $?)" "$out"

# N13: scp-style and ssh:// URLs derive the same host.
d="$(repo n13 "git@$HOST:grp/proj.git" "$LABEL")"; run "$d"
check "N13 scp-style URL derives the host" "$([ "$rc" -eq 1 ]; echo $?)" "$out"
d="$(repo n13b "ssh://git@$HOST:2222/grp/proj.git" "$LABEL")"; run "$d"
check "N13 ssh:// URL with port derives the host" "$([ "$rc" -eq 1 ]; echo $?)" "$out"

# N14: an IP origin is one pattern, with no label or parent.
d="$(repo n14 "http://10.20.30.40:8080/g/p.git" "at 10.20.30.40")"; run "$d"
check "N14 IP origin fails on the IP" "$([ "$rc" -eq 1 ] && [ "$(count_hits "$out")" -eq 1 ]; echo $?)" "$out"

# N15: outside a work tree it refuses rather than passing.
mkdir -p "$tmp/plain"; run "$tmp/plain"
check "N15 non-repository exits 2" "$([ "$rc" -eq 2 ]; echo $?)" "$out"

# N5: no pattern ever appears in any output above.
leak=0
for p in "$HOST" "$LABEL" "$PARENT" fakepve 10.20.30.40; do
  lacks "$all_out" "$p" || { leak=1; echo "  leaked: a pattern"; }
done
check "N5 no output names a pattern" "$leak"

if [ "$fails" -ne 0 ]; then
  echo "test-private-names.sh: $fails of $cases case(s) FAILED"; exit 1
fi
echo "test-private-names.sh: OK ($cases cases)"
