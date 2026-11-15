#!/usr/bin/env bash
# Prove tracker.sh reads, refuses and declares as documented, and that the
# dashboard scripts treat a forge tracker as not applicable (TASK-0171).
#
# Every case runs in a throwaway git repository under mktemp, against the real
# scripts and the real vendored generator, so it needs no network and touches
# nothing in the repository it is run from. tests/validate.sh runs it: it is
# hermetic and takes a few seconds.
#
# THE CASES THAT MATTER MOST are the absent-conf ones. A missing tracker.conf
# means `files`, and every project governed before TASK-0171 has none, so if
# absence ever read as anything else every one of them would lose its
# dashboard.
#
# WHAT THIS PROVES: the conf grammar and its refusals, that `init` never
# overwrites, that a project path may not be a host or URL, that
# build-dashboard.sh refuses on a forge and still builds on files, and that
# publish-dashboard.sh answers `not applicable` and reports what a forge
# project has left over - each by a case that fails when the behaviour is
# removed.
# It also proves (S019.T001) that `init --replace` needs an ADR that exists,
# and that `export` maps a fake forge's issues to briefs, reviews and
# fragments, writes only into an empty directory, lists schema failures, and
# makes only read calls.
# WHAT IT DOES NOT PROVE: that the forge project exists, or that its issues
# follow templates/reference/tracker.md. Nothing here touches a forge: export
# runs against fixtures/forge/fake_forge.py, never a real `gh` or `glab`.
set -uo pipefail

# SAFETY (TASK-0127, TASK-0165). A pre-commit hook exports GIT_DIR and
# GIT_INDEX_FILE, which override `git -C`, so a throwaway `git init` here would
# otherwise act on the real repository. Clear them before any git call.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_PREFIX \
      GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_NAMESPACE \
      GIT_CEILING_DIRECTORIES GIT_DISCOVERY_ACROSS_FILESYSTEM

HERE="$(cd "$(dirname "$0")" && pwd)"
SKILL="$(dirname "$HERE")"

