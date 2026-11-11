#!/usr/bin/env bash
# Prove the vendored dashboard reader still reads a sprint-brief layout.
#
# WHY A FIXTURE AND NOT THIS REPOSITORY. ai-toolbox's own .ai/ is
# numbered-task-shaped (TASK-####), so running the reader against it exercises
# exactly one of the two layouts it supports -- and every defect specific to the
# other one is invisible. The fixture under fixtures/dashboard/ is
# sprint-brief-shaped (S###.T###).
#
# IT HAS NOW EARNED ITS PLACE TWICE. Writing it for TASK-0122 found three
# defects in that generator. Re-pointing it at the vendored one for TASK-0125
# found three more, in a generator that was already passing every check in its
# own repository:
#
#   1. The fixture parsed to ZERO tasks. Its briefs are named
#      `S001.T001_Name.md`; the reader required `S001_Sprint.T001_Name.md`, the
#      spelling its author's own repository happens to use. A reader that
#      accepts one project's spelling works in exactly one project.
#   2. Every pending task reported "no lane assigned in LANES". That reader's
#      home repository owns an execution-lane table keyed by ITS task ids, and
#      it was being applied to a foreign corpus -- so `--check` would have
#      failed for every consumer of this skill, over a policy they do not have.
#   3. Hand-recorded `**Created**`/`**Updated**` fields were ignored in favour
#      of git and then the filesystem mtime. This fixture carries real dates and
#      produced none, so its per-sprint burn-down had no window at all.
#
# It is also the only place an OPEN sprint is exercised -- no sprint is open in
# this repository -- and the only place a FULLY ESTIMATED corpus is exercised:
# every brief here carries `**Points**`, so `units.primary` flips to "points", a
# branch this repository can never reach because nothing in it is estimated.
#
# WHAT THIS PROVES: that the reader extracts the identifiers, dates, statuses,
# estimates and sprint records a sprint-brief layout actually contains, and that
# the figures derived from them come out at known values.
# WHAT IT DOES NOT PROVE: anything about the HTML, the charts, the themes or the
# stylesheet -- those need a browser, and this deliberately needs nothing but
# python3. Nor anything about the numbered-task layout, which this repository's
# own .ai/ covers by being one.
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
sys.path.insert(0, os.path.join(skill, "dashboard"))
import pm_dashboard as D

root = os.path.join(skill, "fixtures", "dashboard")
if not os.path.isdir(root):
    sys.exit("check-dashboard.sh: missing fixture at %s" % root)

# No git: the fixture is not a repository, and the reader must not need one.
payload = D.build_payload(root, use_git=False)
tasks = {t["id"]: t for t in payload["tasks"]}
sprints = {s["id"]: s for s in payload["sprints"]}
metrics = payload["metrics"]

if os.environ.get("MODE") == "--print":
    import json
    json.dump({
        "tasks": sorted(tasks),
        "sprints": {k: {"state": v["state"], "label": v["label"],
                        "task_count": v["task_count"], "done_count": v["done_count"],
                        "points_total": v["points_total"]}
                    for k, v in sprints.items()},
        "units": payload["units"],
        "phases": [(p["number"], p["state"], p["date"]) for p in payload["phases"]],
        "totals": metrics["totals"],
        "defects": payload["defects"],
    }, sys.stdout, indent=1, sort_keys=True)
    sys.exit(0)

fail = []
checks = 0


def eq(label, got, want):
    global checks
    checks += 1
    if got != want:
        fail.append("%s: got %r, want %r" % (label, got, want))


def has(label, container, key):
    global checks
    checks += 1
    if key not in container:
        fail.append("%s: %r missing from %s" % (label, key, sorted(container)))


def at(container, key):
    """Look up, reporting a miss as a mismatch instead of a traceback.

    A checker that dies with a KeyError still fails, but it reports the line it
    crashed on rather than the assertion that broke -- the wrong end of the
    problem for whoever has to fix it.
    """
    if key not in container:
        fail.append("missing entry %r; saw %s" % (key, sorted(container)))
        return {}
    return container[key]


