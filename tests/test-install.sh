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

# S12-S17: mods in CLAUDE_CODE_PLUGIN_DIRS (TASK-0222). Added last, so the
# counts above stay as they were. A mod's Claude Code plugin is
# mods/<name>/claude (ADR-0054); a mod listed from before that layout
# (mods/<name>, as ELSEWHERE below) is still recognised and replaced.
for m in mod-x mod-y _template no-hooks; do
  mkdir -p "$R/mods/$m/claude/.claude-plugin"
  printf '{"name": "%s", "version": "1.2.3"}\n' "$m" > "$R/mods/$m/claude/.claude-plugin/plugin.json"
  [ "$m" = no-hooks ] || mkdir -p "$R/mods/$m/claude/hooks"
done
SEP=":"; [ "$WIN" -eq 1 ] && SEP=";"
winpath() { if [ "$WIN" -eq 1 ]; then cygpath -w "$1"; else printf '%s' "$1"; fi; }
FOREIGN="$(winpath "$tmp/my-plugin")"
ELSEWHERE="$(winpath "$tmp/other-checkout/mods/mod-y")"
SET="$HOME/.claude/settings.json"
FOREIGN="$FOREIGN" ELSEWHERE="$ELSEWHERE" SEP="$SEP" python3 - "$SET" <<'EOF'
import json, os, sys
json.dump({"model": "opus", "env": {"OTHER": "kept",
           "CLAUDE_CODE_PLUGIN_DIRS": os.environ["FOREIGN"] + os.environ["SEP"] + os.environ["ELSEWHERE"]},
           "permissions": {"allow": ["Bash(ls)"]}}, open(sys.argv[1], "w"), indent=2)
EOF
entries() { python3 -c "import json,sys;print('\n'.join(json.load(open(sys.argv[1])).get('env',{}).get('CLAUDE_CODE_PLUGIN_DIRS','').split(sys.argv[2])))" "$SET" "$SEP" | tr -d '\r'; }
ours() { (cd "$R" && winpath "$(pwd)/mods/$1/claude"); }

inst --client claude-code
e="$(entries)"
check "S12 run exits 0 and lists both mods" "$([ "$rc" -eq 0 ] && has "$out" 'mods listed: mod-x, mod-y'; echo $?)" "$out"
check "S12 entries: the foreign one, then this checkout's mods" "$([ "$e" = "$FOREIGN"$'\n'"$(ours mod-x)"$'\n'"$(ours mod-y)" ]; echo $?)" "$e"
check "S12 another checkout's entry is replaced and announced" "$(lacks "$e" other-checkout && has "$out" 'mod-y was listed from'; echo $?)" "$out"
check "S12 _template and a plugin without hooks are not mods" "$(lacks "$e" _template && lacks "$e" no-hooks; echo $?)" "$e"
check "S12 every other key kept; watch set" "$(python3 -c "import json,sys;d=json.load(open(sys.argv[1]));sys.exit(not(d['model']=='opus' and d['env']['OTHER']=='kept' and d['permissions']=={'allow':['Bash(ls)']} and d['env']['CLAUDE_CODE_PLUGIN_DIR_WATCH']=='1'))" "$SET"; echo $?)"

before="$(cat "$SET")"
inst --client claude-code
check "S13 a second run changes nothing and says nothing of mods" "$([ "$before" = "$(cat "$SET")" ] && lacks "$out" 'mods listed' && lacks "$out" NOTICE; echo $?)" "$out"

inst --status
check "S14 --status lists each mod here, with its version" "$(has "$out" 'mod:mod-x' && has "$out" '1.2.3' && has "$out" 'listed here' && lacks "$out" MISSING; echo $?)" "$out"

inst --client claude-code --only alpha
e="$(entries)"
check "S15 deselected mods are unlisted; the foreign entry stays" "$([ "$e" = "$FOREIGN" ] && has "$out" 'mod unlisted: mod-x'; echo $?)" "$e"
inst --status --only alpha
check "S15 --status says 'not selected', not MISSING" "$(has "$out" 'absent (not selected)' && lacks "$out" MISSING; echo $?)" "$out"

