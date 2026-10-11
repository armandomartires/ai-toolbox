#!/usr/bin/env bash
# Prove scripts/install.sh's selection offline (TASK-0164).
#
# Builds a fake repository (two skills, two roles, two MCP servers, and the
# real install.sh and emit-agents.py) and a fake HOME with both clients, all
# under mktemp, then runs the installer. Nothing outside the temp directory is
# read or written; tests/validate.sh runs it.
#
# THE CASES THAT MATTER are S5 and S7-S9: an unknown name must change nothing,
# and deselection must remove only what install regenerates -- never a copy,
# a link elsewhere, or a file this repo did not write.
#
# WHAT THIS PROVES: what each selection source deploys and removes, its
# precedence, its refusals, and --status's report.
# WHAT IT DOES NOT PROVE: anything about the real client directories, or that
# a selection includes what a loop needs (no dependency data exists).
#
# Usage: tests/test-install.sh [path/to/install.sh]   (a copy, for red proofs)
set -uo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
script="${1:-$here/scripts/install.sh}"
[ -f "$script" ] || { echo "FAIL: no script at $script"; exit 1; }

tmp="$(mktemp -d)"
cleanup() {
  # Junctions on Windows: remove the links first so rm never walks into a
  # target through one.
  if [ "$WIN" -eq 1 ]; then
    find "$tmp/home" -type l 2>/dev/null | while IFS= read -r l; do
      MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$l")" >/dev/null 2>&1
    done
  fi
  rm -rf "$tmp"
}
WIN=0; case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) WIN=1 ;; esac
trap cleanup EXIT

fails=0; cases=0
check() {  # check <name> <condition-exit-status> [detail]
  cases=$((cases + 1))
  if [ "$2" -eq 0 ]; then echo "PASS $1"; else echo "FAIL $1${3:+ -- $3}"; fails=$((fails + 1)); fi
}
# Plain bash substring tests: a crashed grep inside `!` reads as a pass.
has() { [[ "$1" == *"$2"* ]]; }
lacks() { has "$1" "$2"; [ $? -eq 1 ]; }
mklink() {  # mklink <target> <link>: a real link on every platform
  if [ "$WIN" -eq 1 ]; then
    MSYS_NO_PATHCONV=1 cmd /c mklink /J "$(cygpath -w "$2")" "$(cygpath -w "$1")" >/dev/null
  else
    ln -s "$1" "$2"
  fi
}

# --- the fake repository ----------------------------------------------------
R="$tmp/repo"
mkdir -p "$R/scripts" "$R/skills" "$R/agents" "$R/mcp-servers/srv-ext" "$R/mcp-servers/srv-py"
cp "$script" "$R/scripts/install.sh"
cp "$here/scripts/emit-agents.py" "$R/scripts/emit-agents.py"
for s in alpha beta _template; do
  mkdir -p "$R/skills/$s"
  printf -- '---\nname: %s\ndescription: test skill\nmetadata:\n  version: "1.0.0"\n---\nbody\n' "$s" > "$R/skills/$s/SKILL.md"
done
for r in role-a role-b; do
  mkdir -p "$R/agents/$r"
  printf -- '---\nname: %s\ndescription: test role\nmode: subagent\ncapabilities:\n  - read-only\n  - no-delegation\nclients:\n  - claude-code\n  - opencode\n---\n\nYou are %s.\n' "$r" "$r" > "$R/agents/$r/agent.md"
done
cat > "$R/mcp-servers/srv-ext/server.json" <<'EOF'
{"name": "srv-ext", "upstream": {"package": "pkg-ext"},
 "launch": {"command": ["run-srv-ext"], "transport": "stdio"}}
EOF
printf '[project]\nname = "srv-py"\n' > "$R/mcp-servers/srv-py/pyproject.toml"

export HOME="$tmp/home"
CS="$HOME/.claude/skills" CA="$HOME/.claude/agents"
OS="$HOME/.config/opencode/skills" OA="$HOME/.config/opencode/agents"
mkdir -p "$HOME/.claude" "$HOME/.config/opencode"
inst() { out="$(cd "$R" && bash scripts/install.sh "$@" 2>&1)"; rc=$?; }
linked() { [ -L "$1" ] && [ "$(cd "$1" 2>/dev/null && pwd -P)" = "$(cd "$R/skills/$(basename "$1")" && pwd -P)" ]; }
snapshot() { (cd "$HOME" && find . | sort); }

# A foreign skill and a foreign agent file live in the clients throughout.
mkdir -p "$CS/gamma" "$CA"; echo keep > "$CS/gamma/SKILL.md"
printf -- '---\nname: my-own-agent\n---\n' > "$CA/my-own-agent.md"

# S1: no selection -- everything, exactly as before.
inst
check "S1 default run exits 0" "$rc" "$out"
check "S1 every skill linked in both clients" "$(linked "$CS/alpha" && linked "$CS/beta" && linked "$OS/alpha" && linked "$OS/beta"; echo $?)" "$out"
check "S1 every role emitted in both clients" "$([ -f "$CA/role-a.md" ] && [ -f "$CA/role-b.md" ] && [ -f "$OA/role-a.md" ] && [ -f "$OA/role-b.md" ]; echo $?)" "$out"
check "S1 both servers printed, no selection line" "$(has "$out" run-srv-ext && has "$out" 'run srv-py' && lacks "$out" 'selection:'; echo $?)" "$out"

