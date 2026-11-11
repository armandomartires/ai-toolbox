#!/usr/bin/env bash
# Prove the Claude Code Stop hook (TASK-0277, P1.7, Q14=B) offline.
#
# Builds a throwaway git repository holding a skill, the fast-check scripts and
# a generated registry, then runs configs/claude-code/hooks/stop-fast-check.sh
# against it the way Claude Code does (hook JSON on stdin, exit 2 blocks).
#
# Cases: a tracked change that breaks the frontmatter check is blocked with the
# failure text; a clean tree is not delayed; an untracked-only change is not
# checked; a second stop (stop_hook_active) passes, so a failure is reported
# once and cannot trap the session. It also asserts that
# configs/claude-code/settings.hooks.json registers the hook under Stop.
#
# Red proof: pass a stub that exits 0 as the hook (`tests/test-stop-hook.sh
# /path/to/stub`): the blocked case must then FAIL.
# WHAT THIS PROVES: the hook script's decisions. WHAT IT DOES NOT PROVE: that a
# live Claude Code session calls it (the settings entry is checked, not run).
#
# Usage: tests/test-stop-hook.sh [path/to/stop-fast-check.sh]
set -uo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
hook="${1:-$here/configs/claude-code/hooks/stop-fast-check.sh}"
[ -f "$hook" ] || { echo "FAIL: no hook at $hook"; exit 1; }
rc=0
ok()  { echo "PASS $1"; }
bad() { echo "FAIL $1"; rc=1; }

# The hook is registered under Stop.
if python3 - "$here/configs/claude-code/settings.hooks.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
cmds = [h["command"] for g in d["hooks"].get("Stop", []) for h in g["hooks"]]
sys.exit(0 if any("stop-fast-check.sh" in c for c in cmds) else 1)
PY
then ok "settings.hooks.json registers the Stop hook"; else bad "settings.hooks.json has no Stop entry for stop-fast-check.sh"; fi

unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
repo="$tmp/repo"
mkdir -p "$repo/scripts" "$repo/skills/demo" "$repo/docs"
for s in fast-check.sh check-skill-frontmatter.py check-hidden-unicode.py sync-registry.sh; do
  cp "$here/scripts/$s" "$repo/scripts/$s"
done
printf -- '---\nname: demo\ndescription: A demo skill.\n---\n# Demo\n' > "$repo/skills/demo/SKILL.md"
(
  cd "$repo" || exit 1
  git init -q . && git config user.email t@example.invalid && git config user.name t
  git config core.autocrlf false
  bash scripts/sync-registry.sh >/dev/null 2>&1
  git add -A && git commit -q -m base
) || { echo "FAIL: fixture repo setup"; exit 1; }

run_hook() { # $1 = stdin JSON; sets out and code
  out="$(cd "$repo" && CLAUDE_PROJECT_DIR="$repo" bash "$hook" <<<"$1" 2>&1)"; code=$?
}

# Clean tree: not delayed, no check runs (the scripts are replaced by a tripwire).
cp "$repo/scripts/fast-check.sh" "$tmp/fast-check.real"
printf '#!/usr/bin/env bash\necho TRIPWIRE-RAN\nexit 1\n' > "$repo/scripts/fast-check.sh"
(cd "$repo" && git commit -qam tripwire)
run_hook '{"stop_hook_active": false}'
if [ "$code" -eq 0 ] && [ -z "$out" ]; then ok "clean tree is not delayed"; else bad "clean tree: code=$code out=$out"; fi
echo "# untracked" > "$repo/untracked.txt"
run_hook '{"stop_hook_active": false}'
if [ "$code" -eq 0 ] && [ -z "$out" ]; then ok "untracked-only change runs no check"; else bad "untracked-only: code=$code out=$out"; fi
rm -f "$repo/untracked.txt"
cp "$tmp/fast-check.real" "$repo/scripts/fast-check.sh"
(cd "$repo" && git commit -qam restore)

BROKEN='---\nname: wrong-name\ndescription: A demo skill.\n---\n# Demo\n'
blocked() { [ "$code" -eq 2 ] && grep -q "INVALID SKILL" <<<"$out" && grep -q "does not match directory" <<<"$out"; }
reset() { (cd "$repo" && git reset -q --hard && git clean -qfd); }

# A tracked change that breaks the frontmatter check is blocked with the text.
printf -- "$BROKEN" > "$repo/skills/demo/SKILL.md"
run_hook '{"stop_hook_active": false}'
if blocked; then ok "broken frontmatter is blocked with the failure text"; else bad "broken frontmatter: code=$code out=$out"; fi

# The second stop of the same turn passes: reported once per turn, no trap.
run_hook '{"stop_hook_active": true}'
if [ "$code" -eq 0 ]; then ok "stop_hook_active lets the second stop through"; else bad "stop_hook_active: code=$code"; fi
run_hook '{"stop_hook_active":true}'
if [ "$code" -eq 0 ]; then ok "compact stop_hook_active:true lets the stop through"; else bad "compact true: code=$code"; fi

# A false payload with a later "true" field is still checked and blocked.
run_hook '{"stop_hook_active": false, "other": true}'
if blocked; then ok "false payload with a later true field is blocked"; else bad "later true field: code=$code out=$out"; fi

# The payload's cwd (a subdirectory of the tree) wins over CLAUDE_PROJECT_DIR.
mkdir -p "$tmp/elsewhere"
out="$(cd "$tmp/elsewhere" && CLAUDE_PROJECT_DIR="$tmp/elsewhere" bash "$hook" <<<"{\"stop_hook_active\": false, \"cwd\": \"$repo/skills\"}" 2>&1)"; code=$?
if blocked; then ok "payload cwd selects the tree to check"; else bad "payload cwd: code=$code out=$out"; fi

# A different, valid tracked change runs the check and passes silently.
printf -- '---\nname: demo\ndescription: A demo skill.\n---\n# Demo\n\nMore text.\n' > "$repo/skills/demo/SKILL.md"
run_hook '{"stop_hook_active": false}'
if [ "$code" -eq 0 ] && [ -z "$out" ]; then ok "a valid tracked change passes silently"; else bad "valid change: code=$code out=$out"; fi
reset

# A staged-only change is a tracked change.
printf -- "$BROKEN" > "$repo/skills/demo/SKILL.md"
(cd "$repo" && git add skills/demo/SKILL.md)
run_hook '{"stop_hook_active": false}'
if blocked; then ok "a staged-only change is checked"; else bad "staged-only: code=$code out=$out"; fi
reset

# A rename is a tracked change (the directory no longer matches the name).
(cd "$repo" && git mv skills/demo skills/demo2)
run_hook '{"stop_hook_active": false}'
if blocked; then ok "a rename is checked"; else bad "rename: code=$code out=$out"; fi
reset

exit "$rc"

