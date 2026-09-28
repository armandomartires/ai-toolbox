#!/usr/bin/env bash
# Generate a self-contained HTML5 delivery dashboard from a repository's .ai/
# governance layer.
#
# WHY THIS EXISTS. The governance layer answers "why" and "what's next" in
# prose, and prose does not add up. The only number anyone tried to maintain
# by hand in this repository -- BACKLOG.md's "N items are open" sentence --
# went stale twice in two days (B-038, TASK-0115, TASK-0118). A generated view
# cannot go stale, because it is regenerated; and it re-counts from the rows
# every time rather than adjusting a previous count by one.
#
# WHAT IT PROVES: what the artifacts on disk currently say.
# WHAT IT DOES NOT PROVE: that any of it is true. A brief recording a suite it
# never ran is rendered as a suite that passed. This is a view of the
# governance layer, not an audit of it -- the same boundary tests/validate.sh
# draws when it checks source completeness and stops there (ADR-0009).
#
# Nothing in this repository runs this script automatically, and it is not part
# of any gate: it needs a working tree and, for its Activity tab, git history,
# so it is neither hermetic nor offline in the way the mandatory gate must be.
# Run it by hand, or from whatever publishes your docs.
#
# Usage:
#   build-dashboard.sh [--root .ai] [--out dashboard.html] [--repo DIR]
#                      [--project NAME] [--theme auto|light|dark]
#                      [--css FILE]... [--css-href URL]
#                      [--json PATH] [--no-git]
#
#   --root       the governance directory. Default `.ai`. Either framework's
#                layout is detected; neither is assumed.
#   --repo       repository root, for git provenance. Default: --root's parent.
#   --css        a stylesheet inlined after the base one. Repeatable. The
#                output stays a single portable file.
#   --css-href   a stylesheet LINKED instead of inlined -- editable without
#                regenerating, at the cost of no longer being self-contained.
#   --json       also write the underlying model, so the same numbers are
#                available to anything else that wants them.
#   --no-git     do not shell out to git. Completion dates then fall back to
#                each brief's Updated field and the Activity tab is empty.
#
# Requires python3 (standard library only) and nothing else: no pip, no npm,
# no network. The emitted file has no CDN reference and no external font.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

command -v python3 >/dev/null 2>&1 || {
  echo "build-dashboard.sh: MISSING prerequisite: python3" >&2; exit 1; }

# The library resolves its assets relative to itself, so this works through
# install.sh's symlinks and from any working directory.
exec python3 "$HERE/dashboard_lib.py" "$@"
