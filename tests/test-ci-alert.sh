#!/usr/bin/env bash
# Prove ci-alert.yml's issue rule offline (TASK-0130).
#
# The alert runs a Python program embedded in .github/workflows/ci-alert.yml,
# so its job needs no checkout and no action (TASK-0124). This extracts that
# program - the lines between `python3 - <<'PY'` and `PY` - loads it without
# running it, and drives its run() against a fake API that records every
# request: the decisions and the side effects both. No network and no git;
# tests/validate.sh runs it.
#
# THE CASE THAT MATTERS MOST is C1: a green run must not close the issue while
# another watched workflow is red. No live run can show it without a red
# default branch.
#
# WHAT THIS PROVES: the program's action and requests for each fixture, and
# that its watched list, concurrency and permissions match what it relies on.
# WHAT IT DOES NOT PROVE: that GitHub delivers the events, answers the API as
# the fixtures assume, or accepts the requests. ci-alert.yml's STATUS line
# says what has been observed.
#
# Usage: tests/test-ci-alert.sh [path/to/ci-alert.yml]   (a copy, for red proofs)
set -euo pipefail
cd "$(dirname "$0")/.."
exec python3 - "${1:-.github/workflows/ci-alert.yml}" <<'TEST'
import contextlib
import io
import os
import re
import sys
import textwrap

path = sys.argv[1]
text = open(path, encoding="utf-8").read()
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))


m = re.search(r"^([ \t]*)python3 - <<'PY'\n(.*?)^\1PY[ \t]*$", text, re.S | re.M)
if not m:
    print("FAIL  %s: no program between python3 - <<'PY' and PY" % path)
    sys.exit(1)
indent, body = m.group(1), m.group(2)

# The program reads its configuration from the environment only when it runs
# as the job. Scrub what the workflow sets, so a program that does its work at
# load time fails here for that reason, and not because a shell exported it.
for k in ("API", "REPO", "GH_TOKEN", "EV", "SIM", "SIM_NAME", "CONCLUSION",
          "WF_NAME", "RUN_ID", "RUN_CREATED", "RUN_EVENT", "RUN_URL", "HEAD_SHA",
          "HEAD_BRANCH", "HEAD_REPO", "TITLE_MSG", "DEFAULT_BRANCH"):
    os.environ.pop(k, None)
ns = {"__name__": "ci_alert_under_test"}
try:
    exec(compile(textwrap.dedent(body), path + " (embedded program)", "exec"), ns)
except BaseException as e:
    print("FAIL  %s: the embedded program ran at load time (%s: %s); it must "
          "only define names behind a __main__ guard" % (path, type(e).__name__, e))
    sys.exit(1)
missing = [n for n in ("run", "decide", "event_from_env", "issue_body", "WATCHED", "MARKER")
           if n not in ns]
if missing:
    print("FAIL  %s: the embedded program defines no %s" % (path, ", ".join(missing)))
    sys.exit(1)
run, WATCHED, MARKER = ns["run"], ns["WATCHED"], ns["MARKER"]
FILE_TO_NAME = {v: k for k, v in WATCHED.items()}

REPO, DEFAULT = "example/repo", "master"


def R(name, rid, hhmm, conclusion, branch=DEFAULT, event="push", repo=REPO):
    """A run shaped like the API's, with no URL in it."""
    return {"name": name, "id": rid, "created_at": "2026-09-30T%s:00Z" % hhmm,
            "status": "completed" if conclusion else "in_progress",
            "conclusion": conclusion, "event": event, "head_branch": branch,
            "head_sha": "%07d" % rid, "head_repository": {"full_name": repo},
            "html_url": "run/%d" % rid, "display_title": "subject %d" % rid}


def wr_env(t):
    return {"REPO": REPO, "DEFAULT_BRANCH": DEFAULT, "EV": "workflow_run",
            "WF_NAME": t["name"], "RUN_ID": str(t["id"]), "RUN_CREATED": t["created_at"],
            "CONCLUSION": t["conclusion"] or "", "RUN_EVENT": t["event"],
            "HEAD_BRANCH": t["head_branch"], "HEAD_SHA": t["head_sha"],
            "HEAD_REPO": t["head_repository"]["full_name"], "RUN_URL": t["html_url"],
            "TITLE_MSG": t["display_title"]}