ELSEWHERE_X="$(winpath "$tmp/other-checkout/mods/mod-x/claude")"
ELSEWHERE_X="$ELSEWHERE_X" python3 -c "import json,os,sys;d=json.load(open(sys.argv[1]));d['env']['CLAUDE_CODE_PLUGIN_DIRS']=os.environ['ELSEWHERE_X'];json.dump(d,open(sys.argv[1],'w'),indent=2)" "$SET"
inst --client claude-code --only alpha
check "S16 a deselected mod listed from elsewhere is left and reported" "$([ "$(entries)" = "$ELSEWHERE_X" ] && has "$out" 'left in place'; echo $?)" "$out"
inst --status
check "S16 --status flags a mod listed elsewhere as MISSING" "$(has "$out" 'listed elsewhere' && has "$out" MISSING; echo $?)" "$out"

printf '{"env": {bad\n' > "$SET"
inst --client claude-code
check "S17 a settings.json that does not parse fails the run, untouched" "$([ "$rc" -ne 0 ] && has "$out" 'does not parse' && [ "$(cat "$SET")" = '{"env": {bad' ]; echo $?)" "$out"

# --- mod ports (TASK-0254): a mod's opencode/ folder is copied, never linked --
echo '{"env": {}}' > "$SET"
mkdir -p "$R/mods/mod-x/opencode/types"
printf "export default { id: 'mod-x' }\n" > "$R/mods/mod-x/opencode/index.ts"
printf 'export const b = 1\n' > "$R/mods/mod-x/opencode/board.ts"
printf 'declare module "m" {}\n' > "$R/mods/mod-x/opencode/types/m.d.ts"
printf 'test\n' > "$R/mods/mod-x/opencode/board.test.ts"
OM="$HOME/.config/opencode/mods/mod-x" OE="$HOME/.config/opencode/plugins/mod-x.ts"
inst --client opencode
check "P1 the opencode step copies the port, tests left out, with a marker" "$([ "$rc" -eq 0 ] && [ -f "$OM/index.ts" ] && [ -f "$OM/types/m.d.ts" ] && [ ! -e "$OM/board.test.ts" ] && [ ! -L "$OM" ] && [ -f "$OM/.ai-toolbox-mod" ] && has "$out" 'mod copied: mod-x'; echo $?)" "$out"
check "P1 the entry in plugins/ re-exports the copy's index.ts" "$(grep -q "export { default } from '../mods/mod-x/index.ts'" "$OE" && [ ! -e "$HOME/.config/opencode/mods/mod-y" ]; echo $?)" "$(cat "$OE" 2>&1)"
printf 'export const b = 2\n' > "$R/mods/mod-x/opencode/board.ts"
inst --client opencode
check "P2 a second run replaces the copy with the repo's" "$(grep -q 'b = 2' "$OM/board.ts"; echo $?)" "$out"
inst --status
check "P3 --status reports the port as a copy" "$(has "$out" 'opencode     mod:mod-x' && has "$out" 'COPY of'; echo $?)" "$out"
inst --client opencode --only alpha
check "P4 a deselected mod's copy and entry are removed" "$([ ! -e "$OM" ] && [ ! -e "$OE" ] && has "$out" 'mod removed: mod-x (opencode)'; echo $?)" "$out"
mkdir -p "$OM"; echo mine > "$OM/index.ts"
inst --client opencode
check "P5 a folder this repo did not write is left in place" "$([ "$(cat "$OM/index.ts")" = mine ] && has "$out" 'was not written by this repo'; echo $?)" "$out"
rm -rf "$OM"