command -v python3 >/dev/null 2>&1 || { echo "check-tracker.sh: MISSING prerequisite: python3" >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "check-tracker.sh: MISSING prerequisite: git" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# A copy on local disk, for the same reason as check-publish.sh: on a WSL
# /mnt/c checkout every read crosses the 9p bridge.
mkdir -p "$TMP/skill"
cp -R "$SKILL/scripts" "$SKILL/assets" "$SKILL/dashboard" "$SKILL/schemas" "$TMP/skill/"
TRK="$TMP/skill/scripts/tracker.sh"
PUB="$TMP/skill/scripts/publish-dashboard.sh"
BUILD="$TMP/skill/scripts/build-dashboard.sh"
CORPUS="$SKILL/fixtures/dashboard"
fails=0
count=0

g() { git -C "$1" -c user.name=check -c user.email=check@example.invalid \
        -c core.hooksPath=/dev/null -c init.defaultBranch=master "${@:2}"; }

# expect CODE DESCRIPTION [grep-pattern] -- command...
expect() {
  local want="$1" desc="$2" pat=""; shift 2
  if [ "$1" != "--" ]; then pat="$1"; shift; fi
  shift
  local out code
  out="$("$@" 2>&1)"; code=$?
  count=$((count + 1))
  if [ "$code" -ne "$want" ]; then
    echo "FAIL  $desc (exit $code, want $want)"; printf '%s\n' "$out" | sed 's/^/        /'
    fails=$((fails + 1)); return
  fi
  if [ -n "$pat" ] && ! printf '%s' "$out" | grep -q -- "$pat"; then
    echo "FAIL  $desc (output lacks '$pat')"; printf '%s\n' "$out" | sed 's/^/        /'
    fails=$((fails + 1)); return
  fi
  echo "PASS  $desc"
}

# mkrepo NAME [tracker.conf text] : a committed repository, optionally declared.
mkrepo() {
  local r="$TMP/$1"
  mkdir -p "$r"
  g "$r" init -q
  [ $# -gt 1 ] && printf '%s' "$2" > "$r/tracker.conf"
  echo one > "$r/one"
  g "$r" add -A && g "$r" commit -q -m one
  printf '%s' "$r"
}

# --- absent conf: files -----------------------------------------------------
R="$(mkrepo absent)"
expect 0 "check: no tracker.conf prints files" "^files$" -- "$TRK" check --repo "$R"
expect 0 "decision: no tracker.conf is files by default" "tracker  files (default: no tracker.conf)" -- "$TRK" decision --repo "$R"
mkdir -p "$R/sub/dir"
expect 0 "check from a subdirectory finds the repository root" "^files$" -- bash -c "cd '$R/sub/dir' && '$TRK' check"
expect 2 "no subcommand is refused" -- "$TRK"
expect 0 "--help prints the usage" "Usage:" -- "$TRK" --help

# --- init ---------------------------------------------------------------------
R="$(mkrepo init-files)"
expect 0 "init --tracker files writes the conf" "tracker.conf written (files)" -- "$TRK" init --tracker files --repo "$R"
expect 0 "the written conf says tracker = files" -- grep -qx 'tracker = files' "$R/tracker.conf"
expect 0 "decision: a written files conf is declared" "tracker  files (declared)" -- "$TRK" decision --repo "$R"
expect 0 "init again with the same answer changes nothing" "nothing to change" -- "$TRK" init --tracker files --repo "$R"
cp "$R/tracker.conf" "$TMP/before.conf"
expect 2 "init with a different answer is refused" "init never overwrites" -- "$TRK" init --tracker gitlab --gitlab-project g/n --repo "$R"
expect 0 "a refused init left the conf as it was" -- cmp -s "$TMP/before.conf" "$R/tracker.conf"

R="$(mkrepo init-gitlab)"
expect 0 "init --tracker gitlab writes the project path" "written (gitlab group/sub/name)" -- "$TRK" init --tracker gitlab --gitlab-project group/sub/name --repo "$R"
expect 0 "check prints the gitlab project" "^gitlab group/sub/name$" -- "$TRK" check --repo "$R"
expect 0 "decision: a forge with no remote on it gets a NOTE" "NOTE     no gitlab remote" -- "$TRK" decision --repo "$R"
g "$R" remote add origin "git@git.example.internal:group/sub/name.git"
expect 0 "decision: an unknown host may be the forge, so no NOTE" "tracker  gitlab group/sub/name" -- "$TRK" decision --repo "$R"
"$TRK" decision --repo "$R" > "$TMP/d.out" 2>&1
expect 1 "decision: no NOTE beside an unknown host" -- grep -q NOTE "$TMP/d.out"

R="$(mkrepo init-github)"
expect 0 "init --tracker github writes the repository" "written (github owner/name)" -- "$TRK" init --tracker github --github-repo owner/name --repo "$R"
expect 0 "check prints the github repository" "^github owner/name$" -- "$TRK" check --repo "$R"

# Refused before anything is written.
R="$(mkrepo refusals)"
expect 2 "gitlab without a project path is refused" "needs gitlab_project" -- "$TRK" init --tracker gitlab --repo "$R"
expect 2 "gitlab with a github_repo is refused" "belongs to tracker = github" -- "$TRK" init --tracker gitlab --gitlab-project g/n --github-repo o/n --repo "$R"
expect 2 "files with a project path is refused" "belongs to tracker = gitlab" -- "$TRK" init --tracker files --gitlab-project g/n --repo "$R"
expect 2 "an unknown tracker is refused" -- "$TRK" init --tracker jira --repo "$R"
expect 2 "a URL as the project path is refused" "names only" -- "$TRK" init --tracker gitlab --gitlab-project https://git.example.internal/g/n --repo "$R"
expect 2 "an scp-style remote as the path is refused" "names only" -- "$TRK" init --tracker gitlab --gitlab-project git@git.example.internal:g/n --repo "$R"
expect 2 "a bare group is not a project path" "is not group/name" -- "$TRK" init --tracker gitlab --gitlab-project group --repo "$R"
expect 2 "github takes exactly owner/name" "is not owner/name" -- "$TRK" init --tracker github --github-repo a/b/c --repo "$R"
expect 2 "a .. segment is refused" "is not group/name" -- "$TRK" init --tracker gitlab --gitlab-project g/../n --repo "$R"
expect 1 "no refused init wrote a conf" -- test -e "$R/tracker.conf"

# --- hand-written conf ----------------------------------------------------------
conf() { printf "$1" > "$R/tracker.conf"; }
R="$(mkrepo grammar)"
conf 'tracker = files\nwiki = yes\n'
expect 2 "an unknown key is refused" "unknown key 'wiki'" -- "$TRK" check --repo "$R"
conf 'tracker = files\ntracker = files\n'
expect 2 "a duplicate key is refused" "set twice" -- "$TRK" check --repo "$R"
conf 'tracker = jira\n'
expect 2 "an unknown tracker in the conf is refused" "known: files | gitlab | github" -- "$TRK" check --repo "$R"
conf 'tracker files\n'
expect 2 "a line without = is refused" "expected \`key = value\`" -- "$TRK" check --repo "$R"
conf '# comment only\n'
expect 2 "a conf without tracker is refused" "\`tracker\` is required" -- "$TRK" check --repo "$R"
conf 'tracker = github\ngitlab_project = g/n\n'
expect 2 "the other forge's path key is refused" "belongs to tracker = gitlab" -- "$TRK" check --repo "$R"
conf '# asked 2026-10-18\r\ntracker = github\r\ngithub_repo = o/n\r\n'
expect 0 "CRLF line endings parse" "^github o/n$" -- "$TRK" check --repo "$R"

# --- build-dashboard.sh: files only ---------------------------------------------
R="$(mkrepo build-files)"
cp -R "$CORPUS" "$R/.ai"
expect 0 "build-dashboard.sh builds on a files tracker (no conf)" -- "$BUILD" --root "$R/.ai" --out "$R/d.html" --no-git
expect 0 "the page was written" -- test -s "$R/d.html"
rm -f "$R/d.html"
printf 'tracker = gitlab\ngitlab_project = g/n\n' > "$R/tracker.conf"
expect 2 "build-dashboard.sh refuses on a gitlab tracker" "not applicable: tracker = gitlab g/n" -- "$BUILD" --root "$R/.ai" --out "$R/d.html" --no-git
expect 1 "no page was written on a forge" -- test -e "$R/d.html"
printf 'tracker = gitlab\n' > "$R/tracker.conf"
expect 2 "build-dashboard.sh refuses on a broken conf" "needs gitlab_project" -- "$BUILD" --root "$R/.ai" --out "$R/d.html" --no-git

# --- publish-dashboard.sh: not applicable on a forge ----------------------------
FORGE='tracker = github\ngithub_repo = owner/name\n'
# skill_dir() REPO : a tracked skill directory, so that a render which ignored
# the tracker would succeed and write - a refusal for any other reason would
# make the "wrote no pipeline" cases pass for the wrong reason.
skill_dir() {
  mkdir -p "$1/tools/pw/scripts"
  : > "$1/tools/pw/scripts/build-dashboard.sh"; : > "$1/tools/pw/scripts/publish-dashboard.sh"
  g "$1" add -A && g "$1" commit -q -m pw
}
R="$(mkrepo publish-forge)"
skill_dir "$R"
conf "$FORGE"
g "$R" remote add github "https://github.com/owner/name.git"
expect 0 "decision: a forge with no publish conf is not applicable, nothing pending" "answered not applicable: tracker = github owner/name" -- "$PUB" decision --repo "$R"
expect 0 "render --check: a forge with no publish conf is clean" "not applicable" -- "$PUB" render --check --repo "$R"
cat > "$R/dashboard-publish.conf" <<'EOF'
targets   = github-pages
skill_dir = tools/pw
branch    = master
status.github-pages = UNVERIFIED - test
EOF
expect 0 "decision: a forge with targets declared says STALE" "STALE    dashboard-publish.conf declares targets" -- "$PUB" decision --repo "$R"
expect 1 "render --check: a forge with targets declared is stale" "declares targets; set \`targets = none\`" -- "$PUB" render --check --repo "$R"
expect 2 "render: refuses to write a pipeline on a forge" "not applicable" -- "$PUB" render --repo "$R"
expect 1 "render on a forge wrote no pipeline" -- test -e "$R/.github/workflows/dashboard.yml"
printf 'targets = none\n' > "$R/dashboard-publish.conf"
expect 0 "render --check: a forge with targets = none is clean" -- "$PUB" render --check --repo "$R"

# A project that published while on files, then moved to a forge.
R="$(mkrepo files-then-forge)"
cat > "$R/dashboard-publish.conf" <<'EOF'
targets   = github-pages
skill_dir = tools/pw
branch    = master
status.github-pages = UNVERIFIED - test
EOF
skill_dir "$R"
expect 0 "render on files writes the pipeline" "wrote    .github/workflows/dashboard.yml" -- "$PUB" render --repo "$R"
printf 'targets = none\n' > "$R/dashboard-publish.conf"
conf "$FORGE"
expect 1 "render --check on a forge names the pipeline still deploying" ".github/workflows/dashboard.yml was generated for github-pages and still deploys" -- "$PUB" render --check --repo "$R"

# --- init --replace: changing the declaration names its ADR (S019.T001) -------------
R="$(mkrepo replace)"
conf "$FORGE"
cp "$R/tracker.conf" "$TMP/before.conf"
expect 2 "--replace without --adr is refused" "takes an id such as ADR-0067" -- "$TRK" init --tracker files --replace --repo "$R"
expect 2 "--replace naming an ADR that is not in .ai/decisions is refused" "ADR-0099 is not in .ai/decisions/" -- "$TRK" init --tracker files --replace --adr ADR-0099 --repo "$R"
expect 2 "--adr without --replace is refused" "goes with --replace" -- "$TRK" init --tracker files --adr ADR-0099 --repo "$R"
expect 0 "every refused --replace left the conf as it was" -- cmp -s "$TMP/before.conf" "$R/tracker.conf"
mkdir -p "$R/.ai/decisions"; echo "# ADR-0099 - back to files" > "$R/.ai/decisions/ADR-0099-back-to-files.md"
expect 0 "--replace --adr with the ADR present switches to files" "replaced (github owner/name -> files, .ai/decisions/ADR-0099-back-to-files.md)" -- "$TRK" init --tracker files --replace --adr ADR-0099 --repo "$R"
expect 0 "the replaced conf names its ADR" -- grep -qx '# Changed by ADR-0099.' "$R/tracker.conf"
expect 0 "check reads files after the switch" "^files$" -- "$TRK" check --repo "$R"
R="$(mkrepo replace-none)"
expect 2 "--replace with no conf to replace is refused" "no tracker.conf to replace" -- "$TRK" init --tracker files --replace --adr ADR-0099 --repo "$R"

# --- export: a forge read back into files (S019.T001) ---------------------------------
# The fake CLI answers only the read calls export makes and exits 3 on any
# other, so a write call fails a case. Paths are native for a Windows python3.
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
FAKE="python3 $(native "$SKILL/fixtures/forge/fake_forge.py")"
LOG="$TMP/forge.log"; export FAKE_FORGE_LOG; FAKE_FORGE_LOG="$(native "$LOG")"
R="$(mkrepo export-files)"
expect 2 "export on a files tracker is refused" "there is no forge to export" -- "$TRK" export --out "$TMP/x-files" --repo "$R"
R="$(mkrepo export-gh)"
conf "$FORGE"
mkdir -p "$R/.ai/tasks"; : > "$R/.ai/tasks/S002.T001_Existing.md"
mkdir -p "$TMP/x-full"; : > "$TMP/x-full/keep"
expect 2 "export into a non-empty directory is refused" "is not empty" -- env TRACKER_GH="$FAKE gh" "$TRK" export --out "$TMP/x-full" --repo "$R"
expect 2 "an unauthenticated CLI stops the export" '`auth status` failed' -- env TRACKER_GH="$FAKE gh" FAKE_FORGE_AUTH=fail "$TRK" export --out "$TMP/x-auth" --repo "$R"
expect 1 "no output directory after a refused export" -- test -e "$TMP/x-auth"
: > "$LOG"
expect 1 "github --state all: written, one brief fails its schema (exit 1)" "FAIL     tasks/S002.T007_HalfWritten.md" -- env TRACKER_GH="$FAKE gh" "$TRK" export --state all --out "$TMP/x-gh" --repo "$R"
O="$TMP/x-gh"
expect 0 "a closed issue that named its id keeps it" -- test -f "$O/tasks/S002.T005_CacheHeaders.md"
expect 0 "a new id comes after the highest in use, a kept one included" -- test -f "$O/tasks/S002.T006_WireTheExport.md"
expect 0 "status: in_progress becomes in progress" -- grep -qx '\*\*Status\*\*: in progress' "$O/tasks/S002.T006_WireTheExport.md"
expect 0 "the H1 is the new id, not the issue title" -- grep -qx '# S002.T006_WireTheExport' "$O/tasks/S002.T006_WireTheExport.md"
expect 0 "a closed issue is completed, with its milestone as sprint" -- grep -qx '\*\*Sprint\*\*: `S002_Beta`' "$O/tasks/S002.T005_CacheHeaders.md"
expect 0 "the closing task report is carried" -- grep -q '^Result:   done' "$O/tasks/S002.T005_CacheHeaders.md"
expect 0 "closed as not planned is cancelled; milestone S1 is sprint S001" -- grep -qx '\*\*Status\*\*: cancelled' "$O/tasks/S001.T001_DropTheOldCache.md"
expect 0 "a review issue named checkpoint becomes reviews/S###-checkpoint.md" -- grep -qx '# S002-checkpoint' "$O/reviews/S002-checkpoint.md"
expect 0 "a backlog issue goes to the ad-hoc fragment" -- grep -qx '### #4. Slow cold start' "$O/35.AD_HOC_TASKS.fragment.md"
expect 0 "a task with no milestone goes there too, its headings quoted" -- grep -qx '> ## Goal' "$O/35.AD_HOC_TASKS.fragment.md"
expect 0 "milestones become roadmap rows" -- grep -q '^| `S002_Beta` | 2026-03-01 | open | 5 |$' "$O/30.ROADMAP.fragment.md"
expect 0 "id-map.tsv maps the issue number to the new id" -- grep -qx "$(printf '#1\tS002.T006\t-\t.ai/tasks/S002.T006_WireTheExport.md')" "$O/id-map.tsv"
expect 0 "EXPORT.md lists the schema failure" -- grep -q 'missing required section: ## Goal' "$O/EXPORT.md"
expect 0 "a migrated issue whose brief the repository holds is skipped" "#8: a migrated copy of S002.T001" -- cat "$O/EXPORT.md"
expect 1 "no second brief for the migrated copy" -- bash -c "ls '$O/tasks' | grep -q '_Existing'"
expect 0 "EXPORT.md notes a status with no files equivalent" -- grep -q '#7: status ready has no files status' "$O/EXPORT.md"
expect 1 "the export made only read calls" -- grep -vE '^gh (auth status|issue list |api --paginate repos/owner/name/milestones)' "$LOG"
expect 1 "the repository's own .ai/ was not written" -- test -e "$R/.ai/tasks/S002.T006_WireTheExport.md"
expect 1 "github --state open leaves closed issues out" "4 issue(s)" -- env TRACKER_GH="$FAKE gh" "$TRK" export --out "$TMP/x-open" --repo "$R"
expect 1 "no closed issue in an open export" -- test -e "$TMP/x-open/tasks/S002.T005_CacheHeaders.md"
expect 0 "with no kept id above it, a new id follows the repository's S002.T001" -- test -f "$TMP/x-open/tasks/S002.T002_WireTheExport.md"
R="$(mkrepo export-gl)"
conf 'tracker = gitlab
gitlab_project = group/sub/name
'
: > "$LOG"
expect 0 "gitlab --state all: every file conforms (exit 0)" "report   EXPORT.md" -- env TRACKER_GLAB="$FAKE glab" "$TRK" export --state all --out "$TMP/x-gl" --repo "$R"
O="$TMP/x-gl"
expect 0 "status::review becomes review" -- grep -qx '\*\*Status\*\*: review' "$O/tasks/S003.T001_WireTheExport.md"
expect 0 "a system note is skipped; the report note is carried" -- grep -q '^Result:   done' "$O/tasks/S003.T002_CacheHeaders.md"
expect 0 "a phase label is noted, not carried" -- grep -q '#10: phase label 2 is not carried' "$O/EXPORT.md"
expect 0 "a milestone that is not S###_Name is noted" -- grep -q "milestone 'v1.0' is not S###_Name" "$O/EXPORT.md"
expect 1 "the gitlab export made only GET calls" -- grep -vE '^glab (auth status|api (--paginate )?projects/group%2Fsub%2Fname/)' "$LOG"

echo
if [ "$fails" -ne 0 ]; then
  echo "check-tracker.sh: $fails of $count case(s) FAILED"
  exit 1
fi
echo "check-tracker.sh: OK ($count cases)"
