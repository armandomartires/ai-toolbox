#!/usr/bin/env bash
# test-emit-prune.sh — prove scripts/emit-agents.py prunes a stale emitted
# agent file, and ONLY that (ADR-0026, TASK-0091).
#
# Hermetic: writes only inside a temp directory it creates and removes.
# NOT run from tests/validate.sh; run it by hand after changing the emitter.
#
# Uses the repo's real agents/: designer-manager is OpenCode-only and
# task-planner declares claude-code, so emitting for claude-code must prune
# the first and emit the second.
set -euo pipefail
cd "$(dirname "$0")/.."

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
fail=0
check() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi; }

# A stale emission: an undeclared role, emitted shape.
printf -- '---\nname: designer-manager\ndescription: stale\n---\nbody\n' > "$T/designer-manager.md"
# Not a role: never touched.
printf -- '---\nname: my-own-agent\n---\n' > "$T/my-own-agent.md"
# A symlink named after an undeclared role: never followed or removed.
printf -- '---\nname: closer\n---\n' > "$T/elsewhere.md"
ln -s "$T/elsewhere.md" "$T/closer.md"
# Role-named, but its frontmatter names something else: not ours to judge.
printf -- '---\nname: somebody-elses-refuter\n---\n' > "$T/refuter.md"

out=$(python3 scripts/emit-agents.py claude-code "$T" 2>&1) || true

check "stale emitted file for an undeclared role is pruned"   '[ ! -e "$T/designer-manager.md" ]'
check "the pruning is announced"                               'printf "%s" "$out" | grep -q "agent pruned: designer-manager -> claude-code"'
check "an unrelated file is left alone"                        '[ -f "$T/my-own-agent.md" ]'
check "a symlink named after a role is left alone"             '[ -L "$T/closer.md" ] && [ -f "$T/elsewhere.md" ]'
check "a role-named file with a different name: is left alone" '[ -f "$T/refuter.md" ]'
check "a declared role is still emitted"                       '[ -f "$T/task-planner.md" ]'

[ "$fail" -eq 0 ] && echo "test-emit-prune.sh: OK" || { echo "test-emit-prune.sh: FAILED"; exit 1; }