# --- Codex (TASK-0255): a mod's codex/ bundle is copied to ~/.codex/plugins/ --
mkdir -p "$R/mods/mod-x/codex/hooks" "$R/mods/mod-x/codex/scripts"
printf '{"name": "mod-x", "version": "0.1.0"}\n' > "$R/mods/mod-x/codex/plugin.json"
printf '{"hooks": {}}\n' > "$R/mods/mod-x/codex/hooks/hooks.json"
printf 'export const s = 1\n' > "$R/mods/mod-x/codex/scripts/server.ts"
printf 'test\n' > "$R/mods/mod-x/codex/scripts/server.test.ts"
CX="$HOME/.codex/plugins/mod-x"
inst --client codex
check "X1 with no ~/.codex the codex step is skipped, nothing written" "$([ "$rc" -eq 2 ] && has "$out" 'client skipped: codex' && [ ! -e "$HOME/.codex" ]; echo $?)" "$out"
mkdir -p "$HOME/.codex"
inst --client codex
check "X2 the codex step copies the bundle, tests left out, with a marker" "$([ "$rc" -eq 0 ] && [ -f "$CX/plugin.json" ] && [ -f "$CX/hooks/hooks.json" ] && [ -f "$CX/scripts/server.ts" ] && [ ! -e "$CX/scripts/server.test.ts" ] && [ -f "$CX/.ai-toolbox-mod" ] && [ ! -L "$CX" ] && has "$out" 'mod copied: mod-x' && has "$out" 'marketplace entry'; echo $?)" "$out"
check "X2 --client codex touches no skill or OpenCode path" "$([ ! -e "$HOME/.config/opencode/mods/mod-x" ] && [ ! -e "$HOME/.codex/skills" ]; echo $?)" "$out"
inst --status
check "X3 --status reports the codex copy" "$(has "$out" 'codex        mod:mod-x' && has "$out" 'COPY of'; echo $?)" "$out"
inst --client codex --only alpha
check "X4 a deselected mod's bundle is removed" "$([ ! -e "$CX" ] && has "$out" 'mod removed: mod-x (codex)'; echo $?)" "$out"
mkdir -p "$CX"; echo '{}' > "$CX/plugin.json"
inst --client codex
check "X5 a bundle this repo did not write is left in place" "$([ "$(cat "$CX/plugin.json")" = '{}' ] && has "$out" 'was not written by this repo'; echo $?)" "$out"

# --- Worktree hooks (TASK-0261): the fragment is merged into the PROJECT's
# .claude/settings.json, never clobbering, never writing an unparsable file ---
mkdir -p "$R/configs/claude-code"
cp "$here/configs/claude-code/settings.hooks.json" "$R/configs/claude-code/settings.hooks.json"
PS="$R/.claude/settings.json"
rm -rf "$R/.claude"
inst --status
check "H1 --status creates no .claude/ and reports the hooks missing" "$([ ! -e "$R/.claude" ] && has "$out" 'hooks:worktree' && has "$out" 'MISSING'; echo $?)" "$out"
mkdir -p "$R/.claude"
printf '{"model": "m", "hooks": {"WorktreeCreate": [{"hooks": [{"type": "command", "command": "mine"}]}], "Stop": [{"hooks": [{"type": "command", "command": "mystop"}]}]}}\n' > "$PS"
inst --client claude-code
merged="$(python3 -c '
import json, os, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
h = d["hooks"]
cmds = lambda e: [x["command"] for g in h.get(e, []) for x in g["hooks"]]
ok = d["model"] == "m" and cmds("Stop")[0] == "mystop" and len(cmds("Stop")) == 2 and "stop-fast-check.sh" in cmds("Stop")[1] and cmds("WorktreeCreate")[0] == "mine" \
  and len(cmds("WorktreeCreate")) == 2 and "worktree-create.sh" in cmds("WorktreeCreate")[1] \
  and len(cmds("WorktreeRemove")) == 1 and "worktree-remove.sh" in cmds("WorktreeRemove")[0] \
  and "$CLAUDE_PROJECT_DIR" not in cmds("WorktreeCreate")[1] \
  and "/configs/claude-code/hooks/worktree-create.sh" in cmds("WorktreeCreate")[1] \
  and cmds("WorktreeCreate")[1].split(chr(34))[1][0] in "/CDEcde" \
  and (not os.environ.get("MSYSTEM") or (cmds("WorktreeCreate")[1].startswith(chr(34))
       and "\\bin\\bash.exe\" \"" in cmds("WorktreeCreate")[1] and "exec " not in cmds("WorktreeCreate")[1]))
