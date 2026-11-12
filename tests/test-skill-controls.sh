#!/usr/bin/env bash
# Claude Code skill controls: schema, linter, skills, ports (TASK-0274, ADR-0060).
#
# WHAT THIS PROVES: the frontmatter linter accepts allowed-tools,
# disable-model-invocation and context and rejects malformed values; the three
# skills carry the stated controls; the real install.sh deploys all non-template
# skills to OpenCode with the Claude-only keys stripped, and writes no skill for
# Codex. Runs install.sh against the real skills in a fake HOME under mktemp.
# WHAT IT DOES NOT PROVE: that a real OpenCode or Codex loads the result.
#
# Usage: tests/test-skill-controls.sh
set -uo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
here="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
WIN=0; case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) WIN=1 ;; esac
cleanup() {
  # Junctions on Windows: remove the links first so rm never walks into a
  # target (the real skills) through one.
  if [ "$WIN" -eq 1 ]; then
    find "$tmp/home" -type l 2>/dev/null | while IFS= read -r l; do
      MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$l")" >/dev/null 2>&1
    done
  fi
  rm -rf "$tmp"
}
trap cleanup EXIT
fails=0; cases=0
check() {  # check <name> <exit-status> [detail]
  cases=$((cases + 1))
  if [ "$2" -eq 0 ]; then echo "PASS $1"; else echo "FAIL $1${3:+ -- $3}"; fails=$((fails + 1)); fi
}
has() { [[ "$1" == *"$2"* ]]; }
lint() { python3 "$here/scripts/check-skill-frontmatter.py" "$1" "$(basename "$(dirname "$1")")" 2>&1; }
# key_of <file> <key>: the top-level frontmatter value, quotes stripped.
key_of() { sed -n '2,/^---$/p' "$1" | sed -n "s/^$2:[[:space:]]*//p" | head -1 | sed 's/^"\(.*\)"$/\1/'; }

# --- the linter -------------------------------------------------------------
mkfix() {  # mkfix <dir> <extra frontmatter lines...>
  local d="$tmp/$1"; shift
  mkdir -p "$d"
  { printf -- '---\nname: %s\ndescription: a fixture\n' "$(basename "$d")"; printf '%s\n' "$@"; printf -- '---\nbody\n'; } > "$d/SKILL.md"
}
mkfix ok-all 'allowed-tools: Read Grep Bash(ls *)' 'disable-model-invocation: true' 'context: fork'
out="$(lint "$tmp/ok-all/SKILL.md")"; rc=$?
check "L1 the linter accepts all three keys" "$rc" "$out"
mkfix bad-dmi 'disable-model-invocation: maybe'
out="$(lint "$tmp/bad-dmi/SKILL.md")"; rc=$?
check "L2 a non-boolean disable-model-invocation is rejected" "$([ "$rc" -ne 0 ] && has "$out" disable-model-invocation; echo $?)" "$out"
mkfix bad-ctx 'context: banana'
out="$(lint "$tmp/bad-ctx/SKILL.md")"; rc=$?
check "L3 a context other than fork is rejected" "$([ "$rc" -ne 0 ] && has "$out" context; echo $?)" "$out"
mkfix bad-tools 'allowed-tools:'
out="$(lint "$tmp/bad-tools/SKILL.md")"; rc=$?
check "L4 an empty allowed-tools is rejected" "$([ "$rc" -ne 0 ] && has "$out" allowed-tools; echo $?)" "$out"

# --- the three skills -------------------------------------------------------
RI="$here/skills/repo-inventory/SKILL.md"
tools="$(key_of "$RI" allowed-tools)"
ro=0
[ -n "$tools" ] || ro=1
# Pre-approves only read tools and the inventory script (allowed-tools does not
# restrict other tools). Each Bash scope must be exactly the script, relative
# (as SKILL.md runs it) or by its installed path.
scopes="$(printf '%s' "$tools" | grep -oE 'Bash\([^)]*\)')"
while IFS= read -r sc; do
  [ -n "$sc" ] || continue
  printf '%s' "$sc" | grep -qE '^Bash\(python3 (\*/repo-inventory/)?scripts/repo_inventory\.py \*\)$' || ro=1
done <<< "$scopes"
rest="$(printf '%s' "$tools" | sed -E 's/Bash\([^)]*\)//g')"
for t in $rest; do
  case "$t" in Read|Grep|Glob) ;; *) ro=1 ;; esac
done
has "$tools" 'Bash(python3 scripts/repo_inventory.py *)' || ro=1
check "K1 repo-inventory pre-approves only read tools and the inventory script" "$ro" "allowed-tools: $tools"
for s in unattended-ops vault-secrets; do
  f="$here/skills/$s/SKILL.md"
  check "K2 $s has disable-model-invocation: true" "$([ "$(key_of "$f" disable-model-invocation)" = true ]; echo $?)"
  check "K3 $s description still names /$s" "$(has "$(key_of "$f" description)" "/$s"; echo $?)"
done
for s in ansible-ops design-flow mod-dev project-migration project-workflow; do
  check "K4 $s carries none of the three keys" "$(grep -qE '^(allowed-tools|disable-model-invocation|context):' "$here/skills/$s/SKILL.md"; [ $? -eq 1 ]; echo $?)"
