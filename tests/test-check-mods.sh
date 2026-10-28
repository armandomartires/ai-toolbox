#!/usr/bin/env bash
# Prove scripts/check-mods.py's rules 7 and 8 offline. Rule 7 (TASK-0188,
# ADR-0043): every mods/*/hooks/sigma.tsx is a byte-identical copy of the
# template's, and a mod whose hooks draw carries one. Rule 8 (TASK-0193,
# ADR-0044): a mod that reads another mod's $.state mirrors that part of the
# owner's contract, and the mirror agrees with it.
#
# Each case builds a throwaway root with a template and one mod, then runs
# the check against it. Hermetic: a mktemp directory, no git, no network;
# tests/validate.sh runs it.
#
# WHAT THIS PROVES: rule 7 passes identical copies and a mod that draws
# nothing, and fails a differing copy, a drawing mod without one, and a copy
# without its owner; rule 8 passes an agreeing mirror and fails a field the
# owner lacks or types otherwise, a union that differs, a state key the
# owner lacks, and another mod's state read with no mirror. WHAT IT DOES
# NOT PROVE: that the module is right (mods/_template/hooks/sigma.test.tsx),
# or that a reader handles the owner's values (each mod's own tests, run by
# tests/test-mods.sh).
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

# owner <root>: a mod "own" whose contract a reader mirrors.
owner() {
  mod "$1" own
  mkdir -p "$1/mods/own/types"
  cat > "$1/mods/own/types/index.d.ts" <<'EOF'
export type Status = 'queued' | 'done'

export type Job = {
  id: string
  /** When it ended. */
  endedAt?: number
  status: Status
}

declare module 'claude-code' {
  interface PluginState {
    'own': {
      jobs: Job[]
    }
  }
}
EOF
}
# reader <root> <job fields> [status union] [state key line] [comment]:
# a mod "reader" mirroring own's contract; a fifth argument replaces the
# MIRROR comment.
reader() {
  local note union key
  note='// MIRROR of mods/own/types/index.d.ts. Each `Own<Name>` is the owner'"'"'s `<Name>`.'
  [ $# -ge 5 ] && note="$5"
  union="${3:-}"; [ -n "$union" ] || union="'queued' | 'done'"
  key="${4:-}"; [ -n "$key" ] || key='jobs: OwnJob[]'
  mod "$1" reader
  mkdir -p "$1/mods/reader/types"
  printf '%s\n' "$note" "export type OwnStatus = $union" "" "export type OwnJob = {" "$2" "}" "" \
    "declare module 'claude-code' {" "  interface PluginState {" "    'own': {" "      $key" "    }" "  }" "}" \
    > "$1/mods/reader/types/index.d.ts"
}
mirror_root() { local r; r="$(root "$1")"; owner "$r"; echo "$r"; }

r="$(mirror_root agree)"; reader "$r" "  id: string
  status: OwnStatus"
run "$r"; check "M1 a mirror that agrees with its owner passes, a subset of fields" "$rc" "$out"

r="$(mirror_root field)"; reader "$r" "  id: string
  endedAt: number"
run "$r"; [ "$rc" -eq 1 ] && [[ "$out" == *"OwnJob.endedAt is ': number', own's Job.endedAt is '?: number'"* ]]
check "M2 a field typed otherwise than the owner's fails, naming both" $? "$out"

r="$(mirror_root missing-field)"; reader "$r" "  name: string"
run "$r"; [ "$rc" -eq 1 ] && [[ "$out" == *"OwnJob.name is not a field of own's Job"* ]]
check "M3 a field the owner lacks fails" $? "$out"

r="$(mirror_root union)"; reader "$r" "  id: string" "'queued' | 'done' | 'lost'"
run "$r"; [ "$rc" -eq 1 ] && [[ "$out" == *"OwnStatus is"*"own's Status is"* ]]
check "M4 a union that differs from the owner's fails" $? "$out"

r="$(mirror_root key)"; reader "$r" "  id: string" "" "jobs: OwnJob[]
      paused: boolean"
run "$r"; [ "$rc" -eq 1 ] && [[ "$out" == *"reads \$.state 'own'.paused, which mods/own/types/index.d.ts does not declare"* ]]
check "M5 a state key the owner lacks fails" $? "$out"

r="$(mirror_root unmirrored)"; reader "$r" "  id: string" "" "" "// reads own's jobs"
run "$r"; [ "$rc" -eq 1 ] && [[ "$out" == *"declares mods/own's \$.state without a MIRROR comment"* ]]
check "M6 another mod's state read with no mirror fails" $? "$out"

echo "test-check-mods.sh: $((cases - fails))/$cases passed"
[ "$fails" -eq 0 ]
