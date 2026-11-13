#!/usr/bin/env python3
"""The gate's checks of `.ai/` governance files (ADR-0066).

tests/validate.sh used to hold these as inline blocks. They live here so
tests/test-layout-both.sh can run them against a fixture, and so one file owns them.

The layout (ADR-0066, `.ai/00.CONVENTIONS.md`):
  .ai/10.CURRENT_STATE.md  20.PLAN.md  35.AD_HOC_TASKS.md  40.RISK_REGISTER.md
  tasks/S###.T###_Name.md  decisions/ADR-NNNN-*.md  reviews/S###-checkpoint.md
  reviews/YYYY-MM-DD-slug.md  .ai/id-map.tsv (old_id, new_id, old_path, new_path)
The old layout (`.ai/tasks/TASK-NNNN-*.md`, `planning/`, `context/`, `templates/`)
is no longer accepted: a task file of that name is reported, never skipped.

Boundaries are numbers of the OLD scheme (a brief below FIRST_CONTRACT_TASK
predates the handover contract, below FIRST_GENERATED_TASK predates any schema,
below FIRST_V2_TASK is checked against the frozen v1 shape). A renamed brief
keeps its boundary by way of the id map: its new name resolves to its old
TASK-NNNN. A brief the map does not name was written after the rename and is
current. Raise a boundary to absorb a change; never lower one.

Usage: check-planning.py <handover|live|risk|idmap|groups|retired|all> [--root DIR]
Exit 0 clean, 1 on any finding. Python 3 standard library only.
"""
import glob
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, ".."))   # skills/, schemas: always this repo's

FIRST_CONTRACT_TASK = 20      # ADR-0012 Decision 4
FIRST_GENERATED_TASK = 24     # briefs below predate any schema (TASK-0110)
FIRST_V2_TASK = 153           # at or above: the current task schema
FIRST_V2_ADR = 34             # at or above: the current adr schema
REQUIRED = ["## Inputs", "## Outputs / handover"]
NEW_TASK = re.compile(r"^S(\d{3})\.T(\d{3})_")


class Layout:
    def __init__(self, root):
        self.root = root
        self.by_new_name = {}     # new file basename -> old id ("TASK-0153")
        self.by_old_id = {}       # old id -> new path
        self.map_rows = []
        path = self.p(".ai/id-map.tsv")
        if os.path.isfile(path):
            with open(path, encoding="utf-8") as fh:
                for ln in fh:
                    c = ln.rstrip("\r\n").split("\t")
                    if not any(c) or c[0] == "old_id":
                        continue
                    self.map_rows.append(c)
                    if len(c) >= 4 and c[0] and c[3]:
                        self.by_new_name[os.path.basename(c[3])] = c[0]
                        self.by_old_id[c[0]] = c[3]

    def p(self, rel):
        return os.path.normpath(os.path.join(self.root, rel))

    def old_task_number(self, name):
        """The OLD number of a brief, or None when it was written after the rename."""
        old = self.by_new_name.get(name, "")
        m = re.fullmatch(r"TASK-(\d{4})", old)
        return int(m.group(1)) if m else None

    def is_review_0012(self, name):
        return self.by_new_name.get(name) == "REVIEW-0012"


def body_after(text, heading):
    """Lines under `heading` up to the next `## `, minus placeholder noise."""
    lines = text.split("\n")
    try:
        start = lines.index(heading)
    except ValueError:
        return None
    out = []
    for line in lines[start + 1:]:
        if line.startswith("## "):
            break
        s = line.strip()
        if not s:
            continue
        if s.startswith("<!--") or s.startswith("-->") or s.startswith(">"):
            continue
        if set(s) <= set("|- "):
            continue
        out.append(s)
    return out


