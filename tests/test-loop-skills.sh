#!/usr/bin/env bash
# Loop skills: five thin wrappers, one per loop (TASK-0273, P1.3).
#
# WHAT THIS PROVES: each of the five loops has loops/<n>/SKILL.md named run-<n>
# that passes the skill linter, sets disable-model-invocation: true, carries an
# argument-hint, links loop.md as the single source and stays short with no rule
# keyword (a wrapper that restates a rule is a second copy); the registry lists
# them; the skills plugin carries each beside its loop.md; and deleting a wrapper
# or adding a rule makes the audit fail (a fixture copy, never the real files).
# WHAT IT DOES NOT PROVE: that a model follows loop.md when the skill is invoked.
#
# Usage: tests/test-loop-skills.sh
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
LOOPS="ansible-change design-brief project-build release-check unattended-run"
MAXLINES=20
RULE_WORDS='\b(must|never|always|do not|don.t|shall|required)\b'

# audit <root>: print one problem per line for the loop skills under <root>.
audit() {
  local root="$1" n f
  for n in $LOOPS; do
    f="$root/loops/$n/SKILL.md"
    if [ ! -f "$f" ]; then echo "$n: loops/$n/SKILL.md is missing"; continue; fi
    python3 "$here/scripts/check-skill-frontmatter.py" "$f" "run-$n" >/dev/null 2>&1 \
      || echo "$n: the frontmatter does not pass the linter as run-$n"
    grep -q '^disable-model-invocation: true' "$f" || echo "$n: disable-model-invocation: true is missing"
    grep -q '^argument-hint: ' "$f" || echo "$n: argument-hint is missing"
    grep -q 'loop\.md' "$f" || echo "$n: does not link loop.md"
    [ "$(wc -l < "$f")" -le "$MAXLINES" ] || echo "$n: longer than $MAXLINES lines"
    if awk 'NR==1&&/^---/{fm=1;next} fm&&/^---/{fm=0;next} !fm' "$f" | grep -qiE "$RULE_WORDS"; then
      echo "$n: the body holds a rule keyword"
    fi
  done
  return 0
}

out="$(audit "$here")"
check "W1 five loop skills pass the audit" "$([ -z "$out" ]; echo $?)" "$out"

# The registry lists them (a derived file: render and compare to the committed one).
reg="$tmp/registry.md"
(cd "$here" && REGISTRY_OUT="$reg" bash scripts/sync-registry.sh >/dev/null 2>&1)
miss=""
for n in $LOOPS; do grep -q "^| run-$n | .*| loops/$n |" "$reg" || miss="$miss run-$n"; done
check "W2 the registry lists the five loop skills" "$([ -z "$miss" ]; echo $?)" "missing:$miss"
check "W3 docs/registry.md is current" "$(cmp -s <(tr -d '\r' < "$reg") <(tr -d '\r' < "$here/docs/registry.md"); echo $?)"
check "W4 loop skills are not in the Skills section (8 skills stay 8)" "$(sed -n '/^## Skills/,/^## MCP/p' "$reg" | grep -q '^| run-'; [ $? -eq 1 ]; echo $?)"

# The skills plugin carries each beside its loop.md.
pb="$tmp/built"
python3 "$here/scripts/build-plugin.py" --out "$pb" >/dev/null 2>&1
miss=""
for n in $LOOPS; do
  d="$pb/ai-toolbox-skills/skills/run-$n"
  { [ -f "$d/SKILL.md" ] && [ -f "$d/loop.md" ]; } || miss="$miss run-$n"
done
check "W5 the skills plugin holds each wrapper beside its loop.md" "$([ -z "$miss" ]; echo $?)" "missing:$miss"
# A loop.md that cites the untrusted-content rules carries a copy, and each
# wrapper names the command a plugin skill answers to (TASK-0273 review).
miss=""
for n in $LOOPS; do
  d="$pb/ai-toolbox-skills/skills/run-$n"
  if grep -q 'docs/security/untrusted-content.md' "$here/loops/$n/loop.md"; then
    cmp -s <(tr -d '\r' < "$d/untrusted-content.md" 2>/dev/null) <(tr -d '\r' < "$here/docs/security/untrusted-content.md") || miss="$miss run-$n"
  fi
  grep -q "Invoke with /ai-toolbox-skills:run-$n\." "$here/loops/$n/SKILL.md" || miss="$miss $n(command)"
done
check "W5b each wrapper names /ai-toolbox-skills:run-<loop> and carries untrusted-content.md where cited" "$([ -z "$miss" ]; echo $?)" "missing:$miss"

# Red proofs on a fixture copy.
fx="$tmp/fx"; mkdir -p "$fx"; cp -r "$here/loops" "$fx/loops"
rm -f "$fx/loops/release-check/SKILL.md"
out="$(audit "$fx")"
check "W6 deleting a wrapper fails the audit" "$([[ "$out" == *release-check* ]]; echo $?)" "$out"
cp "$here/loops/release-check/SKILL.md" "$fx/loops/release-check/SKILL.md" 2>/dev/null
printf 'You must always run the gate twice.\n' >> "$fx/loops/release-check/SKILL.md"
out="$(audit "$fx")"
check "W7 a restated rule fails the audit" "$([[ "$out" == *"rule keyword"* ]]; echo $?)" "$out"
cp "$here/loops/release-check/SKILL.md" "$fx/loops/release-check/SKILL.md"
sed -i '/^disable-model-invocation/d' "$fx/loops/release-check/SKILL.md"
out="$(audit "$fx")"
check "W8 a wrapper without disable-model-invocation fails the audit" "$([[ "$out" == *disable-model-invocation* ]]; echo $?)" "$out"
cp "$here/loops/release-check/SKILL.md" "$fx/loops/release-check/SKILL.md"
check "W9 the restored wrapper passes again" "$([ -z "$(audit "$fx")" ]; echo $?)"

if [ "$fails" -ne 0 ]; then echo "test-loop-skills.sh: $fails of $cases case(s) FAILED"; exit 1; fi
echo "test-loop-skills.sh: OK ($cases cases)"
