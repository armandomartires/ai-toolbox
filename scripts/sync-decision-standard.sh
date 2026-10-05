#!/usr/bin/env bash
# Generate the OpenCode binding's decision-standard.md from the two
# references that own the adjudicator's decision standard.
#
# Why a generated copy exists at all (B-035, TASK-0106): all nine roles
# declare `worktree-only`, emitted as `external_directory: deny`, so an
# adjudicator cannot read skills/unattended-ops/ — reads of it were 57 of
# the S10.7 pilot's 92 denials. The denial is correct, so the standard has
# to reach the role *in its prompt*. And driver.py is a template that a
# consuming repository copies out of this skill, after which the references
# sit at no known relative path. A sibling file travels with that copy.
#
# The copy is not a second owner. verdicts.md and evidence.md remain the
# only owners; this file is concatenation, never paraphrase, and
# tests/validate.sh fails when it drifts from them. That is the same
# derived-artifact-plus-staleness-check shape docs/registry.md uses.
set -euo pipefail
cd "$(dirname "$0")/.."

REFS=skills/unattended-ops/references
# STANDARD_OUT lets tests/validate.sh generate to a scratch path and compare,
# rather than rewriting the tracked file to test it.
OUT="${STANDARD_OUT:-skills/unattended-ops/templates/bindings/opencode/decision-standard.md}"
SOURCES=("$REFS/verdicts.md" "$REFS/evidence.md")

for src in "${SOURCES[@]}"; do
  [ -r "$src" ] || { echo "sync-decision-standard.sh: cannot read $src" >&2; exit 1; }
done

{
  # Every clause must read true in ai-toolbox AND beside a copied driver.py,
  # where none of these paths exists (B-051, TASK-0139).
  echo "<!-- Rendered by ai-toolbox's scripts/sync-decision-standard.sh. Sources,"
  echo "     concatenated verbatim and owned by them, not here (ai-toolbox paths):"
  for src in "${SOURCES[@]}"; do echo "       $src"; done
  echo "     In ai-toolbox, edit a source and re-run the script; tests/validate.sh"
  echo "     fails on drift. A copy in another repository is not regenerated there. -->"
  for src in "${SOURCES[@]}"; do
    echo
    cat "$src"
  done
} > "$OUT"

echo "sync-decision-standard.sh: wrote $OUT"
