#!/usr/bin/env bash
# Prove ai-project-scaffold.sh writes project-workflow's one convention
# (ADR-0066, S017.T008) and stays idempotent.
#
# Every case runs under mktemp, offline, with --no-git; it touches nothing in
# the repository it is run from. Hermetic and a few seconds, so
# tests/validate.sh runs it.
#
# WHAT THIS PROVES: on an empty directory a files scaffold writes the numbered
# files, decisions/, tasks/, reviews/, sessions/ and reference/ and none of the
# retired paths; its numbered files are byte-identical to project-workflow's
# templates (it reads them, never carries a second copy: ADR-0027); the
# decision it writes passes project-workflow's schema; its AGENTS.md names no
# retired path or id scheme; a second --force run changes not one byte and exits
# 0; a forge scaffold writes tracker.conf that project-workflow's tracker.sh
# reads, the forge variant of 20.PLAN.md and no files-owned path.
# WHAT IT DOES NOT PROVE: that the generated files read well, or a scaffold
# into a repository that already has content (an additive --force there is
# covered only by the idempotence case).
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SKILL="$(dirname "$HERE")"
SCAFFOLD="$HERE/ai-project-scaffold.sh"
PW="$(dirname "$SKILL")/project-workflow"
TPL="$PW/templates"

T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT

fails=0
ok()   { echo "  ok   $1"; }
fail() { echo "FAIL   $1${2:+ -- $2}"; fails=$((fails + 1)); }
check() { if [ "$2" -eq 0 ]; then ok "$1"; else fail "$1" "${3:-}"; fi; }

# A content hash of every file, so "unchanged" means every byte.
snapshot() { (cd "$1" && find . -type f -not -path './.git/*' | LC_ALL=C sort | xargs sha256sum); }

# ---- files tracker, empty directory ---------------------------------------------
F="$T/files"; mkdir "$F"
bash "$SCAFFOLD" "$F" --no-git >"$T/out" 2>&1
check "files scaffold into an empty directory exits 0" $? "$(tail -3 "$T/out")"

for p in .ai/00.CONVENTIONS.md .ai/10.CURRENT_STATE.md .ai/20.PLAN.md .ai/30.ROADMAP.md \
         .ai/35.AD_HOC_TASKS.md .ai/40.RISK_REGISTER.md .ai/decisions .ai/tasks \
         .ai/reviews .ai/sessions .ai/reference tracker.conf AGENTS.md CLAUDE.md; do
  check "files scaffold writes $p" "$([ -e "$F/$p" ]; echo $?)"
done
for p in TODO.md .ai/planning .ai/context .ai/templates .ai/tasks/TODO.md .ai/README.md; do
  check "files scaffold does not write $p" "$([ ! -e "$F/$p" ]; echo $?)"
done
check "files scaffold writes the first ADR with its prefix" \
  "$([ -f "$F/.ai/decisions/ADR-0001-repo-structure.md" ]; echo $?)"

# Read from the one owner, never carried: each numbered file equals its template.
for n in 00.CONVENTIONS 10.CURRENT_STATE 20.PLAN 30.ROADMAP 35.AD_HOC_TASKS 40.RISK_REGISTER; do
  cmp -s "$TPL/$n.md" "$F/.ai/$n.md"
  check "$n.md is project-workflow's template, byte for byte" $?
done
cmp -s "$TPL/reference/tracker.md" "$F/.ai/reference/tracker.md"
check "reference/ is project-workflow's, byte for byte" $?

# The decision it writes meets the schema project-workflow owns.
bash "$PW/scripts/check-artifact.sh" "$F/.ai/decisions/ADR-0001-repo-structure.md" --kind adr >"$T/adr" 2>&1
check "ADR-0001 passes project-workflow's adr schema" $? "$(head -3 "$T/adr")"

# No retired path or id scheme in what an agent reads first.
bad="$(grep -nE '\.ai/(context|planning|templates)|TASK-NNNN|TASK-0001|SPRINT-CURRENT|BACKLOG\.md|TODO\.md' \
        "$F/AGENTS.md" "$F/README.md" "$F"/.ai/decisions/*.md 2>/dev/null || true)"
check "AGENTS.md, README.md and ADR-0001 name no retired path or id scheme" "$([ -z "$bad" ]; echo $?)" "$bad"
check "tracker.sh reads the files scaffold as files" \
  "$([ "$(bash "$PW/scripts/tracker.sh" check --repo "$F" 2>&1)" = files ]; echo $?)"

# ---- idempotence --------------------------------------------------------------------
snapshot "$F" >"$T/snap1"
bash "$SCAFFOLD" "$F" --no-git --force >"$T/out2" 2>&1
check "a second --force run exits 0" $? "$(tail -3 "$T/out2")"
snapshot "$F" >"$T/snap2"
cmp -s "$T/snap1" "$T/snap2"
check "a second run changes not one byte" $? "$(diff "$T/snap1" "$T/snap2" | head -5)"
bash "$SCAFFOLD" "$F" --no-git >/dev/null 2>&1
check "a run without --force refuses a non-empty directory" "$([ $? -ne 0 ]; echo $?)"

# An existing repository keeps its own files: additive, never overwriting.
E="$T/existing"; mkdir -p "$E/.ai"
printf 'mine\n' > "$E/AGENTS.md"; printf 'mine\n' > "$E/.ai/10.CURRENT_STATE.md"
bash "$SCAFFOLD" "$E" --no-git --force >/dev/null 2>&1
check "--force adds around existing files without overwriting" \
  "$([ "$(cat "$E/AGENTS.md")" = mine ] && [ "$(cat "$E/.ai/10.CURRENT_STATE.md")" = mine ] \
     && [ -f "$E/.ai/20.PLAN.md" ]; echo $?)"

# ---- forge tracker ---------------------------------------------------------------------
G="$T/forge"
bash "$SCAFFOLD" "$G" --no-git --tracker gitlab --gitlab-project grp/sub/app >"$T/outg" 2>&1
check "gitlab scaffold exits 0" $? "$(tail -3 "$T/outg")"
check "tracker.sh reads the forge scaffold as gitlab grp/sub/app" \
  "$([ "$(bash "$PW/scripts/tracker.sh" check --repo "$G" 2>&1)" = "gitlab grp/sub/app" ]; echo $?)"
for p in .ai/00.CONVENTIONS.md .ai/10.CURRENT_STATE.md .ai/20.PLAN.md .ai/40.RISK_REGISTER.md .ai/decisions .ai/reference; do
  check "forge scaffold writes $p" "$([ -e "$G/$p" ]; echo $?)"
done
cmp -s "$TPL/forge/20.PLAN.md" "$G/.ai/20.PLAN.md"
check "forge 20.PLAN.md is project-workflow's forge variant" $?
for p in .ai/tasks .ai/reviews .ai/sessions .ai/30.ROADMAP.md .ai/35.AD_HOC_TASKS.md .ai/planning .ai/context .ai/templates; do
  check "forge scaffold does not write $p" "$([ ! -e "$G/$p" ]; echo $?)"
done

echo
if [ "$fails" -ne 0 ]; then echo "check-scaffold.sh: $fails failed"; exit 1; fi
echo "check-scaffold.sh: all passed"
