#!/usr/bin/env bash
# Deploy skills to agent clients, emit agent roles, and print MCP
# registration commands.
#
# Usage: install.sh [link|copy] [--client claude-code|opencode|all]
#
# link (default) symlinks skills into each client's skills dir, per
# ADR-0002's symlink-first preference; copy is the fallback for checkouts
# where symlinks are unavailable. The mode applies to SKILLS ONLY: agents
# are generated per client (ADR-0018), so they have no link or copy mode.
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
#
# A fourth column (agents target) rather than a second table: the gate's
# parse anchors on the FIRST field (`grep -oE '^[a-z0-9_-]+\|'`), so extra
# columns are invisible to it, and the loop below reads fields positionally
# with `IFS='|' read`. Both verified before choosing (TASK-0040). A second
# table would have introduced a second list of client names that could
# disagree with this one — the defect the config-pairing check exists to
# prevent, reintroduced one level up.
#
# The agents directory names are TASK-0036's OBSERVED values, not the
# documented ones: OpenCode discovers both `agents/` (documented) and
# `agent/` (undocumented), and this repo writes the documented plural.
# name|skills target dir|parent dir that must already exist|agents target dir
CLIENTS="
claude-code|${HOME}/.claude/skills|${HOME}/.claude|${HOME}/.claude/agents
opencode|${HOME}/.config/opencode/skills|${HOME}/.config/opencode|${HOME}/.config/opencode/agents
"
# LM Studio is intentionally absent: its hub/skills directory is not an
# Agent Skills target. It is configured for MCP only - see
# configs/lm-studio/README.md.

# Activate the tracked pre-commit hook (ADR-0007). Hooks live in
# .githooks/ rather than .git/hooks/ so they are version-controlled and
# survive a fresh clone; core.hooksPath is the one-line activation.
# Idempotent: only reports when it actually changes something.
if [ -d .githooks ] && git rev-parse --git-dir >/dev/null 2>&1; then
  current=$(git config --get core.hooksPath || true)
  if [ "$current" = ".githooks" ]; then
    : # already active, stay quiet
  else
    git config core.hooksPath .githooks
    echo "git hooks activated: core.hooksPath=.githooks (was ${current:-unset})"
  fi

  # Warn if the hook's mode *as git records it* is not executable
  # (TASK-0014). tests/validate.sh fails on this authoritatively; the
  # warning exists here because this is the first script a fresh clone
  # runs, and on a core.filemode=false checkout the problem is invisible
  # locally — the hook runs fine here while being silently ignored by any
  # machine that honours the executable bit. Advisory only: never exits
  # non-zero (skill deployment is unrelated) and never mutates the index.
  hook_mode=$(git ls-files -s .githooks/pre-commit 2>/dev/null | awk '{print $1}')
  if [ -n "$hook_mode" ] && [ "$hook_mode" != "100755" ]; then
    echo "  WARNING: .githooks/pre-commit is recorded in git as $hook_mode, not 100755."
    echo "           The commit gate will be silently skipped on any machine that"
    echo "           honours the executable bit. Fix with:"
    echo "             git update-index --chmod=+x .githooks/pre-commit"
    if [ "$(git config --get core.filemode || true)" = "false" ]; then
      echo "           NOTE: core.filemode=false on this checkout, so 'chmod +x' alone"
      echo "           will NOT fix this — git ignores the filesystem bit here. Use the"
      echo "           git update-index command above. See docs/operations/runbook.md."
    fi
  fi
fi

deployed_any=0
while IFS='|' read -r client target parent agents_target; do
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

  # Agents are EMITTED, never linked (ADR-0018 clause 3): a per-client file's
  # content differs by definition, so it cannot be a symlink to one source.
  # $MODE deliberately does not apply here — there is no link or copy mode
  # for agents.
  #
  # NO FRESHNESS CHECK EXISTS OR MAY BE ADDED. Emission creates a copy
  # outside the repo whose currency nothing verifies; that is an accepted
  # weakness, not an oversight. ADR-0018 clause 4: "anyone who later 'fixes'
  # this by checking the deployed copy breaks every fresh clone and CI."
  # ADR-0009: "a gate that cannot pass on a clean checkout stops being run,
  # and a gate that is not run is worse than no gate, because it is still
  # trusted." The control is that this is cheap and idempotent — re-run it.
  #
  # Nothing prunes a stale emitted file either: deleting a role here leaves
  # its agent live in both clients. Recorded, not silently patched — an
  # installer that deletes files from a user's config directory needs its own
  # decision, not a convenience.
  #
  # Exits non-zero if emission is REFUSED for a declared capability the
  # client cannot enforce (clause 8). That failure is intentional and must
  # not be softened to a warning.
  if [ -d agents ]; then
    mkdir -p "$agents_target"
    python3 scripts/emit-agents.py "$client" "$agents_target" || {
      echo "agent emission failed for $client" >&2
      exit 1
    }
  fi
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
