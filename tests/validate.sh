#!/usr/bin/env bash
# Mandatory validation: skill frontmatter, and MCP server shape/manifest
# integrity (ADR-0005). Requires python3 for JSON parsing.
set -euo pipefail
cd "$(dirname "$0")/.."
fail=0

for f in skills/*/SKILL.md; do
  [ -f "$f" ] || continue
  grep -q '^name:' "$f" || { echo "MISSING name: $f"; fail=1; }
  grep -q '^description:' "$f" || { echo "MISSING description: $f"; fail=1; }
done

# MCP servers: exactly one shape marker per directory, and every external
# manifest must parse, carry its required keys, and — if it exposes
# destructive tools — carry a granted authorization pointing at a task
# file that actually exists (AGENTS.md, Security and secrets).
command -v python3 >/dev/null 2>&1 || { echo "MISSING prerequisite: python3"; exit 1; }

for d in mcp-servers/*/; do
  d="${d%/}"
  [ -d "$d" ] || continue
  case "$(basename "$d")" in _template) continue ;; esac

  has_py=0; has_ext=0
  [ -f "$d/pyproject.toml" ] && has_py=1
  [ -f "$d/server.json" ] && has_ext=1

  if [ "$has_py" -eq 1 ] && [ "$has_ext" -eq 1 ]; then
    echo "AMBIGUOUS SHAPE: $d has both pyproject.toml and server.json"
    fail=1
    continue
  fi
  if [ "$has_py" -eq 0 ] && [ "$has_ext" -eq 0 ]; then
    echo "NO SHAPE: $d has neither pyproject.toml nor server.json"
    fail=1
    continue
  fi
  [ "$has_ext" -eq 1 ] || continue

  python3 - "$d/server.json" "$(basename "$d")" <<'PY' || fail=1
import json, os, sys

path, dirname = sys.argv[1], sys.argv[2]
try:
    with open(path) as fh:
        m = json.load(fh)
except (json.JSONDecodeError, UnicodeDecodeError) as exc:
    print("INVALID JSON: %s: %s" % (path, exc))
    sys.exit(1)

bad = []
for key in ("name", "description", "upstream", "launch", "runtime",
            "environment", "capabilities"):
    if key not in m:
        bad.append("missing required key: %s" % key)
for parent, child in (("upstream", "registry"), ("upstream", "package"),
                      ("upstream", "version"), ("upstream", "license"),
                      ("launch", "command"), ("launch", "transport"),
                      ("runtime", "declared"), ("runtime", "tested"),
                      ("capabilities", "destructive")):
    if isinstance(m.get(parent), dict) and child not in m[parent]:
        bad.append("missing required key: %s.%s" % (parent, child))

# Template dirs are validated for schema drift but are named _template*,
# so the name-matches-directory rule cannot apply to them.
if (m.get("name") and m["name"] != dirname
        and not dirname.startswith("_")):
    bad.append("name %r does not match directory %r" % (m["name"], dirname))
cmd = m.get("launch", {}).get("command")
if cmd is not None and (not isinstance(cmd, list) or not cmd):
    bad.append("launch.command must be a non-empty array")

caps = m.get("capabilities", {})
if caps.get("destructive") is True:
    if not caps.get("destructive_tools"):
        bad.append("capabilities.destructive is true but "
                   "destructive_tools is empty")
    auth = m.get("authorization")
    if not isinstance(auth, dict) or auth.get("granted") is not True:
        bad.append("capabilities.destructive is true but "
                   "authorization.granted is not true (AGENTS.md requires "
                   "explicit human authorization in the task file)")
    else:
        for key in ("by", "date", "task"):
            if not auth.get(key):
                bad.append("authorization.%s is required when destructive"
                           % key)
        task = auth.get("task")
        if task and not os.path.isfile(task):
            bad.append("authorization.task points at a nonexistent file: %s"
                       % task)

for msg in bad:
    print("INVALID MANIFEST: %s: %s" % (path, msg))
sys.exit(1 if bad else 0)
PY
done

# Loops: frontmatter name/description, name matches directory, and the
# three structural sections. A loop without exit conditions is an
# unbounded instruction, which is the failure mode worth catching.
for f in loops/*/loop.md; do
  [ -f "$f" ] || continue
  d=$(dirname "$f")
  base=$(basename "$d")
  name=$(awk '/^name:/{sub(/^name: */,"");print;exit}' "$f")
  [ -n "$name" ] || { echo "MISSING name: $f"; fail=1; }
  grep -q '^description:' "$f" || { echo "MISSING description: $f"; fail=1; }
  case "$base" in
    _template*) ;;   # templates are named _template*, so cannot match
    *) [ -z "$name" ] || [ "$name" = "$base" ] || {
         echo "NAME MISMATCH: $f declares '$name' but directory is '$base'"
         fail=1; } ;;
  esac
  for section in Trigger Steps "Exit conditions"; do
    grep -q "^## ${section}\$" "$f" || {
      echo "MISSING SECTION '## ${section}': $f"; fail=1; }
  done
done

# Every client scripts/install.sh can deploy to must have a wiring
# snapshot, so a new client cannot be added to the script without one.
# The client list is read from install.sh itself to keep them in sync.
for client in $(sed -n '/^CLIENTS="$/,/^"$/p' scripts/install.sh \
                | grep -oE '^[a-z0-9_-]+\|' | tr -d '|'); do
  [ -f "configs/$client/README.md" ] || {
    echo "MISSING wiring snapshot: configs/$client/README.md (client '$client' is in scripts/install.sh)"
    fail=1
  }
done

# No registry row may point at a template. scripts/sync-registry.sh skips
# templates in one place, but this check is independent of it on purpose:
# the same leak was fixed three times (TASK-0005/0006/0008) before the
# generator was de-duplicated, so a regression must fail a check rather
# than reach a commit. Matches the PATH column only — a description may
# legitimately contain the word "template".
if [ -f docs/registry.md ]; then
  while IFS= read -r row; do
    path=$(printf '%s\n' "$row" | awk -F'|' '{gsub(/^ +| +$/,"",$(NF-1)); print $(NF-1)}')
    case "$path" in
      *_template*)
        echo "TEMPLATE IN REGISTRY: docs/registry.md lists '$path' — templates are not deployable components (run scripts/sync-registry.sh)"
        fail=1
        ;;
    esac
  done < <(grep '^| ' docs/registry.md | grep -v '^| Name ' | grep -v '^|---')
fi

[ $fail -eq 0 ] && echo "validate.sh: OK"
exit $fail