sys.stdout.write("yes" if ok else "no")' "$PS" 2>&1)"
check "H2 the fragment is merged beside an existing hook and other keys, the absolute path in place of the variable" "$([ "$rc" -eq 0 ] && [ "$merged" = yes ] && has "$out" 'hooks added: WorktreeCreate, Stop, WorktreeRemove'; echo $?)" "$out $merged"
before="$(cat "$PS")"
inst --client claude-code
check "H3 a second run is a no-op" "$([ "$rc" -eq 0 ] && [ "$(cat "$PS")" = "$before" ] && lacks "$out" 'hooks added'; echo $?)" "$out"
inst --status
check "H3 --status then reports the hooks present" "$(has "$out" 'hooks:worktree' && has "$out" 'present in'; echo $?)" "$out"
printf '{bad' > "$PS"
inst --client claude-code
check "H4 an unparsable file is left untouched and the run exits 1" "$([ "$rc" -eq 1 ] && [ "$(cat "$PS")" = '{bad' ] && has "$out" 'does not parse'; echo $?)" "$out"
rm -rf "$R/.claude" "$R/configs"

# --- Permissions and sandbox (TASK-0276, Q13=C): permission rules go into the
# project settings of every install; the sandbox block only into the
# unattended file, written by `--unattended` ---
mkdir -p "$R/configs/claude-code"
PF="$here/configs/claude-code/settings.permissions.json"
SF="$here/configs/claude-code/settings.sandbox.json"
RPF="$R/configs/claude-code/settings.permissions.json"
RSF="$R/configs/claude-code/settings.sandbox.json"
check "Q0 both fragments exist in the repo" "$([ -f "$PF" ] && [ -f "$SF" ]; echo $?)" "$PF $SF"
[ -f "$PF" ] && cp "$PF" "$RPF"
[ -f "$SF" ] && cp "$SF" "$RSF"
rm -rf "$R/.claude"; mkdir -p "$R/.claude"
printf '{"model": "m", "permissions": {"allow": ["Bash(ls*)"], "deny": ["Read(./secret.txt)"]}}\n' > "$PS"
inst --client claude-code
perm_ok="$(python3 -c '
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
p = d.get("permissions", {})
dn, ask = p.get("deny", []), p.get("ask", [])
ok = d["model"] == "m" and "sandbox" not in d \
  and p.get("allow") == ["Bash(ls*)"] and "Read(./secret.txt)" in dn \
  and all(dn.count(x) == 1 for x in ("Read(**/.env)", "Read(**/.env.local)",
      "Bash(git push --force *)", "Bash(git push -f *)", "Bash(git push * -f *)",
      "Bash(git push * --force)", "Bash(git push * +*)", "Bash(git push * --mirror*)",
      "Bash(git push * --delete*)", "Bash(git push * :*)")) \
  and not any("example" in x or x == "Read(**/.env*)" for x in dn) \
  and not any(x.startswith("Bash(git push") and "lease" in x for x in dn) \
  and all(ask.count(x) == 1 for x in ("Bash(git push*)", "Bash(git -C * push*)",
      "Bash(git -c * push*)", "WebFetch"))
sys.stdout.write("yes" if ok else "no")' "$PS" 2>&1)"
check "Q1 interactive install merges the deny and ask rules (-f, +refspec, :branch, -C) beside existing ones, no .env.example deny, no sandbox block" "$([ "$rc" -eq 0 ] && [ "$perm_ok" = yes ] && has "$out" 'permissions added'; echo $?)" "$out $perm_ok"
before="$(cat "$PS")"
inst --client claude-code
check "Q2 a second interactive run changes nothing" "$([ "$rc" -eq 0 ] && [ "$(cat "$PS")" = "$before" ] && lacks "$out" 'permissions added'; echo $?)" "$out"
[ ! -e "$R/.claude/settings.unattended.json" ]
check "Q3 an interactive install writes no unattended file" "$?"
inst --client claude-code --unattended
US="$R/.claude/settings.unattended.json"
sb_ok="$(python3 -c '
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
s = d.get("sandbox", {})
doms = s.get("network", {}).get("allowedDomains", [])
ok = s.get("enabled") is True and s.get("allowUnsandboxedCommands") is False \
  and doms == ["gitlab.com", "github.com", "pypi.org", "files.pythonhosted.org", "registry.npmjs.org"] \
  and "Bash(git push --force *)" in d.get("permissions", {}).get("deny", [])
