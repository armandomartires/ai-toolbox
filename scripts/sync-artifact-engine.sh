#!/usr/bin/env bash
# Copy the artifact engine and its two wrappers into project-migration.
#
# Why a copy exists at all (B-036, TASK-0117). The engine that renders and
# checks planning artifacts lives in skills/project-workflow/scripts/, but
# project-migration owns four schemas of its own. Installed without
# project-workflow, it had schemas and no generator: SKILL.md's "generate,
# do not copy a template" rule named a script the reader did not have. A copy
# in the skill's own scripts/ travels with it, the same reason
# scripts/sync-decision-standard.sh ships a sibling of driver.py.
#
# The copies are not second owners. Each file in project-workflow remains the
# only owner; these are byte-identical copies, never edited, and
# tests/validate.sh fails when one differs. Only the ENGINE is shared --
# no schema is copied between the two frameworks (ADR-0013).
set -euo pipefail
cd "$(dirname "$0")/.."

CHECK=0
[ "${1:-}" = "--check" ] && CHECK=1

SRC=skills/project-workflow/scripts
# --check compares each copy against its owner byte for byte and writes
# nothing, which is how tests/validate.sh tests the copies without rewriting
# them. Never `git diff`: an untracked or uncommitted copy has no diff, so
# that form passes vacuously -- the TASK-0106 lesson.
# ENGINE_OUT still redirects a real write, for rendering somewhere else.
OUT="${ENGINE_OUT:-skills/project-migration/scripts}"
FILES="artifact_lib.py new-artifact.sh check-artifact.sh"

for f in $FILES; do
  [ -r "$SRC/$f" ] || { echo "sync-artifact-engine.sh: cannot read $SRC/$f" >&2; exit 1; }
done

if [ "$CHECK" = 1 ]; then
  stale=0
  for f in $FILES; do
    if ! cmp -s "$SRC/$f" "$OUT/$f"; then
      echo "ENGINE: $OUT/$f differs from its owner $SRC/$f —"
      echo "ENGINE: run scripts/sync-artifact-engine.sh and commit the result"
      stale=1
    fi
  done
  exit "$stale"
fi

mkdir -p "$OUT"
for f in $FILES; do
  cp "$SRC/$f" "$OUT/$f"
done
echo "sync-artifact-engine.sh: wrote $FILES to $OUT"
