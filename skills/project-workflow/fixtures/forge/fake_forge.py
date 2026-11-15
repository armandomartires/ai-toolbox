#!/usr/bin/env python3
"""A fake `gh` and `glab` for check-tracker.sh: canned JSON, no network.

FIXTURE, not a client. `fake_forge.py gh|glab ARGS...` answers the read calls
forge_export.py makes, as the real CLIs shape them, and refuses anything else
with exit 3, so a write call is a test failure, not a silent pass. Each call
is appended to $FAKE_FORGE_LOG when it is set. FAKE_FORGE_AUTH=fail makes
`auth status` fail, as an unauthenticated CLI does.

The data is invented. Bodies come from this directory and from
../complete-task.md, the fixture check-artifact.sh passes.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def body(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as fh:
        return fh.read()


DONE = body("../complete-task.md")
OPEN = body("open-task.md")
REVIEW = body("review.md")
REPORT = ("Result:   done - the headers are set\n"
          "Verified: pytest -q -> 16 passed\n")


def gh_issue(n, title, b, state="OPEN", reason="", labels=(), milestone=None,
             comments=(), created="2026-02-01T09:00:00Z", closed=None):
    return {"number": n, "title": title, "body": b, "state": state,
            "stateReason": reason, "labels": [{"name": l} for l in labels],
            "milestone": {"title": milestone} if milestone else None,
            "comments": [{"body": c, "author": {"login": "x"}} for c in comments],
            "createdAt": created, "closedAt": closed}


GH_ISSUES = [
    gh_issue(1, "Wire the export", OPEN, labels=["status: in_progress", "type: task"],
             milestone="S002_Beta"),
    gh_issue(2, "S002.T005 Cache headers", DONE, "CLOSED", "COMPLETED",
             milestone="S002_Beta", comments=["Looks good.", REPORT],
             closed="2026-02-20T10:00:00Z"),
    gh_issue(3, "Drop the old cache", OPEN, "CLOSED", "NOT_PLANNED", milestone="S1",
             closed="2026-01-10T10:00:00Z"),
    gh_issue(4, "Slow cold start", "Ready when: a profile exists.\n\nStartup takes 4 s.",
             labels=["type: backlog", "priority: low"]),
    gh_issue(5, "Untriaged idea", OPEN),
    gh_issue(6, "S002 checkpoint", REVIEW, "CLOSED", "COMPLETED",
             labels=["type: review"], milestone="S002_Beta",
             closed="2026-03-01T10:00:00Z"),
    gh_issue(7, "Half written", "Just a sentence.", labels=["status: ready"],
             milestone="S002_Beta"),
    gh_issue(8, "S002.T001 Existing", DONE, "CLOSED", "COMPLETED",
             labels=["migrated"], milestone="S002_Beta",
             closed="2026-01-05T10:00:00Z"),
]
GH_MILESTONES = [
    [{"title": "S002_Beta", "due_on": "2026-03-01T00:00:00Z", "state": "open"}],
    [{"title": "S1", "due_on": None, "state": "closed"}],
]


def gl_issue(iid, title, b, state="opened", labels=(), milestone=None):
    return {"iid": iid, "title": title, "description": b, "state": state,
            "labels": list(labels),
            "milestone": {"title": milestone} if milestone else None,
            "created_at": "2026-04-01T09:00:00Z",
            "closed_at": "2026-04-09T09:00:00Z" if state == "closed" else None}


GL_ISSUES = [
    gl_issue(10, "Wire the export", OPEN, labels=["status::review", "phase::2"],
             milestone="S003_Gamma"),
    gl_issue(11, "Cache headers", DONE, "closed", milestone="S003_Gamma"),
]
GL_NOTES = {11: [{"body": "changed milestone to %S003_Gamma", "system": True},
                 {"body": REPORT, "system": False}]}
GL_MILESTONES = [{"title": "S003_Gamma", "due_date": "2026-12-01", "state": "active"},
                 {"title": "v1.0", "due_date": None, "state": "active"}]


def out(value):
    sys.stdout.write(json.dumps(value))
    sys.stdout.write("\n")


def arg(args, flag):
    return args[args.index(flag) + 1] if flag in args else None


def main(argv):
    log = os.environ.get("FAKE_FORGE_LOG")
    if log:
        with open(log, "a", encoding="utf-8") as fh:
            fh.write(" ".join(argv) + "\n")
    tool, args = argv[0], argv[1:]
    if args[:2] == ["auth", "status"]:
        if os.environ.get("FAKE_FORGE_AUTH") == "fail":
            sys.stderr.write("You are not logged into any hosts\n")
            return 1
        return 0
    if tool == "gh" and args[:2] == ["issue", "list"]:
        if arg(args, "--repo") != "owner/name":
            sys.stderr.write("could not resolve to a Repository\n")
            return 1
        state = arg(args, "--state")
        out([i for i in GH_ISSUES if state == "all" or i["state"] == "OPEN"])
        return 0
    if tool == "gh" and args[:2] == ["api", "--paginate"] and "/milestones" in args[2]:
        for page in GH_MILESTONES:      # one array per page, as --paginate prints
            out(page)
        return 0
    if tool == "glab" and args[:1] == ["api"]:
        path = args[-1]
        if not path.startswith("projects/group%2Fsub%2Fname/"):
            sys.stderr.write("404 Project Not Found\n")
            return 1
        if "/issues?" in path:
            want = path.split("state=")[1].split("&")[0]
            out([i for i in GL_ISSUES if want == "all" or i["state"] == want])
            return 0
        if "/notes?" in path:
            out(GL_NOTES.get(int(path.split("/issues/")[1].split("/")[0]), []))
            return 0
        if "/milestones?" in path:
            out(GL_MILESTONES)
            return 0
    sys.stderr.write("fake_forge: not a read call this fixture answers: %s\n"
                     % " ".join(argv))
    return 3


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
