#!/usr/bin/env bash
# Port parity: Claude Code is the reference profile, each port maps a term or
# refuses the role (ADR-0065, TASK-0280).
#
# WHAT THIS PROVES: one agent source emits all three client formats (a fixture
# role Codex can express gets a valid TOML; the real roles get Claude Code and
# OpenCode files); the matrix in docs/registry.md equals `emit-agents.py
# --parity`, and each role row says exactly what an emission into a scratch
# directory writes; dropping a port mapping changes the matrix, so the
# registry check fails; a role whose term Codex cannot enforce is refused for
# Codex, never written without it.
# WHAT IT DOES NOT PROVE: that Codex loads the TOML (no Codex here), or that a
# Codex sandbox matches a role's intent; those are the parent session's.
#
# Usage: tests/test-emit-parity.sh
set -uo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
here="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fails=0; cases=0
check() {  # check <name> <exit-status> [detail]
  cases=$((cases + 1))
  if [ "$2" -eq 0 ]; then echo "PASS $1"; else echo "FAIL $1${3:+ -- $3}"; fails=$((fails + 1)); fi
}
PY=python3
command -v python3 >/dev/null 2>&1 && python3 -c 'import sys' >/dev/null 2>&1 || PY=python

# P1: the registry's Port parity section is the emitter's --parity output.
(cd "$here" && "$PY" scripts/emit-agents.py --parity) > "$tmp/parity.md"
sed -n '/^## Port parity$/,$p' "$here/docs/registry.md" | tail -n +3 | tr -d '\r' > "$tmp/reg.md"
check "P1 docs/registry.md carries the --parity matrix" \
  "$(cmp -s "$tmp/parity.md" "$tmp/reg.md"; echo $?)" "$(diff "$tmp/parity.md" "$tmp/reg.md" | head -5)"

# P2: each role row agrees with an emission into scratch directories.
for c in claude-code opencode codex; do
  (cd "$here" && "$PY" scripts/emit-agents.py "$c" "$tmp/out-$c" >/dev/null 2>&1)
done
bad=""
while IFS='|' read -r _ role cc oc cx _; do
  role="$(echo "$role" | xargs)"
  [ -n "$role" ] || continue
  for pair in "claude-code:$cc:.md" "opencode:$oc:.md" "codex:$cx:.toml"; do
    c="${pair%%:*}"; rest="${pair#*:}"; cell="$(echo "${rest%:*}" | xargs)"; ext="${rest##*:}"
    f="$tmp/out-$c/$role$ext"
    if [ "$cell" = "emitted" ]; then [ -f "$f" ] || bad="$bad $role/$c(missing)"
    else [ ! -e "$f" ] || bad="$bad $role/$c(unexpected)"; fi
  done
done < <(sed -n '/^| Role |/,$p' "$tmp/parity.md" | tail -n +3)
check "P2 each role row matches what an emission writes" "$([ -z "$bad" ]; echo $?)" "$bad"
n="$(ls "$tmp/out-claude-code" "$tmp/out-opencode" 2>/dev/null | grep -c '\.md$')"
check "P3 the real roles reach Claude Code and OpenCode ($n files)" "$([ "$n" -gt 10 ]; echo $?)"
check "P4 no real role is written for Codex" "$([ ! -d "$tmp/out-codex" ] || [ -z "$(ls -A "$tmp/out-codex")" ]; echo $?)"

# P5: a fixture root with a role Codex can express emits a valid TOML, and a
# role it cannot is refused (exit 1, named), never written.
fx="$tmp/fx"; mkdir -p "$fx/agents/shell-free" "$fx/agents/reader" "$fx/scripts"
cp "$here/scripts/emit-agents.py" "$fx/scripts/"
cat > "$fx/agents/shell-free/agent.md" <<'EOF'
---
description: A fixture role with no shell, a "quoted" word and a backslash \ in it.
mode: subagent
capabilities:
  - no-bash
clients:
  - claude-code
  - opencode
  - codex
---
Answer from the files you are given. Line two, with "quotes".
EOF
cat > "$fx/agents/reader/agent.md" <<'EOF'
---
description: A fixture role that reads only.
mode: subagent
capabilities:
  - read-only
clients:
  - codex
---
Read and report.
EOF
out="$(cd "$fx" && "$PY" scripts/emit-agents.py codex "$fx/codex" 2>&1)"; rc=$?
toml="$fx/codex/shell-free.toml"
check "P5 a Codex-expressible role is emitted as TOML" "$([ -f "$toml" ]; echo $?)" "$out"
check "P6 the TOML parses, names the role and switches the shell off" "$("$PY" - "$toml" <<'EOF' >/dev/null 2>&1; echo $?
import sys, tomllib
d = tomllib.load(open(sys.argv[1], "rb"))
assert d["name"] == "shell-free", d
assert d["features"] == {"shell_tool": False}, d
assert d["description"].startswith("A fixture role") and '"quoted"' in d["description"] and "\\ in it" in d["description"], d
assert d["developer_instructions"].startswith("Answer from the files"), d
EOF
)"
check "P7 a role Codex cannot enforce is refused, loudly, and not written" \
  "$([ $rc -eq 1 ] && [[ "$out" == *"'reader' declares 'read-only'"* ]] && [ ! -e "$fx/codex/reader.toml" ]; echo $?)" "rc=$rc $out"
# Re-emission prunes nothing it did not write, and keeps its own file (idempotent).
(cd "$fx" && "$PY" scripts/emit-agents.py codex "$fx/codex" >/dev/null 2>&1)
check "P8 re-emission is idempotent" "$([ -f "$toml" ]; echo $?)"
sed -i 's/^  - codex$//' "$fx/agents/shell-free/agent.md"
(cd "$fx" && "$PY" scripts/emit-agents.py codex "$fx/codex" >/dev/null 2>&1)
check "P9 a role that stops declaring codex has its TOML pruned (ADR-0026)" "$([ ! -e "$toml" ]; echo $?)"

# P10: dropping a port mapping changes the matrix, so P1 would fail.
cp "$here/scripts/emit-agents.py" "$tmp/emit-drop.py"
"$PY" - "$tmp/emit-drop.py" <<'EOF'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
a = '    "no-bash": {"features": {"shell_tool": False}},\n'
assert s.count(a) == 1
open(p, "w", encoding="utf-8").write(s.replace(a, ""))
EOF
(cd "$here" && "$PY" "$tmp/emit-drop.py" --parity) > "$tmp/parity-drop.md"
check "P10 dropping the Codex no-bash mapping changes the matrix" \
  "$(! cmp -s "$tmp/parity-drop.md" "$tmp/reg.md"; echo $?)"
cp "$here/scripts/emit-agents.py" "$tmp/emit-drop2.py"
"$PY" - "$tmp/emit-drop2.py" <<'EOF'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
a = '        "opencode": [("webfetch", "deny"), ("websearch", "deny")],\n'
assert s.count(a) == 1
open(p, "w", encoding="utf-8").write(s.replace(a, '        "opencode": None,\n'))
EOF
(cd "$here" && "$PY" "$tmp/emit-drop2.py" --parity) > "$tmp/parity-drop2.md" 2>/dev/null
check "P11 dropping an OpenCode mapping changes the matrix" \
  "$(! cmp -s "$tmp/parity-drop2.md" "$tmp/reg.md"; echo $?)"

if [ "$fails" -eq 0 ]; then echo "test-emit-parity.sh: OK ($cases cases)"; exit 0; fi
echo "test-emit-parity.sh: $fails of $cases case(s) FAILED"; exit 1
