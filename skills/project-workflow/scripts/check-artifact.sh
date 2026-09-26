#!/usr/bin/env bash
# Prove a finished planning artifact matches the schema that owns its shape.
#
# Read-only. Exits 0 when the artifact conforms, 1 when it does not, 2 on a
# malformed schema or unreadable input.
#
# It rejects: a required heading absent; headings out of the schema's order; a
# heading the schema recorded as superseded; a surviving `FILL:` marker from
# the generator; and an after-the-work section left empty on an artifact that
# claims to be complete.
#
# THE HEADINGS ARE READ FROM THE SCHEMA FILE, never from a copy held here. The
# schema is the one owner of shape (ADR-0027), so a checker carrying its own
# heading list would become the second owner it exists to prevent. Change a
# schema and this script follows without being edited -- the same reason
# check-binding.sh resolves loop.md's step numbers out of the loop file.
#
# WHAT THIS PROVES: that an artifact carries the headings its schema declares,
# in that order, with no generator markers left behind.
# WHAT IT DOES NOT PROVE: that any of it is true, or useful, or even that a
# section says anything. It reads structure, never prose. A conformant brief
# can have a `## Goal` containing one meaningless sentence and this passes.
# Do not extend it to judge meaning: a check that guesses fires on correct
# text and gets deleted, which is worse than the gap it tried to close.
#
# NOT CHECKED: any line or byte budget. No such budget is defined in the
# authoring guide, any ADR, or AGENTS.md, and ADR-0008 settles why inventing
# one here would make this the author of a requirement rather than its
# enforcer. Uniform shape is what is enforced; smaller files are a consequence
# of it, not a rule.
#
# WIRING: `tests/validate.sh` runs this script over this repository's task
# briefs at or above its FIRST_GENERATED_TASK boundary.
#
# Usage:
#   check-artifact.sh <artifact> [--schema PATH | --kind task [--framework F]]
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

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
    -h|--help)   sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)          die "unknown argument: $1" ;;
    *)           [ -z "$ARTIFACT" ] || die "one artifact at a time"
                 ARTIFACT="$1"; shift ;;
  esac
done

[ -n "$ARTIFACT" ] || die "usage: check-artifact.sh <artifact> [--kind task]"
[ -r "$ARTIFACT" ] || die "cannot read artifact: $ARTIFACT"

if [ -z "$SCHEMA" ]; then
  [ -n "$KIND" ] || KIND=task
  if [ -n "$FRAMEWORK" ] && [ "$FRAMEWORK" != "project-workflow" ]; then
    SCHEMA="$HERE/../../$FRAMEWORK/schemas/$KIND.md"
  else
    SCHEMA="$HERE/../schemas/$KIND.md"
  fi
fi
[ -r "$SCHEMA" ] || die "cannot read schema: $SCHEMA"

ARTIFACT="$ARTIFACT" SCHEMA="$SCHEMA" python3 "$HERE/artifact_lib.py" check
