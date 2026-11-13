#!/usr/bin/env bash
# Prove every check and script that reads the planning layout accepts BOTH the
# old one and ADR-0066's numbered one (TASK-0298), so the one-commit rename
# lands green and TASK-0300 can drop the old half later.
#
# Builds two small fixtures from the same generated artifacts: the old layout
# (`.ai/tasks/TASK-NNNN-*.md`, `planning/BACKLOG.md`, `context/*`) and the same
# content converted BY HAND to the new one (`tasks/S###.T###_Name.md`,
# `35.AD_HOC_TASKS.md`, `10.CURRENT_STATE.md`, `.ai/id-map.tsv`, tables under
# `docs/development/`). Nothing here reads this repository's own `.ai/`, so the
# test outlives the rename. The layout is detected by what exists
# (`.ai/00.CONVENTIONS.md`), never by a flag.
#
# For each changed check it asserts: green on the old fixture, green on the new
# one, and red on a seeded defect in each (a check that cannot fail is worse
# than none). Hermetic: a mktemp tree, local git only. tests/validate.sh runs it.
#
# WHAT THIS PROVES: the five governance checks in tests/check-planning.py, the
# backlog check, the emitter's table paths, sync-templates.sh and worktree.sh
# read either layout. WHAT IT DOES NOT PROVE: that this repository, once
# renamed, is green -- that is TASK-0299's run of tests/validate.sh.
#
# Red proof of the change: point the overrides at the pre-change files, e.g.
#   WORKTREE_SH=/path/old/worktree.sh BACKLOG_PY=/path/old/check-backlog-closures.py \
#   EMIT_PY=/path/old/emit-agents.py SYNC_SH=/path/old/sync-templates.sh \
#   PLANNING_PY=/path/old/check-planning.py tests/test-layout-both.sh
set -uo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
cd "$here" || exit 1
export PYTHONUTF8=1 GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

PLANNING_PY="${PLANNING_PY:-$here/tests/check-planning.py}"
BACKLOG_PY="${BACKLOG_PY:-$here/scripts/check-backlog-closures.py}"
EMIT_PY="${EMIT_PY:-$here/scripts/emit-agents.py}"
SYNC_SH="${SYNC_SH:-$here/scripts/sync-templates.sh}"
WORKTREE_SH="${WORKTREE_SH:-$here/scripts/worktree.sh}"

T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
# A path native Python can open too (Git Bash's /tmp is not one).
T="$(cd "$T" && { pwd -W 2>/dev/null || pwd; })"

fails=0; cases=0
check() {  # check <name> <exit-status-of-the-condition> [detail]
  cases=$((cases + 1))
  if [ "$2" -eq 0 ]; then echo "PASS $1"; else echo "FAIL $1${3:+ -- $3}"; fails=$((fails + 1)); fi
}
passes() { "$@" >"$T/out" 2>&1; local rc=$?; OUT="$(cat "$T/out")"; return $rc; }
has() { [[ "$OUT" == *"$1"* ]]; }

# --- the generated artifacts both layouts share -----------------------------
P="$T/pool"; mkdir -p "$P"
PM=skills/project-migration; PW=skills/project-workflow
gen() {  # gen <skill> <out> <args...>
  local skill="$1" out="$2"; shift 2
  bash "$here/skills/$skill/scripts/new-artifact.sh" --date 2026-11-13 --out "$P/$out" "$@" >/dev/null 2>&1 \
    || { echo "FAIL could not generate $out"; exit 1; }
}
gen project-migration task-v1.md --schema "$here/tests/legacy-schemas/task-v1.md" --id TASK-0100 --title Legacy
gen project-migration task-v2.md --kind task --framework project-migration --id TASK-0200 --title Current
gen project-migration task-tpl.md --kind task --framework project-migration --template
gen project-migration adr-v1.md --schema "$here/tests/legacy-schemas/adr-v1.md" --id ADR-0013 --title Old
gen project-migration adr-v2.md --kind adr --framework project-migration --id ADR-0050 --title New
gen project-migration review.md --kind review --framework project-migration --id REVIEW-0001 --title Rev
gen project-migration session.md --kind session --framework project-migration --id 2026-11-13 --title Sess
gen project-workflow wtask.md --kind task --framework project-workflow --id S012.T002_Fresh --sprint S012_Fresh
gen project-workflow wreview.md --kind review --framework project-workflow --id S012-checkpoint
# A generated skeleton carries FILL markers, which the schema check rejects;
# these stand-ins are "filled" by dropping the markers (shape, not content).
python3 - "$P" <<'PY'
import glob, os, re, sys
for f in glob.glob(os.path.join(sys.argv[1], "*.md")):
    if f.endswith("task-tpl.md"):
        continue                       # the template keeps its markers
    s = open(f, encoding="utf-8").read()
    s = re.sub(r"<!-- FILL:.*?-->\n?", "", s, flags=re.S)
    open(f, "w", encoding="utf-8", newline="\n").write(s)
