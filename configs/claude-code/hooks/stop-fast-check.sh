#!/usr/bin/env bash
# Claude Code Stop hook (TASK-0277, P1.7, Q14=B): run scripts/fast-check.sh
# only when TRACKED files changed, and block the stop with its output.
#
# - Clean tree, or untracked-only changes: exit 0 at once, no check runs.
#   Untracked new files and changes already committed are not checked; the
#   full gate (tests/validate.sh, CI) covers them.
# - Failure: exit 2 with the failure text on stderr; Claude Code feeds it back
#   and the session continues.
# - Trap guard: when the payload's stop_hook_active is true the stop was
#   already blocked once in this turn, so it passes. A failure is reported once
#   per turn, never loops; the next turn that changes tracked files checks
#   again. Override: FAST_CHECK_SKIP=1.
# - The tree checked is the payload's "cwd" (its repository root) when present,
#   else CLAUDE_PROJECT_DIR, else this hook's own checkout.
set -uo pipefail
input=$(cat 2>/dev/null || true)
[ "${FAST_CHECK_SKIP:-}" = 1 ] && exit 0
parsed=$(python3 -c 'import json,sys
try:
    d = json.load(sys.stdin)
    if not isinstance(d, dict): d = {}
except Exception:
    d = {}
c = d.get("cwd")
print("1" if d.get("stop_hook_active") is True else "0")
print(c if isinstance(c, str) else "")' <<<"$input" 2>/dev/null | tr -d '\r') || parsed=""
active=$(sed -n 1p <<<"$parsed")
cwd=$(sed -n 2p <<<"$parsed")
[ "$active" = 1 ] && exit 0

repo=""
for cand in "$( [ -n "$cwd" ] && [ -d "$cwd" ] && git -C "$cwd" rev-parse --show-toplevel 2>/dev/null )" \
            "${CLAUDE_PROJECT_DIR:-}" "$(cd "$(dirname "$0")/../../.." && pwd)"; do
  if [ -n "$cand" ] && [ -f "$cand/scripts/fast-check.sh" ]; then repo="$cand"; break; fi
done
[ -n "$repo" ] || exit 0
changed=$(git -C "$repo" status --porcelain --untracked-files=no 2>/dev/null)
[ -n "$changed" ] || exit 0
out=$(bash "$repo/scripts/fast-check.sh" 2>&1) && exit 0
printf 'Stop blocked: the fast check failed on the tracked changes.\n%s\n' "$out" >&2
exit 2
