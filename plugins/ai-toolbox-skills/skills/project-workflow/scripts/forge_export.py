#!/usr/bin/env python3
"""Export a forge tracker's work into .ai/ files: the way back to `files`.

Driven by `tracker.sh export`; see that file for usage. Standard library only.

WHY THIS EXISTS (S019.T001, ADR-0067 in ai-toolbox). Moving a project from
files to GitLab or GitHub is documented and one-way: the briefs become issues
and the old files leave with `git rm`, kept under the `pre-forge-migration`
tag. Going back means writing the forge's issues and milestones as briefs
again. This module reads them through `glab` or `gh` and writes them, through
templates/reference/tracker.md's mapping table run backwards, into a fresh
directory a person merges by hand.

IT ONLY READS THE FORGE. Every call is `auth status`, `issue list` or a GET
through `api`; nothing is closed, labelled or edited. Closing the forge's
issues afterwards is the human's step (tracker.md, *Changing the tracker back
to files*).

IT NEVER WRITES INTO AN EXISTING .ai/. The output directory must be new or
empty, so a restored `pre-forge-migration` layer and the export are merged
by a person who can see both.

WHAT IT PROVES: that each issue became a file in the convention's shape, and
which files the artifact schemas reject (it lists them; it fixes nothing).
WHAT IT DOES NOT PROVE: that an issue body held the task schema, that the
prose is true, or that the forge was complete. Ids are assigned here, so a
brief's T number is new unless the issue already named one.
"""
import datetime
import json
import os
import re
import shlex
import subprocess
import sys
import urllib.parse

import artifact_lib

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMAS = os.path.join(os.path.dirname(HERE), "schemas")
# The CLI to run, overridable as a command line (a wrapper, or the gate's fake
# forge). Never a token: the CLIs read their own configuration.
CLI_ENV = {"github": "TRACKER_GH", "gitlab": "TRACKER_GLAB"}
CLI_DEFAULT = {"github": "gh", "gitlab": "glab"}

TASK_ID = re.compile(r"\bS(\d{3})\.T(\d{3})(?!\d)")
SPRINT = re.compile(r"^S(\d{1,3})(?:_([A-Za-z0-9][A-Za-z0-9_-]*))?$")
# Forge status label -> files status (tracker.md, *Labels and statuses*).
STATUS = {"in_progress": "in progress", "blocked": "blocked",
          "review": "review", "ready": "not started",
          "deferred": "not started"}
NO_FILES_STATUS = ("ready", "deferred")


class Refusal(Exception):
    """A condition the user must fix; exit 2 with the message."""


# --- reading the forge -----------------------------------------------------------

def cli(tracker):
    return shlex.split(os.environ.get(CLI_ENV[tracker]) or CLI_DEFAULT[tracker])


def run(base, args):
    cmd = base + args
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True,
                              encoding="utf-8")
    except FileNotFoundError:
        raise Refusal("%s is not on PATH; install it, or point %s at it"
                      % (base[0], "TRACKER_GH or TRACKER_GLAB"))
    if proc.returncode != 0:
        last = (proc.stderr.strip().splitlines() or ["no output"])[-1]
        raise Refusal("`%s` failed (exit %d): %s"
                      % (" ".join(args[:2]), proc.returncode, last))
    return proc.stdout


def json_values(text):
    """Every JSON value in text, lists flattened: `--paginate` prints one
    array per page, back to back."""
    out, dec, i = [], json.JSONDecoder(), 0
    text = text.strip()
    while i < len(text):
        value, i = dec.raw_decode(text, i)
        out.extend(value if isinstance(value, list) else [value])
        while i < len(text) and text[i].isspace():
            i += 1
    return out


def label_value(labels, key):
    """`status::x` (GitLab) or `status: x` (GitHub) -> x, else None."""
    for name in labels:
        m = re.match(r"^%s(?:::|:\s*)(.+)$" % key, name)
        if m:
            return m.group(1).strip()
    return None


def day(stamp):
    return (stamp or "")[:10] or None


def fetch_github(cmd, repo, state):
    run(cmd, ["auth", "status"])
    fields = ("number,title,body,state,stateReason,labels,milestone,"
              "comments,createdAt,closedAt")
    raw = json_values(run(cmd, ["issue", "list", "--repo", repo, "--state",
                                 state, "--limit", "1000", "--json", fields]))
    issues = []
    for it in raw:
        labels = [l["name"] for l in it.get("labels") or []]
        closed = it.get("state", "").upper() == "CLOSED"
        report = [c.get("body", "") for c in it.get("comments") or []]
        issues.append({
            "number": it["number"], "title": it.get("title", ""),
            "body": it.get("body") or "", "closed": closed,
            "cancelled": closed and (it.get("stateReason") == "NOT_PLANNED"
                                     or "cancelled" in labels),
            "labels": labels,
            "milestone": (it.get("milestone") or {}).get("title"),
            "comments": report,
            "created": day(it.get("createdAt")),
            "closed_on": day(it.get("closedAt")),
        })
    miles = json_values(run(cmd, ["api", "--paginate",
                                   "repos/%s/milestones?state=all&per_page=100"
                                   % repo]))
    milestones = [{"title": m["title"], "due": day(m.get("due_on")),
                   "closed": m.get("state") == "closed"} for m in miles]
    return issues, milestones


