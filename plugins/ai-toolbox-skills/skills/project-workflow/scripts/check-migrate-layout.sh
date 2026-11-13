#!/usr/bin/env bash
# Prove migrate-layout.py moves a project-migration repository onto ADR-0066's
# one convention as documented (TASK-0297).
#
# Every case runs in a throwaway git repository under mktemp, built from
# fixtures/migrate-layout/ (briefs across two sprints and two Post buckets, an
# open and a planned sprint, one brief no heading assigns, two ADRs, a
# sprint-closing review and a dated one, a backlog, context files, a plan, a
# sprint file, sessions, cross-links between them). It needs no network and
# touches nothing in the repository it is run from. It is hermetic and takes a
# few seconds, so tests/validate.sh may run it.
#
# WHAT THIS PROVES: the dry run prints the map and changes not one byte; --write
# refuses while a brief is unassigned and, with --skip-unassigned, moves every
# file per the rules, writes the id map, keeps `git log --follow` working,
# rewrites path references, and leaves ids inside historical prose untouched.
# WHAT IT DOES NOT PROVE: behaviour on ai-toolbox's own 286 briefs (the dry run
# against it is reported by the task, never run with --write here), nor the
# content conversion of live files, which is TASK-0299's.
set -uo pipefail

# SAFETY (TASK-0127, TASK-0165). A pre-commit hook exports GIT_DIR and
# GIT_INDEX_FILE, which override `git -C`; clear them before any git call.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_PREFIX \
      GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_NAMESPACE \
      GIT_CEILING_DIRECTORIES GIT_DISCOVERY_ACROSS_FILESYSTEM

HERE="$(cd "$(dirname "$0")" && pwd)"
SKILL="$(dirname "$HERE")"
TOOL="$HERE/migrate-layout.py"
FIX="$SKILL/fixtures/migrate-layout"

