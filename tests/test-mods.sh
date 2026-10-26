#!/usr/bin/env bash
# Run every mod's own checks with Claude Code itself: `claude plugin
# validate` (manifest, hooks, the $.state contract) and `claude plugin test`
# (the mod's *.test.ts and *.test.tsx files). ADR-0040, TASK-0177.
#
# Usage: test-mods.sh [--mod <name>]
#
# NOT part of tests/validate.sh: it needs a `claude` that supports mods
# (2.1.308 or later), which the offline, hermetic gate must not require. The
# gate checks each mod's shape (scripts/check-mods.py); this checks that it
# loads and that its tests pass. Run it for any task that changes a mod.
#
# The CLI is the first of $CLAUDE_BIN, `claude`, `claude.exe` that is new
# enough. In WSL, `claude.exe` is the Windows CLI, which reads this checkout
# over \\wsl.localhost; the WSL `claude` may lag behind it.
#
# Outcomes are three, never two:
#   PASS - validate and test both passed
#   FAIL - either failed (a real defect)
#   SKIP - no new-enough `claude` found, so nothing ran. NOT a pass.
#
# Exit codes: 0 = all PASS, 1 = at least one FAIL, 2 = usage error or
#             unknown mod, 3 = SKIP.
set -uo pipefail
cd "$(dirname "$0")/.."

MIN=2.1.308
WANT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --mod)   shift; WANT="${1:-}" ;;
    --mod=*) WANT="${1#*=}" ;;
    -h|--help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

# Prints the version a candidate reports, or nothing.
version_of() {
  "$1" --version 2>/dev/null | grep -oE '^[0-9]+\.[0-9]+\.[0-9]+' | head -1
}

CLI=""
for c in ${CLAUDE_BIN:-} claude claude.exe; do
  command -v "$c" >/dev/null 2>&1 || continue
  v="$(version_of "$c")"
  [ -n "$v" ] || continue
  if [ "$(printf '%s\n%s\n' "$MIN" "$v" | sort -V | head -1)" = "$MIN" ]; then
    CLI="$c"; echo "using $c $v"; break
  fi
  echo "skipping $c $v: mods need $MIN or later"
done
if [ -z "$CLI" ]; then
  echo "SKIP all mods: no claude $MIN or later (set CLAUDE_BIN, or run claude update)"
  echo "note: SKIP is not a pass - the check did not run."
  exit 3
fi

pass=0; failed=0; matched=0
for d in mods/*/; do
  name="$(basename "$d")"
  [ -z "$WANT" ] || [ "$WANT" = "$name" ] || continue
  matched=$((matched + 1))
  # Run from mods/ with a relative path, so a Windows CLI in WSL resolves it
  # against its \\wsl.localhost working directory.
  if ! out="$(cd mods && "$CLI" plugin validate "$name" 2>&1)"; then
    printf '%s\n' "$out" | grep -E '^ *(>|×)' ; echo "FAIL $name: plugin validate"
    failed=$((failed + 1)); continue
  fi
  if ! out="$(cd mods && "$CLI" plugin test "$name" 2>&1)"; then
    printf '%s\n' "$out" | grep -E '\((fail)\)|error' ; echo "FAIL $name: plugin test"
    failed=$((failed + 1)); continue
  fi
  echo "PASS $name: $(printf '%s\n' "$out" | grep -E '^ *[0-9]+ pass' | tr -s ' ')"
  pass=$((pass + 1))
done

if [ "$matched" -eq 0 ]; then
  echo "no mod named '${WANT}' under mods/" >&2
  exit 2
fi
echo "test-mods.sh: $pass passed, $failed failed"
[ "$failed" -eq 0 ] || exit 1
exit 0
