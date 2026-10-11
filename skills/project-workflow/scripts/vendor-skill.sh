#!/usr/bin/env bash
# Copy this skill into a project that publishes its dashboard, and keep the
# copy checkable.
#
# A project that publishes needs the skill INSIDE its repository: a CI runner
# clones the repository and nothing else, so `skill_dir` in
# dashboard-publish.conf must be a tracked path there. This script makes and
# updates that copy, and VENDORED.md in it records the source commit, the
# version and a sha256 per file. See references/dashboard.md, "Publishing it".
#
# Usage:
#   vendor-skill.sh --into REPO [--dest PATH] --write [--adopt]
#   vendor-skill.sh --into REPO [--dest PATH] --check
#   vendor-skill.sh --verify [--dir DIR]
#
#   --write   run from the SOURCE checkout: copy SKILL.md, scripts/, assets/,
#             dashboard/, references/ and schemas/ as committed at HEAD into
#             REPO/PATH and write VENDORED.md. Refuses uncommitted source
#             changes, a destination outside REPO, a directory it did not
#             write, and a copy with local edits. Removes only files its own
#             previous manifest listed; a hand-added file is kept and named.
#   --adopt   with --write: take over a hand-made copy, or discard local edits.
#   --check   run from the SOURCE checkout: exit 1 naming every file that is
#             behind the source or edited in the copy. Writes nothing.
#   --verify  run from the VENDORED copy, in the consuming project's gate:
#             exit 1 on any edited, missing or added file. Needs no source.
#   --dest    the copy's path inside REPO. Default: skill_dir from REPO's
#             dashboard-publish.conf.
#   --dir     the copy to verify. Default: the copy this script is in.
#
# Exit codes: 0 ok, 1 stale or edited, 2 refused.
# Requires git (for --write and --check) and python3, standard library only.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

usage() { awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; }
case "${1:-}" in
  -h|--help) usage; exit 0 ;;
  "")        usage >&2; exit 2 ;;
esac

command -v python3 >/dev/null 2>&1 || {
  echo "vendor-skill.sh: MISSING prerequisite: python3" >&2; exit 2; }

exec python3 "$HERE/vendor_lib.py" "$@"
