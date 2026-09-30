#!/usr/bin/env bash
# Generate a self-contained HTML5 delivery dashboard from a repository's .ai/
# governance layer.
#
# WHAT THIS IS NOW. A thin wrapper over the vendored generator in
# ../dashboard/. That generator is a COPY: it is developed in the
# `sigma-llmwiki` repository and vendored here by its own sync script, which
# writes ../dashboard/VENDORED.md with the source commit and a sha256 per file.
# Do not edit anything under ../dashboard/ — a local edit makes the two copies
# diverge, and two independently-evolving dashboard generators is the exact
# situation TASK-0125 exists to undo. See that file, and TASK-0125.
#
# WHY THE WRAPPER SURVIVED THE SWAP. This path and this flag surface are
# called by .github/workflows/dashboard.yml and cited by
# skills/project-migration/SKILL.md. Keeping both valid costs a dozen lines and
# means nothing else had to change.
#
# WHAT IT PROVES: what the artifacts on disk currently say.
# WHAT IT DOES NOT PROVE: that any of it is true. A brief recording a suite it
# never ran is rendered as a suite that passed. This is a view of the
# governance layer, not an audit of it -- the same boundary tests/validate.sh
# draws when it checks source completeness and stops there (ADR-0009).
#
# It is not part of any gate: it needs a working tree and, for its Activity
# tab, git history, so it is neither hermetic nor offline as a gate must be.
# Run by hand, it renders the working tree and checked-out HEAD it runs in;
# a published page is built by CI from a full clone (publish-dashboard.sh).
#
# Usage:
#   build-dashboard.sh [--root .ai] [--out dashboard.html] [--repo DIR]
#                      [--project NAME] [--theme auto|light|dark]
#                      [--css FILE] [--css-href URL]
#                      [--json PATH] [--no-git]
#
#   --root       the governance directory. Default `.ai`. Either corpus layout
#                is detected; neither is assumed.
#   --repo       repository root, for git provenance. Default: --root's parent.
#   --out        the HTML file to write. Default `dashboard.html`.
#   --json       also write the underlying model, so the same numbers are
#                available to anything else that wants them.
#   --no-git     do not read git. Completion dates then fall back to each
#                brief's own recorded fields and the Activity tab is empty.
#
#   --theme / --css / --css-href are accepted and IGNORED, with a warning. The
#   generator's customisation surface is an optional `dashboard.custom.css`
#   beside the output file, which it links last; see ../dashboard/SCHEMA.md.
#   They are accepted rather than rejected so an existing invocation does not
#   break, and warned about rather than silently dropped so nobody believes a
#   stylesheet was applied when it was not.
#
# Requires python3 (standard library only) and nothing else: no pip, no npm,
# no network. The emitted file has no CDN reference and no external font.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SKILL="$(dirname "$HERE")"
GEN="$SKILL/dashboard/pm_dashboard.py"

command -v python3 >/dev/null 2>&1 || {
  echo "build-dashboard.sh: MISSING prerequisite: python3" >&2; exit 1; }

[ -f "$GEN" ] || {
  echo "build-dashboard.sh: missing vendored generator at $GEN" >&2
  echo "  Re-vendor it from the source repository:" >&2
  echo "  python .ai/scripts/sync_dashboard_skill.py --target <this repo> --write" >&2
  exit 1; }

ROOT=".ai"
OUT="dashboard.html"
REPO=""
PROJECT=""
JSON=""
NO_GIT=0

while [ $# -gt 0 ]; do
  case "$1" in
    --root)     ROOT="$2"; shift 2 ;;
    --out)      OUT="$2"; shift 2 ;;
    --repo)     REPO="$2"; shift 2 ;;
    --project)  PROJECT="$2"; shift 2 ;;
    --json)     JSON="$2"; shift 2 ;;
    --no-git)   NO_GIT=1; shift ;;
    --theme|--css|--css-href)
      echo "build-dashboard.sh: $1 is no longer applied and is ignored." >&2
      echo "  Put an optional dashboard.custom.css beside the output instead;" >&2
      echo "  the generated page links it last. See ../dashboard/SCHEMA.md." >&2
      shift 2 ;;
    -h|--help)  sed -n '2,52p' "$0"; exit 0 ;;
    *) echo "build-dashboard.sh: unknown option: $1" >&2; exit 2 ;;
  esac
done

# The generator takes the repository root and finds the corpus inside it, where
# this CLI has always taken the corpus directory. `--repo` wins when given;
# otherwise the root is --root's parent, which is what the old default meant.
if [ -z "$REPO" ]; then
  REPO="$(cd "$(dirname "$ROOT")" 2>/dev/null && pwd || echo ".")"
fi

ARGS=(--root "$REPO" --out "$OUT")
[ "$NO_GIT" -eq 1 ] && ARGS+=(--no-git)

python3 "$GEN" "${ARGS[@]}"

# `--json PATH`: the generator writes `dashboard-data.json` beside the page.
# Move it where the caller asked, so dashboard.yml's existing --json continues
# to mean what it meant.
if [ -n "$JSON" ]; then
  SIDECAR="$(dirname "$OUT")/dashboard-data.json"
  if [ -f "$SIDECAR" ]; then
    mkdir -p "$(dirname "$JSON")"
    [ "$SIDECAR" = "$JSON" ] || mv "$SIDECAR" "$JSON"
  else
    echo "build-dashboard.sh: expected $SIDECAR and it was not written" >&2
    exit 1
  fi
fi

# `--project` is accepted for compatibility; the generator names the project
# from the repository directory. Warned rather than silently ignored.
if [ -n "$PROJECT" ]; then
  BASENAME="$(basename "$REPO")"
  if [ "$PROJECT" != "$BASENAME" ]; then
    echo "build-dashboard.sh: --project '$PROJECT' ignored; the page is titled" >&2
    echo "  from the repository directory name ('$BASENAME')." >&2
  fi
fi