def fetch_gitlab(cmd, project, state):
    run(cmd, ["auth", "status"])
    base = "projects/%s" % urllib.parse.quote(project, safe="")
    want = {"open": "opened", "all": "all"}[state]
    raw = json_values(run(cmd, ["api", "--paginate", "%s/issues?state=%s&per_page=100"
                                 % (base, want)]))
    issues = []
    for it in raw:
        labels = list(it.get("labels") or [])
        closed = it.get("state") == "closed"
        comments = []
        if closed:
            # Only a closed issue carries a task report, as its closing comment.
            notes = json_values(run(cmd, ["api", "%s/issues/%d/notes?sort=asc&per_page=100"
                                           % (base, it["iid"])]))
            comments = [n.get("body", "") for n in notes if not n.get("system")]
        issues.append({
            "number": it["iid"], "title": it.get("title", ""),
            "body": it.get("description") or "", "closed": closed,
            "cancelled": closed and "cancelled" in labels,
            "labels": labels,
            "milestone": (it.get("milestone") or {}).get("title"),
            "comments": comments,
            "created": day(it.get("created_at")),
            "closed_on": day(it.get("closed_at")),
        })
    miles = json_values(run(cmd, ["api", "--paginate", "%s/milestones?per_page=100"
                                   % base]))
    milestones = [{"title": m["title"], "due": day(m.get("due_date")),
                   "closed": m.get("state") == "closed"} for m in miles]
    return issues, milestones


# --- mapping ----------------------------------------------------------------------

def sprint_of(milestone):
    """`S011_Name` -> ("S011", "S011_Name"); `S3` -> ("S003", "S003"); else None."""
    m = SPRINT.match(milestone or "")
    if not m:
        return None
    sid = "S%03d" % int(m.group(1))
    return sid, ("%s_%s" % (sid, m.group(2)) if m.group(2) else sid)


def pascal(title, number):
    title = TASK_ID.sub("", title)
    words = re.findall(r"[A-Za-z0-9]+", title)
    name = ""
    for w in words:
        if len(name) + len(w) > 48:
            break
        name += w[:1].upper() + w[1:]
    return name or "Issue%d" % number


def slug(title):
    return "-".join(re.findall(r"[a-z0-9]+", title.lower()))[:48] or "review"


def used_ids(repo):
    """{sprint: {T numbers}} already taken by briefs in the repository."""
    used = {}
    tasks = os.path.join(repo, ".ai", "tasks")
    for _root, _dirs, files in os.walk(tasks):
        for f in files:
            m = TASK_ID.match(f)
            if m:
                used.setdefault("S" + m.group(1), set()).add(int(m.group(2)))
    return used


def status_of(issue, notes):
    if issue["closed"]:
        return "cancelled" if issue["cancelled"] else "completed"
    value = label_value(issue["labels"], "status")
    if value is None:
        return "not started"
    if value in NO_FILES_STATUS:
        notes.append("#%d: status %s has no files status; written as not started"
                     % (issue["number"], value))
    if value not in STATUS:
        notes.append("#%d: unknown status label %r; written as not started"
                     % (issue["number"], value))
    return STATUS.get(value, "not started")


def set_field(lines, field, value, after):
    """Replace `**field**: ...`, else insert it after the line index `after`."""
    pat = re.compile(r"^\*\*%s\*\*:" % re.escape(field))
    for i, line in enumerate(lines):
        if pat.match(line):
            lines[i] = "**%s**: %s" % (field, value)
            return i
    lines.insert(after + 1, "**%s**: %s" % (field, value))
    return after + 1


def with_title(body, h1):
    """The body with its first heading line set to `# h1`."""
    lines = body.replace("\r\n", "\n").strip("\n").split("\n") if body.strip() else []
    first = next((i for i, l in enumerate(lines) if l.strip()), None)
    if first is not None and lines[first].startswith("# "):
        lines[first] = "# " + h1
        return lines, first
    return ["# " + h1, ""] + lines, 0


def task_report(issue):
    """The closing comment that holds a task report (`Result:` line), or None."""
    for body in reversed(issue["comments"]):
        if re.search(r"(?m)^\s*Result:", body):
            return body.replace("\r\n", "\n").strip()
    return None


