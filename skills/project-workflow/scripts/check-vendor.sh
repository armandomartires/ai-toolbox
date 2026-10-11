#!/usr/bin/env bash
# Prove vendor-skill.sh writes, checks, verifies and refuses as documented.
#
# Every case runs in throwaway git repositories under mktemp: a SOURCE repo
# holding a small skill with the real vendor-skill.sh and vendor_lib.py in it,
# and a CONSUMER repo it is vendored into. Nothing touches the repository this
# is run from. tests/validate.sh runs it.
#
# THE CASE THAT MATTERS MOST is `--verify fails on a local edit`: it is what a
# consuming project's gate runs, and a vendored copy edited in place is how a
# second, silently diverging generator starts (TASK-0125, TASK-0161).
#
# WHAT THIS PROVES: the write, removal, refusal, staleness and edit-detection
# rules, each by a case that fails when the rule is removed.
# WHAT IT DOES NOT PROVE: that a vendored copy runs in a consumer's CI.
set -uo pipefail

# A pre-commit hook exports GIT_DIR and GIT_INDEX_FILE, and both override
# `git -C`; clear them so every git call reaches the scratch repository it
# names (TASK-0127, where one that did not committed a 423-file deletion).
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_PREFIX \
      GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_NAMESPACE \
      GIT_CEILING_DIRECTORIES GIT_DISCOVERY_ACROSS_FILESYSTEM

HERE="$(cd "$(dirname "$0")" && pwd)"