def sim_env(conclusion, name="validate"):
    return {"REPO": REPO, "DEFAULT_BRANCH": DEFAULT, "EV": "workflow_dispatch",
            "SIM": conclusion, "SIM_NAME": name}


class Fake:
    """A fake GitHub API: canned runs per watched workflow and at most one
    open issue. Records every request."""

    def __init__(self, runs, issue=False, raise_on=None):
        self.runs, self.calls, self.raise_on = runs, [], raise_on
        self.issue = {"number": 7, "title": MARKER} if issue else None

    def __call__(self, method, path, payload=None):
        self.calls.append((method, path, payload))
        if self.raise_on and method == self.raise_on:
            raise RuntimeError("fake API refused %s %s" % (method, path))
        if method == "GET" and "/issues?" in path:
            return [self.issue] if self.issue else []
        if method == "GET" and "/actions/workflows/" in path:
            f = path.split("/actions/workflows/")[1].split("/")[0]
            return {"workflow_runs": [dict(r) for r in self.runs.get(FILE_TO_NAME[f], [])]}
        if method == "POST" and path.endswith("/issues"):
            return {"number": 7}
        return {}

    def of(self, method, frag=""):
        return [c for c in self.calls if c[0] == method and frag in c[1]]


def drive(env, fake):
    # The program logs what it decides; only this test's verdicts are printed.
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            return run(env, fake), None
    except BaseException as e:
        return None, e


def expect(name, env, fake, action, posts=None, patches=0, run_gets=None,
           gets=None, post_has=()):
    got, err = drive(env, fake)
    problems = []
    if err is not None:
        problems.append("raised %s: %s" % (type(err).__name__, err))
    if got != action:
        problems.append("action %r, want %r" % (got, action))
    p = fake.of("POST")
    if posts is not None and len(p) != posts:
        problems.append("%d POST(s), want %d" % (len(p), posts))
    if len(fake.of("PATCH")) != patches:
        problems.append("%d PATCH(es), want %d" % (len(fake.of("PATCH")), patches))
    n = len(fake.of("GET", "/actions/workflows/"))
    if run_gets is not None and n != run_gets:
        problems.append("%d runs GET(s), want %d" % (n, run_gets))
    if gets is not None and len(fake.of("GET")) != gets:
        problems.append("%d GET(s), want %d" % (len(fake.of("GET")), gets))
    for s in post_has:
        if not any(s in ((c[2] or {}).get("body") or (c[2] or {}).get("title") or "")
                   for c in p):
            problems.append("no POST carries %r" % s)
    check(name, not problems, "; ".join(problems))
    return fake


GREEN = {"validate": [R("validate", 101, "11:00", "success")],
         "dashboard": [R("dashboard", 102, "11:01", "success")],
         "dashboard-daily": [R("dashboard-daily", 103, "00:23", "success")]}


def green(**over):
    d = {k: list(v) for k, v in GREEN.items()}
    d.update(over)
    return d


# --- the close rule ----------------------------------------------------------
expect("C1 a green run does not close while another watched workflow is red",
       wr_env(R("dashboard", 201, "12:01", "success")),
       Fake(green(validate=[R("validate", 200, "12:00", "failure")]), issue=True),
       "keep-open", posts=1, patches=0, post_has=("Not closing", "`validate`"))
expect("C2 last night's red dashboard-daily holds the issue open through a green push",
       wr_env(R("validate", 211, "12:05", "success")),
       Fake(green(**{"dashboard-daily": [R("dashboard-daily", 210, "00:23", "failure")]}),
            issue=True),
       "keep-open", posts=1, patches=0, post_has=("`dashboard-daily`",))
expect("C3 closes when every watched workflow's latest run is green",
       wr_env(R("validate", 221, "12:05", "success")),
       Fake(green(validate=[R("validate", 220, "11:00", "failure")]), issue=True),
       "close", posts=1, patches=1, post_has=("Recovered",))
