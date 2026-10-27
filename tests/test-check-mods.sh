#!/usr/bin/env bash
# Prove scripts/check-mods.py's rule 7 offline (TASK-0188, ADR-0043): every
# mods/*/hooks/sigma.tsx is a byte-identical copy of the template's, and a
# mod whose hooks draw carries one.
#
# Each case builds a throwaway root with a template and one mod, then runs
# the check against it. Hermetic: a mktemp directory, no git, no network;
# tests/validate.sh runs it.
#
# WHAT THIS PROVES: the rule passes identical copies and a mod that draws
# nothing, and fails a differing copy, a drawing mod without one, and a copy
# without its owner. WHAT IT DOES NOT PROVE: that the module is right; its
# tests are mods/_template/hooks/sigma.test.tsx, run by tests/test-mods.sh.
#
# Usage: tests/test-check-mods.sh [path/to/check-mods.py]
set -uo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
script="${1:-$here/scripts/check-mods.py}"
[ -f "$script" ] || { echo "FAIL: no script at $script"; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fails=0; cases=0
check() {  # check <name> <condition-exit-status> [detail]
  cases=$((cases + 1))
  if [ "$2" -eq 0 ]; then echo "PASS $1"; else echo "FAIL $1${3:+ -- $3}"; fails=$((fails + 1)); fi
}

# mod <root> <dir> <register body>: a mod that passes rules 1 to 6.
mod() {
  local d="$1/mods/$2"
  mkdir -p "$d/.claude-plugin" "$d/hooks"
  printf '{"name": "%s", "description": "A mod."}\n' "${3:-$2}" > "$d/.claude-plugin/plugin.json"
  printf '{"modules": ["./register.tsx"]}\n' > "$d/hooks/hooks.json"
  printf '%s\n' "${4:-export const register = () => {}}" > "$d/hooks/register.tsx"
  echo "# $2" > "$d/README.md"
}
# root <name>: a root whose template owns a sigma.tsx.
root() {
  local r="$tmp/$1"
  mod "$r" _template my-mod
  echo "export const SIGMA = 'v2'" > "$r/mods/_template/hooks/sigma.tsx"
  echo "$r"
}
run() { out="$(python3 "$script" "$1" 2>&1)"; rc=$?; }
DRAW="on('ui.render', { component: 'Pane' }, () => null)"

r="$(root same)"; mod "$r" pane pane "$DRAW"; cp "$r/mods/_template/hooks/sigma.tsx" "$r/mods/pane/hooks/"
run "$r"; check "S1 an identical copy passes" "$rc" "$out"

r="$(root plain)"; mod "$r" quiet
run "$r"; check "S2 a mod that draws nothing needs no copy" "$rc" "$out"

r="$(root differs)"; mod "$r" pane pane "$DRAW"; echo "export const SIGMA = 'v1'" > "$r/mods/pane/hooks/sigma.tsx"
run "$r"; [ "$rc" -eq 1 ] && [[ "$out" == *"mods/pane: hooks/sigma.tsx differs from its owner"* ]]
check "S3 a differing copy fails, naming the mod" $? "$out"

r="$(root missing)"; mod "$r" pane pane "$DRAW"
run "$r"; [ "$rc" -eq 1 ] && [[ "$out" == *"mods/pane: draws (ui.render) without hooks/sigma.tsx; cp mods/_template/hooks/sigma.tsx"* ]]
check "S4 a drawing mod without a copy fails, with the cp to run" $? "$out"

r="$(root test-only)"; mod "$r" pane; echo "$DRAW" > "$r/mods/pane/hooks/view.test.tsx"
run "$r"; check "S5 a test file that draws does not count" "$rc" "$out"

r="$(root orphan)"; mod "$r" pane; echo "x" > "$r/mods/pane/hooks/sigma.tsx"; rm "$r/mods/_template/hooks/sigma.tsx"
run "$r"; [ "$rc" -eq 1 ] && [[ "$out" == *"owner mods/_template/hooks/sigma.tsx is missing"* ]]
check "S6 a copy without its owner fails" $? "$out"

echo "test-check-mods.sh: $((cases - fails))/$cases passed"
[ "$fails" -eq 0 ]
