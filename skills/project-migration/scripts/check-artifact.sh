#!/usr/bin/env bash
# Check a finished planning artifact against the schema that owns its shape
# (ADR-0027). Read-only. Exit 0 conforms, 1 does not, 2 bad schema or input.
#
# Rejects: a missing required heading; headings out of schema order; a
# superseded heading; a leftover `FILL:` marker; an empty after-the-work
# section on an artifact marked complete; more lines than the schema's
# `max_lines` (ADR-0033). Headings come from the schema, never from here.
#
# Proves structure only, never that the prose is true or useful.
#
# Usage: check-artifact.sh <artifact> [--schema PATH | --kind task [--framework F]]
#
# Owner: skills/project-workflow/scripts/; project-migration holds a
# byte-identical copy written by scripts/sync-artifact-engine.sh (B-036).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# The skill this copy of the script lives in, read from its own directory
# name rather than written in, because the same file ships in two skills
# (see Owner above). --framework naming that skill means "mine".
SELF="$(basename "$(dirname "$HERE")")"

ARTIFACT=""
SCHEMA=""
KIND=""
FRAMEWORK=""

die() { echo "check-artifact.sh: $*" >&2; exit 2; }

while [ $# -gt 0 ]; do
  case "$1" in
    --schema)    SCHEMA="${2:?--schema needs a path}"; shift 2 ;;
    --kind)      KIND="${2:?--kind needs a value}"; shift 2 ;;
    --framework) FRAMEWORK="${2:?--framework needs a value}"; shift 2 ;;
    -h|--help)   sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)          die "unknown argument: $1" ;;
    *)           [ -z "$ARTIFACT" ] || die "one artifact at a time"
                 ARTIFACT="$1"; shift ;;
  esac
done

[ -n "$ARTIFACT" ] || die "usage: check-artifact.sh <artifact> [--kind task]"
[ -r "$ARTIFACT" ] || die "cannot read artifact: $ARTIFACT"

if [ -z "$SCHEMA" ]; then
  [ -n "$KIND" ] || KIND=task
  if [ -n "$FRAMEWORK" ] && [ "$FRAMEWORK" != "$SELF" ]; then
    SCHEMA="$HERE/../../$FRAMEWORK/schemas/$KIND.md"
  else
    SCHEMA="$HERE/../schemas/$KIND.md"
  fi
fi
[ -r "$SCHEMA" ] || die "cannot read schema: $SCHEMA"

ARTIFACT="$ARTIFACT" SCHEMA="$SCHEMA" python3 "$HERE/artifact_lib.py" check