command -v python3 >/dev/null 2>&1 || { echo "check-migrate-layout.sh: MISSING prerequisite: python3" >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "check-migrate-layout.sh: MISSING prerequisite: git" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0
ok()  { PASS=$((PASS + 1)); echo "  ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "  FAIL $1"; }
check() { # description, then a command that must succeed
  local d="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d"; fi
}
has()  { grep -qF -- "$2" "$1"; }          # file contains literal text
lacks() { ! grep -qF -- "$2" "$1"; }

tool() { python3 "$TOOL" "$@"; }

# A byte-level fingerprint of the working tree (everything but .git).
fingerprint() {
  (cd "$1" && find . -path ./.git -prune -o -type f -print | LC_ALL=C sort |
    while IFS= read -r f; do printf '%s ' "$f"; cksum < "$f"; done)
}

R="$TMP/repo"
mkdir -p "$R"
cp -R "$FIX/." "$R/"
git -C "$R" init -q
git -C "$R" config user.email fixture@example.invalid
git -C "$R" config user.name fixture
git -C "$R" config core.autocrlf false
git -C "$R" add -A
git -C "$R" commit -q -m "old layout"

echo "migrate-layout"

if [ ! -f "$TOOL" ]; then
  bad "migrate-layout.py exists ($TOOL)"
  echo "check-migrate-layout.sh: $PASS passed, $FAIL FAILED"
  exit 1
fi

# --- dry run: prints the map, changes nothing -------------------------------
BEFORE="$(fingerprint "$R")"
HEAD0="$(git -C "$R" rev-parse HEAD)"
tool --repo "$R" > "$TMP/dry.out" 2> "$TMP/dry.err"
RC=$?
check "dry run exits 0" test "$RC" -eq 0
[ "$BEFORE" = "$(fingerprint "$R")" ] && ok "dry run changes no byte on disk" || bad "dry run changes no byte on disk"
check "dry run leaves the index and HEAD alone" test -z "$(git -C "$R" status --porcelain)" -a "$HEAD0" = "$(git -C "$R" rev-parse HEAD)"
check "dry run says it is a dry run" grep -q "DRY RUN" "$TMP/dry.out"
for row in \
  "task	TASK-0001	S001.T001	.ai/tasks/TASK-0001-bootstrap-repo.md	.ai/tasks/S001.T001_BootstrapRepo.md" \
  "task	TASK-0002	S002.T001	.ai/tasks/TASK-0002-add-parser.md	.ai/tasks/S002.T001_AddParser.md" \
  "task	TASK-0003	S002.T002	.ai/tasks/TASK-0003-add-cli-flags.md	.ai/tasks/S002.T002_AddCliFlags.md" \
  "task	TASK-0005	S003.T001	.ai/tasks/TASK-0005-open-work.md	.ai/tasks/S003.T001_OpenWork.md" \
  "task	TASK-0009	S003.T002	.ai/tasks/TASK-0009-open-in-bucket.md	.ai/tasks/S003.T002_OpenInBucket.md" \
  "task	TASK-0006	S006.T001	.ai/tasks/TASK-0006-planned-work.md	.ai/tasks/S006.T001_PlannedWork.md" \
  "task	TASK-0008	S004.T001	.ai/tasks/TASK-0008-early-fix.md	.ai/tasks/S004.T001_EarlyFix.md" \
  "task	TASK-0004	S005.T001	.ai/tasks/TASK-0004-fix-typo.md	.ai/tasks/S005.T001_FixTypo.md" \
  "adr	ADR-0001	ADR-0001	.ai/decisions/0001-use-git.md	.ai/decisions/ADR-0001-use-git.md" \
  "review	REVIEW-0002	S002-checkpoint	.ai/reviews/REVIEW-0002-sprint-s2-parser.md	.ai/reviews/S002-checkpoint.md" \
  "review	REVIEW-0001	2026-09-12-skill-audit	.ai/reviews/REVIEW-0001-skill-audit.md	.ai/reviews/2026-09-12-skill-audit.md" \
  ; do
  grep -qxF -- "$row" "$TMP/dry.out" && ok "dry-run map row: ${row%%	.ai*}" || bad "dry-run map row: ${row%%	.ai*}"
done
check "dry run: Post buckets in date order of their first task (Post-S3 before Post-S2)" \
  grep -q "Post-S3=S004 (first task 2026-09-15), Post-S2=S005" "$TMP/dry.out"
check "dry run: planned sprint S4 (above the open S3) takes the next free number after the Post buckets, S006" \
  grep -q "future sprint(s) S4=S006" "$TMP/dry.out"
check "dry run: an open task under a Post bucket joins the open sprint, not S005" \
  test -z "$(grep "^task	TASK-0009	S005" "$TMP/dry.out")"
check "dry run reports the unassigned brief" grep -q "unassigned.*TASK-0007-orphan-brief.md" "$TMP/dry.out"
check "dry run lists TODO.md as retired" grep -q "retired.*\.ai/tasks/TODO.md" "$TMP/dry.out"
check "dry run lists templates/ as retired" grep -q "retired.*\.ai/templates/TASK.md" "$TMP/dry.out"
check "dry run names the content follow-up" grep -q "follow-up (TASK-0299" "$TMP/dry.out"

# --- --write refuses while a brief is unassigned ----------------------------
tool --repo "$R" --write > "$TMP/ref.out" 2> "$TMP/ref.err"
RC=$?
check "--write refuses (exit 2) with an unassigned brief" test "$RC" -eq 2
check "the refusal names the brief" grep -q "TASK-0007-orphan-brief.md" "$TMP/ref.err"
[ "$BEFORE" = "$(fingerprint "$R")" ] && ok "a refused --write changes no byte" || bad "a refused --write changes no byte"

# --- --write on a dirty tree refuses ----------------------------------------
echo stray >> "$R/docs/guide.md"
tool --repo "$R" --write --skip-unassigned > /dev/null 2> "$TMP/dirty.err"
RC=$?
check "--write refuses a dirty working tree" test "$RC" -eq 2
git -C "$R" checkout -q -- docs/guide.md

# --- --write ----------------------------------------------------------------
tool --repo "$R" --write --skip-unassigned > "$TMP/write.out" 2> "$TMP/write.err"
RC=$?
check "--write --skip-unassigned exits 0" test "$RC" -eq 0
[ "$RC" -ne 0 ] && sed 's/^/    /' "$TMP/write.err"

# every brief/ADR/review/etc. is where the rules put it
for p in \
  .ai/tasks/S001.T001_BootstrapRepo.md .ai/tasks/S002.T001_AddParser.md .ai/tasks/S002.T002_AddCliFlags.md \
  .ai/tasks/S003.T001_OpenWork.md .ai/tasks/S003.T002_OpenInBucket.md .ai/tasks/S006.T001_PlannedWork.md .ai/tasks/S004.T001_EarlyFix.md \
  .ai/tasks/S005.T001_FixTypo.md \
  .ai/decisions/ADR-0001-use-git.md .ai/decisions/ADR-0002-pin-python.md \
  .ai/reviews/S002-checkpoint.md .ai/reviews/2026-09-12-skill-audit.md \
  .ai/00.CONVENTIONS.md .ai/10.CURRENT_STATE.md .ai/20.PLAN.md .ai/30.ROADMAP.md \
  .ai/35.AD_HOC_TASKS.md .ai/40.RISK_REGISTER.md docs/development/model-tiers.md \
  .ai/archive/plans/PLAN-0001-parser.md .ai/archive/sprints/SPRINT-S1-first.md \
  .ai/sessions/INDEX.md .ai/sessions/SESSION-20260901-1000.md .ai/GOALS.md \
  .ai/id-map.tsv ; do
  check "exists: $p" test -f "$R/$p"
done
for p in \
  .ai/tasks/TASK-0001-bootstrap-repo.md .ai/decisions/0001-use-git.md .ai/README.md \
  .ai/planning/BACKLOG.md .ai/planning/plans/PLAN-0001-parser.md .ai/context/CURRENT_STATE.md \
  .ai/tasks/TODO.md .ai/templates/TASK.md .ai/reviews/REVIEW-0002-sprint-s2-parser.md ; do
  check "gone: $p" test ! -e "$R/$p"
done
check "the unassigned brief stays where it was" test -f "$R/.ai/tasks/TASK-0007-orphan-brief.md"

# the id map: header, one row per brief/ADR/review, every new path exists
MAP="$R/.ai/id-map.tsv"
check "id map header" test "$(head -n1 "$MAP")" = "old_id	new_id	old_path	new_path"
for id in TASK-0001 TASK-0002 TASK-0003 TASK-0004 TASK-0005 TASK-0006 TASK-0008 TASK-0009 \
          ADR-0001 ADR-0002 REVIEW-0001 REVIEW-0002; do
  check "id map has a row for $id" grep -q "^$id	" "$MAP"
done
check "id map does not invent a row for the unassigned brief" test -z "$(grep "^TASK-0007	" "$MAP")"
MISSING=0
while IFS="	" read -r oid nid opath npath; do
  [ "$oid" = "old_id" ] && continue
  [ -f "$R/$npath" ] || { MISSING=$((MISSING + 1)); echo "    missing: $npath"; }
done < "$MAP"
check "every new path in the id map exists" test "$MISSING" -eq 0
check "id map is tab-separated with four columns" \
  test -z "$(awk -F'\t' 'NF != 4' "$MAP")"

# path references are rewritten ...
has "$R/AGENTS.md" '`.ai/30.ROADMAP.md`' && ok "backticked path rewritten (AGENTS.md)" || bad "backticked path rewritten (AGENTS.md)"
has "$R/AGENTS.md" '(.ai/10.CURRENT_STATE.md)' && ok "markdown link rewritten (AGENTS.md)" || bad "markdown link rewritten (AGENTS.md)"
has "$R/docs/guide.md" '(../.ai/decisions/ADR-0001-use-git.md)' && ok "relative link into .ai rewritten" || bad "relative link into .ai rewritten"
has "$R/docs/guide.md" '`.ai/tasks/S002.T002_AddCliFlags.md`' && ok "backticked brief path rewritten" || bad "backticked brief path rewritten"
has "$R/.ai/tasks/S002.T001_AddParser.md" '(../decisions/ADR-0001-use-git.md)' && ok "relative link inside a moved brief rewritten" || bad "relative link inside a moved brief rewritten"
has "$R/.ai/tasks/S002.T001_AddParser.md" '`.ai/35.AD_HOC_TASKS.md`' && ok "backticked path inside a moved brief rewritten" || bad "backticked path inside a moved brief rewritten"
has "$R/.ai/decisions/ADR-0002-pin-python.md" '(ADR-0001-use-git.md)' && ok "same-folder link between ADRs rewritten" || bad "same-folder link between ADRs rewritten"
has "$R/.ai/archive/plans/PLAN-0001-parser.md" '(../../decisions/ADR-0002-pin-python.md)' && ok "link from an archived plan rewritten" || bad "link from an archived plan rewritten"
has "$R/.ai/00.CONVENTIONS.md" '[sprint](20.PLAN.md)' && ok "link between two moved live files rewritten" || bad "link between two moved live files rewritten"
has "$R/.ai/20.PLAN.md" '(tasks/S003.T001_OpenWork.md)' && ok "link from a live file up and into tasks/ rewritten" || bad "link from a live file up and into tasks/ rewritten"
has "$R/.ai/10.CURRENT_STATE.md" '(tasks/S003.T001_OpenWork.md)' && ok "link from context/ to tasks/ rewritten" || bad "link from context/ to tasks/ rewritten"
has "$R/.ai/GOALS.md" '.ai/tasks/S001.T001_BootstrapRepo.md' && ok "bare path in GOALS.md rewritten" || bad "bare path in GOALS.md rewritten"
has "$R/.ai/reviews/S002-checkpoint.md" '(../tasks/S002.T001_AddParser.md)' && ok "link inside a moved review rewritten" || bad "link inside a moved review rewritten"
has "$R/.ai/sessions/SESSION-20260901-1000.md" '`.ai/tasks/S001.T001_BootstrapRepo.md`' && ok "path in an unmoved session rewritten" || bad "path in an unmoved session rewritten"
# ... and ids in historical prose are not (ADR-0066 clause 5)
has "$R/.ai/tasks/S002.T001_AddParser.md" 'Follows TASK-0001 and ADR-0001;' && ok "ids in a closed brief's prose are NOT rewritten" || bad "ids in a closed brief's prose are NOT rewritten"
has "$R/.ai/tasks/S002.T001_AddParser.md" '# TASK-0002 — Add the parser' && ok "a closed brief keeps its own title and id" || bad "a closed brief keeps its own title and id"
has "$R/.ai/reviews/S002-checkpoint.md" 'Reviewed TASK-0002 and TASK-0003;' && ok "ids in a review's prose are NOT rewritten" || bad "ids in a review's prose are NOT rewritten"
has "$R/.ai/decisions/ADR-0002-pin-python.md" 'task TASK-0002.' && ok "ids in an ADR's prose are NOT rewritten" || bad "ids in an ADR's prose are NOT rewritten"
has "$R/AGENTS.md" 'Task TASK-0002 is named in prose' && ok "ids in root prose are NOT rewritten" || bad "ids in root prose are NOT rewritten"
has "$R/.ai/35.AD_HOC_TASKS.md" 'Revisit TASK-0003' && ok "ids in a backlog row are NOT rewritten (content conversion is TASK-0299)" || bad "ids in a backlog row are NOT rewritten"
# a moved file's own content is otherwise byte-identical
check "an unlinked moved file is byte-identical" cmp -s "$FIX/.ai/context/model-tiers.md" "$R/docs/development/model-tiers.md"
check "sessions are unchanged apart from the path reference" \
  cmp -s "$FIX/.ai/sessions/INDEX.md" "$R/.ai/sessions/INDEX.md"

# history survives the move: commit, then follow the renamed brief
git -C "$R" add -A
git -C "$R" commit -q -m "migrate"
FOLLOW="$(git -C "$R" log --follow --format=%s -- .ai/tasks/S002.T001_AddParser.md)"
check "git log --follow finds the moved brief's history" test "$(printf '%s\n' "$FOLLOW" | grep -c .)" -ge 2
printf '%s\n' "$FOLLOW" | grep -qx "old layout" && ok "  ... including the commit before the move" || bad "  ... including the commit before the move"
RENAMES="$(git -C "$R" show --stat --format= -M HEAD | grep -c '=>')"
# The fixture's files are a few lines each, so a rewritten link can push a file
# under git's 50% similarity; the files with no reference are the stable ones.
echo "    renames detected: $RENAMES"
check "git sees the moves as renames (>= 10)" test "$RENAMES" -ge 10

# idempotent: a repository already on the new layout maps to nothing to move
tool --repo "$R" > "$TMP/again.out" 2>&1
check "a second dry run moves nothing" grep -q "^moved total: 0$" "$TMP/again.out"

echo "check-migrate-layout.sh: $PASS passed, $FAIL FAILED"
[ "$FAIL" -eq 0 ]
