#!/usr/bin/env bash
# Run the agent's stages of the mod workflow (docs/development/mod-workflow.md,
# ADR-0051) in order, from inside an ai-toolbox checkout. It owns no rule: each
# subcommand calls the repository's own script and reports what it printed.
#
# Usage: mod-dev.sh <subcommand> [args]
#   check                         stage 2/8: python3 scripts/check-mods.py
#   scaffold <name>               stage 2: copy mods/_template to mods/<name>,
#                                 rename it, regenerate the registry, check
#   validate <name> [--strict]    stage 4: claude plugin validate mods/<name>/claude
#   sync [<name>...] [--session ID] [--watch]
#                                 stage 3: scripts/dev-mods.py (copy, never link)
#   preview [<name>...] [--serve PORT]
#                                 stage 5: scripts/preview-mods.py
#   test [<name>]                 stage 6: tests/test-mods.sh [--mod <name>]
#   status [<name>]               stages 3 and 8: the manifest's version beside
#                                 what `claude plugin list` loads and what each
#                                 dev-mods copy holds
#   all <name> [--session ID]     check, validate, sync, preview (build), test, status
#
# Exit codes: 0 ok; 1 a stage failed; 2 usage, or not in an ai-toolbox checkout.
# Idempotent: scaffold refuses an existing mod; sync and preview rebuild in place.
set -uo pipefail

