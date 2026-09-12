#!/usr/bin/env bash
# Mandatory validation: every skill has valid frontmatter.
set -euo pipefail
cd "$(dirname "$0")/.."
fail=0
for f in skills/*/SKILL.md; do
  [ -f "$f" ] || continue
  grep -q '^name:' "$f" || { echo "MISSING name: $f"; fail=1; }
  grep -q '^description:' "$f" || { echo "MISSING description: $f"; fail=1; }
done
[ $fail -eq 0 ] && echo "validate.sh: OK"
exit $fail