PY
# The two closers a backlog entry may cite must read as finished.
sed -i 's/^- Status: planned/- Status: done/' "$P/task-v1.md" "$P/task-v2.md"
sed -i 's/^\*\*Status\*\*: not started/**Status**: completed/' "$P/wtask.md"
printf '# junk\nnot a contract brief, and below the boundary\n' > "$P/junk.md"

RISK='Last reviewed: 2026-11-13

| ID | a | b | c | d | e | f | g | h | Status |
|----|---|---|---|---|---|---|---|---|--------|
| R-01 | x | x | x | x | x | x | x | x | open |'
TIERS='| opus | critic |
| sonnet | implementer |'
TURNS='| implementer | 250 | - |'
BACKLOG_COLS="$(sed -n 's/^columns: //p' "$here/$PM/schemas/backlog.md" | tr -d '\r')"
bl_sep="$(printf '%s' "$BACKLOG_COLS" | sed 's/[^|]/-/g')"

cp_to() { mkdir -p "$(dirname "$2")"; cp "$P/$1" "$2"; }   # cp_to <pool file> <dest>

mkold() {  # the old layout, in $1
  local d="$1"
  cp_to task-tpl.md "$d/.ai/templates/TASK.md"
  cp_to junk.md "$d/.ai/tasks/TASK-0010-pre.md"
  cp_to task-v1.md "$d/.ai/tasks/TASK-0100-legacy.md"
  cp_to task-v2.md "$d/.ai/tasks/TASK-0200-current.md"
  printf -- '- [x] TASK-0200\n' > "$d/.ai/tasks/TODO.md"
  cp_to adr-v1.md "$d/.ai/decisions/0013-old.md"
  cp_to adr-v2.md "$d/.ai/decisions/0050-new.md"
  cp_to review.md "$d/.ai/reviews/REVIEW-0001-rev.md"
  cp_to junk.md "$d/.ai/reviews/REVIEW-0012-odd.md"
  cp_to session.md "$d/.ai/sessions/2026-11-13-sess.md"
  mkdir -p "$d/.ai/context" "$d/.ai/planning" "$d/AGENTS.md.d"
  printf '# State\n' > "$d/.ai/context/CURRENT_STATE.md"
  printf '%s\n' "$RISK" > "$d/.ai/context/risk-register.md"
  printf '%s\n' "$TIERS" > "$d/.ai/context/model-tiers.md"
  printf '%s\n' "$TURNS" > "$d/.ai/context/turn-limits.md"
  printf '# Sprint\n' > "$d/.ai/planning/SPRINT-CURRENT.md"
  { echo "# Backlog"; echo
    echo "| $BACKLOG_COLS |"; echo "|$bl_sep|"
    echo "| B-001 | Closed one | low | low | none | low | **done** | Closed 2026-11-13 by \`TASK-0200\`. |"
    echo "| B-002 | Open one | low | low | none | low | **ready** | When asked. |"
    echo; echo "**One item is open**, counted from the Status column."; } > "$d/.ai/planning/BACKLOG.md"
  rmdir "$d/AGENTS.md.d"
}

