#!/usr/bin/env bash
# Prove every check and script that reads the planning layout reads ADR-0066's
# numbered one, and only that one (S017.T005 made them read both; S017.T007
# dropped the old half). This was tests/test-layout-both.sh.
#
# Builds a small new-layout fixture from generated artifacts
# (`tasks/S###.T###_Name.md`, `35.AD_HOC_TASKS.md`, `10.CURRENT_STATE.md`,
# `.ai/id-map.tsv`, tables under `docs/development/`). Nothing here reads this
# repository's own `.ai/`, so the test does not move with it.
#
# For each check it asserts: green on the fixture, red on a seeded defect (a
# check that cannot fail is worse than none), and red on the OLD layout's
# shapes (a stray `.ai/tasks/TASK-0001-x.md`, a `.ai/context/` with no numbered
# files). Hermetic: a mktemp tree, local git only. tests/validate.sh runs it.
#
# WHAT THIS PROVES: the five governance checks in tests/check-planning.py, the
# backlog check, the emitter's table paths, sync-templates.sh and worktree.sh
# read the numbered layout and reject the old one's files. WHAT IT DOES NOT
# PROVE: that this repository's own `.ai/` is green; tests/validate.sh does.
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

# --- the generated artifacts the fixture is built from -----------------------
P="$T/pool"; mkdir -p "$P"
PM=skills/project-migration; PW=skills/project-workflow
gen() {  # gen <skill> <out> <args...>
  local skill="$1" out="$2"; shift 2
  bash "$here/skills/$skill/scripts/new-artifact.sh" --date 2026-11-13 --out "$P/$out" "$@" >/dev/null 2>&1 \
    || { echo "FAIL could not generate $out"; exit 1; }
}
gen project-migration task-v1.md --schema "$here/tests/legacy-schemas/task-v1.md" --id TASK-0100 --title Legacy
gen project-migration task-v2.md --kind task --framework project-migration --id TASK-0200 --title Current
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
    s = open(f, encoding="utf-8").read()
    s = re.sub(r"<!-- FILL:.*?-->\n?", "", s, flags=re.S)
    open(f, "w", encoding="utf-8", newline="\n").write(s)
PY
# The two closers an ad-hoc entry may cite must read as finished.
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

cp_to() { mkdir -p "$(dirname "$2")"; cp "$P/$1" "$2"; }   # cp_to <pool file> <dest>