command -v python3 >/dev/null 2>&1 || { echo "check-vendor.sh: MISSING prerequisite: python3" >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "check-vendor.sh: MISSING prerequisite: git" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fails=0
count=0

g() { git -C "$1" -c user.name=check -c user.email=check@example.invalid \
        -c core.hooksPath=/dev/null -c init.defaultBranch=master \
        -c core.autocrlf=false "${@:2}"; }

# expect CODE DESCRIPTION [grep-pattern] -- command...
expect() {
  local want="$1" desc="$2" pat=""; shift 2
  if [ "$1" != "--" ]; then pat="$1"; shift; fi
  shift
  local out code
  out="$("$@" 2>&1)"; code=$?
  count=$((count + 1))
  if [ "$code" -ne "$want" ]; then
    echo "FAIL  $desc (exit $code, want $want)"; printf '%s\n' "$out" | sed 's/^/        /'
    fails=$((fails + 1)); return
  fi
  if [ -n "$pat" ] && ! printf '%s' "$out" | grep -q -- "$pat"; then
    echo "FAIL  $desc (output lacks '$pat')"; printf '%s\n' "$out" | sed 's/^/        /'
    fails=$((fails + 1)); return
  fi
  echo "PASS  $desc"
}

# The source: a skill with the real vendoring scripts, plus files in every
# shipped directory and one in a directory that is not shipped.
SRC="$TMP/src"
SK="$SRC/skills/pw"
mkdir -p "$SK/scripts" "$SK/assets/publish" "$SK/fixtures"
cp "$HERE/vendor-skill.sh" "$HERE/vendor_lib.py" "$SK/scripts/"
printf -- '---\nname: pw\nmetadata:\n  version: "1.0.0"\n---\n# pw\n' > "$SK/SKILL.md"
echo 'echo build' > "$SK/scripts/build-dashboard.sh"
echo 'template' > "$SK/assets/publish/x.yml"
echo 'fixture' > "$SK/fixtures/f.md"
g "$SRC" init -q && g "$SRC" add -A && g "$SRC" commit -q -m one
V="$SK/scripts/vendor-skill.sh"

# The consumer: declares where the copy goes, as a publishing project does.
C="$TMP/consumer"
mkdir -p "$C"
g "$C" init -q
printf 'targets = none\nskill_dir = tools/pw\n' > "$C/dashboard-publish.conf"
D="$C/tools/pw"

# --- write -------------------------------------------------------------------
expect 0 "--write vendors into skill_dir from the conf" "vendored pw 1.0.0" -- "$V" --into "$C" --write
expect 0 "the manifest records version and commit" -- grep -q '^- Version: `1.0.0`' "$D/VENDORED.md"
expect 0 "the manifest records the source commit" -- grep -q "^- Commit: \`$(g "$SRC" rev-parse HEAD)\`" "$D/VENDORED.md"
expect 1 "fixtures/ is not shipped" -- test -e "$D/fixtures/f.md"
expect 0 "--check is clean straight after --write" "ok" -- "$V" --into "$C" --check
expect 0 "--verify passes on the untouched copy" "unedited" -- "$D/scripts/vendor-skill.sh" --verify
python3 -c "import sys; p=sys.argv[1]; d=open(p,'rb').read(); open(p,'wb').write(d.replace(b'\n', b'\r\n'))" "$D/scripts/build-dashboard.sh"
expect 0 "CRLF line endings are not an edit" -- "$D/scripts/vendor-skill.sh" --verify

# --- edits in the copy -----------------------------------------------------
echo 'echo edited' >> "$D/scripts/build-dashboard.sh"
expect 1 "--verify fails on a local edit and names the file" "edited locally scripts/build-dashboard.sh" -- "$D/scripts/vendor-skill.sh" --verify
expect 1 "--check reports the local edit too" "edited locally" -- "$V" --into "$C" --check
expect 2 "--write refuses to discard a local edit" "local edits" -- "$V" --into "$C" --write
expect 0 "--write --adopt discards it deliberately" -- "$V" --into "$C" --write --adopt
expect 0 "the copy verifies again" -- "$D/scripts/vendor-skill.sh" --verify

echo 'mine' > "$D/scripts/extra.sh"
expect 1 "--verify fails on a file added beside the copy" "not vendored   scripts/extra.sh" -- "$D/scripts/vendor-skill.sh" --verify
expect 0 "--write keeps a hand-added file and names it" "kept     scripts/extra.sh" -- "$V" --into "$C" --write
expect 0 "the hand-added file is still there" -- test -f "$D/scripts/extra.sh"
rm "$D/scripts/extra.sh"
mkdir -p "$D/scripts/__pycache__"; echo x > "$D/scripts/__pycache__/vendor_lib.cpython-311.pyc"
expect 0 "--verify ignores __pycache__ written by running the copy" -- "$D/scripts/vendor-skill.sh" --verify

# --- the source moves on -----------------------------------------------------
sed -i 's/1.0.0/1.1.0/' "$SK/SKILL.md"
echo 'echo build v2' > "$SK/scripts/build-dashboard.sh"
g "$SRC" rm -q "$SK/assets/publish/x.yml"
g "$SRC" add -A && g "$SRC" commit -q -m two
expect 1 "--check reports a copy behind the source" "behind         scripts/build-dashboard.sh" -- "$V" --into "$C" --check
expect 1 "--check names both versions" "vendored 1.0.0, source 1.1.0" -- "$V" --into "$C" --check
expect 0 "--write brings it up to date" "was 1.0.0" -- "$V" --into "$C" --write
expect 1 "--write removed a file gone from the source" -- test -e "$D/assets/publish/x.yml"
expect 0 "--check is clean again" -- "$V" --into "$C" --check

# --- refusals ------------------------------------------------------------------
echo 'uncommitted' >> "$SK/scripts/build-dashboard.sh"
expect 2 "--write refuses uncommitted source changes" "uncommitted" -- "$V" --into "$C" --write
g "$SRC" checkout -q -- "$SK/scripts/build-dashboard.sh"
expect 2 "a destination outside the repository is refused" "outside the repository" -- "$V" --into "$C" --dest ../elsewhere --write
expect 2 "the repository root itself is refused" "outside the repository" -- "$V" --into "$C" --dest . --write
mkdir -p "$C/hand/pw"; echo 'old' > "$C/hand/pw/SKILL.md"
expect 2 "a hand-made copy is not overwritten" "not written by this script" -- "$V" --into "$C" --dest hand/pw --write
expect 0 "--adopt takes it over" -- "$V" --into "$C" --dest hand/pw --write --adopt
C2="$TMP/noconf"; mkdir -p "$C2"; g "$C2" init -q
expect 2 "no conf and no --dest is refused" "no destination" -- "$V" --into "$C2" --write
expect 2 "--verify in the source is refused" "not a vendored copy" -- "$V" --verify
expect 2 "vendoring from a vendored copy is refused" "itself a vendored copy" -- "$D/scripts/vendor-skill.sh" --into "$C2" --dest x --write
expect 2 "--check and --write together are refused" -- "$V" --into "$C" --check --write

echo
if [ "$fails" -ne 0 ]; then
  echo "check-vendor.sh: $fails of $count case(s) FAILED"
  exit 1
fi
echo "check-vendor.sh: OK ($count cases)"