f = expect("C4 a workflow that has never run does not hold the issue open",
           wr_env(R("validate", 231, "12:05", "success")),
           Fake(green(**{"dashboard-daily": []}), issue=True), "close", posts=1, patches=1)
check("C4b the close is a PATCH to closed, completed",
      any(c[2] == {"state": "closed", "state_reason": "completed"} for c in f.of("PATCH")))
expect("C5 a newer cancelled run does not hide an older failure",
       wr_env(R("dashboard", 242, "12:11", "success")),
       Fake(green(validate=[R("validate", 240, "12:00", "failure"),
                            R("validate", 241, "12:10", "cancelled")]), issue=True),
       "keep-open", patches=0)
expect("C6 an unfinished run is not evidence",
       wr_env(R("dashboard", 252, "12:11", "success")),
       Fake(green(validate=[R("validate", 250, "12:00", "failure"),
                            R("validate", 251, "12:10", None)]), issue=True),
       "keep-open", patches=0)
for order in ("API order", "reversed"):
    newest_green = [R("validate", 261, "12:10", "success"), R("validate", 260, "12:00", "failure")]
    newest_red = [R("validate", 265, "12:10", "failure"), R("validate", 264, "12:00", "success")]
    if order == "reversed":
        newest_green.reverse()
        newest_red.reverse()
    expect("C7 the newest run wins, newest green, %s" % order,
           wr_env(R("dashboard", 263, "12:20", "success")),
           Fake(green(validate=newest_green), issue=True), "close", patches=1)
    expect("C7 the newest run wins, newest red, %s" % order,
           wr_env(R("dashboard", 263, "12:20", "success")),
           Fake(green(validate=newest_red), issue=True), "keep-open", patches=0)
expect("C8 the triggering run counts before the API shows it finished",
       wr_env(R("validate", 271, "12:05", "success")),
       Fake(green(validate=[R("validate", 271, "12:05", None),
                            R("validate", 270, "12:00", "failure")]), issue=True),
       "close", patches=1)

# --- what counts as evidence -------------------------------------------------
expect("C9 a failure on a side branch opens nothing and queries nothing",
       wr_env(R("validate", 281, "12:05", "failure", branch="feature")), Fake(green()),
       "ignore-branch", posts=0, gets=0)
expect("C10 a fork's green pull request from a branch named master closes nothing",
       wr_env(R("validate", 291, "12:05", "success", event="pull_request", repo="someone/fork")),
       Fake(green(validate=[R("validate", 290, "12:00", "failure")]), issue=True),
       "ignore-branch", posts=0, gets=0)
expect("C11 a same-repository pull_request run is not default-branch evidence",
       wr_env(R("dashboard", 302, "12:11", "success")),
       Fake(green(validate=[R("validate", 300, "12:00", "failure"),
                            R("validate", 301, "12:10", "success", event="pull_request")]),
            issue=True),
       "keep-open", patches=0)

# --- the failure path --------------------------------------------------------
f = expect("C12 a failure opens the issue, naming the rule and every watched workflow",
           wr_env(R("validate", 311, "12:05", "failure")), Fake(green()), "open",
           posts=1, patches=0, run_gets=0,
           post_has=tuple("`%s`" % n for n in WATCHED) + ("`master`", "closes itself"))
check("C12b the issue carries the marker title",
      any((c[2] or {}).get("title") == MARKER for c in f.of("POST", "/issues")))
expect("C12c a second failure comments rather than opening another",
       wr_env(R("dashboard", 321, "12:06", "failure")), Fake(green(), issue=True), "comment",
       posts=1, patches=0, run_gets=0, post_has=("Still failing",))
expect("C13 a cancelled trigger changes nothing",
       wr_env(R("dashboard", 331, "12:05", "cancelled")), Fake(green(), issue=True),
       "ignore-conclusion", posts=0, gets=0)
expect("C14 a green run with nothing open still evaluates every watched workflow",
       wr_env(R("validate", 341, "12:05", "success")), Fake(green()), "none",
       posts=0, patches=0, run_gets=len(WATCHED))