mknew() {  # the numbered layout, in $1
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

NEW="$T/new"
mknew "$NEW"
fresh() { rm -rf "$T/x"; cp -r "$NEW" "$T/x"; }

planning() { passes python3 "$PLANNING_PY" "$1" --root "$2"; }

# --- P: the governance checks of tests/validate.sh (tests/check-planning.py) --
for c in handover live risk idmap groups retired; do
  planning $c "$NEW"; check "P1 $c passes on the numbered layout" $? "$OUT"
done

# Seeded defects: a brief at the contract boundary loses its Outputs section,
# an over-budget live file, a malformed risk row, a stray task name, a brief
# that breaks its schema.
fresh; sed -i '/^## Outputs \/ handover$/d' "$T/x/.ai/tasks/S012.T001_Current.md"
planning handover "$T/x"; check "P2 a brief without its Outputs section fails the handover check" \
  "$([ $? -ne 0 ] && has "missing '## Outputs / handover'"; echo $?)" "$OUT"
fresh; seq 1 201 > "$T/x/.ai/10.CURRENT_STATE.md"
planning live "$T/x"; check "P3 a CURRENT_STATE over 200 lines fails the budget" \
  "$([ $? -ne 0 ] && has "over its budget of 200"; echo $?)" "$OUT"
fresh; echo '| R-02 | short |' >> "$T/x/.ai/40.RISK_REGISTER.md"
planning risk "$T/x"; check "P4 a malformed risk row fails" \
  "$([ $? -ne 0 ] && has "malformed row"; echo $?)" "$OUT"
fresh; printf '# x\n' > "$T/x/.ai/tasks/notes.md"
planning handover "$T/x"; check "P5 a task file with no S###.T### name is reported, never skipped" \
  "$([ $? -ne 0 ] && has "cannot be checked"; echo $?)" "$OUT"
fresh; printf '\n## Surprise heading, a v1 brief has no such section\n## Another\n' >> "$T/x/.ai/tasks/S006.T001_Legacy.md"
sed -i 's/^## Status$/## Statuz/' "$T/x/.ai/tasks/S006.T001_Legacy.md"
planning groups "$T/x"; check "P6 a brief that breaks its schema fails the schema check" $([ $? -ne 0 ]; echo $?) "$OUT"

# The renamed v1 brief keeps its boundary through the id map: with the map row
# gone, S006.T001 reads as new work and is held to the current schema.
fresh; sed -i '/^TASK-0100\t/d' "$T/x/.ai/id-map.tsv"
planning groups "$T/x"; check "P7 a renamed v1 brief is keyed by the id map; without its row it is held to the current schema" \
  $([ $? -ne 0 ]; echo $?) "$OUT"
# A brief created from now on (its name is not in the id map) must match the
# hybrid schemas/task.md. The legacy shape, with no `## Acceptance criteria`,
# fails; the same body under a map row stays valid (S017.T003 part 2).
fresh; cp "$P/task-v2.md" "$T/x/.ai/tasks/S012.T003_NewLegacyShape.md"
planning groups "$T/x"; check "P7b a new brief in the legacy shape fails the schema check" \
  "$([ $? -ne 0 ] && has "S012.T003_NewLegacyShape.md" && has "missing required section: ## Goal"; echo $?)" "$OUT"
fresh; cp "$P/task-v2.md" "$T/x/.ai/tasks/S012.T003_RenamedLegacy.md"
printf 'TASK-0301\tS012.T003\t.ai/tasks/TASK-0301-x.md\t.ai/tasks/S012.T003_RenamedLegacy.md\n' >> "$T/x/.ai/id-map.tsv"
planning groups "$T/x"; check "P7c the same body renamed through a map row (legacy by ADR-0066 5) stays valid" $? "$OUT"
fresh; printf 'TASK-0300\tS012.T003\t.ai/tasks/TASK-0300-x.md\t.ai/tasks/S012.T003_Gone.md\n' >> "$T/x/.ai/id-map.tsv"
planning idmap "$T/x"; check "P8 an id-map row whose new file is missing fails" \
  "$([ $? -ne 0 ] && has "does not exist"; echo $?)" "$OUT"
fresh; rm "$T/x/.ai/id-map.tsv"
planning idmap "$T/x"; check "P9 a missing id map fails" $([ $? -ne 0 ]; echo $?) "$OUT"

# The old layout is no longer accepted (S017.T007): each of these passed before.
fresh; cp "$P/task-v2.md" "$T/x/.ai/tasks/TASK-0001-stray.md"
planning handover "$T/x"; check "P10 a stray .ai/tasks/TASK-0001-x.md is rejected by the handover check" \
  "$([ $? -ne 0 ] && has "TASK-0001-stray.md"; echo $?)" "$OUT"
planning groups "$T/x"; check "P11 a stray .ai/tasks/TASK-0001-x.md is not read as a brief by the schema check" \
  "$(has "TASK-0001"; [ $? -ne 0 ]; echo $?)" "$OUT"
rm -rf "$T/x"; mkdir -p "$T/x/.ai/context"; printf '# State\n' > "$T/x/.ai/context/CURRENT_STATE.md"
printf '%s\n' "$RISK" > "$T/x/.ai/context/risk-register.md"
planning risk "$T/x"; check "P12 .ai/context/risk-register.md does not satisfy the risk check" \
  "$([ $? -ne 0 ] && has ".ai/40.RISK_REGISTER.md is missing"; echo $?)" "$OUT"
planning idmap "$T/x"; check "P13 a repository with no .ai/id-map.tsv fails the id-map check" $([ $? -ne 0 ]; echo $?) "$OUT"

for old in .ai/planning .ai/context .ai/templates; do
  fresh; mkdir -p "$T/x/$old"
  planning retired "$T/x"; check "P14 a $old/ directory is rejected by the retired-layout check" \
    "$([ $? -ne 0 ] && has "$old exists"; echo $?)" "$OUT"
done
fresh; : > "$T/x/TODO.md"
planning retired "$T/x"; check "P15 a TODO.md is rejected by the retired-layout check" "$([ $? -ne 0 ] && has "TODO.md exists"; echo $?)" "$OUT"
planning retired "$NEW"; check "P16 the numbered fixture passes the retired-layout check" $? "$OUT"

# --- B: scripts/check-backlog-closures.py ------------------------------------
passes python3 "$BACKLOG_PY" "$NEW"; check "B1 the backlog check passes" $? "$OUT"
fresh; sed -i 's#by `S012.T002`#by `S012.T999`#' "$T/x/.ai/35.AD_HOC_TASKS.md"
passes python3 "$BACKLOG_PY" "$T/x"; check "B2 a closer with no file fails" "$([ $? -ne 0 ] && has "no file"; echo $?)" "$OUT"
fresh; sed -i 's/^\*\*Status\*\*: completed/**Status**: not started/' "$T/x/.ai/tasks/S012.T002_Fresh.md"
passes python3 "$BACKLOG_PY" "$T/x"; check "B3 a closer still open fails" "$([ $? -ne 0 ] && has "Status reads"; echo $?)" "$OUT"
fresh; printf '\n### 4. Unexercised: a\n### 5. Unexercised: b\n### 6. Unexercised: c\n### 7. Unexercised: d\n' > "$T/x/open.tmp"
sed -i '/^## Resolved$/e cat '"$T"'/x/open.tmp' "$T/x/.ai/35.AD_HOC_TASKS.md"
passes python3 "$BACKLOG_PY" "$T/x"; check "B4 more than 3 open Unexercised entries fail the cap" "$([ $? -ne 0 ] && has "cap of 3"; echo $?)" "$OUT"
rm -rf "$T/x"; mkdir -p "$T/x/.ai/planning"; printf '# Backlog\n' > "$T/x/.ai/planning/BACKLOG.md"
passes python3 "$BACKLOG_PY" "$T/x"; check "B5 .ai/planning/BACKLOG.md is not read: a repository without 35.AD_HOC_TASKS.md fails" \
  "$([ $? -ne 0 ] && has "cannot read"; echo $?)" "$OUT"

# --- E: the emitter reads the tier and turn tables under docs/development/ ----
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
OUT="$(emit_probe "$NEW" 2>&1)"
check "E1 the emitter reads the tier and turn tables" \
  "$([ "$OUT" = "opus sonnet [('maxTurns', '250')]" ]; echo $?)" "$OUT"
rm -rf "$T/x"; mkdir -p "$T/x/.ai/context"
printf '%s\n' "$TIERS" > "$T/x/.ai/context/model-tiers.md"; printf '%s\n' "$TURNS" > "$T/x/.ai/context/turn-limits.md"
OUT="$(emit_probe "$T/x" 2>&1)"
check "E2 tables under .ai/context/ are not read" "$([ "$OUT" = "inherit inherit []" ]; echo $?)" "$OUT"

# --- S: scripts/sync-templates.sh --------------------------------------------
# A copy of the script and the two skills it renders from, rooted in a fixture.
r="$T/sync"
mkdir -p "$r/scripts" "$r/skills" "$r/.ai"
cp "$SYNC_SH" "$r/scripts/sync-templates.sh"
cp -r "$here/$PW" "$here/$PM" "$r/skills/"
printf '# Conventions\n' > "$r/.ai/00.CONVENTIONS.md"
passes bash -c "cd '$r' && bash scripts/sync-templates.sh"; check "S1 sync-templates writes without error" $? "$OUT"
passes bash -c "cd '$r' && bash scripts/sync-templates.sh --check"; check "S2 sync-templates --check passes" $? "$OUT"
check "S3 no .ai/templates/ is created (retired)" "$([ ! -e "$r/.ai/templates" ]; echo $?)"
echo stale >> "$r/skills/project-workflow/templates/tasks/0000_TEMPLATE.md"
passes bash -c "cd '$r' && bash scripts/sync-templates.sh --check"; check "S4 a drifted template still fails --check" $([ $? -ne 0 ]; echo $?) "$OUT"
check "S5 the script names no .ai/templates/ target" "$(grep -q ':\.ai/templates/' "$SYNC_SH"; [ $? -ne 0 ]; echo $?)"

bash -c "cd '$r' && bash scripts/sync-templates.sh" >/dev/null 2>&1   # undo S4's drift
for f in templates/10.CURRENT_STATE.md templates/40.RISK_REGISTER.md templates/sessions/0000_TEMPLATE.md; do
  check "S6 sync-templates renders $f from its schema" \
    "$([ -s "$r/skills/project-workflow/$f" ] && head -1 "$r/skills/project-workflow/$f" | grep -q '^<!-- Rendered by ai-toolbox'; echo $?)"
  echo stale >> "$r/skills/project-workflow/$f"
  passes bash -c "cd '$r' && bash scripts/sync-templates.sh --check"
  check "S7 a drifted $f fails --check" "$([ $? -ne 0 ] && has "$f"; echo $?)" "$OUT"
  bash -c "cd '$r' && bash scripts/sync-templates.sh" >/dev/null 2>&1
done
check "S8 the ADR template is ADR-0000-TEMPLATE.md" \
  "$([ -s "$r/skills/project-workflow/templates/decisions/ADR-0000-TEMPLATE.md" ] && [ ! -e "$r/skills/project-workflow/templates/decisions/0000-TEMPLATE.md" ]; echo $?)"

# --- A: new-artifact.sh --kind adr renders ADR-NNNN-title.md -----------------
NA="$here/$PW/scripts/new-artifact.sh"
passes bash "$NA" --filename --kind adr --id ADR-0067 --name one-thing
check "A1 the ADR file name is decisions/ADR-0067-one-thing.md" "$([ "$OUT" = "decisions/ADR-0067-one-thing.md" ]; echo $?)" "$OUT"
passes bash "$NA" --kind adr --id ADR-0067 --title Pick
check "A2 the ADR heading reads ADR-0067 -- Pick" "$(head -1 <<<"$OUT" | grep -q '^# ADR-0067 — Pick$'; echo $?)" "$(head -1 <<<"$OUT")"
# Numbering continues past BOTH shapes of file name.
rm -rf "$T/d"; mkdir -p "$T/d/.ai/decisions"
: > "$T/d/.ai/decisions/0012-old.md"; : > "$T/d/.ai/decisions/ADR-0066-new.md"
: > "$T/d/.ai/decisions/ADR-0000-TEMPLATE.md"; : > "$T/d/.ai/decisions/INDEX.md"
passes bash -c "cd '$T/d' && bash '$NA' --filename --kind adr --name next-one"
check "A3 with no --id the next number follows the highest of NNNN- and ADR-NNNN- files" \
  "$([ "$OUT" = "decisions/ADR-0067-next-one.md" ]; echo $?)" "$OUT"
: > "$T/d/.ai/decisions/0090-oldest-shape.md"
passes bash -c "cd '$T/d' && bash '$NA' --filename --kind adr --name next-one"
check "A4 an old-shape file with the highest number is counted too" \
  "$([ "$OUT" = "decisions/ADR-0091-next-one.md" ]; echo $?)" "$OUT"

# --- W: scripts/worktree.sh takes S###.T### only as a task id -----------------
git init -q -b master "$T/repo"
( cd "$T/repo" && mkdir scripts && cp "$WORKTREE_SH" scripts/worktree.sh && chmod +x scripts/worktree.sh \
  && git add -A && git commit -qm init )
wt="$T/repo-worktrees"
export WORKTREE_SKIP_GATE=1
passes bash -c "cd '$T/repo' && scripts/worktree.sh add S012.T001"
rc=$?
check "W1 add S012.T001 creates branch agent/S012.T001 and a sibling worktree" \
  "$( [ $rc -eq 0 ] && (cd "$T/repo" && git show-ref --verify --quiet "refs/heads/agent/S012.T001") && [ -d "$wt/S012.T001" ]; echo $?)" "$OUT"
check "W2 add S012.T001 is a task branch: no free-name note" "$(! has 'not a task branch'; echo $?)" "$OUT"
passes bash -c "cd '$T/repo' && scripts/worktree.sh add TASK-0299"
check "W3 add TASK-0299 (the retired form) is a free name" "$(has 'not a task branch'; echo $?)" "$OUT"

echo "test-planning-layout.sh: $cases cases, $fails failed"
[ "$fails" -eq 0 ]
