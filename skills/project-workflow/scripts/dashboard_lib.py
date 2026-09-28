#!/usr/bin/env python3
"""Read a repository's .ai/ governance layer and emit an agile dashboard.

ONE OWNER, SAME RULE AS artifact_lib.py. The schemas own an artifact's shape;
this module owns how a *filled* artifact is read for reporting. It reads what
the files contain rather than what the schemas say they should, because the
two differ in practice -- 115 of 119 briefs in this repository carry a
parseable `- Status:` line and four do not, and a reader that assumed the
schema would simply lose them.

TWO FRAMEWORKS. ADR-0013 keeps project-workflow and project-migration
deliberately divergent. A reader that handled only the former could not be
run against this repository, which uses the latter -- so it could never be
dogfooded, and an unexercised dashboard is a decorative one. Both shapes are
detected per file; neither is normative here.

python3 stdlib only, deliberately: a dashboard that needs `pip install` is a
dashboard nobody generates. The emitted HTML has no CDN reference, no
external font and no network access -- every chart is hand-rolled SVG.

WHAT THIS PROVES: what the artifacts on disk currently say.
WHAT IT DOES NOT PROVE: that any of it is true. A brief that records a
passing suite it never ran is reported as a passing suite. This renders the
governance layer; it does not audit it. See references/dashboard.md.
"""
import json
import os
import re
import subprocess
import sys
from datetime import date, datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(os.path.dirname(HERE), "assets")

ISO_DATE = re.compile(r"\b(20\d\d)-(\d\d)-(\d\d)\b")
HEADING = re.compile(r"^(#{1,6})\s+(.*\S)\s*$")
CHECKBOX = re.compile(r"^\s*[-*]\s+\[( |x|X)\]")
SHA = re.compile(r"\b([0-9a-f]{7,40})\b")
TASK_REF = re.compile(r"\bTASK-(\d{3,4})\b")
# The trailing name stops at a dot: `\S+` matched `Scaffold.md` and put the
# file extension inside the identifier. Found by the project-workflow
# fixture, which is the only place that id scheme is exercised.
WF_TASK_ID = re.compile(r"\bS(\d{1,3})\.T(\d{1,3})(?:_([^\s.`]+))?")
SPRINT_REF = re.compile(r"\bS(\d{1,3})\b")

# The closed status vocabularies of the two frameworks, mapped onto the four
# bands a cumulative-flow diagram needs. `cancelled` is deliberately its own
# band and is excluded from scope: an item withdrawn from the release did not
# burn down, and counting it as done overstates delivery.
STATUS_MAP = {
    "planned": "todo", "ready": "todo", "not started": "todo",
    "not_started": "todo", "todo": "todo", "open": "todo", "backlog": "todo",
    "in_progress": "doing", "in progress": "doing", "wip": "doing",
    "review": "doing", "in review": "doing", "doing": "doing",
    "blocked": "blocked", "waiting": "blocked", "parked": "blocked",
    "done": "done", "completed": "done", "complete": "done",
    "closed": "done", "shipped": "done",
    "cancelled": "cancelled", "canceled": "cancelled",
    "superseded": "cancelled", "withdrawn": "cancelled",
}
BAND_ORDER = ["todo", "doing", "blocked", "done"]
BAND_LABEL = {"todo": "To do", "doing": "In progress", "blocked": "Blocked",
              "done": "Done", "cancelled": "Cancelled", "unknown": "Unknown"}


class DataError(Exception):
    """A section was asked for and yielded nothing.

    Raised rather than emitting an empty tab. ADR-0009's rule: a view that
    quietly renders nothing is worse than an absent one, because it is still
    read -- an empty burn-up looks like "no work happened", not like "the
    reader could not find the tasks".
    """


# ---------------------------------------------------------------- utilities

def die(msg):
    sys.stderr.write("dashboard_lib: %s\n" % msg)
    raise SystemExit(2)