mknew() {  # the SAME content in the numbered layout, converted by hand, in $1
  local d="$1"
  mkdir -p "$d/.ai" "$d/docs/development"
  printf '# Conventions\n' > "$d/.ai/00.CONVENTIONS.md"
  cp_to junk.md "$d/.ai/tasks/S001.T010_Pre.md"
  cp_to task-v1.md "$d/.ai/tasks/S006.T001_Legacy.md"
  cp_to task-v2.md "$d/.ai/tasks/S012.T001_Current.md"
  cp_to wtask.md "$d/.ai/tasks/S012.T002_Fresh.md"      # written after the rename: unmapped
  cp_to adr-v1.md "$d/.ai/decisions/ADR-0013-old.md"
  cp_to adr-v2.md "$d/.ai/decisions/ADR-0050-new.md"
  cp_to review.md "$d/.ai/reviews/2026-09-01-rev.md"
  cp_to junk.md "$d/.ai/reviews/2026-09-02-odd.md"
  cp_to wreview.md "$d/.ai/reviews/S012-checkpoint.md"
  cp_to session.md "$d/.ai/sessions/2026-11-13-sess.md"
  printf '# State\n' > "$d/.ai/10.CURRENT_STATE.md"
  printf '# Plan\n' > "$d/.ai/20.PLAN.md"
  printf '%s\n' "$RISK" > "$d/.ai/40.RISK_REGISTER.md"
  printf '%s\n' "$TIERS" > "$d/docs/development/model-tiers.md"
  printf '%s\n' "$TURNS" > "$d/docs/development/turn-limits.md"
  printf 'old_id\tnew_id\told_path\tnew_path\n' > "$d/.ai/id-map.tsv"
  while IFS='|' read -r o n op np; do
    printf '%s\t%s\t%s\t%s\n' "$o" "$n" "$op" "$np" >> "$d/.ai/id-map.tsv"
  done <<'MAP'
TASK-0010|S001.T010|.ai/tasks/TASK-0010-pre.md|.ai/tasks/S001.T010_Pre.md
TASK-0100|S006.T001|.ai/tasks/TASK-0100-legacy.md|.ai/tasks/S006.T001_Legacy.md
TASK-0200|S012.T001|.ai/tasks/TASK-0200-current.md|.ai/tasks/S012.T001_Current.md
REVIEW-0001|2026-09-01-rev|.ai/reviews/REVIEW-0001-rev.md|.ai/reviews/2026-09-01-rev.md
REVIEW-0012|2026-09-02-odd|.ai/reviews/REVIEW-0012-odd.md|.ai/reviews/2026-09-02-odd.md
MAP
  { echo "# Ad-Hoc Tasks"; echo; echo "## Open"; echo
    echo "### 2. Open one"; echo; echo "**Found during**: \`S012.T001_Current\`."; echo
    echo "## Resolved"; echo
    echo "### 1. Closed one"; echo; echo "Closed 2026-11-13 by \`S012.T002\`."; echo
    echo "### 3. Closed by an old id"; echo; echo "Closed 2026-11-13 by \`TASK-0200\`."; } > "$d/.ai/35.AD_HOC_TASKS.md"
}

OLD="$T/old"; NEW="$T/new"
mkold "$OLD"; mknew "$NEW"

planning() { passes python3 "$PLANNING_PY" "$1" --root "$2"; }

# --- P: the governance checks of tests/validate.sh (tests/check-planning.py) --
for layout in old new; do
  d="$T/$layout"
  for c in handover live risk idmap groups; do
    planning $c "$d"; check "P1 $layout layout: $c passes" $? "$OUT"
  done
done