sys.stdout.write("yes" if ok else "no")' "$US" 2>&1)"
check "Q4 --unattended writes sandbox.enabled, allowUnsandboxedCommands false and the exact domain list (plus the permission rules) to the unattended file" "$([ "$rc" -eq 0 ] && [ "$sb_ok" = yes ] && has "$out" 'sandbox added'; echo $?)" "$out $sb_ok"
ubefore="$(cat "$US")"; pbefore="$(cat "$PS")"
inst --client claude-code --unattended
check "Q5 a second unattended run changes nothing, and settings.json still has no sandbox" "$([ "$rc" -eq 0 ] && [ "$(cat "$US")" = "$ubefore" ] && [ "$(cat "$PS")" = "$pbefore" ] && lacks "$(cat "$PS")" sandbox; echo $?)" "$out"
printf '{bad' > "$PS"
inst --client claude-code
check "Q6 an unparsable settings.json is left untouched and the run exits 1 naming its permissions" "$([ "$rc" -eq 1 ] && [ "$(cat "$PS")" = '{bad' ] && has "$out" 'its permissions were not written'; echo $?)" "$out"
printf '{}\n' > "$PS"
# A real red proof: the removed fragment makes the run succeed WITHOUT rules,
# which is what Q1 catches; here the installer must still not fail silently
# when the unattended run lacks a fragment.
rm -f "$RPF"
inst --client claude-code
check "Q7 with the permissions fragment removed no rule is merged (Q1 would fail)" "$([ "$rc" -eq 0 ] && lacks "$(cat "$PS")" 'git push'; echo $?)" "$out"
inst --client claude-code --unattended
check "Q8 --unattended with a fragment missing exits non-zero and says so" "$([ "$rc" -ne 0 ] && has "$out" 'settings.permissions.json, which is missing'; echo $?)" "$out"
cp "$PF" "$RPF"; rm -f "$RSF"
inst --client claude-code --unattended
check "Q9 --unattended without the sandbox fragment exits non-zero" "$([ "$rc" -ne 0 ] && has "$out" 'settings.sandbox.json, which is missing'; echo $?)" "$out"
cp "$SF" "$RSF"
printf '{"sandbox": {"enabled": false, "allowUnsandboxedCommands": true, "network": {"allowedDomains": ["local.example"]}}}\n' > "$US"
inst --status
has "$out" 'MISSING or WEAKENED'
check "Q10 --status reports a weakened unattended file" "$?" "$out"
inst --client claude-code --unattended
wk="$(python3 -c '
import json, sys
s = json.load(open(sys.argv[1], encoding="utf-8"))["sandbox"]
d = s["network"]["allowedDomains"]
sys.stdout.write("yes" if s["enabled"] is True and s["allowUnsandboxedCommands"] is False and d[0] == "local.example" and "gitlab.com" in d else "no")' "$US" 2>&1)"
check "Q11 a re-run forces sandbox.enabled true over a weakened value and keeps a local domain" "$([ "$rc" -eq 0 ] && [ "$wk" = yes ]; echo $?)" "$out $wk"
mv "$HOME/.claude" "$HOME/.claude.off"
rm -f "$US"
inst --client claude-code --unattended
check "Q12 --unattended without ~/.claude still writes the project file, says the client was skipped, and exits non-zero (no client deployed)" "$([ "$rc" -ne 0 ] && [ -f "$US" ] && has "$out" 'client skipped: claude-code'; echo $?)" "$out"
inst --client opencode --unattended
check "Q13 --unattended with another --client is refused" "$([ "$rc" -eq 2 ]; echo $?)" "$out"
mv "$HOME/.claude.off" "$HOME/.claude"
rm -rf "$R/.claude" "$R/configs"