def check_handover(lay):
    """Handover sections in the task template and in task briefs (ADR-0012).

    Content presence only, never table shape. Briefs below the contract
    boundary are records of what happened and are not rewritten to pass.
    """
    bad = []

    def check(path, label):
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        for heading in REQUIRED:
            body = body_after(text, heading)
            if body is None:
                bad.append("%s: missing '%s'" % (label, heading))
            elif not body:
                bad.append("%s: '%s' is present but empty" % (label, heading))

    # `.ai/templates/` is retired: the task template is the skill's.
    tpl = os.path.join(REPO, "skills/project-workflow/templates/tasks/0000_TEMPLATE.md")
    if os.path.isfile(tpl):
        check(tpl, "templates/tasks/0000_TEMPLATE.md")

    # Walks recursively: a brief must not escape by being archived under tasks/completed/.
    for dirpath, _d, filenames in os.walk(lay.p(".ai/tasks")):
        for name in sorted(filenames):
            if not name.endswith(".md") or name == "TODO.md":
                continue
            rel = os.path.relpath(os.path.join(dirpath, name), lay.p(".ai/tasks"))
            if not NEW_TASK.match(name):
                bad.append("%s: filename does not match S###.T###_*.md, so it cannot be "
                           "checked -- rename it or update this check" % rel)
                continue
            n = lay.old_task_number(name)
            if n is None or n >= FIRST_CONTRACT_TASK:
                check(os.path.join(dirpath, name), rel)
    return bad


def check_live(lay):
    """Live files hold state, not history (ADR-0033): a line budget each, and no
    backlog line over 600 characters."""
    specs = [(".ai/10.CURRENT_STATE.md", 200), (".ai/20.PLAN.md", 80), ("AGENTS.md", 120)]
    backlog = ".ai/35.AD_HOC_TASKS.md"
    bad = []
    for rel, mx in specs:
        f = lay.p(rel)
        if not os.path.isfile(f):
            continue
        with open(f, encoding="utf-8") as fh:
            n = sum(1 for _ in fh)
        if n > mx:
            bad.append("%s is %d lines, over its budget of %d (ADR-0033)" % (rel, n, mx))
    f = lay.p(backlog)
    if os.path.isfile(f):
        with open(f, encoding="utf-8") as fh:
            for i, ln in enumerate(fh, 1):
                if len(ln.rstrip("\n")) > 600:
                    bad.append("%s line over 600 characters (ADR-0033): %s:%d: %d chars"
                               % (os.path.basename(backlog), backlog, i, len(ln.rstrip("\n"))))
    return bad


def check_risk(lay):
    """The AI risk register exists and is well-formed (issue #13)."""
    rel = ".ai/40.RISK_REGISTER.md"
    f = lay.p(rel)
    if not os.path.isfile(f):
        return ["%s is missing" % rel]
    text = open(f, encoding="utf-8").read()
    bad = []
    if not re.search(r"^Last reviewed: \d{4}-\d{2}-\d{2}", text, re.M):
        bad.append("no 'Last reviewed: YYYY-MM-DD' line")
    rows = [l for l in text.splitlines() if l.startswith("| R-")]
    if not rows:
        bad.append("no R-NN rows")
    for l in rows:
        cells = [c.strip() for c in l.strip().strip("|").split("|")]
        if len(cells) != 10 or not re.fullmatch(r"R-\d{2}", cells[0]) or not cells[-1]:
            bad.append("malformed row: " + l[:60])
    return bad


def check_idmap(lay):
    """The id map exists and every row is whole (ADR-0066 5)."""
    f = lay.p(".ai/id-map.tsv")
    if not os.path.isfile(f):
        return [".ai/id-map.tsv is missing: old ids resolve only through it"]
    bad, seen = [], set()
    for c in lay.map_rows:
        if len(c) != 4 or not c[0] or not c[1]:
            bad.append("id-map row is not old_id, new_id, old_path, new_path: %s" % "|".join(c)[:60])
            continue
        if c[0] in seen:
            bad.append("id-map lists %s twice" % c[0])
        seen.add(c[0])
        if c[3] and not os.path.exists(lay.p(c[3])):
            bad.append("id-map: %s -> %s, which does not exist" % (c[0], c[3]))
    return bad


RETIRED = [".ai/planning", ".ai/context", ".ai/templates", ".ai/tasks/TODO.md",
           "TODO.md"]