def read(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError:
        return ""


def to_date(value):
    """First ISO date anywhere in `value`, or None.

    Deliberately permissive. Real briefs write `- Created: 2026-09-14`,
    `**Date**: 2026-09-26`, and `CLOSED 2026-09-23 on REVIEW-0011` -- a
    strict field parser loses the third form, which is the only place a
    sprint's end date is written down.
    """
    if not value:
        return None
    m = ISO_DATE.search(value)
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def iso(d):
    return d.isoformat() if d else None


def days_between(a, b):
    return (b - a).days if a and b else None


def sections(text):
    """Map heading text (lowercased, no #s) -> list of body lines.

    Fenced code blocks are skipped so a ``` block containing a `## ` line
    cannot invent a section. Observed necessary: TASK-0121's brief quotes a
    gate's output format inside a fence.
    """
    out, current, fence = {}, None, False
    for line in text.split("\n"):
        if re.match(r"^\s*(```|~~~)", line):
            fence = not fence
        if not fence:
            m = HEADING.match(line)
            if m:
                current = m.group(2).strip().lower()
                out.setdefault(current, [])
                continue
        if current is not None:
            out[current].append(line)
    return out


def field(lines, *keys):
    """Value of `- Key: v`, `**Key**: v` or `Key: v`, first match wins."""
    pattern = re.compile(
        r"^\s*(?:[-*]\s*)?(?:\*\*)?(%s)(?:\*\*)?\s*:\s*(.*)$"
        % "|".join(re.escape(k) for k in keys), re.I)
    for line in lines:
        m = pattern.match(line)
        if m:
            return m.group(2).strip()
    return None


def normalise_status(raw):
    """Map a written status onto the closed vocabulary.

    Real values are messy in a way a naive `.strip()` loses: this repository
    holds `done`, `done   `, `**done**`, `done — **delivered by S7's pilot**`
    and `done, with one carried-over item — see ...`, all meaning done. The
    leading word is taken and everything after the first separator dropped,
    which is what a reader does.
    """
    if not raw:
        return "unknown"
    v = raw.strip().lower()
    v = re.sub(r"#.*$", "", v)                   # trailing vocabulary comment
    v = v.replace("*", "").replace("`", "").strip()
    m = re.match(r"[a-z][a-z_ ]*", v)
    words = re.sub(r"\s+", " ", m.group(0)).strip().split() if m else []
    # Longest prefix first, so `in progress` beats `in` and a trailing
    # narrative (`CLOSED 2026-09-15 — decided, not implemented`) is dropped
    # rather than turned into `unknown`. Splitting on punctuation instead
    # returned `closed 2026` for that real row, which reads as a parse
    # success and is not one.
    for n in range(min(len(words), 3), 0, -1):
        key = " ".join(words[:n])
        for cand in (key, key.replace(" ", "_")):
            if cand in STATUS_MAP:
                return STATUS_MAP[cand]
    return "unknown"


def count_boxes(lines):
    total = checked = 0
    for line in lines or []:
        m = CHECKBOX.match(line)
        if m:
            total += 1
            if m.group(1).lower() == "x":
                checked += 1
    return {"total": total, "checked": checked}


def md_table(lines):
    """Parse the first pipe table in `lines` into a list of dicts."""
    rows, header = [], None
    for line in lines:
        s = line.strip()
        if not s.startswith("|"):
            # A blank line inside a table is not the end of it. Observed:
            # .ai/planning/BACKLOG.md separates three of its 46 rows with one,
            # and a parser that stopped there reported 26 -- an undercount that
            # looks exactly like a correct answer.
            if not s:
                continue
            if header and rows:
                break
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if re.match(r"^[\s:|-]+$", s.replace("|", "-")) and header:
            continue
        if header is None:
            header = [c.lower() for c in cells]
            continue
        if len(cells) < 2:
            continue
        rows.append(dict(zip(header, cells)))
    return rows


def ident(text):
    """An identifier out of a field that also carries prose.

    `**Sprint**: `S001_Foundation` (see ../30.ROADMAP.md for what this sprint
    means)` is what the schema's own preamble emits. Running that through
    plain() returned `S001Foundation (see ../30.ROADMAP.md ...)` -- underscores
    stripped as emphasis and the parenthetical kept, so every sprint got a
    unique name and none of them matched anything. Prefer the backticked span;
    fall back to the first token.
    """
    if not text:
        return None
    m = re.search(r"`([^`]+)`", text)
    token = m.group(1) if m else text.strip().split()[0] if text.strip() else ""
    token = token.strip().strip(".,;:")
    return token or None


def plain(text):
    """Strip the markdown a title carries so it renders in a table cell."""
    if not text:
        return ""
    text = re.sub(r"~~(.+?)~~", r"\1", text)
    text = re.sub(r"[`*_]", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


# ------------------------------------------------------------------ readers

def detect_framework(root):
    """Which governance framework `root` holds.

    Derived from which files exist, the same way ADR-0005 derives an MCP
    server's shape from its marker file -- not from a flag the caller has to
    get right, and not from a name.
    """
    if os.path.isdir(os.path.join(root, "planning")):
        return "project-migration"
    if os.path.isfile(os.path.join(root, "00.CONVENTIONS.md")) or \
       os.path.isfile(os.path.join(root, "20.PLAN.md")):
        return "project-workflow"
    return "project-migration" if os.path.isdir(
        os.path.join(root, "context")) else "project-workflow"


def read_task(path):
    """One task brief, in whichever framework's shape it is written."""
    text = read(path)
    if not text.strip():
        return None
    lines = text.split("\n")
    secs = sections(text)
    base = os.path.basename(path)

    # Identity. project-migration files are TASK-####-slug.md; the
    # project-workflow scheme is S###.T###_Name.md. Both also write the id
    # into the H1, which is the fallback when a file has been renamed.
    h1 = next((HEADING.match(l).group(2) for l in lines[:5]
               if HEADING.match(l) and HEADING.match(l).group(1) == "#"), "")
    m = TASK_REF.search(base) or WF_TASK_ID.search(base) or \
        TASK_REF.search(h1) or WF_TASK_ID.search(h1)
    if not m:
        return None
    tid = m.group(0) if m.re is not TASK_REF else "TASK-%s" % m.group(1)
    title = plain(re.sub(r"^\s*%s\s*[—:-]*\s*" % re.escape(tid), "",
                         plain(h1))) or tid

    preamble = lines[:40]
    status_lines = secs.get("status", []) or preamble
    status_raw = field(status_lines, "Status") or field(preamble, "Status")
    status = normalise_status(status_raw)

    created = to_date(field(status_lines, "Created") or "")
    updated = to_date(field(status_lines, "Updated") or "")
    owner = plain(field(status_lines, "Owner") or "") or "unassigned"

    # Started. The Execution log's first `- Date:` is when work actually
    # began; 112 of 119 briefs here carry one. Without it a cumulative-flow
    # diagram has no in-progress band at all, because nothing else in either
    # schema records a start.
    log = secs.get("execution log", [])
    for key in sorted(k for k in secs if k.startswith("attempt")):
        log = log + secs[key]
    started = to_date(field(log, "Date") or "")

    # Scanned over the WHOLE brief, not just the Execution log. Both task
    # schemas set `allow_extra: true` and real briefs use it: TASK-0046 files
    # its commit under `### Deviations and known gaps`, six sub-headings deep
    # inside the log, and a log-only scan lost it along with 35 others.
    #
    # A hash must contain a digit. `[0-9a-f]{7,40}` alone matches English
    # words -- `effaced`, `defaced` -- and this text is prose.
    commits = []
    for line in text.split("\n"):
        if re.match(r"^\s*(?:[-*>]\s*)?(?:\*\*)?Commits?(?:\(s\))?"
                    r"(?:\*\*)?\s*:", line, re.I):
            commits += [h for h in SHA.findall(line)
                        if len(h) >= 7 and any(c.isdigit() for c in h)]
    seen, ordered = set(), []
    for h in commits:
        if h not in seen:
            seen.add(h)
            ordered.append(h)

    # Estimate. No schema in either framework has a points field and none is
    # being added -- ADR-0008 forbids a reader authoring a requirement. One
    # point per task is what a team with no estimates actually has; a project
    # that does estimate gets its number read instead.
    pts = field(status_lines + preamble, "Points", "Estimate", "Story points",
                "Size")
    try:
        points = float(re.search(r"[\d.]+", pts).group(0)) if pts else 1.0
    except (AttributeError, ValueError):
        points = 1.0

    return {
        "id": tid,
        "title": title,
        "status": status,
        "status_raw": plain(status_raw or "") or "not recorded",
        "owner": owner,
        "created": iso(created),
        "started": iso(started),
        "updated": iso(updated),
        "done": None,                       # resolved later, from git if it can be
        "sprint": ident(field(preamble, "Sprint") or ""),
        "points": points,
        "commits": ordered,
        "criteria": count_boxes(secs.get("acceptance criteria", [])),
        "validations": count_boxes(secs.get("mandatory validations", []) or
                                   secs.get("validation", [])),
        "path": path,
        "bytes": len(text.encode("utf-8")),
    }


def read_tasks(root):
    d = os.path.join(root, "tasks")
    if not os.path.isdir(d):
        raise DataError("no tasks directory at %s" % d)
    out = []
    for name in sorted(os.listdir(d)):
        if not name.endswith(".md") or name in ("TODO.md", "INDEX.md"):
            continue
        t = read_task(os.path.join(d, name))
        if t:
            out.append(t)
    if not out:
        raise DataError("%s holds no parseable task brief" % d)
    return out


def read_todo_membership(root):
    """Sprint membership from the TODO/plan index.

    This is the only place project-migration records which sprint ran a task:
    the index groups its checklist under `## Sprint S# — Name` headings. The
    sprint archive files mention task ids too, but they also cite *earlier*
    tasks in their narrative -- S10's file names 35 of them -- so mentions
    misassign and the index does not.
    """
    member, current = {}, None
    for name in ("TODO.md", "20.PLAN.md", "INDEX.md"):
        path = os.path.join(root, "tasks", name)
        if not os.path.isfile(path):
            path = os.path.join(root, name)
        if not os.path.isfile(path):
            continue
        for line in read(path).split("\n"):
            m = HEADING.match(line)
            if m and len(m.group(1)) <= 3:
                head = m.group(2)
                s = SPRINT_REF.search(head)
                current = ("S%s" % s.group(1)) if s else None
                if current and re.match(r"^\s*post[- ]", head, re.I):
                    current = "Post-%s" % current
                continue
            if current and CHECKBOX.match(line):
                for t in TASK_REF.finditer(line):
                    member.setdefault("TASK-%s" % t.group(1), current)
        if member:
            break
    return member


def read_sprint_mentions(root):
    """Fallback membership: task ids named by a sprint's own archive file.

    Second choice, never first. A sprint file cites earlier tasks in its
    narrative -- S10's names 35 ids -- so mentions over-assign. Used only for
    tasks the index never listed, which is how S1's seven tasks are recovered:
    the index's first block predates the `## Sprint S#` headings and has none.
    """
    out = {}
    d = os.path.join(root, "planning", "sprints")
    if not os.path.isdir(d):
        return out
    for name in sorted(os.listdir(d),
                       key=lambda n: int((SPRINT_REF.search(n) or
                                          re.match(r"(\d+)", "999")).group(1))
                       if SPRINT_REF.search(n) else 999):
        if not name.endswith(".md"):
            continue
        m = SPRINT_REF.search(name)
        if not m:
            continue
        sid = "S%s" % m.group(1)
        for t in TASK_REF.finditer(read(os.path.join(d, name))):
            out.setdefault("TASK-%s" % t.group(1), sid)
    return out


def read_sprints(root, tasks):
    """Sprint records: archived files plus whatever is currently open."""
    out = []
    d = os.path.join(root, "planning", "sprints")
    files = sorted(os.listdir(d)) if os.path.isdir(d) else []
    for name in files:
        if not name.endswith(".md"):
            continue
        text = read(os.path.join(root, "planning", "sprints", name))
        m = SPRINT_REF.search(name)
        if not m:
            continue
        sid = "S%s" % m.group(1)
        h1 = next((HEADING.match(l).group(2) for l in text.split("\n")[:5]
                   if HEADING.match(l)), sid)
        # The end date is the one AFTER the closing word, not the first date
        # on the line. `Opened 2026-09-15, closed 2026-09-16` is a real line in
        # SPRINT-S7 and the naive read returns the opening date -- a sprint
        # that looks one day shorter than it was, on every chart.
        closed = None
        for line in text.split("\n")[:40]:
            m = re.search(r"\b(?:closed|completed|complete)\b", line, re.I)
            if m:
                closed = to_date(line[m.end():]) or to_date(line)
                if closed:
                    break
        out.append({"id": sid, "title": plain(h1), "state": "closed",
                    "end": iso(closed), "start": None, "path": name})

    # The open sprint, if there is one. This repository has none -- S10 closed
    # 2026-09-26 and SPRINT-CURRENT.md says so in its H1 -- so the open-sprint
    # path here is exercised by fixture, not by dogfooding, and that is
    # recorded rather than implied.
    for name in ("SPRINT-CURRENT.md", "20.PLAN.md"):
        path = os.path.join(root, "planning", name)
        if not os.path.isfile(path):
            path = os.path.join(root, name)
        if not os.path.isfile(path):
            continue
        text = read(path)
        h1 = next((HEADING.match(l).group(2) for l in text.split("\n")[:5]
                   if HEADING.match(l)), "")
        if re.search(r"no sprint is open", h1 + text[:400], re.I):
            break
        m = SPRINT_REF.search(h1)
        if m and not any(s["id"] == "S%s" % m.group(1) for s in out):
            out.append({"id": "S%s" % m.group(1), "title": plain(h1),
                        "state": "open", "start": iso(to_date(text[:2000])),
                        "end": None, "path": name})
        break

    # project-workflow keeps no planning/sprints/ directory: a sprint exists
    # only as a `**Sprint**:` field on its member briefs and a heading in
    # 20.PLAN.md. Reconciling those two is not optional -- 20.PLAN.md's heading
    # yields `S002` and the briefs say `S002_Performance`, so a record keyed on
    # the heading alone matches no task, is dropped for having no members, and
    # every sprint falls through to the "ran outside a sprint" bucket with the
    # velocity chart empty. Found by the fixture; this repository uses the
    # other framework and could never have shown it.
    named = sorted({t["sprint"] for t in (tasks or []) if t["sprint"]})
    for name in named:
        match = None
        for rec in out:
            if name == rec["id"] or name.startswith(rec["id"] + "_") or \
               rec["id"] == name.split("_")[0]:
                match = rec
                break
        if match:
            match["id"] = name          # adopt the fuller id the briefs use
            match["title"] = match["title"] or name.replace("_", " ")
        else:
            out.append({"id": name, "title": name.replace("_", " "),
                        "state": "closed", "start": None, "end": None,
                        "path": None})

    def order(rec):
        m = re.search(r"\d+", rec["id"])
        return int(m.group(0)) if m else 999

    out.sort(key=order)
    return out


def read_backlog(root):
    """The backlog table, or the ad-hoc list, whichever the framework has."""
    path = os.path.join(root, "planning", "BACKLOG.md")
    if os.path.isfile(path):
        rows = md_table(read(path).split("\n"))
        out = []
        for r in rows:
            rid = plain(r.get("id", ""))
            if not re.match(r"^B-\d+$", rid):
                continue
            out.append({
                "id": rid,
                "title": plain(r.get("title", "")),
                "priority": plain(r.get("priority", "")).lower() or "unrated",
                "value": plain(r.get("value", "")).lower() or "unrated",
                "risk": plain(r.get("risk", "")).lower() or "unrated",
                "status": normalise_status(r.get("status", "")),
                "status_raw": plain(r.get("status", "")) or "open",
                "depends": plain(r.get("dependencies", "")) or "none",
                "note": plain(r.get("ready when", ""))[:400],
            })
        return out

    # project-workflow's equivalent is a list of `### N. Title` entries with
    # labelled lines rather than a table. Same fields, different shape.
    path = os.path.join(root, "35.AD_HOC_TASKS.md")
    if not os.path.isfile(path):
        return []
    out, current, state = [], None, "todo"
    for line in read(path).split("\n"):
        m = HEADING.match(line)
        if m and len(m.group(1)) == 2:
            state = "done" if re.search(r"closed|done", m.group(2), re.I) \
                else "todo"
        elif m and len(m.group(1)) == 3:
            mm = re.match(r"^(\d+)\.\s*(.*)$", m.group(2))
            if mm:
                current = {"id": "A-%s" % mm.group(1),
                           "title": plain(mm.group(2)),
                           "priority": "unrated", "value": "unrated",
                           "risk": "unrated", "status": state,
                           "status_raw": state, "depends": "none", "note": ""}
                out.append(current)
        elif current is not None and line.strip():
            v = field([line], "What's wrong", "Next step")
            if v:
                current["note"] = (current["note"] + " " + plain(v)).strip()
    return out


def read_phases(root):
    """Roadmap phases -- the long-horizon goals, past and future."""
    for rel in ("planning/ROADMAP.md", "30.ROADMAP.md", "ROADMAP.md"):
        path = os.path.join(root, rel)
        if os.path.isfile(path):
            break
    else:
        return []
    out = []
    for line in read(path).split("\n"):
        m = HEADING.match(line)
        if not m or len(m.group(1)) != 2:
            continue
        head = m.group(2)
        pm = re.match(r"^Phase\s+(\d+)\s*[—:-]*\s*(.*)$", head, re.I)
        if not pm:
            continue
        done = bool(re.search(r"\bcomplete", head, re.I))
        title = re.sub(r"\s*\(.*$", "", pm.group(2)).strip()
        out.append({"id": "Phase %s" % pm.group(1), "title": plain(title),
                    "state": "done" if done else "todo",
                    "date": iso(to_date(head))})
    return out


def read_adrs(root):
    d = os.path.join(root, "decisions")
    if not os.path.isdir(d):
        return []
    out = []
    for name in sorted(os.listdir(d)):
        if not name.endswith(".md") or name == "INDEX.md":
            continue
        text = read(os.path.join(d, name))
        secs = sections(text)
        h1 = next((HEADING.match(l).group(2) for l in text.split("\n")[:5]
                   if HEADING.match(l)), name)
        # Both shapes: a `## Status` section whose body is `Accepted (date)`,
        # and a `**Status**:` preamble line. Neither is normative; this repo
        # writes the first and the project-workflow schema declares the second.
        body = " ".join(l for l in secs.get("status", []) if l.strip())[:120]
        raw = body or field(text.split("\n")[:12], "Status") or ""
        low = raw.lower()
        state = ("superseded" if "supersede" in low else
                 "deprecated" if "deprecat" in low else
                 "accepted" if "accept" in low else
                 "rejected" if "reject" in low else
                 "proposed" if "propos" in low else "unknown")
        mid = re.match(r"^(?:ADR-)?(\d{3,4})", name)
        out.append({
            "id": "ADR-%s" % mid.group(1) if mid else name,
            "title": plain(re.sub(r"^ADR-\d+\s*[—:-]*\s*", "", plain(h1))),
            "status": state,
            "status_raw": plain(raw)[:80] or "not recorded",
            "date": iso(to_date(raw) or to_date(text[:1200])),
        })
    return out


def read_reviews(root):
    d = os.path.join(root, "reviews")
    if not os.path.isdir(d):
        return []
    out = []
    for name in sorted(os.listdir(d)):
        if not name.endswith(".md") or name == "INDEX.md":
            continue
        text = read(os.path.join(d, name))
        h1 = next((HEADING.match(l).group(2) for l in text.split("\n")[:5]
                   if HEADING.match(l)), name)
        mid = re.match(r"^(?:REVIEW-)?(\d{3,4})", name)
        out.append({"id": "REVIEW-%s" % mid.group(1) if mid else name,
                    "title": plain(re.sub(r"^REVIEW-\d+\s*[—:-]*\s*", "",
                                          plain(h1))),
                    "date": iso(to_date(text[:1500]))})
    return out


# ------------------------------------------------------------- git provenance

def git(repo, *args):
    try:
        out = subprocess.run(("git", "-C", repo) + args, check=True,
                             stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                             timeout=60)
        return out.stdout.decode("utf-8", "replace")
    except (OSError, subprocess.SubprocessError):
        return None


def read_commits(repo):
    """Commit log, or [] when git is unavailable.

    Degrades rather than failing. The generator must work in a fresh clone, a
    worktree (ADR-0023), and a directory that was copied rather than cloned --
    and the last of those has no .git at all.
    """
    if git(repo, "rev-parse", "--git-dir") is None:
        return []
    raw = git(repo, "log", "--no-merges", "--date=short",
              "--pretty=format:%H%x1f%cI%x1f%an%x1f%s", "--numstat")
    if not raw:
        return []
    out, cur = [], None
    for line in raw.split("\n"):
        if "\x1f" in line:
            h, when, who, subject = line.split("\x1f", 3)
            cur = {"hash": h, "short": h[:7], "date": when[:10], "author": who,
                   "subject": subject, "files": 0, "added": 0, "removed": 0,
                   "task": None}
            m = TASK_REF.search(subject) or WF_TASK_ID.search(subject)
            if m:
                cur["task"] = ("TASK-%s" % m.group(1)
                               if m.re is TASK_REF else m.group(0))
            out.append(cur)
        elif line.strip() and cur is not None:
            parts = line.split("\t")
            if len(parts) == 3:
                cur["files"] += 1
                for i, key in ((0, "added"), (1, "removed")):
                    if parts[i].isdigit():
                        cur[key] += int(parts[i])
    return out


def resolve_done_dates(tasks, commits, use_git):
    """When each task actually finished.

    Preference order, and the order matters:
      1. the commit date of a hash the brief records -- an instant no later
         edit can move;
      2. the commit that names the task in its subject line;
      3. `Updated`, which is a field a human maintains and therefore the
         weakest of the three.
    A task that is done and yields no date at all is counted in every total
    and plotted on no timeline, and is listed under `warnings` rather than
    silently dropped.
    """
    by_hash, by_task = {}, {}
    for c in commits:
        by_hash[c["hash"]] = c["date"]
        by_hash[c["short"]] = c["date"]
        if c["task"]:
            by_task.setdefault(c["task"], c["date"])
    undated = []
    for t in tasks:
        if t["status"] != "done":
            continue
        best = None
        if use_git:
            for h in t["commits"]:
                for key in (h, h[:7]):
                    if key in by_hash:
                        best = max(best or "", by_hash[key])
            if not best:
                best = by_task.get(t["id"])
        t["done"] = best or t["updated"]
        t["done_source"] = ("commit" if best else
                            "updated" if t["updated"] else "none")
        if not t["done"]:
            undated.append(t["id"])
    return undated


# ------------------------------------------------------------------ metrics

def day_range(start, end):
    d, out = start, []
    while d <= end:
        out.append(d)
        d += timedelta(days=1)
    return out


def band_on(t, d):
    """Which band a task occupies on day `d`, or None if not yet created.

    RECONSTRUCTED, NOT REPLAYED. Neither schema records status transitions, so
    a task's history is rebuilt from the three instants that do exist --
    Created, the Execution log's first Date, and the commit that closed it.
    A task that went to blocked and back looks like it never did. The chart
    card says so; see references/dashboard.md, "What this does not prove".
    """
    created = t["_created"]
    if not created or d < created:
        return None
    done = t["_done"]
    if done and d >= done:
        return "done"
    started = t["_started"]
    if t["status"] in ("blocked",) and (not started or d >= started):
        return "blocked"
    if started and d >= started:
        return "doing" if t["status"] != "todo" else "todo"
    return "todo"


def percentile(values, p):
    if not values:
        return None
    s = sorted(values)
    k = (len(s) - 1) * (p / 100.0)
    lo, hi = int(k), min(int(k) + 1, len(s) - 1)
    return round(s[lo] + (s[hi] - s[lo]) * (k - lo), 1)


def compute(model):
    tasks = model["tasks"]
    for t in tasks:
        t["_created"] = to_date(t["created"]) or to_date(t["updated"])
        t["_done"] = to_date(t["done"])
        t["_started"] = to_date(t["started"]) or t["_created"]
        if t["_done"] and t["_created"] and t["_done"] < t["_created"]:
            t["_done"] = t["_created"]          # a brief edited out of order

    dated = [t for t in tasks if t["_created"]]
    if not dated:
        raise DataError("no task carries a usable date; every timeline would "
                        "be empty")
    start = min(t["_created"] for t in dated)
    today = date.today()
    last = max([t["_done"] for t in dated if t["_done"]] + [start])
    end = max(today, last)
    grid = day_range(start, end)
    in_scope = [t for t in tasks if t["status"] != "cancelled" and t["_created"]]

    # --- cumulative flow, and the burn charts that read off it -------------
    cfd, burnup, burndown, wip = [], [], [], []
    for d in grid:
        bands = dict.fromkeys(BAND_ORDER, 0.0)
        scope = done_pts = 0.0
        for t in in_scope:
            b = band_on(t, d)
            if b is None:
                continue
            bands[b] += 1
            scope += t["points"]
            if b == "done":
                done_pts += t["points"]
        iso_d = d.isoformat()
        cfd.append(dict(date=iso_d, **{k: bands[k] for k in BAND_ORDER}))
        burnup.append({"date": iso_d, "scope": round(scope, 2),
                       "done": round(done_pts, 2)})
        burndown.append({"date": iso_d,
                         "remaining": round(scope - done_pts, 2)})
        wip.append({"date": iso_d,
                    "wip": bands["doing"] + bands["blocked"]})

    # --- projection, not an "ideal" line ----------------------------------
    # A release burndown's ideal line needs a committed end date. This
    # framework has none, so drawing one would be an invented commitment.
    # A least-squares trend over the recent remaining-work line is a claim
    # about observed pace instead, and it is drawn dashed because that is
    # what dashing legitimately means (anti-patterns: never dash a gridline).
    window = burndown[-min(len(burndown), 21):]
    projection, proj_date = [], None
    if len(window) >= 3:
        n = len(window)
        xs = list(range(n))
        ys = [p["remaining"] for p in window]
        mx, my = sum(xs) / n, sum(ys) / n
        denom = sum((x - mx) ** 2 for x in xs)
        slope = (sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / denom
                 if denom else 0.0)
        if slope < -1e-9:
            x0 = to_date(window[0]["date"])
            steps = int((0 - (my - slope * mx)) / slope) + 1
            for i in range(0, min(steps, n + 400) + 1):
                v = (my - slope * mx) + slope * i
                projection.append({"date": (x0 + timedelta(days=i)).isoformat(),
                                   "remaining": round(max(v, 0.0), 2)})
                if v <= 0 and proj_date is None:
                    proj_date = (x0 + timedelta(days=i)).isoformat()

    # --- throughput, cycle time, aging ------------------------------------
    per_day = {}
    for t in in_scope:
        if t["_done"]:
            per_day[t["_done"]] = per_day.get(t["_done"], 0) + 1
    daily = [{"date": d.isoformat(), "count": per_day.get(d, 0)} for d in grid]

    weeks = {}
    for d in grid:
        wk = (d - timedelta(days=d.weekday())).isoformat()
        weeks.setdefault(wk, 0)
        weeks[wk] += per_day.get(d, 0)
    throughput = [{"week": k, "count": v} for k, v in sorted(weeks.items())]

    cycle = []
    for t in in_scope:
        if not t["_done"]:
            continue
        cycle.append({
            "id": t["id"], "title": t["title"], "date": t["done"],
            "cycle": max(days_between(t["_started"], t["_done"]) or 0, 0),
            "lead": max(days_between(t["_created"], t["_done"]) or 0, 0),
            "sprint": t["sprint"] or "—",
        })
    cyc_vals = [c["cycle"] for c in cycle]
    lead_vals = [c["lead"] for c in cycle]

    hist = {}
    for v in lead_vals:
        hist[v] = hist.get(v, 0) + 1
    lead_hist = [{"days": k, "count": hist[k]} for k in sorted(hist)]

    aging = sorted(
        ({"id": t["id"], "title": t["title"], "status": t["status"],
          "status_raw": t["status_raw"], "owner": t["owner"],
          "age": days_between(t["_created"], today) or 0,
          "criteria": t["criteria"]}
         for t in in_scope if t["status"] in ("todo", "doing", "blocked")),
        key=lambda a: -a["age"])

    # --- sprints ----------------------------------------------------------
    members = model["membership"]
    for t in tasks:
        t["sprint"] = t["sprint"] or members.get(t["id"]) or "unassigned"
    sprints = []
    known = {s["id"]: s for s in model["sprints"]}
    order = [s["id"] for s in model["sprints"]]
    for name in order + sorted({t["sprint"] for t in tasks} - set(order)):
        mine = [t for t in tasks if t["sprint"] == name
                and t["status"] != "cancelled"]
        if not mine:
            continue
        rec = dict(known.get(name, {"id": name, "title": name,
                                    "state": "adhoc", "start": None,
                                    "end": None}))
        created = [t["_created"] for t in mine if t["_created"]]
        dones = [t["_done"] for t in mine if t["_done"]]
        rec["start"] = rec.get("start") or (iso(min(created)) if created else None)
        rec["end"] = rec.get("end") or (iso(max(dones)) if dones else None)
        rec["tasks"] = len(mine)
        rec["done"] = sum(1 for t in mine if t["status"] == "done")
        rec["points"] = round(sum(t["points"] for t in mine), 2)
        rec["points_done"] = round(sum(t["points"] for t in mine
                                       if t["status"] == "done"), 2)
        s_d, e_d = to_date(rec["start"]), to_date(rec["end"])
        rec["days"] = (days_between(s_d, e_d) or 0) + 1 if s_d and e_d else None
        # Per-sprint burn-down and burn-up over that sprint's own window.
        rec["burn"] = []
        if s_d and e_d:
            span = day_range(s_d, e_d)
            total = rec["points"]
            for i, d in enumerate(span):
                closed = sum(t["points"] for t in mine
                             if t["_done"] and t["_done"] <= d)
                scope = sum(t["points"] for t in mine
                            if t["_created"] and t["_created"] <= d)
                ideal = total * (1 - i / float(max(len(span) - 1, 1)))
                rec["burn"].append({"date": d.isoformat(),
                                    "remaining": round(scope - closed, 2),
                                    "scope": round(scope, 2),
                                    "done": round(closed, 2),
                                    "ideal": round(ideal, 2)})
        sprints.append(rec)
    velocity = [{"sprint": s["id"], "points": s["points_done"],
                 "committed": s["points"], "days": s["days"]}
                for s in sprints if s["state"] != "adhoc"]

    # --- forecast ---------------------------------------------------------
    forecast = monte_carlo(daily, len(aging))

    # --- backlog and decisions -------------------------------------------
    order_p = ["high", "medium", "low", "unrated"]
    bl = model["backlog"]
    matrix = {}
    for b in bl:
        if b["status"] == "done":
            continue
        key = (b["priority"], b["value"])
        matrix.setdefault(key, []).append(b["id"])
    backlog_matrix = [{"priority": k[0], "value": k[1], "count": len(v),
                       "ids": v} for k, v in sorted(matrix.items())]
    backlog_mix = [
        {"priority": p,
         "open": sum(1 for b in bl if b["priority"] == p
                     and b["status"] != "done"),
         "closed": sum(1 for b in bl if b["priority"] == p
                       and b["status"] == "done")}
        for p in order_p if any(b["priority"] == p for b in bl)]

    adr_dates = sorted(a["date"] for a in model["adrs"] if a["date"])
    adr_cum, run = [], 0
    for d in grid:
        run += sum(1 for x in adr_dates if x == d.isoformat())
        adr_cum.append({"date": d.isoformat(), "count": run})

    commit_days = {}
    for c in model["commits"]:
        commit_days[c["date"]] = commit_days.get(c["date"], 0) + 1
    authors = {}
    for c in model["commits"]:
        a = authors.setdefault(c["author"], {"author": c["author"],
                                             "commits": 0, "added": 0,
                                             "removed": 0})
        a["commits"] += 1
        a["added"] += c["added"]
        a["removed"] += c["removed"]

    for t in tasks:                       # drop the private date objects
        for k in ("_created", "_started", "_done"):
            t.pop(k, None)

    open_tasks = [t for t in tasks if t["status"] in ("todo", "doing",
                                                      "blocked")]
    done_tasks = [t for t in tasks if t["status"] == "done"]
    crit = sum(t["criteria"]["total"] for t in tasks)
    crit_ok = sum(t["criteria"]["checked"] for t in tasks)

    return {
        "window": {"start": iso(start), "end": iso(end),
                   "today": iso(today), "days": len(grid)},
        "cfd": cfd, "bands": BAND_ORDER, "band_label": BAND_LABEL,
        "burnup": burnup, "burndown": burndown, "projection": projection,
        "projected_done": proj_date,
        "wip": wip, "daily": daily, "throughput": throughput,
        "cycle": cycle, "lead_hist": lead_hist, "aging": aging,
        "sprints": sprints, "velocity": velocity, "forecast": forecast,
        "backlog_matrix": backlog_matrix, "backlog_mix": backlog_mix,
        "adr_cum": adr_cum, "commit_days": commit_days,
        "authors": sorted(authors.values(), key=lambda a: -a["commits"]),
        "kpi": {
            "tasks": len(tasks),
            "done": len(done_tasks),
            "open": len(open_tasks),
            "blocked": sum(1 for t in tasks if t["status"] == "blocked"),
            "cancelled": sum(1 for t in tasks if t["status"] == "cancelled"),
            "percent": round(100.0 * len(done_tasks) / max(len(tasks), 1), 1),
            "points": round(sum(t["points"] for t in tasks), 1),
            "points_done": round(sum(t["points"] for t in done_tasks), 1),
            "wip": len([t for t in tasks if t["status"] in ("doing",
                                                            "blocked")]),
            "cycle_p50": percentile(cyc_vals, 50),
            "cycle_p85": percentile(cyc_vals, 85),
            "lead_p50": percentile(lead_vals, 50),
            "lead_p85": percentile(lead_vals, 85),
            "throughput_week": round(
                sum(x["count"] for x in throughput[-4:]) /
                float(max(len(throughput[-4:]), 1)), 1),
            "sprints": len([s for s in sprints if s["state"] != "adhoc"]),
            "sprint_open": next((s["id"] for s in sprints
                                 if s["state"] == "open"), None),
            "adrs": len(model["adrs"]),
            "reviews": len(model["reviews"]),
            "backlog_open": sum(1 for b in bl if b["status"] != "done"),
            "backlog_total": len(bl),
            "phases": len(model["phases"]),
            "phases_done": sum(1 for p in model["phases"]
                               if p["state"] == "done"),
            "commits": len(model["commits"]),
            "criteria": crit, "criteria_checked": crit_ok,
            "criteria_percent": round(100.0 * crit_ok / max(crit, 1), 1),
            "elapsed": len(grid),
        },
    }


def monte_carlo(daily, remaining, trials=5000):
    """How long the open items take, sampled from observed daily throughput.

    Seeded, so the same input gives the same forecast -- a forecast that moves
    when nothing moved is not a forecast. The sample is the project's own
    history including its zero days; that is the point of the method, and it
    is why it needs no estimate, no velocity assumption and no target date.
    """
    import random
    history = [d["count"] for d in daily]
    if not history or remaining <= 0 or sum(history) == 0:
        return {"remaining": remaining, "samples": 0, "p50": None,
                "p85": None, "p95": None, "histogram": []}
    rng = random.Random(20260928)
    runs = []
    for _ in range(trials):
        got = days = 0
        while got < remaining and days < 3650:
            got += rng.choice(history)
            days += 1
        runs.append(days)
    hist = {}
    for r in runs:
        hist[r] = hist.get(r, 0) + 1
    today = date.today()
    out = {"remaining": remaining, "samples": trials,
           "histogram": [{"days": k, "count": hist[k]} for k in sorted(hist)]}
    for p in (50, 85, 95):
        v = int(percentile(runs, p) or 0)
        out["p%d" % p] = v
        out["p%d_date" % p] = (today + timedelta(days=v)).isoformat()
    return out


# --------------------------------------------------------------- assembly

def build_model(root, repo=None, use_git=True, project=None):
    root = os.path.abspath(root)
    if not os.path.isdir(root):
        die("no such directory: %s" % root)
    repo = os.path.abspath(repo or os.path.dirname(root))
    framework = detect_framework(root)

    commits = read_commits(repo) if use_git else []
    tasks = read_tasks(root)
    undated = resolve_done_dates(tasks, commits, use_git)

    membership = read_sprint_mentions(root)
    membership.update(read_todo_membership(root))

    model = {
        "project": {
            "name": project or os.path.basename(repo) or "project",
            "root": root, "repo": repo, "framework": framework,
            "git": bool(commits),
            "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        },
        "tasks": tasks,
        "sprints": read_sprints(root, tasks),
        "backlog": read_backlog(root),
        "phases": read_phases(root),
        "adrs": read_adrs(root),
        "reviews": read_reviews(root),
        "commits": commits,
        "membership": membership,
        "warnings": [],
    }
    if undated:
        model["warnings"].append(
            "%d task(s) are marked done but carry no date and appear on no "
            "timeline: %s" % (len(undated), ", ".join(undated[:8])))
    unknown = [t["id"] for t in tasks if t["status"] == "unknown"]
    if unknown:
        model["warnings"].append(
            "%d task(s) have no recognised status and are excluded from the "
            "status bands: %s" % (len(unknown), ", ".join(unknown[:8])))
    if not commits and use_git:
        model["warnings"].append(
            "git history was unavailable, so completion dates fall back to "
            "each brief's Updated field and the Activity tab is empty")

    model["series"] = compute(model)
    model.pop("membership")
    return model


def asset(name):
    path = os.path.join(ASSETS, name)
    if not os.path.isfile(path):
        die("missing asset %s -- expected beside the skill at %s"
            % (name, ASSETS))
    return read(path)


def render(model, css_files=(), css_href=None, theme="auto"):
    """Assemble one self-contained HTML file.

    No CDN, no external font, no fetch. The whole point is that the output
    opens by double-click from file://, survives being emailed or committed,
    and still works in five years.
    """
    shell = asset("dashboard.html")
    custom = "\n".join(read(p) for p in css_files)
    payload = json.dumps(model, separators=(",", ":"), sort_keys=False)
    # </script> inside a JSON string would close the block that carries it.
    payload = payload.replace("</", "<\\/")
    link = ('\n<link rel="stylesheet" href="%s">'
            % css_href.replace('"', "&quot;")) if css_href else ""
    out = shell
    for token, value in (
            ("{{TITLE}}", model["project"]["name"]),
            ("{{THEME}}", theme if theme in ("light", "dark", "auto")
             else "auto"),
            ("{{BASE_CSS}}", asset("dashboard.css")),
            ("{{CUSTOM_CSS}}", custom),
            ("{{CSS_LINK}}", link),
            ("{{DATA}}", payload),
            ("{{SCRIPT}}", asset("dashboard.js"))):
        out = out.replace(token, value)
    return out


def main(argv):
    args = {"root": ".ai", "out": "dashboard.html", "theme": "auto",
            "repo": None, "project": None, "json": None, "git": True}
    css, href = [], None
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in ("--root", "--out", "--theme", "--repo", "--project",
                 "--json"):
            if i + 1 >= len(argv):
                die("%s needs a value" % a)
            args[a[2:]] = argv[i + 1]
            i += 2
        elif a == "--css":
            css.append(argv[i + 1])
            i += 2
        elif a == "--css-href":
            href = argv[i + 1]
            i += 2
        elif a == "--no-git":
            args["git"] = False
            i += 1
        elif a in ("-h", "--help"):
            sys.stdout.write(__doc__)
            return 0
        else:
            die("unknown option %s" % a)

    for p in css:
        if not os.path.isfile(p):
            die("no such stylesheet: %s" % p)
    try:
        model = build_model(args["root"], args["repo"], args["git"],
                            args["project"])
    except DataError as exc:
        die("%s" % exc)

    if args["json"]:
        with open(args["json"], "w", encoding="utf-8") as fh:
            json.dump(model, fh, indent=1, sort_keys=False)
    html = render(model, css, href, args["theme"])
    with open(args["out"], "w", encoding="utf-8") as fh:
        fh.write(html)

    k = model["series"]["kpi"]
    sys.stderr.write(
        "dashboard: %s\n  %d tasks (%d done, %d open), %d sprints, %d ADRs, "
        "%d backlog rows, %d commits\n"
        % (args["out"], k["tasks"], k["done"], k["open"], k["sprints"],
           k["adrs"], k["backlog_total"], k["commits"]))
    for w in model["warnings"]:
        sys.stderr.write("  warning: %s\n" % w)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