usage() { sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$ROOT" ] || [ ! -d "$ROOT/mods" ] || [ ! -f "$ROOT/scripts/check-mods.py" ]; then
  echo "mod-dev: run it from inside an ai-toolbox checkout (no mods/ and scripts/check-mods.py above $(pwd))" >&2
  exit 2
fi
cd "$ROOT"

PY="${PYTHON:-python3}"
CLI="${CLAUDE_BIN:-}"
if [ -z "$CLI" ]; then
  for c in claude claude.exe; do command -v "$c" >/dev/null 2>&1 && { CLI="$c"; break; }; done
fi

mod_exists() { [ -f "mods/$1/claude/.claude-plugin/plugin.json" ]; }
need_mod() {
  [ -n "${1:-}" ] || { echo "mod-dev: a mod name is required" >&2; exit 2; }
  mod_exists "$1" || { echo "mod-dev: no mod named '$1' under mods/" >&2; exit 2; }
}
manifest_version() {
  "$PY" -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8")).get("version", "?"))' "$1" 2>/dev/null || echo "?"
}

cmd_check() { "$PY" scripts/check-mods.py; }

cmd_scaffold() {
  name="${1:-}"
  [ -n "$name" ] || { echo "mod-dev: scaffold needs a name" >&2; exit 2; }
  printf '%s' "$name" | grep -Eq '^[a-z0-9]+(-[a-z0-9]+)*$' || {
    echo "mod-dev: '$name' is not lowercase kebab-case (the manifest rule)" >&2; exit 2; }
  if [ -e "mods/$name" ]; then echo "mod-dev: mods/$name exists; scaffold changes nothing" >&2; exit 2; fi
  cp -R mods/_template "mods/$name"
  # The template calls itself my-mod in its manifest, module, tests, contract and README.
  grep -rl --exclude-dir=.claude-plugin 'my-mod' "mods/$name" | while IFS= read -r f; do
    "$PY" - "$f" "$name" <<'PY'
import sys
p, name = sys.argv[1], sys.argv[2]
s = open(p, encoding="utf-8").read().replace("my-mod", name)
open(p, "w", encoding="utf-8", newline="\n").write(s)
PY
  done
  f="mods/$name/claude/.claude-plugin/plugin.json"
  "$PY" - "$f" "$name" <<'PY'
import json, sys
p, name = sys.argv[1], sys.argv[2]
m = json.load(open(p, encoding="utf-8"))
m["name"] = name
m["version"] = "0.1.0"
open(p, "w", encoding="utf-8", newline="\n").write(json.dumps(m, indent=2) + "\n")
PY
  bash scripts/sync-registry.sh >/dev/null
  echo "scaffolded mods/$name from mods/_template (0.1.0); registry regenerated"
  echo "next: set description in $f, rewrite README.md, then: mod-dev.sh validate $name"
  cmd_check
}

cmd_validate() {
  need_mod "${1:-}"
  [ -n "$CLI" ] || { echo "SKIP validate $1: no claude on PATH (set CLAUDE_BIN)"; return 3; }
  name="$1"; shift
  # From mods/ with a relative path, so a Windows CLI in WSL resolves it (tests/test-mods.sh does the same).
  (cd mods && "$CLI" plugin validate "$name/claude" "$@")
}

cmd_sync() { "$PY" scripts/dev-mods.py "$@"; }

cmd_preview() { "$PY" scripts/preview-mods.py "$@"; }

cmd_test() {
  if [ -n "${1:-}" ]; then need_mod "$1"; bash tests/test-mods.sh --mod "$1"; else bash tests/test-mods.sh; fi
}

cmd_status() {
  list=""
  if [ -n "$CLI" ]; then list="$("$CLI" plugin list 2>/dev/null || true)"; fi
  for d in mods/*/; do
    name="$(basename "$d")"
    case "$name" in _template*) continue ;; esac
    [ -z "${1:-}" ] || [ "$1" = "$name" ] || continue
    echo "$name"
    echo "  manifest   $(manifest_version "${d}claude/.claude-plugin/plugin.json")  (mods/$name/claude)"
    if [ -n "$list" ]; then
      # Each entry: a line with the id, then Version:/Path:/Status: lines until the next blank line.
      printf '%s\n' "$list" | awk -v n="$name" '
        /^[[:space:]]*$/ { inblk = 0 }
        $0 ~ ("^[^A-Za-z]*" n "@") { inblk = 1; id = $0; sub(/^[^A-Za-z]*/, "", id); sub(/ .*/, "", id); ver = "?"; path = ""; st = "" }
        inblk && /Version:/ { ver = $2 }
        inblk && /Path:/ { path = $0; sub(/^[[:space:]]*Path:[[:space:]]*/, "", path) }
        inblk && /Status:/ { st = $0; sub(/^[[:space:]]*Status:[[:space:]]*/, "", st); printf "  loaded     %s  %s  %s%s\n", ver, id, st, (path != "" ? "  " path : ""); inblk = 0 }
        $0 ~ ("\"" n "@[a-z]+\" from claude.ai not loaded") { line = $0; sub(/^[[:space:]]*/, "", line); print "  not loaded " line }'
    else
      echo "  loaded     ?  (no claude on PATH)"
    fi
    for c in "$HOME"/.claude/dev-mods/*/"$name"/.claude-plugin/plugin.json; do
      [ -f "$c" ] || continue
      sess="$(basename "$(dirname "$(dirname "$(dirname "$c")")")")"
      kind="copy"
      top="$(dirname "$(dirname "$c")")"
      if [ -L "$top" ]; then kind="LINK (replace it: mod-dev.sh sync $name --session $sess)"; fi
      echo "  dev-mods   $(manifest_version "$c")  $sess  $kind"
    done
  done
}

cmd_all() {
  need_mod "${1:-}"
  name="$1"; shift
  rc=0
  echo "== check";    cmd_check || rc=1
  echo "== validate"; cmd_validate "$name" || rc=1
  echo "== sync";     cmd_sync "$name" "$@" || rc=1
  echo "== preview";  cmd_preview "$name" || rc=1
  echo "== test";     cmd_test "$name" || rc=1
  echo "== status";   cmd_status "$name"
  [ "$rc" -eq 0 ] && echo "all: ok (stages 2-6 and 8's check); next: the live check, then the version bump" || echo "all: a stage failed (see above)"
  return "$rc"
}

sub="${1:-}"; shift 2>/dev/null || true
case "$sub" in
  check)    cmd_check "$@" ;;
  scaffold) cmd_scaffold "$@" ;;
  validate) cmd_validate "$@" ;;
  sync)     cmd_sync "$@" ;;
  preview)  cmd_preview "$@" ;;
  test)     cmd_test "$@" ;;
  status)   cmd_status "$@" ;;
  all)      cmd_all "$@" ;;
  -h|--help|help|"") usage; [ -n "$sub" ] && exit 0 || exit 2 ;;
  *) echo "mod-dev: unknown subcommand '$sub'" >&2; usage >&2; exit 2 ;;
esac
