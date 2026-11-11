#!/usr/bin/env bash
# CLAUDE.md is a short regular file importing @AGENTS.md, and the path-scoped
# rules under .claude/rules/ are tracked (TASK-0275, ADR-0061 superseding 0002).
#
# WHY: a symlink renders as a one-line text file on a Windows clone without
# core.symlinks, and Claude Code then reads "AGENTS.md" as the instructions.
# The import line works the same on every checkout.
# WHAT THIS PROVES: CLAUDE.md is not mode 120000 in the index and not a link on
# disk, its first line is `@AGENTS.md`, every .claude/rules/*.md opens with a
# front matter block holding a `paths:` filter, and git does not ignore them
# while the rest of .claude/ stays ignored.
# Hermetic: reads the repo, writes nothing. Usage: tests/test-claude-md.sh [root]
set -uo pipefail
root="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$root" || exit 1
fails=0
fail() { echo "FAIL: $*"; fails=$((fails + 1)); }
ok() { echo "PASS: $*"; }

if [ -L CLAUDE.md ]; then
  fail "CLAUDE.md is a symlink"
else
  ok "CLAUDE.md is not a symlink on disk"
fi
mode="$(git ls-files -s CLAUDE.md | cut -d' ' -f1)"
if [ "$mode" = "120000" ]; then
  fail "CLAUDE.md is mode 120000 (symlink) in the index"
else
  ok "CLAUDE.md index mode is ${mode:-untracked}, not 120000"
fi
first="$(head -n 1 CLAUDE.md 2>/dev/null | tr -d '\r')"
if [ "$first" = "@AGENTS.md" ]; then
  ok "first line is @AGENTS.md"
else
  fail "first line of CLAUDE.md is '$first', want @AGENTS.md"
fi
if [ "$(wc -l < CLAUDE.md 2>/dev/null || echo 0)" -gt 40 ]; then
  fail "CLAUDE.md is over 40 lines; keep it to Claude-only notes"
fi

shopt -s nullglob
rules=(.claude/rules/*.md)
[ "${#rules[@]}" -ge 2 ] || fail "want at least 2 rules under .claude/rules/, found ${#rules[@]}"
for r in "${rules[@]}"; do
  if [ "$(head -n 1 "$r" | tr -d '\r')" != "---" ]; then
    fail "$r has no front matter"
    continue
  fi
  if ! awk 'NR>1 && /^---\r?$/ {found=1; exit} END {exit !found}' "$r"; then
    fail "$r front matter is not closed"
    continue
  fi
  fm="$(awk 'NR>1 && /^---\r?$/ {exit} NR>1 {print}' "$r" | tr -d '\r')"
  # at least one non-empty entry under paths: (a list item or an inline value)
  if printf '%s\n' "$fm" | awk '
      /^paths:/ {inp=1; v=$0; sub(/^paths:[ \t]*/, "", v); if (v != "" && v != "[]") n++; next}
      inp && /^[ \t]+-[ \t]*[^ \t#]/ {n++; next}
      inp && /^[^ \t]/ {inp=0}
      END {exit !(n > 0)}'; then
    ok "$r has a paths filter with an entry"
  else
    fail "$r has no non-empty paths entry"
  fi
  if git ls-files --error-unmatch "$r" >/dev/null 2>&1; then
    ok "$r is tracked or staged"
  else
    fail "$r is not tracked or staged"
  fi
  # --no-index: a tracked file would otherwise be skipped by check-ignore
  if git check-ignore -q --no-index "$r"; then fail "$r would be ignored by git"; else ok "$r is not ignored"; fi
done
for ig in .claude/settings.local.json mods/x/.claude/settings.local.json; do
  if git check-ignore -q --no-index "$ig"; then
    ok "$ig stays ignored"
  else
    fail "$ig is not ignored"
  fi
done

if [ "$fails" -eq 0 ]; then
  echo "OK: claude-md layer"
  exit 0
fi
echo "FAILED: $fails"
exit 1
