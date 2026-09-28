#!/usr/bin/env bash
# Prove the dashboard reader still reads a project-workflow layout correctly.
#
# WHY A FIXTURE AND NOT THIS REPOSITORY. ai-toolbox's own .ai/ is
# project-migration-shaped, so running the reader against it exercises exactly
# one of the two layouts the reader claims to support -- and every defect
# specific to the other one is invisible. The fixture under
# fixtures/dashboard/ is project-workflow-shaped, and writing it found three
# real defects on the spot: the task-id pattern swallowed the `.md`
# extension; an identifier field was cleaned as prose, turning
# `S001_Foundation` into `S001Foundation (see ../30.ROADMAP.md...)`; and a
# sprint the plan calls `S002` never matched a brief saying `S002_Performance`,
# so every sprint in that layout fell into the "outside a sprint" bucket with
# the velocity chart empty. Each assertion below is one of those, plus the
# figures that would move if the metric code changed.
#
# It is also the only place an OPEN sprint is exercised. No sprint is open in
# this repository, so that path has no other cover.
#
# WHAT THIS PROVES: that the reader extracts the identifiers, dates, statuses,
# estimates and sprint records a project-workflow layout actually contains,
# and that the metrics derived from them still come out at known values.
# WHAT IT DOES NOT PROVE: anything about the HTML, the charts, the themes or
# the stylesheet -- those need a browser, and this deliberately needs nothing
# but python3. Nor anything about a project-migration layout, which this
# repository's own .ai/ covers by being one.
#
# Nothing in this repository runs this script automatically. It is NOT part of
# tests/validate.sh and does not belong there: the mandatory gate is hermetic
# and this is a component check its author runs. Invoke it by hand.
#
#   check-dashboard.sh            # assert against fixtures/dashboard
#   check-dashboard.sh --print    # dump what the reader saw, for diffing
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SKILL="$(dirname "$HERE")"

command -v python3 >/dev/null 2>&1 || {
  echo "check-dashboard.sh: MISSING prerequisite: python3" >&2; exit 1; }

MODE="${1:-}"

SKILL="$SKILL" MODE="$MODE" python3 - <<'PY'
import os
import sys

skill = os.environ["SKILL"]
sys.path.insert(0, os.path.join(skill, "scripts"))
import dashboard_lib as D

root = os.path.join(skill, "fixtures", "dashboard")
if not os.path.isdir(root):
    sys.exit("check-dashboard.sh: missing fixture at %s" % root)

# No git: the fixture is not a repository, and the reader must not need one.
model = D.build_model(root, repo=root, use_git=False, project="fixture")
S = model["series"]
tasks = {t["id"]: t for t in model["tasks"]}
sprints = {s["id"]: s for s in S["sprints"]}

if os.environ.get("MODE") == "--print":
    import json
    json.dump({"tasks": sorted(tasks), "sprints": {k: {
        "state": v["state"], "tasks": v["tasks"], "done": v["done"],
        "points": v["points"], "points_done": v["points_done"]}
        for k, v in sprints.items()}, "kpi": S["kpi"]},
        sys.stdout, indent=1, sort_keys=True)
    sys.exit(0)

fail = []


def eq(label, got, want):
    if got != want:
        fail.append("%s: got %r, want %r" % (label, got, want))


def has(label, container, key):
    if key not in container:
        fail.append("%s: %r missing from %s" % (label, key, sorted(container)))


def at(container, key):
    """Look up, reporting a miss as a mismatch instead of a traceback.

    A checker that dies with a KeyError still fails, but it reports the line
    it crashed on rather than the assertion that broke -- which is the wrong
    end of the problem for whoever has to fix it. Verified by reverting each
    of the three fixes above and reading what this printed.
    """
    if key not in container:
        fail.append("missing entry %r; saw %s" % (key, sorted(container)))
        return {}
    return container[key]


# 1. The id stops at the extension. `S\d+\.T\d+(?:_(\S+))?` matched
#    `Scaffold.md` and put the file extension inside the identifier.
has("task id excludes the .md extension", tasks, "S001.T001_Scaffold")
eq("no id carries an extension",
   [i for i in tasks if i.endswith(".md")], [])

# 2. An identifier is not prose. The schema's own preamble emits
#    "**Sprint**: `S001_Foundation` (see ../30.ROADMAP.md for what this
#    sprint means)"; cleaning it as markdown stripped the underscore as
#    emphasis and kept the parenthetical.
eq("sprint field yields a bare identifier",
   at(tasks, "S001.T001_Scaffold").get("sprint"), "S001_Foundation")

# 3. The plan's heading says S002 and the briefs say S002_Performance. A
#    record keyed on the heading matches no task, is dropped for having no
#    members, and the velocity chart comes out empty.
has("sprint record adopts the id the briefs use", sprints, "S002_Performance")
eq("the open sprint is detected", at(sprints, "S002_Performance").get("state"), "open")
eq("the closed sprint is detected", at(sprints, "S001_Foundation").get("state"), "closed")
eq("velocity has a row per sprint", len(S["velocity"]), 2)

# 4. A declared estimate is read; the default is one point per task.
eq("declared points are read", at(tasks, "S002.T003_Docs").get("points"), 13.0)
eq("committed points", at(sprints, "S002_Performance").get("points"), 23.0)
eq("delivered points", at(sprints, "S002_Performance").get("points_done"), 8.0)

# 5. The preamble status vocabulary of this framework.
eq("completed -> done", at(tasks, "S001.T001_Scaffold").get("status"), "done")
eq("in progress -> doing", at(tasks, "S002.T002_Metrics").get("status"), "doing")
eq("not started -> todo", at(tasks, "S002.T003_Docs").get("status"), "todo")

# 6. The rest of the layout.
eq("ad-hoc entries are the backlog here", len(model["backlog"]), 3)
eq("open ad-hoc entries",
   sum(1 for b in model["backlog"] if b["status"] != "done"), 2)
eq("roadmap phases", len(model["phases"]), 3)
eq("an undeclared phase stays open",
   [p["state"] for p in model["phases"]], ["done", "done", "todo"])
eq("decisions", len(model["adrs"]), 1)
eq("reviews", len(model["reviews"]), 1)
eq("tasks", S["kpi"]["tasks"], 5)
eq("closed tasks", S["kpi"]["done"], 3)

# 7. The series the charts read, so a metric change cannot pass silently.
eq("burn-up ends at total scope", S["burnup"][-1]["scope"], 31.0)
eq("burn-up ends at delivered", S["burnup"][-1]["done"], 16.0)
eq("per-sprint burn-down has a window",
   len(at(sprints, "S002_Performance").get("burn") or []) > 1, True)

for msg in fail:
    print("FIXTURE MISMATCH: %s" % msg)
if fail:
    print("\ncheck-dashboard.sh: %d assertion(s) failed" % len(fail))
    sys.exit(1)
print("check-dashboard.sh: OK (%d assertions, project-workflow fixture)" % 26)
PY
