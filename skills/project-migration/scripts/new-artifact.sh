#!/usr/bin/env bash
# Emit a planning artifact's skeleton from the schema that owns its shape
# (ADR-0027). The author fills slots; headings, order and ids come from the
# schema, so they cannot drift. Proves shape only, never content.
#
# Usage:
#   new-artifact.sh --kind task [--framework project-workflow]
#                   [--guidance terse|standard|explicit|literal]
#                   [--id ...] [--name ...] [--title ...] [--sprint ...]
#                   [--date YYYY-MM-DD] [--out PATH] [--template]
#   new-artifact.sh --schema PATH ...        # explicit schema, overrides --kind
#   new-artifact.sh --filename --kind task --id ...   # print target path only
#
# Owner: skills/project-workflow/scripts/; project-migration holds a
# byte-identical copy written by scripts/sync-artifact-engine.sh (B-036).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# The skill this copy of the script lives in, read from its own directory
# name rather than written in, because the same file ships in two skills
# (see Owner above). --framework naming that skill means "mine".
SELF="$(basename "$(dirname "$HERE")")"

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
    -h|--help)   sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
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
  if [ -n "$FRAMEWORK" ] && [ "$FRAMEWORK" != "$SELF" ]; then
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