# Seeded defects, each caught in each layout. A brief at the contract boundary
# loses its Outputs section, an over-budget live file, a malformed risk row, a
# stray task name, an unreadable id map row, a brief that breaks its schema.
for layout in old new; do
  d="$T/$layout"; rm -rf "$T/x"; cp -r "$d" "$T/x"
  if [ $layout = old ]; then cur=.ai/tasks/TASK-0200-current.md; state=.ai/context/CURRENT_STATE.md
    risk=.ai/context/risk-register.md; v1=.ai/tasks/TASK-0100-legacy.md
  else cur=.ai/tasks/S012.T001_Current.md; state=.ai/10.CURRENT_STATE.md
    risk=.ai/40.RISK_REGISTER.md; v1=.ai/tasks/S006.T001_Legacy.md; fi
  sed -i '/^## Outputs \/ handover$/d' "$T/x/$cur"
  planning handover "$T/x"; check "P2 $layout: a brief without its Outputs section fails the handover check" \
    "$([ $? -ne 0 ] && has "missing '## Outputs / handover'"; echo $?)" "$OUT"
  rm -rf "$T/x"; cp -r "$d" "$T/x"
  seq 1 201 > "$T/x/$state"
  planning live "$T/x"; check "P3 $layout: a CURRENT_STATE over 200 lines fails the budget" \
    "$([ $? -ne 0 ] && has "over its budget of 200"; echo $?)" "$OUT"
  rm -rf "$T/x"; cp -r "$d" "$T/x"
  echo '| R-02 | short |' >> "$T/x/$risk"
  planning risk "$T/x"; check "P4 $layout: a malformed risk row fails" \
    "$([ $? -ne 0 ] && has "malformed row"; echo $?)" "$OUT"
  rm -rf "$T/x"; cp -r "$d" "$T/x"
  printf '# x\n' > "$T/x/.ai/tasks/notes.md"
  planning handover "$T/x"; check "P5 $layout: a task file named neither way is reported, never skipped" \
    "$([ $? -ne 0 ] && has "cannot be checked"; echo $?)" "$OUT"
  rm -rf "$T/x"; cp -r "$d" "$T/x"
  printf '\n## Surprise heading, a v1 brief has no such section\n## Another\n' >> "$T/x/$v1"
  sed -i 's/^## Status$/## Statuz/' "$T/x/$v1"
  planning groups "$T/x"; check "P6 $layout: a brief that breaks its schema fails the schema check" $([ $? -ne 0 ]; echo $?) "$OUT"
done

# The renamed v1 brief keeps its boundary through the id map: with the map row
# gone, S006.T001 reads as new work and is held to the current schema.
rm -rf "$T/x"; cp -r "$NEW" "$T/x"; sed -i '/^TASK-0100\t/d' "$T/x/.ai/id-map.tsv"
planning groups "$T/x"; check "P7 new layout: a renamed v1 brief keyed by the id map; without its row it is held to the current schema" \
  $([ $? -ne 0 ]; echo $?) "$OUT"
rm -rf "$T/x"; cp -r "$NEW" "$T/x"; printf 'TASK-0300\tS012.T003\t.ai/tasks/TASK-0300-x.md\t.ai/tasks/S012.T003_Gone.md\n' >> "$T/x/.ai/id-map.tsv"
planning idmap "$T/x"; check "P8 new layout: an id-map row whose new file is missing fails" \
  "$([ $? -ne 0 ] && has "does not exist"; echo $?)" "$OUT"
rm -rf "$T/x"; cp -r "$NEW" "$T/x"; rm "$T/x/.ai/id-map.tsv"
planning idmap "$T/x"; check "P9 new layout: a missing id map fails" $([ $? -ne 0 ]; echo $?) "$OUT"

# --- B: scripts/check-backlog-closures.py ------------------------------------
for layout in old new; do
  passes python3 "$BACKLOG_PY" "$T/$layout"; check "B1 $layout layout: the backlog check passes" $? "$OUT"
done
rm -rf "$T/x"; cp -r "$OLD" "$T/x"
sed -i 's#by `TASK-0200`#by `TASK-0999`#' "$T/x/.ai/planning/BACKLOG.md"
passes python3 "$BACKLOG_PY" "$T/x"; check "B2 old layout: a closer with no file fails" "$([ $? -ne 0 ] && has "no file"; echo $?)" "$OUT"
rm -rf "$T/x"; cp -r "$NEW" "$T/x"
sed -i 's#by `S012.T002`#by `S012.T999`#' "$T/x/.ai/35.AD_HOC_TASKS.md"
passes python3 "$BACKLOG_PY" "$T/x"; check "B2 new layout: a closer with no file fails" "$([ $? -ne 0 ] && has "no file"; echo $?)" "$OUT"
rm -rf "$T/x"; cp -r "$NEW" "$T/x"
sed -i 's/^\*\*Status\*\*: completed/**Status**: not started/' "$T/x/.ai/tasks/S012.T002_Fresh.md"
passes python3 "$BACKLOG_PY" "$T/x"; check "B3 new layout: a closer still open fails" "$([ $? -ne 0 ] && has "Status reads"; echo $?)" "$OUT"
rm -rf "$T/x"; cp -r "$NEW" "$T/x"
printf '\n### 4. Unexercised: a\n### 5. Unexercised: b\n### 6. Unexercised: c\n### 7. Unexercised: d\n' > "$T/x/open.tmp"
sed -i '/^## Resolved$/e cat '"$T"'/x/open.tmp' "$T/x/.ai/35.AD_HOC_TASKS.md"
passes python3 "$BACKLOG_PY" "$T/x"; check "B4 new layout: more than 3 open Unexercised entries fail the cap" "$([ $? -ne 0 ] && has "cap of 3"; echo $?)" "$OUT"