# --- P1.2 (TASK-0272): the three Claude Code plugins -------------------------
# Runs against the REAL repository ($here), not the fake one above. Counts are
# read from the sources (skills/, the emitter's claude-code output), never
# hardcoded: 8 skills and 4 agents today, whatever they are tomorrow.
# WHAT THIS PROVES: the build yields the counts, a dropped component fails
# them, the permission rules are read from the fragment at build time, plugins/
# drift is caught, and (with claude on PATH) the plugins validate and install.
# WHAT IT DOES NOT PROVE: that Claude Code applies a plugin's settings.json
# permissions; scripts/install.sh --unattended is what writes them.
BP="$here/scripts/build-plugin.py"
PB="$tmp/built"
python3 "$BP" --out "$PB" >/dev/null 2>&1
check "P1 build-plugin.py builds the three plugins" "$([ -f "$PB/ai-toolbox-skills/.claude-plugin/plugin.json" ] && [ -f "$PB/ai-toolbox-agents/.claude-plugin/plugin.json" ] && [ -f "$PB/ai-toolbox-gates/.mcp.json" ]; echo $?)"

src_skills="$(cd "$here/skills" && for d in */; do d="${d%/}"; case "$d" in _template*|mod-dev) continue ;; esac; [ -f "$d/SKILL.md" ] && echo "$d"; done | wc -l | tr -d ' ')"
# The plugin also carries the run-<loop> wrappers from loops/<n>/SKILL.md (TASK-0273).
loop_skills="$(cd "$here/loops" && for d in */; do d="${d%/}"; case "$d" in _template*) continue ;; esac; [ -f "$d/SKILL.md" ] && echo "$d"; done | wc -l | tr -d ' ')"
src_skills=$((src_skills + loop_skills))
mkdir -p "$tmp/em"
(cd "$here" && python3 scripts/emit-agents.py claude-code "$tmp/em" >/dev/null 2>&1)
src_agents="$(ls "$tmp/em" | wc -l | tr -d ' ')"
# counts_ok <built-dir>: skills, agents and the gates server, against the sources.
counts_ok() {
  local b="$1" s a g
  s="$(ls "$b/ai-toolbox-skills/skills"/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')"
  a="$(ls "$b/ai-toolbox-agents/agents"/*.md 2>/dev/null | wc -l | tr -d ' ')"
  g="$(python3 -c 'import json,sys; print("gates" in json.load(open(sys.argv[1]))["mcpServers"])' "$b/ai-toolbox-gates/.mcp.json" 2>/dev/null)"
  [ "$src_skills" -gt 0 ] && [ "$src_agents" -gt 0 ] && [ "$s" = "$src_skills" ] && [ "$a" = "$src_agents" ] && [ "$g" = True ]
}
counts_ok "$PB"
check "P2 built plugins hold $src_skills skills, $src_agents agents (the emitter's count) and the gates server" "$?"
rm -rf "$tmp/cut"; cp -r "$PB" "$tmp/cut"
rm -rf "$tmp/cut/ai-toolbox-skills/skills/$(ls "$tmp/cut/ai-toolbox-skills/skills" | head -n 1)"
counts_ok "$tmp/cut"; check "P3 dropping a skill from the build fails the count" "$([ $? -ne 0 ]; echo $?)"
rm -rf "$tmp/cut"; cp -r "$PB" "$tmp/cut"; rm -f "$tmp/cut/ai-toolbox-agents/agents/"critic.md
counts_ok "$tmp/cut"; check "P4 dropping an agent from the build fails the count" "$([ $? -ne 0 ]; echo $?)"
rm -rf "$tmp/cut"; cp -r "$PB" "$tmp/cut"; rm -f "$tmp/cut/ai-toolbox-gates/.mcp.json"
counts_ok "$tmp/cut"; check "P5 dropping the gates server fails the count" "$([ $? -ne 0 ]; echo $?)"