def check_retired(lay):
    """The old layout's paths are gone (ADR-0066, S017.T007): nothing may be
    kept or re-created there, so a check that no longer reads them cannot be
    leaving live files unpoliced."""
    return ["%s exists: the old planning layout is retired, use .ai/00.CONVENTIONS.md's names"
            % rel for rel in RETIRED if os.path.exists(lay.p(rel))]


def groups(lay):
    """[(schema, artifact)] for every artifact the skill's checker validates."""
    pm = os.path.join(REPO, "skills/project-migration/schemas")
    pw = os.path.join(REPO, "skills/project-workflow/schemas")
    legacy = os.path.join(REPO, "tests/legacy-schemas")
    out = []

    def add(schema, art):
        if os.path.isfile(schema):
            out.append((schema, art))

    def num_of(name):
        m = re.match(r"^[A-Z-]*0*(\d+)", name)
        return int(m.group(1)) if m else None

    for dirpath in (lay.p(".ai/tasks"),):
        for f in sorted(glob.glob(os.path.join(dirpath, "*.md"))):
            name = os.path.basename(f)
            if not NEW_TASK.match(name):
                continue
            n = lay.old_task_number(name)
            if n is None:
                # Written after the rename: the project-workflow task schema.
                add(os.path.join(pw, "task.md"), f)
            elif n < FIRST_GENERATED_TASK:
                continue
            elif n < FIRST_V2_TASK:
                add(os.path.join(legacy, "task-v1.md"), f)
            else:
                add(os.path.join(pm, "task.md"), f)

    for f in sorted(glob.glob(lay.p(".ai/decisions/*.md"))):
        name = os.path.basename(f)
        if name == "INDEX.md":
            continue
        n = num_of(name)
        add(os.path.join(legacy, "adr-v1.md") if n is not None and n < FIRST_V2_ADR
            else os.path.join(pm, "adr.md"), f)

    # REVIEW-0012 is exempt by name, and by its old id once renamed: it alone
    # orders its sections differently, and a review is never rewritten.
    for f in sorted(glob.glob(lay.p(".ai/reviews/*.md"))):
        name = os.path.basename(f)
        if name == "INDEX.md" or lay.is_review_0012(name):
            continue
        add(os.path.join(pm, "review.md") if name in lay.by_new_name
            else os.path.join(pw, "review.md"), f)
    for f in sorted(glob.glob(lay.p(".ai/sessions/*.md"))):
        if os.path.basename(f) != "INDEX.md":
            add(os.path.join(pm, "session.md"), f)
    return out


def check_groups(lay):
    lib = os.path.join(REPO, "skills/project-workflow/scripts/artifact_lib.py")
    if not (os.path.isdir(os.path.join(REPO, "skills/project-migration/schemas"))
            and os.path.isfile(lib)):
        return []
    gs = groups(lay)
    if not gs:
        return []
    env = dict(os.environ, ARTIFACT_GROUPS="".join("%s\t%s\n" % g for g in gs))
    r = subprocess.run([sys.executable, lib, "check-groups"], env=env, cwd=REPO,
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if r.returncode == 0:
        return []
    return [ln for ln in r.stdout.splitlines() if ln.strip()] or ["check-groups failed"]


CHECKS = {"handover": ("HANDOVER", check_handover), "live": ("LIVE", check_live),
          "risk": ("RISK-REGISTER", check_risk), "idmap": ("ID-MAP", check_idmap),
          "groups": ("SCHEMA", check_groups), "retired": ("OLD-LAYOUT", check_retired)}


def main(argv):
    args = argv[1:]
    root = "."
    if "--root" in args:
        i = args.index("--root")
        root = args[i + 1]
        del args[i:i + 2]
    which = args[0] if args else "all"
    if which != "all" and which not in CHECKS:
        print(__doc__)
        return 2
    lay = Layout(root)
    bad = 0
    for name in (CHECKS if which == "all" else [which]):
        prefix, fn = CHECKS[name]
        for msg in fn(lay):
            print("%s: %s" % (prefix, msg))
            bad = 1
    return bad


if __name__ == "__main__":
    sys.exit(main(sys.argv))
