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
for d in mcp-servers/*/; do
  d="${d%/}"
  name=$(basename "$d")
  case "$name" in _template*) continue ;; esac
  if [ -f "$d/pyproject.toml" ]; then
    echo "  cd $d && uv run $name   # then add to .mcp.json / client config"
  elif [ -f "$d/server.json" ]; then
    # External server (ADR-0005): print the real launch command and the
    # environment it needs, straight from the manifest.
    python3 - "$d/server.json" <<'PY'
import json, shlex, sys
m = json.load(open(sys.argv[1]))
print("  " + " ".join(shlex.quote(a) for a in m["launch"]["command"])
      + "   # %s (%s, transport=%s)" % (m["name"],
                                        m["upstream"]["package"],
                                        m["launch"]["transport"]))
req = [k for k, v in m.get("environment", {}).items() if v.get("required")]
if req:
    print("      requires env: " + ", ".join(sorted(req)))
for p in m.get("preconditions", []):
    print("      precondition: " + p)
if m.get("capabilities", {}).get("destructive"):
    print("      WARNING: exposes destructive tools - see "
          + m.get("authorization", {}).get("task", "the task file"))
PY
  fi
done