# Dependencies: agents needs skills, in the plugin and in the marketplace.
dep="$(python3 - "$PB" "$here/.claude-plugin/marketplace.json" <<'PY'
import json, sys
b, mk = sys.argv[1], sys.argv[2]
m = json.load(open(mk, encoding="utf-8"))
e = {p["name"]: p for p in m["plugins"]}
ok = all(n in e and e[n]["source"] == "./plugins/" + n
         for n in ("ai-toolbox-skills", "ai-toolbox-agents", "ai-toolbox-gates"))
want = [{"name": "ai-toolbox-skills", "version": "~0.1.0"}]  # the range form: TASK-0283
want = json.load(open(mk.replace(".claude-plugin/marketplace.json", "scripts/plugin-versions.json"), encoding="utf-8"))["plugins"]["ai-toolbox-agents"]["dependencies"]
want = [{"name": n, "version": r} for n, r in want.items()]
ok = ok and e["ai-toolbox-agents"].get("dependencies") == want and want[0]["name"] == "ai-toolbox-skills"
pj = json.load(open(b + "/ai-toolbox-agents/.claude-plugin/plugin.json", encoding="utf-8"))
ok = ok and pj.get("dependencies") == want
print("yes" if ok else "no")
PY
)"
check "P6 marketplace lists the three plugins and agents depends on skills" "$([ "$dep" = yes ]; echo $?)" "$dep"

# Not shipped: permission rules, hooks and the checkout-only skill. A plugin
# settings.json is not a known way to ship permission rules (install.sh writes
# them), the worktree hooks are this repo's rule, and mod-dev needs a checkout.
nopl="$(cd "$PB" && find . \( -name settings.json -o -name hooks.json -o -name hooks -o -name mod-dev \) | wc -l | tr -d ' ')"
check "P7 no plugin carries a settings.json, hooks or the mod-dev skill" "$([ "$nopl" = 0 ]; echo $?)" "found $nopl"
check "P8 the gates .mcp.json passes only the required variables plus GATES_TRANSPORT=stdio, run frozen without dev" "$(python3 -c '
import json, sys
s = json.load(open(sys.argv[1]))["mcpServers"]["gates"]
ok = sorted(s["env"]) == ["GATES_ALLOWED_EXECUTABLES", "GATES_MAP", "GATES_MAP_SHA256", "GATES_RUN_ROOT", "GATES_TRANSPORT"] and s["env"]["GATES_TRANSPORT"] == "stdio" and "--frozen" in s["args"] and "--no-dev" in s["args"]
sys.exit(0 if ok else 1)' "$PB/ai-toolbox-gates/.mcp.json"; echo $?)"
# A fake root: CRLF sources, the excluded skill, a --check that ignores line endings.
FR="$tmp/fakeroot"; mkdir -p "$FR/scripts" "$FR/.ai/context" "$FR/skills/only" "$FR/skills/mod-dev" "$FR/agents" "$FR/mcp-servers/gates"
cp "$BP" "$here/scripts/emit-agents.py" "$here/scripts/plugin-versions.json" "$FR/scripts/"
cp "$here/.ai/context/model-tiers.md" "$FR/.ai/context/" 2>/dev/null
cp -r "$here/agents/critic" "$FR/agents/critic"
cp -r "$here/mcp-servers/gates/src" "$here/mcp-servers/gates/pyproject.toml" "$FR/mcp-servers/gates/"
printf -- '---\r\nname: only\r\ndescription: x\r\n---\r\nbody\r\n' > "$FR/skills/only/SKILL.md"
printf -- '---\nname: mod-dev\ndescription: x\n---\nbody\n' > "$FR/skills/mod-dev/SKILL.md"
fbo="$(cd "$FR" && python3 scripts/build-plugin.py 2>&1)"
p9a="$(python3 -c '
import os, sys
r = sys.argv[1]
f = os.path.join(r, "ai-toolbox-skills", "skills", "only", "SKILL.md")
if not os.path.isfile(f): print("missing"); sys.exit()
print("cr" if bytes([13]) in open(f, "rb").read() else "mod-dev" if os.path.exists(os.path.join(r, "ai-toolbox-skills", "skills", "mod-dev")) else "ok")' "$FR/plugins")"
check "P9 the build writes LF for a CRLF source and leaves mod-dev out" "$([ "$p9a" = ok ]; echo $?)" "$p9a $fbo"
crlf="$(python3 -c '
import glob, sys
print(sum(bytes([13]) in open(f, "rb").read() for f in glob.glob(sys.argv[1] + "/plugins/*/*/*.md")))' "$here")"
check "P9b the committed agent and skill files hold no CR" "$([ "$crlf" = 0 ]; echo $?)" "$crlf"

