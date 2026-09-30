#!/usr/bin/env bash
# Publish the delivery dashboard to GitHub Pages and/or GitLab Pages.
#
# A LOCAL BUILD NEEDS NONE OF THIS. build-dashboard.sh writes one
# self-contained HTML file; unpublished, that is the whole dashboard.
# Publishing is optional: a project that wants the page on the web declares
# its destinations in `dashboard-publish.conf` at its root, and this script
# renders, from ../assets/publish/, the CI pipeline that builds and publishes
# the page for each one. See references/dashboard.md, "Publishing it".
#
# WHY RENDERED, NOT COPIED (TASK-0127, closing B-048). The pipeline carries
# rules that were learned by publishing a wrong page - most of all that a
# shallow clone yields a complete-looking dashboard with a truncated history.
# A copy made by hand keeps those rules only until someone edits it. A rendered
# copy is checked: `render --check` exits non-zero when it drifts.
#
# Usage:
#   publish-dashboard.sh render [--check] [--adopt] [--repo DIR]
#   publish-dashboard.sh guard --model PATH [--expect-shape SHAPE] [--repo DIR]
#
#   render   write each configured destination's CI file:
#              github-pages -> .github/workflows/dashboard.yml
#              gitlab-pages -> .gitlab/ci/dashboard-pages.yml, included from
#                              .gitlab-ci.yml (a stub is written only when the
#                              project has none; an existing one is never
#                              edited, and --check fails if it lacks the include)
#            Refuses to overwrite a file it did not generate.
#   --check  write nothing; exit 1 naming every stale, missing or orphaned file.
#   --adopt  replace a hand-written CI file with the rendered one, once.
#   guard    run inside a pipeline, after build-dashboard.sh --json: exit 1 if
#            the clone is shallow, the history has <= 1 commit, no task parsed,
#            git was unavailable, or the corpus shape is not SHAPE.
#   --repo   repository root. Default: the enclosing git work tree, else CWD.
#
# dashboard-publish.conf (`key = value`, `#` comments):
#   targets        = github-pages gitlab-pages     # either or both
#   skill_dir      = skills/project-workflow       # inside the repo: a runner
#                                                  # clones the repo, nothing else
#   branch         = master                        # the branch that publishes
#   root           = .ai                           # optional, default .ai
#   expect_shape   = numbered_task                 # optional: numbered_task | sprint_brief
#   status.github-pages = UNVERIFIED - never run   # required per target
#   status.gitlab-pages = UNVERIFIED - never run
#
# Exit codes: 0 ok, 1 stale (render --check) or guard failed, 2 refused.
# Requires python3, standard library only.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

usage() { sed -n '2,46p' "$0" | sed 's/^# \{0,1\}//'; }
case "${1:-}" in
  -h|--help) usage; exit 0 ;;
  "")        usage >&2; exit 2 ;;
esac

command -v python3 >/dev/null 2>&1 || {
  echo "publish-dashboard.sh: MISSING prerequisite: python3" >&2; exit 2; }

exec python3 "$HERE/publish_lib.py" "$@"