# S2: --only removes the rest from both clients.
inst --only alpha,role-a
check "S2 --only exits 0 and reports the selection" "$([ "$rc" -eq 0 ] && has "$out" 'selection: 2 of 6 components, from --only'; echo $?)" "$out"
check "S2 deselected skill unlinked in both clients" "$([ ! -e "$CS/beta" ] && [ ! -e "$OS/beta" ] && has "$out" 'skill unlinked: beta'; echo $?)" "$out"
check "S2 the skill's source is untouched" "$([ -f "$R/skills/beta/SKILL.md" ]; echo $?)"
check "S2 selected skill still linked" "$(linked "$CS/alpha" && linked "$OS/alpha"; echo $?)" "$out"
check "S2 deselected role pruned, selected kept" "$([ ! -e "$CA/role-b.md" ] && [ ! -e "$OA/role-b.md" ] && [ -f "$CA/role-a.md" ]; echo $?)" "$out"
check "S2 no server selected, no MCP section" "$(lacks "$out" 'Register MCP'; echo $?)" "$out"

# S3: install.selection -- comments, blanks, CRLF, a trailing comment.
printf '# what this machine wants\r\nbeta\r\n\r\nsrv-ext  # the external one\r\n' > "$R/install.selection"
inst
check "S3 file selection deploys beta, removes alpha" "$([ "$rc" -eq 0 ] && linked "$CS/beta" && [ ! -e "$CS/alpha" ]; echo $?)" "$out"
check "S3 file selection prunes both roles" "$([ ! -e "$CA/role-a.md" ] && [ ! -e "$OA/role-a.md" ]; echo $?)" "$out"
check "S3 only the selected server is printed" "$(has "$out" run-srv-ext && lacks "$out" 'run srv-py'; echo $?)" "$out"
check "S3 names its source" "$(has "$out" 'from install.selection'; echo $?)" "$out"

# S4: --only overrides the file.
inst --only alpha
check "S4 --only beats install.selection" "$(linked "$CS/alpha" && [ ! -e "$CS/beta" ]; echo $?)" "$out"

# S5: an unknown name refuses before writing anything.
before="$(snapshot)"
inst --only beta,nope
check "S5 unknown name exits 2 and names it" "$([ "$rc" -eq 2 ] && has "$out" nope; echo $?)" "$out"
check "S5 unknown name changed nothing" "$([ "$before" = "$(snapshot)" ]; echo $?)"

# S6: a selection naming nothing is refused, not read as "everything".
printf '# nothing yet\n\n' > "$R/install.selection"
before="$(snapshot)"
inst
check "S6 empty selection exits 2 and changes nothing" "$([ "$rc" -eq 2 ] && has "$out" 'selects no components' && [ "$before" = "$(snapshot)" ]; echo $?)" "$out"
rm -f "$R/install.selection"

# S7-S9: what deselection must leave alone.
inst                                   # everything back
unlink_one() { if [ "$WIN" -eq 1 ]; then MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$1")" >/dev/null; else rm -f "$1"; fi; }
unlink_one "$CS/beta"; cp -r "$R/skills/beta" "$CS/beta"            # a copy
mkdir -p "$tmp/elsewhere/beta"; echo x > "$tmp/elsewhere/beta/SKILL.md"
unlink_one "$OS/beta"; mklink "$tmp/elsewhere/beta" "$OS/beta"      # a link elsewhere
printf -- '---\nname: somebody-else\n---\n' > "$CA/role-b.md"        # role-named, not ours
inst --only alpha
check "S7 a deselected copy is left and reported" "$([ -f "$CS/beta/SKILL.md" ] && [ ! -L "$CS/beta" ] && has "$out" 'is a copy; left in place'; echo $?)" "$out"
check "S8 a link elsewhere is left" "$([ -L "$OS/beta" ] && [ -f "$tmp/elsewhere/beta/SKILL.md" ]; echo $?)" "$out"
check "S9 a role-named file we did not write is left" "$([ -f "$CA/role-b.md" ]; echo $?)" "$out"
check "S9 foreign skill and agent file untouched" "$([ -f "$CS/gamma/SKILL.md" ] && [ -f "$CA/my-own-agent.md" ]; echo $?)" "$out"

# S10: --status honours the selection.
rm -rf "$CS/beta"; unlink_one "$CS/alpha"
inst --status --only alpha
st_alpha="$(printf '%s\n' "$out" | while IFS= read -r l; do [[ "$l" == claude-code*alpha* ]] && echo "$l"; done)"
st_beta="$(printf '%s\n' "$out" | while IFS= read -r l; do [[ "$l" == claude-code*beta* ]] && echo "$l"; done)"
check "S10 selected but absent is STALE" "$(has "$st_alpha" STALE; echo $?)" "$out"
check "S10 unselected and absent is 'not selected', not STALE" "$(has "$st_beta" 'not selected' && lacks "$st_beta" STALE; echo $?)" "$out"

# S11: a repeated name counts once.
inst --only alpha --only alpha
check "S11 duplicates count once" "$(has "$out" 'selection: 1 of 6'; echo $?)" "$out"

if [ "$fails" -ne 0 ]; then
  echo "test-install.sh: $fails of $cases case(s) FAILED"; exit 1
fi
echo "test-install.sh: OK ($cases cases)"
