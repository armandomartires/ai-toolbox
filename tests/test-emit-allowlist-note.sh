#!/usr/bin/env bash
# test-emit-allowlist-note.sh — prove scripts/emit-agents.py appends the
# generated "Shell commands you may run" section to an OpenCode role with a
# shell allowlist, listing its patterns, and to no other role (B-034,
# TASK-0102).
#
# Hermetic: writes only inside a temp directory it creates and removes.
# NOT run from tests/validate.sh; run it by hand after changing the emitter.
#
# Uses the repo's real agents/: closer carries bash-allowlist; task-planner
# carries no-bash.
set -euo pipefail
cd "$(dirname "$0")/.."

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
fail=0
check() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi; }

python3 scripts/emit-agents.py opencode "$T" >/dev/null

H="## Shell commands you may run"
check "an allowlisted role gets the generated section"      'grep -qxF "$H" "$T/closer.md"'
check "it lists the closer's staging pattern verbatim"      'grep -qxF -- "- \`git add -- *\`" "$T/closer.md"'
check "it lists the closer's commit pattern verbatim"       'grep -qxF -- "- \`git commit -m *\`" "$T/closer.md"'
check "every closer pattern is listed"                      '[ "$(grep -c "^- \`git " "$T/closer.md")" -ge 6 ]'
check "it says to quote path arguments"                     'grep -q "double quotes" "$T/closer.md"'
check "a role with test_allow lists those patterns too"     'grep -qxF "$H" "$T/qa-test.md"'
check "a role without a shell allowlist gets no section"    '! grep -qF "$H" "$T/task-planner.md"'
check "the section comes after the role body, not before"   '[ "$(grep -n "^# closer" "$T/closer.md" | cut -d: -f1)" -lt "$(grep -nxF "$H" "$T/closer.md" | cut -d: -f1)" ]'

[ "$fail" -eq 0 ] && echo "test-emit-allowlist-note.sh: OK" || { echo "test-emit-allowlist-note.sh: FAILED"; exit 1; }