def brief(issue, tid, sprint_name, status, source):
    lines, h1 = with_title(issue["body"], tid)
    # The identification block follows the H1 and its blank line.
    anchor = h1 + 1 if h1 + 1 < len(lines) and not lines[h1 + 1].strip() else h1
    at = set_field(lines, "Status", status, anchor)
    at = set_field(lines, "Sprint", "`%s`" % sprint_name, at)
    set_field(lines, "Forge issue", "#%d (%s)" % (issue["number"], source), at)
    report = task_report(issue) if issue["closed"] else None
    if report and not any(l.strip() == "## Task report" for l in lines):
        lines += ["", "## Task report", "", "Closing comment of #%d:" % issue["number"],
                  "", "```", report, "```"]
    return "\n".join(lines).rstrip("\n") + "\n"


# --- export -----------------------------------------------------------------------

def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)


def export(repo, tracker, project, out, state):
    if tracker == "files":
        raise Refusal("tracker.conf declares files: there is no forge to export "
                      "from (the .ai/ files are the tracker)")
    if os.path.exists(out) and (not os.path.isdir(out) or os.listdir(out)):
        raise Refusal("%s exists and is not empty; export writes only into a new "
                      "or empty directory, never over planning files" % out)
    cmd = cli(tracker)
    fetch = fetch_github if tracker == "github" else fetch_gitlab
    issues, milestones = fetch(cmd, project, state)
    source = "%s %s" % (tracker, project)
    today = datetime.date.today().isoformat()
    issues.sort(key=lambda i: i["number"])

    notes, written, adhoc, idmap = [], [], {"open": [], "resolved": []}, []
    used = used_ids(repo)
    tasks = []
    for issue in issues:
        kind = label_value(issue["labels"], "type") or "task"
        if label_value(issue["labels"], "phase"):
            notes.append("#%d: phase label %s is not carried; place its sprint in "
                         "30.ROADMAP.md by hand" % (issue["number"],
                                                    label_value(issue["labels"], "phase")))
        if kind in ("backlog", "adhoc"):
            adhoc["resolved" if issue["closed"] else "open"].append(issue)
        elif kind == "review":
            sprint = sprint_of(issue["milestone"])
            if sprint and "checkpoint" in issue["title"].lower():
                rid = "%s-checkpoint" % sprint[0]
            else:
                rid = "%s-%s" % (issue["closed_on"] or issue["created"] or today,
                                 slug(issue["title"]))
            lines, _ = with_title(issue["body"], rid)
            rel = "reviews/%s.md" % rid
            write(os.path.join(out, rel), "\n".join(lines).rstrip("\n") + "\n")
            written.append((rel, "review"))
            idmap.append((issue["number"], rid, rel))
        elif kind == "task":
            sprint = sprint_of(issue["milestone"])
            if sprint is None:
                why = ("no milestone" if not issue["milestone"]
                       else "milestone %r is not S###_Name" % issue["milestone"])
                notes.append("#%d: a task with %s; listed as an ad-hoc entry"
                             % (issue["number"], why))
                adhoc["resolved" if issue["closed"] else "open"].append(issue)
                continue
            m = TASK_ID.search(issue["title"]) or TASK_ID.search(issue["body"][:200])
            kept = None
            if m and "S" + m.group(1) == sprint[0]:
                kept = int(m.group(2))
                if kept in used.get(sprint[0], set()) and "migrated" in issue["labels"]:
                    # Filed from a brief at the move to the forge (tracker.md,
                    # *Changing the tracker*), and that brief is back in the
                    # repository: the issue is a copy, not new work.
                    notes.append("#%d: a migrated copy of S%s.T%03d, which the "
                                 "repository holds; skipped"
                                 % (issue["number"], m.group(1), kept))
                    continue
                if kept in used.get(sprint[0], set()):
                    notes.append("#%d: names S%s.T%03d, which is taken; given a new id"
                                 % (issue["number"], m.group(1), kept))
                    kept = None
                else:
                    used.setdefault(sprint[0], set()).add(kept)
            tasks.append((issue, sprint, kept))
        else:
            notes.append("#%d: unknown type %r; exported as a task"
                         % (issue["number"], kind))
            issue["labels"] = [l for l in issue["labels"]
                               if label_value([l], "type") is None]
            sprint = sprint_of(issue["milestone"])
            if sprint is None:
                adhoc["resolved" if issue["closed"] else "open"].append(issue)
            else:
                tasks.append((issue, sprint, None))

    for issue, sprint, kept in tasks:
        taken = used.setdefault(sprint[0], set())
        number = kept
        if number is None:
            # After the highest id in use, never into a gap: a gap may be a
            # brief that lives only in history (the pre-forge-migration tag).
            number = max(taken | {0}) + 1
            taken.add(number)
        tid = "%s.T%03d_%s" % (sprint[0], number, pascal(issue["title"], issue["number"]))
        rel = "tasks/%s.md" % tid
        status = status_of(issue, notes)
        write(os.path.join(out, rel), brief(issue, tid, sprint[1], status, source))
        written.append((rel, "task"))
        idmap.append((issue["number"], tid.split("_", 1)[0], rel))

    if adhoc["open"] or adhoc["resolved"]:
        parts = ["# Ad-hoc entries exported from %s on %s" % (source, today), "",
                 "Merge each entry into `35.AD_HOC_TASKS.md` by hand: give it the "
                 "next free number, keep its *Ready when* line, and update the "
                 "open count.", ""]
        for section, items in (("Open", adhoc["open"]), ("Resolved", adhoc["resolved"])):
            if not items:
                continue
            parts += ["## %s" % section, ""]
            for it in items:
                body = it["body"].replace("\r\n", "\n").strip()
                parts += ["### #%d. %s" % (it["number"], it["title"]), ""]
                if re.search(r"(?m)^#", body):
                    # A task-shaped body: quoted, so its headings stay inside
                    # this entry instead of becoming the list's own.
                    body = "\n".join(("> " + l).rstrip() for l in body.split("\n"))
                if body:
                    parts += [body, ""]
        write(os.path.join(out, "35.AD_HOC_TASKS.fragment.md"),
              "\n".join(parts).rstrip("\n") + "\n")
        written.append(("35.AD_HOC_TASKS.fragment.md", None))

    counts = {}
    for issue in issues:
        s = sprint_of(issue["milestone"])
        if s:
            counts[s[1]] = counts.get(s[1], 0) + 1
    rows = []
    for m in sorted(milestones, key=lambda m: (m["due"] or "9999", m["title"])):
        s = sprint_of(m["title"])
        if s is None:
            notes.append("milestone %r is not S###_Name; not in the roadmap rows"
                         % m["title"])
            continue
        rows.append("| `%s` | %s | %s | %d |" % (s[1], m["due"] or "",
                                                "closed" if m["closed"] else "open",
                                                counts.get(s[1], 0)))
    if rows:
        write(os.path.join(out, "30.ROADMAP.fragment.md"), "\n".join(
            ["# Sprints exported from %s on %s" % (source, today), "",
             "Merge these rows into the sprint table of `30.ROADMAP.md` by hand; "
             "Dates and Theme are yours to fill.", "",
             "| Sprint | Due | State | Issues read |", "|---|---|---|---|"]
            + rows) + "\n")
        written.append(("30.ROADMAP.fragment.md", None))

    if idmap:
        write(os.path.join(out, "id-map.tsv"), "\n".join(
            ["old_id\tnew_id\told_path\tnew_path"]
            + ["#%d\t%s\t-\t.ai/%s" % row for row in sorted(idmap)]) + "\n")
        written.append(("id-map.tsv", None))

    failing = []
    for rel, kind in written:
        if kind is None:
            continue
        problems = artifact_lib.check(os.path.join(out, rel),
                                      os.path.join(SCHEMAS, kind + ".md"))
        if problems:
            failing.append((rel, problems))

    report = ["# Export from %s" % source, "",
              "**Date**: %s" % today,
              "**State**: %s" % state,
              "**Issues read**: %d; **milestones read**: %d" % (len(issues), len(milestones)),
              "", "## Written", ""]
    report += ["- `%s`" % rel for rel, _ in written] or ["- nothing"]
    report += ["", "## Not carried, or carried with a change", ""]
    report += ["- %s" % n for n in notes] or ["- nothing"]
    report += ["", "## Rejected by the artifact schemas", "",
               "Listed, not fixed: edit each file before it joins `.ai/`.", ""]
    for rel, problems in failing:
        report += ["- `%s`" % rel] + ["  - %s" % p for p in problems]
    if not failing:
        report += ["- nothing"]
    report += ["", "## Next", "",
               "Follow *Changing the tracker back to files* in "
               "`templates/reference/tracker.md`: merge these files into `.ai/`, "
               "check them, then switch `tracker.conf` with "
               "`tracker.sh init --tracker files --replace --adr ADR-NNNN`."]
    write(os.path.join(out, "EXPORT.md"), "\n".join(report) + "\n")

    print("export: %d issue(s) and %d milestone(s) from %s into %s"
          % (len(issues), len(milestones), source, out))
    for rel, _ in written:
        print("wrote    %s" % rel)
    for n in notes:
        print("NOTE     %s" % n)
    for rel, problems in failing:
        print("FAIL     %s: %s" % (rel, "; ".join(problems)))
    print("report   EXPORT.md")
    return 1 if failing else 0


if __name__ == "__main__":
    sys.stderr.write("forge_export.py: run it through tracker.sh export\n")
    sys.exit(2)
