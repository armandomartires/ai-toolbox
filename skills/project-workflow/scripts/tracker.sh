#!/usr/bin/env bash
# Read, check or declare a project's work tracker: files, gitlab or github.
#
# A project tracks its work either in the `.ai/` layer this skill scaffolds
# (`files`), or on its forge: GitLab or GitHub issues, milestones, boards and
# wiki. The choice is asked once, at scaffolding, and declared in a tracked
# `tracker.conf` at the repository root (ADR-0037 in ai-toolbox). A missing
# tracker.conf means `files`. The dashboard and its publishing pipelines apply
# only to `files`. What lives where on a forge: templates/reference/tracker.md.
#
# Usage:
#   tracker.sh check    [--repo DIR]
#   tracker.sh decision [--repo DIR]
#   tracker.sh init --tracker files|gitlab|github
#                   [--gitlab-project group/name | --github-repo owner/name]
#                   [--repo DIR]
#
#   check     print one line - `files`, `gitlab group/name` or
#             `github owner/name` - for scripts. Absent conf prints `files`.
#   decision  list each remote as `name host forge` and say what is declared:
#             `files (declared)`, `files (default: no tracker.conf)`, or the
#             forge and path, with a NOTE when no remote is on that forge.
#             Always exit 0: there is no pending state to ask about.
#   init      write tracker.conf when there is none. An identical one is left
#             alone; a different one is refused - edit it by hand and record
#             an ADR. Never overwrites.
#   --repo    repository root. Default: the enclosing git work tree, else CWD.
#
# tracker.conf (`key = value`; a `#` comment must start its own line):
#   tracker        = gitlab        # files | gitlab | github
#   gitlab_project = group/name    # required for gitlab, refused otherwise
#   github_repo    = owner/name    # required for github, refused otherwise
# The path is a name, never a host or URL.
#
# Exit codes: 0 ok, 2 refused. Requires python3, standard library only.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

usage() { sed -n '2,35p' "$0" | sed 's/^# \{0,1\}//'; }
case "${1:-}" in
  -h|--help) usage; exit 0 ;;
  "")        usage >&2; exit 2 ;;
esac

command -v python3 >/dev/null 2>&1 || {
  echo "tracker.sh: MISSING prerequisite: python3" >&2; exit 2; }

exec python3 "$HERE/tracker_lib.py" "$@"