# --- simulations -------------------------------------------------------------
expect("C15a a simulated success is not evidence: real red keeps the issue open",
       sim_env("success"),
       Fake(green(validate=[R("validate", 350, "12:00", "failure")]), issue=True),
       "keep-open", patches=0)
expect("C15b a simulated success closes only when the real runs are green",
       sim_env("success"), Fake(green(), issue=True), "close", patches=1)
expect("C15c a simulated failure opens the issue",
       sim_env("failure"), Fake(green()), "open", posts=1, run_gets=0)

# --- failing loudly ----------------------------------------------------------
env = wr_env(R("validate", 361, "12:05", "success"))
env.pop("DEFAULT_BRANCH")
got, err = drive(env, Fake(green()))
check("C16 an event naming no default branch fails loudly",
      isinstance(err, SystemExit), "got %r / %r" % (got, err))
junk = [R("validate", 400 + i, "12:%02d" % i, "cancelled") for i in range(30)]
got, err = drive(wr_env(R("dashboard", 499, "13:00", "success")),
                 Fake(green(validate=junk), issue=True))
check("C17 a full page with no run that succeeded or failed is not called green",
      isinstance(err, SystemExit) and "refusing" in str(err), "got %r / %r" % (got, err))
got, err = drive(wr_env(R("validate", 371, "12:05", "failure")),
                 Fake(green(), raise_on="POST"))
check("C18 an API error propagates rather than being swallowed",
      isinstance(err, RuntimeError), "got %r / %r" % (got, err))

# --- the workflow around the program -----------------------------------------
t = re.search(r"^  workflow_run:\n(?:[ \t]*#.*\n)*[ \t]*workflows:[ \t]*\[([^\]]*)\]", text, re.M)
listed = [w.strip().strip("'\"") for w in t.group(1).split(",")] if t else None
check("S1 the trigger list equals WATCHED", listed == list(WATCHED),
      "trigger %r, WATCHED %r" % (listed, list(WATCHED)))
names = {}
for fn in sorted(os.listdir(".github/workflows")):
    if fn.endswith((".yml", ".yaml")):
        src = open(os.path.join(".github/workflows", fn), encoding="utf-8").read()
        nm = re.search(r"^name:[ \t]*['\"]?([^'\"\n]+?)['\"]?[ \t]*$", src, re.M)
        names.setdefault(nm.group(1) if nm else None, []).append(fn)
bad = [n for n, fn in WATCHED.items() if names.get(n) != [fn]]
check("S2 each watched name is the top-level name: of its file, and of no other",
      not bad, "mismatched %r in %r" % (bad, names))
c = re.search(r"^concurrency:\n((?:  .*\n)+)", text, re.M)
cb = c.group(1) if c else ""
check("S3 concurrency keeps every alert: cancel-in-progress false, queue max",
      re.search(r"^  cancel-in-progress: false[ \t]*$", cb, re.M)
      and re.search(r"^  queue: max[ \t]*$", cb, re.M), repr(cb))
p = re.search(r"^permissions:\n((?:  .*\n)+)", text, re.M)
pl = sorted(l.strip() for l in (p.group(1) if p else "").splitlines() if l.strip())
check("S4 permissions are exactly contents: read, actions: read, issues: write",
      pl == ["actions: read", "contents: read", "issues: write"], repr(pl))
b = ns["issue_body"]("d", "master")
check("S5 the issue body names every watched workflow and the branch",
      all("`%s`" % n in b for n in WATCHED) and "`master`" in b)
bad_lines = [i for i, l in enumerate(body.split("\n"), 1)
             if l.strip() and (not l.startswith(indent) or "\t" in l)]
check("S6 every program line keeps the heredoc's indentation, with no tab",
      not bad_lines, "lines %r" % bad_lines[:5])
check("S7 no ${{ expression inside the program", "${{" not in body)

for name, ok, detail in results:
    print(("PASS  %s" % name) if ok else ("FAIL  %s: %s" % (name, detail)))
print()
fails = [r for r in results if not r[1]]
if fails:
    print("test-ci-alert.sh: %d of %d case(s) FAILED" % (len(fails), len(results)))
    sys.exit(1)
print("test-ci-alert.sh: OK (%d cases)" % len(results))
TEST
