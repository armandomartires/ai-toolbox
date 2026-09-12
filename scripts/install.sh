#!/usr/bin/env bash
# Deploy skills and print MCP registration commands.
set -euo pipefail
cd "$(dirname "$0")/.."
MODE="${1:-link}"   # link | copy
TARGET="${HOME}/.claude/skills"
SKILLS=(skills/*)

mkdir -p "$TARGET"
for d in "${SKILLS[@]}"; do
  name=$(basename "$d")
  [ "$name" = "_template" ] && continue
  [ -f "$d/SKILL.md" ] || continue
  case "$MODE" in
    link)  ln -sfn "$(pwd)/$d" "$TARGET/$name" ;;
    copy)  rm -rf "$TARGET/$name"; cp -r "$d" "$TARGET/$name" ;;
  esac
  echo "skill deployed: $name ($MODE)"
done

echo
echo "Register MCP servers (adjust commands per client):"
for f in mcp-servers/*/pyproject.toml; do
  [ -f "$f" ] || continue
  d=$(dirname "$f")
  [ "$d" = "mcp-servers/_template" ] && continue
  name=$(basename "$d")
  echo "  cd $d && uv run $name   # then add to .mcp.json / client config"
done
