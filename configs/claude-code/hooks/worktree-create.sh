#!/usr/bin/env bash
# Claude Code WorktreeCreate hook (ADR-0023, TASK-0261).
#
# Claude Code's own worktrees default to <repo>/.claude/worktrees/<slug>,
# INSIDE the repo. This hook replaces that: it makes the sibling worktree
# `scripts/worktree.sh add <slug>` makes, on branch agent/<slug>.
#
# Contract: the hook JSON arrives on stdin (`name`, a slug like
# bold-oak-a3f2, and `cwd`); the LAST stdout line is the worktree's absolute
# path. Everything else goes to stderr. The hook has no task id, so the
# branch is agent/<slug>; when the task is known, use
# `worktree.sh add TASK-nnnn` instead.
#
# WORKTREE_SKIP_GATE=1: the gate probe in `add` takes minutes, and this hook
# must answer inside its timeout. The \r strips matter on Windows, where the
# python3 launcher writes CRLF.
set -uo pipefail
input=$(cat)
command -v python3 >/dev/null 2>&1 || { echo "worktree-create: python3 is not on PATH" >&2; exit 1; }
name=$(python3 -c 'import json,sys
d=json.load(sys.stdin)
v=d.get("name", "")
sys.stdout.write(v if isinstance(v, str) else "")' <<<"$input") || { echo "worktree-create: stdin is not JSON" >&2; exit 1; }
name=${name%$'\r'}
case "$name" in
  ""|*[!a-zA-Z0-9._-]*|-*|.|..)
    echo "worktree-create: invalid worktree name '$name' (need [A-Za-z0-9._-])" >&2; exit 1 ;;
esac
repo="${CLAUDE_PROJECT_DIR:-}"
[ -f "$repo/scripts/worktree.sh" ] || repo="$(cd "$(dirname "$0")/../../.." && pwd)"
[ -f "$repo/scripts/worktree.sh" ] || { echo "worktree-create: no scripts/worktree.sh under $repo" >&2; exit 1; }
WORKTREE_SKIP_GATE=1 bash "$repo/scripts/worktree.sh" add "$name" >&2 || exit 1
# Ask git where it put it, in the host's own path form.
main=$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir)
main="${main%/.git}"
if command -v cygpath >/dev/null 2>&1; then main=$(cygpath -m "$main"); fi
path="$(dirname "$main")/$(basename "$main")-worktrees/$name"
if command -v cygpath >/dev/null 2>&1; then path=$(cygpath -w "$path"); fi
echo "$path"
