#!/usr/bin/env bash
# Claude Code WorktreeRemove hook (ADR-0023, TASK-0261).
#
# Reads `worktree_path` from the hook JSON on stdin and runs
# `scripts/worktree.sh remove <path>`. A refusal (uncommitted changes,
# unlanded commits, a locked worktree) is printed and the hook still exits 0:
# the worktree stays, which is what Claude Code should see. The \r strip
# matters on Windows, where the python3 launcher writes CRLF.
set -uo pipefail
input=$(cat)
command -v python3 >/dev/null 2>&1 || { echo "worktree-remove: python3 is not on PATH" >&2; exit 1; }
path=$(python3 -c 'import json,sys
d=json.load(sys.stdin)
v=d.get("worktree_path", "")
sys.stdout.write(v if isinstance(v, str) else "")' <<<"$input") || { echo "worktree-remove: stdin is not JSON" >&2; exit 1; }
path=${path%$'\r'}
[ -n "$path" ] || { echo "worktree-remove: no worktree_path in the hook input" >&2; exit 1; }
repo="${CLAUDE_PROJECT_DIR:-}"
[ -f "$repo/scripts/worktree.sh" ] || repo="$(cd "$(dirname "$0")/../../.." && pwd)"
if bash "$repo/scripts/worktree.sh" remove "$path" >&2; then
  :
else
  echo "worktree-remove: kept $path (see above)" >&2
fi
exit 0