# 1. The fixture parses at all -- it did not, until the reader stopped
#    requiring a sprint name in the filename.
eq("every brief is read", len(tasks), 5)
has("a brief with no sprint name in its filename is read", tasks, "S001.T001")
eq("no id carries an extension", [i for i in tasks if i.endswith(".md")], [])

# 2. No defect is invented against a foreign corpus.
eq("a foreign corpus raises no lane defects", payload["defects"], [])

# 3. A sprint with no recorded name is labelled by id alone, with no dangling
#    separator.
eq("sprint label omits an unrecorded name", at(sprints, "S001").get("label"), "S001")

# 4. Both sprint states, including the open one this repository cannot show.
eq("the closed sprint is detected", at(sprints, "S001").get("state"), "closed")
eq("the open sprint is detected", at(sprints, "S002").get("state"), "active")
eq("velocity has a row per sprint", len(metrics["velocity"]), 2)

# 5. Hand-recorded dates are used, so the per-sprint burn has a real window.
eq("both sprints have a burn series", sorted(metrics["sprint_burn"]), ["S001", "S002"])
eq("the burn window is more than one point",
   len(metrics["sprint_burn"].get("S002") or []) > 1, True)
eq("a Created field dates the brief",
   at(tasks, "S002.T001").get("created_at_source"), "created_field")

# 6. Declared estimates, and the fully-estimated branch.
eq("declared points are read", at(tasks, "S002.T003").get("points"), 13)
eq("points coverage is complete", payload["units"]["points_coverage"], 1.0)
eq("a fully estimated corpus counts points", payload["units"]["primary"], "points")
eq("points total is summed", payload["units"]["points_total"], 31)
eq("committed points per sprint", at(sprints, "S002").get("points_total"), 23)

# 7. Membership and counts.
eq("S001 holds two briefs", at(sprints, "S001").get("task_count"), 2)
eq("S001 is fully delivered", at(sprints, "S001").get("done_count"), 2)
eq("S002 holds three briefs", at(sprints, "S002").get("task_count"), 3)
eq("S002 has one delivered", at(sprints, "S002").get("done_count"), 1)
eq("closed tasks", metrics["totals"]["done"], 3)

# 8. The status vocabulary of this layout.
eq("completed -> done", at(tasks, "S001.T001").get("state"), "done")
eq("in progress -> in_progress",
   at(tasks, "S002.T002").get("workflow_state"), "in_progress")
eq("not started -> not_started",
   at(tasks, "S002.T003").get("workflow_state"), "not_started")

# 9. The other artifact families, read from the same root.
eq("ad-hoc items are read", len(payload["adhoc"]), 3)
eq("the ad-hoc list also fills the backlog key", len(payload["backlog"]), 3)
eq("an ad-hoc list grades nothing",
   sorted({b["priority"] for b in payload["backlog"]}), ["unrated"])
eq("roadmap phases are read", len(payload["phases"]), 3)
eq("an undated phase stays open",
   [(p["state"], p["date"] is None) for p in payload["phases"]],
   [("done", False), ("done", False), ("open", True)])
eq("decisions are read", len(payload["decisions"]), 1)
eq("reviews are read", len(payload["reviews"]), 1)

# 10. The payload satisfies its own schema, and --no-git says so out loud.
eq("the payload passes its own validator", D.validate(payload), [])
eq("schema version", payload["schema_version"], 2)
eq("the corpus shape is detected", payload["project"]["corpus_shape"], "sprint_brief")
eq("git is reported unavailable", payload["project"]["git_available"], False)
eq("the --no-git degradation is stated, not silent",
   any("--no-git" in n for n in payload["provenance"]["notes"]), True)

if fail:
    print("check-dashboard.sh: FAILED")
    for f in fail:
        print("  FIXTURE MISMATCH: %s" % f)
    sys.exit(1)

print("check-dashboard.sh: OK (%d assertions, sprint-brief fixture)" % checks)
PY