# --- E: the emitter reads the tier and turn tables where the layout puts them -
emit_probe() {  # emit_probe <root>: prints "tier turns" for critic / implementer
  (cd "$1" && python3 - "$EMIT_PY" <<'PY'
import importlib.util, sys
spec = importlib.util.spec_from_file_location("emit_agents", sys.argv[1])
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
print(m.model_alias("critic"), m.model_alias("implementer"), m.turn_limits("implementer"))
PY
  )
}
for layout in old new; do
  OUT="$(emit_probe "$T/$layout" 2>&1)"
  check "E1 $layout layout: the emitter reads the tier and turn tables" \
    "$([ "$OUT" = "opus sonnet [('maxTurns', '250')]" ]; echo $?)" "$OUT"
done

# --- S: scripts/sync-templates.sh --------------------------------------------
# A copy of the script and the two skills it renders from, rooted in a fixture.
mksync() {  # mksync <layout>: a repo root whose .ai/ is that layout's marker
  local r="$T/sync-$1"
  mkdir -p "$r/scripts" "$r/skills" "$r/.ai"
  cp "$SYNC_SH" "$r/scripts/sync-templates.sh"
  cp -r "$here/$PW" "$here/$PM" "$r/skills/"
  [ "$1" = new ] && printf '# Conventions\n' > "$r/.ai/00.CONVENTIONS.md"
  echo "$r"
}
for layout in old new; do
  r="$(mksync $layout)"
  passes bash -c "cd '$r' && bash scripts/sync-templates.sh"; check "S1 $layout layout: sync-templates writes without error" $? "$OUT"
  passes bash -c "cd '$r' && bash scripts/sync-templates.sh --check"; check "S2 $layout layout: sync-templates --check passes" $? "$OUT"
  if [ $layout = old ]; then
    check "S3 old layout: .ai/templates/TASK.md is generated" "$([ -f "$r/.ai/templates/TASK.md" ]; echo $?)"
  else
    check "S3 new layout: no .ai/templates/ is created (retired)" "$([ ! -e "$r/.ai/templates" ]; echo $?)"
  fi
  echo stale >> "$r/skills/project-workflow/templates/tasks/0000_TEMPLATE.md"
  passes bash -c "cd '$r' && bash scripts/sync-templates.sh --check"; check "S4 $layout layout: a drifted template still fails --check" $([ $? -ne 0 ]; echo $?) "$OUT"
done

# --- W: scripts/worktree.sh takes S###.T### and TASK-nnnn ---------------------
git init -q -b master "$T/repo"
( cd "$T/repo" && mkdir scripts && cp "$WORKTREE_SH" scripts/worktree.sh && chmod +x scripts/worktree.sh \
  && git add -A && git commit -qm init )
wt="$T/repo-worktrees"
export WORKTREE_SKIP_GATE=1
for id in S012.T001 TASK-0299; do
  passes bash -c "cd '$T/repo' && scripts/worktree.sh add $id"
  rc=$?
  check "W1 add $id creates branch agent/$id and a sibling worktree" \
    "$( [ $rc -eq 0 ] && (cd "$T/repo" && git show-ref --verify --quiet "refs/heads/agent/$id") && [ -d "$wt/$id" ]; echo $?)" "$OUT"
  check "W2 add $id is a task branch: no free-name note" "$(! has 'not a task branch'; echo $?)" "$OUT"
done

echo "test-layout-both.sh: $cases cases, $fails failed"
[ "$fails" -eq 0 ]
