# role-guard.sh — starts role-guard.py and fails closed ONLY for the guarded
# agents (TASK-0271 risk review H6, ADR-0062).
#
# Run as `bash role-guard.sh` by the ai-toolbox-agents plugin's hooks.json (no
# shebang, so it needs no executable bit). The old command,
# `python3 role-guard.py || exit 2`, blocked EVERY matched call in every
# session on a host without a working python3. Now:
#   - a working python (python3, else python; 3.8 or newer) runs the guard,
#     which decides and fails closed by itself;
#   - no working python, or the guard crashing: a call whose agent_type is
#     `ai-toolbox-agents:<role>` is denied, every other call (the main thread,
#     an unguarded agent) gets no decision.
# The agent_type test on the no-python path is a text match on the engine's
# own JSON, which writes ASCII names unescaped.
# Extra arguments (--config, --today) are passed to the guard for the tests.
input=$(cat)
dir=$(dirname "$0")
deny() {
  printf '%s\n' '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "role-guard (ADR-0062): '"$1"'; failing closed for a guarded agent"}}'
  exit 0
}
guarded() {
  printf '%s' "$input" | grep -q '"agent_type"[[:space:]]*:[[:space:]]*"ai-toolbox-agents:'
}
for py in python3 python; do
  if command -v "$py" >/dev/null 2>&1 &&
     "$py" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' >/dev/null 2>&1; then
    result=$(printf '%s' "$input" | "$py" "$dir/role-guard.py" "$@")
    rc=$?
    if [ "$rc" -eq 0 ]; then
      [ -n "$result" ] && printf '%s\n' "$result"
      exit 0
    fi
    if guarded; then deny "the guard exited $rc"; fi
    exit 0
  fi
done
if guarded; then deny "no working python3 or python on PATH"; fi
exit 0
