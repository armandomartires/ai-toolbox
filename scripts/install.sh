#!/usr/bin/env bash
# Deploy skills to agent clients and print MCP registration commands.
#
# Usage: install.sh [link|copy] [--client claude-code|opencode|all]
#
# link (default) symlinks skills into each client's skills dir, per
# ADR-0002's symlink-first preference; copy is the fallback for checkouts
# where symlinks are unavailable.
#
# Overwrite policy (TASK-0006): a client target is replaced only when this
# repo owns a skill of that name, and replacing a pre-existing non-symlink
# directory is always announced. Skills the repo does not own are never
# touched. Clients whose config dir is absent are skipped, not created.
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="link"
WANT_CLIENT="all"
while [ $# -gt 0 ]; do
  case "$1" in
    link|copy) MODE="$1" ;;
    --client)  shift; WANT_CLIENT="${1:-all}" ;;
    --client=*) WANT_CLIENT="${1#*=}" ;;
    -h|--help)
      sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

# Clients this script can deploy skills to. tests/validate.sh reads these
# names from here and requires configs/<name>/README.md for each, so the
# names must match the configs/ directory names exactly.
# name|skills target dir|parent dir that must already exist
CLIENTS="
claude-code|${HOME}/.claude/skills|${HOME}/.claude
opencode|${HOME}/.config/opencode/skills|${HOME}/.config/opencode
"
# LM Studio is intentionally absent: its hub/skills directory is not an
# Agent Skills target. It is configured for MCP only - see
# configs/lm-studio/README.md.

deployed_any=0
while IFS='|' read -r client target parent; do
  [ -n "$client" ] || continue
  case "$WANT_CLIENT" in
    all) ;;
    "$client") ;;
    *) continue ;;
  esac
  if [ ! -d "$parent" ]; then
    echo "client skipped: $client (not installed: $parent absent)"
    continue
  fi
  deployed_any=1
  mkdir -p "$target"
  for d in skills/*; do
    name=$(basename "$d")
    case "$name" in _template*) continue ;; esac
    [ -f "$d/SKILL.md" ] || continue
    dest="$target/$name"
    # A pre-existing real directory must be removed before linking:
    # `ln -sfn` against a real directory silently creates the link *inside*
    # it, leaving the stale skill in place and reporting success.
    if [ -e "$dest" ] && [ ! -L "$dest" ]; then
      echo "  NOTICE: replacing pre-existing directory $dest (repo owns skill '$name')"
      rm -rf "$dest"
    fi
    case "$MODE" in
      link) ln -sfn "$(pwd)/$d" "$dest" ;;
      copy) rm -rf "$dest"; cp -r "$d" "$dest" ;;
    esac
    echo "skill deployed: $name -> $client ($MODE)"
  done
done <<EOF
$CLIENTS
EOF

if [ "$deployed_any" -eq 0 ]; then
  echo "no matching client for --client '$WANT_CLIENT'" >&2
  exit 2
fi

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
