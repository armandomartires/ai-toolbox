#!/usr/bin/env bash
# Fast subset of tests/validate.sh for the Stop hook (TASK-0277, P1.7, Q14=B).
#
# Three checks, seconds not minutes; the full gate stays in tests/validate.sh
# and CI:
#   1. skill frontmatter  scripts/check-skill-frontmatter.py (the owner of the
#                         rules; validate.sh calls it too)
#   2. registry           docs/registry.md has no template row and equals what
#                         scripts/sync-registry.sh renders now (rendered to a
#                         scratch file, never by `git diff`)
#   3. hidden Unicode     scripts/check-hidden-unicode.py
# Agents/loops frontmatter, MCP shape and the rest stay in the full gate.
# Usage: scripts/fast-check.sh   (run from anywhere; prints failures, exit 1)
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0
command -v python3 >/dev/null 2>&1 || { echo "FAST-CHECK: python3 is not on PATH"; exit 1; }

for f in skills/*/SKILL.md; do
  [ -f "$f" ] || continue
  python3 scripts/check-skill-frontmatter.py "$f" "$(basename "$(dirname "$f")")" || fail=1
done

scratch="$(mktemp)"
trap 'rm -f "$scratch"' EXIT
if [ ! -f docs/registry.md ]; then
  echo "FAST-CHECK registry: docs/registry.md is missing (run scripts/sync-registry.sh)"
  fail=1
else
  if grep '^| ' docs/registry.md | grep -v '^| Name ' | grep -v '^|---' \
       | awk -F'|' '{gsub(/^ +| +$/,"",$(NF-1)); print $(NF-1)}' | grep -q '_template'; then
    echo "FAST-CHECK registry: docs/registry.md lists a template (run scripts/sync-registry.sh)"
    fail=1
  fi
  if REGISTRY_OUT="$scratch" bash scripts/sync-registry.sh >/dev/null 2>&1; then
    diff -q --strip-trailing-cr "$scratch" docs/registry.md >/dev/null || { echo "FAST-CHECK registry: docs/registry.md is stale (run scripts/sync-registry.sh)"; fail=1; }
  else
    echo "FAST-CHECK registry: scripts/sync-registry.sh failed"; fail=1
  fi
fi

python3 scripts/check-hidden-unicode.py || fail=1

[ "$fail" -eq 0 ] || echo "FAST-CHECK: failed (the full gate is tests/validate.sh)"
exit "$fail"