# Drift: plugins/ must equal a fresh build; an edit or a missing file fails,
# a line-ending change alone does not.
(cd "$FR" && python3 scripts/build-plugin.py --check >/dev/null 2>&1)
check "P10 --check passes on a fresh build" "$?"
sed -i 's/$/\r/' "$FR/plugins/ai-toolbox-skills/skills/only/SKILL.md"
(cd "$FR" && python3 scripts/build-plugin.py --check >/dev/null 2>&1)
check "P10b --check ignores line endings" "$?"
echo stale >> "$FR/plugins/ai-toolbox-skills/skills/only/SKILL.md"
(cd "$FR" && python3 scripts/build-plugin.py --check >/dev/null 2>&1)
check "P11 --check fails when a built file was edited" "$([ $? -ne 0 ]; echo $?)"
(cd "$FR" && python3 scripts/build-plugin.py >/dev/null 2>&1; rm -f plugins/ai-toolbox-gates/README.md; python3 scripts/build-plugin.py --check >/dev/null 2>&1)
check "P12 --check fails when a built file is missing" "$([ $? -ne 0 ]; echo $?)"
(cd "$here" && python3 scripts/build-plugin.py --check >/dev/null 2>&1)
check "P13 the committed plugins/ matches a fresh build" "$?"


# claude plugin validate and a real install into a throwaway config dir.
if command -v claude >/dev/null 2>&1; then
  vfail=""
  for k in skills agents gates; do
    claude plugin validate "$(cygpath -w "$PB/ai-toolbox-$k" 2>/dev/null || echo "$PB/ai-toolbox-$k")" >/dev/null 2>&1 || vfail="$vfail $k"
  done
  check "P14 claude plugin validate passes on each plugin" "$([ -z "$vfail" ]; echo $?)" "$vfail"
  CC="$tmp/claude-config"; mkdir -p "$CC"
  MP="$here"; [ "$WIN" -eq 1 ] && MP="$(cygpath -w "$here")"
  ifail=""
  CLAUDE_CONFIG_DIR="$CC" claude plugin marketplace add "$MP" >/dev/null 2>&1 || ifail="$ifail marketplace"
  for k in skills agents gates; do
    CLAUDE_CONFIG_DIR="$CC" claude plugin install "ai-toolbox-$k@ai-toolbox" --scope user >/dev/null 2>&1 || ifail="$ifail $k"
  done
  check "P15 the three plugins install into a throwaway config dir" "$([ -z "$ifail" ]; echo $?)" "$ifail"
  I="$CC/plugins/cache/ai-toolbox"
  isk="$(ls "$I"/ai-toolbox-skills/*/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')"
  iag="$(ls "$I"/ai-toolbox-agents/*/agents/*.md 2>/dev/null | wc -l | tr -d ' ')"
  igt="$(ls "$I"/ai-toolbox-gates/*/.mcp.json 2>/dev/null | wc -l | tr -d ' ')"
  check "P16 the installed copies hold $src_skills skills, $src_agents agents and the gates server" "$([ "$isk" = "$src_skills" ] && [ "$iag" = "$src_agents" ] && [ "$igt" = 1 ]; echo $?)" "skills=$isk agents=$iag gates=$igt"
else
  echo "SKIP P14-P16 (claude is not on PATH)"
fi

if [ "$fails" -ne 0 ]; then
  echo "test-install.sh: $fails of $cases case(s) FAILED"; exit 1
fi
echo "test-install.sh: OK ($cases cases)"
