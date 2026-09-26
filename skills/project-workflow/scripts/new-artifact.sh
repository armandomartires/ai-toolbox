#!/usr/bin/env bash
# Emit a planning artifact's skeleton from the schema that owns its shape.
#
# WHY THIS EXISTS (ADR-0027, TASK-0109). Both governance frameworks used to
# produce artifacts by copy-a-template-and-fill. A template is a document to
# imitate, and every "is this line instruction or structure?" judgment is an
# independent chance to drift. Measured on 2026-09-26: 105 task files in
# .ai/tasks/ with ~14 competing heading sets, `## Inputs` in 86 of them, 23
# carrying a `## Preconditions` superseded long ago, and heading order
# ungoverned. Separately, project-workflow's own template contradicted its own
# SKILL.md about the task ID format. Nothing caught either, because shape was
# stated in prose in four places per framework.
#
# A skeleton is not imitated, it is filled. The author never types a heading,
# never chooses an order, never invents an identifier — so none of those can
# drift, at any model size.
#
# WHAT THIS PROVES: that the emitted file carries every heading the schema
# declares, in the schema's order, with identifiers and dates substituted.
# WHAT IT DOES NOT PROVE: anything about the prose someone writes into the
# slots. Shape is not content. A schema-conformant brief can still have a
# `## Goal` that says nothing, and no amount of extending this script will
# detect that — see check-artifact.sh's matching paragraph.
#
# WIRING: `scripts/sync-templates.sh` runs this script to regenerate every
# tracked template file. Nothing else in this repository invokes it; it is
# meant to be run by a person or an agent creating one artifact.
#
# Usage:
#   new-artifact.sh --kind task [--framework project-workflow]
#                   [--guidance terse|standard|explicit|literal]
#                   [--id ...] [--name ...] [--title ...] [--sprint ...]
#                   [--date YYYY-MM-DD] [--out PATH] [--template]
#   new-artifact.sh --schema PATH ...        # explicit schema, overrides --kind
#   new-artifact.sh --filename --kind task --id ...   # print target path only
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

SCHEMA=""
KIND=""
FRAMEWORK=""
GUIDANCE="standard"
OUT=""
TEMPLATE=0
FILENAME_ONLY=0
declare -a SUBS=()

die() { echo "new-artifact.sh: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --schema)    SCHEMA="${2:?--schema needs a path}"; shift 2 ;;
    --kind)      KIND="${2:?--kind needs a value}"; shift 2 ;;
    --framework) FRAMEWORK="${2:?--framework needs a value}"; shift 2 ;;
    --guidance)  GUIDANCE="${2:?--guidance needs a level}"; shift 2 ;;
    --out)       OUT="${2:?--out needs a path}"; shift 2 ;;
    --template)  TEMPLATE=1; shift ;;
    --filename)  FILENAME_ONLY=1; shift ;;
    --id|--name|--title|--sprint|--task|--date)
                 SUBS+=("${1#--}=${2:?$1 needs a value}"); shift 2 ;;
    -h|--help)   sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)           die "unknown argument: $1" ;;
  esac
done

case "$GUIDANCE" in
  terse|standard|explicit|literal) ;;
  *) die "--guidance must be terse, standard, explicit or literal (got '$GUIDANCE').
       These are prose densities, not model tiers: the filled artifact is
       identical at every level. See ADR-0027 clause 4." ;;
esac

# Schema resolution is script-relative, never CWD-relative, so the skill keeps
# working when install.sh symlinks it into a client directory. The same reason
# check-binding.sh resolves loop.md from \$HERE rather than the working tree.
if [ -z "$SCHEMA" ]; then
  [ -n "$KIND" ] || die "need --schema PATH or --kind NAME"
  if [ -n "$FRAMEWORK" ] && [ "$FRAMEWORK" != "project-workflow" ]; then
    SCHEMA="$HERE/../../$FRAMEWORK/schemas/$KIND.md"
  else
    SCHEMA="$HERE/../schemas/$KIND.md"
  fi
fi
[ -r "$SCHEMA" ] || die "cannot read schema: $SCHEMA"

if [ -n "$OUT" ] && [ -e "$OUT" ]; then
  die "refusing to overwrite $OUT — artifacts are created once, never regenerated over"
fi

RENDERED="$(
  SCHEMA="$SCHEMA" GUIDANCE="$GUIDANCE" TEMPLATE="$TEMPLATE" \
  FILENAME_ONLY="$FILENAME_ONLY" SUBS="$(printf '%s\n' ${SUBS[@]+"${SUBS[@]}"})" \
  python3 "$HERE/artifact_lib.py" render
)" || exit 1

if [ -n "$OUT" ]; then
  mkdir -p "$(dirname "$OUT")"
  printf '%s\n' "$RENDERED" > "$OUT"
  echo "new-artifact.sh: wrote $OUT" >&2
else
  printf '%s\n' "$RENDERED"
fi