done
check "K5 no skill sets context: fork (none fits, ADR-0060)" "$(grep -lE '^context:' "$here"/skills/*/SKILL.md >/dev/null 2>&1; [ $? -eq 1 ]; echo $?)"

# --- the ports --------------------------------------------------------------
export HOME="$tmp/home"
# install.sh sets core.hooksPath in the repository it runs from, so it runs from
# a throwaway repo holding the real scripts, skills, agents and servers, never
# from this checkout. Real skills are copied in; no link reaches them.
R="$tmp/repo"; mkdir -p "$R"
for d in scripts skills agents mcp-servers mods configs; do
  [ -d "$here/$d" ] && cp -r "$here/$d" "$R/$d"
done
( cd "$R" && git init -q . ) >/dev/null 2>&1
mkdir -p "$HOME/.claude" "$HOME/.config/opencode" "$HOME/.codex"
n=0; for d in "$here"/skills/*/; do
  case "$(basename "$d")" in _template*) continue ;; esac
  [ -f "$d/SKILL.md" ] && n=$((n + 1))
done
check "P0 the repo has 8 non-template skills" "$([ "$n" -eq 8 ]; echo $?)" "$n"
out="$(cd "$R" && bash scripts/install.sh copy --client opencode 2>&1)"; rc=$?
OS="$HOME/.config/opencode/skills"
loaded=0
for d in "$OS"/*/; do
  f="$d/SKILL.md"
  [ -f "$f" ] && [ "$(key_of "$f" name)" = "$(basename "$d")" ] && loaded=$((loaded + 1))
done
check "P1 OpenCode loads 8 skills" "$([ "$rc" -eq 0 ] && [ "$loaded" -eq 8 ]; echo $?)" "rc=$rc loaded=$loaded $out"
check "P2 OpenCode's copies carry none of the Claude-only keys" "$(grep -lE '^(allowed-tools|disable-model-invocation|context):' "$OS"/*/SKILL.md >/dev/null 2>&1; [ $? -eq 1 ]; echo $?)"
check "P3 the stripped copies keep name, description and body" "$([ "$(key_of "$OS/vault-secrets/SKILL.md" name)" = vault-secrets ] && [ "$(key_of "$OS/vault-secrets/SKILL.md" description)" = "$(key_of "$here/skills/vault-secrets/SKILL.md" description)" ] && cmp -s <(sed '1,/^---$/d' "$here/skills/vault-secrets/SKILL.md") <(sed '1,/^---$/d' "$OS/vault-secrets/SKILL.md"); echo $?)"
check "P4 the source skills are untouched by the install" "$(grep -q '^disable-model-invocation: true' "$here/skills/vault-secrets/SKILL.md"; echo $?)"
out="$(cd "$R" && bash scripts/install.sh --client claude-code 2>&1)"; rc=$?
CSK="$HOME/.claude/skills/vault-secrets/SKILL.md"
check "P5 Claude Code keeps the keys (a link to the source)" "$([ "$rc" -eq 0 ] && grep -q '^disable-model-invocation: true' "$CSK"; echo $?)" "$out"
out="$(cd "$R" && bash scripts/install.sh --client codex 2>&1)"; rc=$?
# Codex (TASK-0281): the 8 skills under ~/.agents/skills, the folder Codex
# scans, stripped like OpenCode's; a hand-invoked skill keeps that state
# through agents/openai.yaml, Codex's own switch.
AS="$HOME/.agents/skills"
loaded=0
for d in "$AS"/*/; do
  f="$d/SKILL.md"
  [ -f "$f" ] && [ "$(key_of "$f" name)" = "$(basename "$d")" ] && loaded=$((loaded + 1))
done
check "P6 Codex loads 8 skills from ~/.agents/skills" "$([ "$rc" -eq 0 ] && [ "$loaded" -eq 8 ] && [ ! -e "$HOME/.codex/skills" ]; echo $?)" "rc=$rc loaded=$loaded $out"
check "P7 Codex's copies carry none of the Claude-only keys" "$(grep -lE '^(allowed-tools|disable-model-invocation|context):' "$AS"/*/SKILL.md >/dev/null 2>&1; [ $? -eq 1 ]; echo $?)"
hand="$(grep -l '^disable-model-invocation:[[:space:]]*true' "$here"/skills/*/SKILL.md | xargs -n1 dirname | xargs -n1 basename | sort | tr '\n' ' ')"
pol="$(for f in "$AS"/*/agents/openai.yaml; do [ -f "$f" ] && grep -q 'allow_implicit_invocation: false' "$f" && basename "$(dirname "$(dirname "$f")")"; done | sort | tr '\n' ' ')"
check "P8 exactly the hand-invoked skills ($hand) carry allow_implicit_invocation: false" "$([ -n "$hand" ] && [ "$pol" = "$hand" ]; echo $?)" "policy on: $pol"

if [ "$fails" -ne 0 ]; then
  echo "test-skill-controls.sh: $fails of $cases case(s) FAILED"; exit 1
fi
echo "test-skill-controls.sh: OK ($cases cases)"
