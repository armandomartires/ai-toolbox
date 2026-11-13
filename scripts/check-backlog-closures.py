#!/usr/bin/env python3
"""Check that every closed backlog row names a closer that agrees (B-038),
and that the "N items are open" sentence matches the rows (B-047).

The rule is stated in .ai/README.md (*Closing a backlog row*); this only
checks it. For each row of .ai/planning/BACKLOG.md whose Status cell says
done or closed:

  1. its Ready-when cell cites a TASK-NNNN, ADR-NNNN or REVIEW-NNNN;
  2. the closer - the id after "Closed <date> by", else the first id cited -
     exists as a file under .ai/;
  3. if the closer is a task, its "- Status:" line reads done or cancelled.

The table's shape comes from skills/project-migration/schemas/backlog.md's
`columns:` line, its one owner (B-042, TASK-0147): the header row must equal
it, and every row must have that many cells. The schema is found beside this
script's repository, never under a fixture root, and a missing one fails.

At most UNEXERCISED_CAP open rows are titled "Unexercised:" (ADR-0039,
TASK-0175): a capability nothing has run for real is an open row, and at the
cap the next capability waits until one is exercised or retired.

And BACKLOG.md holds exactly one "**<N> items are open**" sentence (or
"item is"), whose N - a word up to twenty, or digits - equals the number of
rows whose Status says neither done nor closed (TASK-0145).

WHAT THIS PROVES: no closed row points at nothing, at a missing file, or at
a task still open. WHAT IT DOES NOT PROVE: the reverse - a row left `ready`
after its task closed (B-035's case) - because briefs cite backlog items in
free prose; or that a word of the closing note is true. It reads no dated
record other than the cited task's Status line.

Two layouts are read (ADR-0066), told apart by what exists: `.ai/00.CONVENTIONS.md`
means the numbered one, whose list is .ai/35.AD_HOC_TASKS.md. There an entry is
"### NNN. Title" under "## Open" or "## Resolved" (B-NNN keeps its number), an
entry under Resolved must cite a closer that exists and is done, completed or
cancelled, the open count is not a table cell, so a "**N items are open**"
sentence is optional there but must be right if present, and the Unexercised cap
applies to the Open entries. An old id (TASK-NNNN, REVIEW-NNNN) resolves through
.ai/id-map.tsv (old_id, new_id, old_path, new_path) once its file has moved.

Usage: check-backlog-closures.py [repo-root]   (a fixture root, for red proofs)
Exit 0 clean, 1 on any finding. Python 3, standard library only.
"""
import glob
import os
import re
import sys

root = sys.argv[1] if len(sys.argv) > 1 else "."
NEW = os.path.isfile(os.path.join(root, ".ai/00.CONVENTIONS.md"))
backlog = os.path.join(root, ".ai/35.AD_HOC_TASKS.md" if NEW else ".ai/planning/BACKLOG.md")
schema = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                      "skills/project-migration/schemas/backlog.md")
ID = r"(TASK|ADR|REVIEW)-(\d{4})"
NEW_ID = r"S(\d{3})\.T(\d{3})"          # ADR-0066 task id

UNEXERCISED_CAP = 3  # chosen by the human; raise it only by amending ADR-0039
WHERE = {"TASK": ".ai/tasks/TASK-{n}-*.md", "ADR": ".ai/decisions/{n}-*.md",
         "REVIEW": ".ai/reviews/REVIEW-{n}-*.md"}
# The numbered layout keeps ADR numbers and renames only the file.
WHERE_ALSO = {"ADR": [".ai/decisions/ADR-{n}-*.md"]}


def id_map():
    """{old_id: absolute new path} from .ai/id-map.tsv, or {} when it is absent."""
    out = {}
    try:
        with open(os.path.join(root, ".ai/id-map.tsv"), encoding="utf-8") as fh:
            for ln in fh:
                c = ln.rstrip(chr(13) + chr(10)).split(chr(9))
                if len(c) >= 4 and c[0] != "old_id":
                    out[c[0]] = os.path.join(root, c[3])
    except OSError:
        pass
    return out


def find_files(kind, num, ids):
    """The file a TASK/ADR/REVIEW id names: where it was, else where the map moved it."""
    pats = [WHERE[kind]] + WHERE_ALSO.get(kind, [])
    files = [f for pat in pats for f in glob.glob(os.path.join(root, pat.format(n=num)))]
    mapped = ids.get("%s-%s" % (kind, num))
    if not files and mapped and os.path.isfile(mapped):
        files = [mapped]
    return files


def status_word(text):
    """A brief's status: old `- Status:` under `## Status`, or new `**Status**:`."""
    sect = re.search(r"^## Status\s*$(.*?)(?=^## |\Z)", text, re.M | re.S)
    s = re.search(r"^- Status:\s*\**\s*([A-Za-z_]+)", sect.group(1) if sect else "", re.M)
    if not s:
        s = re.search(r"^\*\*Status\*\*:\s*([A-Za-z_]+)", text, re.M)
    return s.group(1).lower() if s else None


try:
    lines = open(backlog, encoding="utf-8").read().split("\n")
except OSError as e:
    print("BACKLOG: cannot read %s (%s)" % (backlog, e))
    sys.exit(1)

WORDS = ("zero one two three four five six seven eight nine ten eleven twelve "
         "thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty").split()
ids = id_map()
findings = []
closed = 0
open_rows = []
unexercised = []


def check_closer(row, note):
    """Findings for one closed item: its closer is cited, exists, and is done."""
    m = re.search(r"Closed \d{4}-\d{2}-\d{2} by `?(?:" + ID + "|" + NEW_ID + ")", note)
    if not m:
        m = re.search(r"\b(?:" + ID + "|" + NEW_ID + r")\b", note)
    if not m:
        findings.append("%s is closed but cites no TASK, ADR or REVIEW" % row)
        return
    if m.group(3):                                   # S###.T###
        label = "S%s.T%s" % (m.group(3), m.group(4))
        files = glob.glob(os.path.join(root, ".ai/tasks/%s_*.md" % label))
        kind = "TASK"
    else:
        kind, num = m.group(1), m.group(2)
        label = "%s-%s" % (kind, num)
        files = find_files(kind, num, ids)
    if not files:
        findings.append("%s is closed by %s, which has no file under .ai/" % (row, label))
        return
    if kind != "TASK":
        return
    # The status line of the brief itself, not the first one anywhere: a
    # brief may quote the phrase in its context (TASK-0147's did).
    word = status_word(open(files[0], encoding="utf-8").read())
    if word not in ("done", "completed", "cancelled"):
        findings.append("%s is closed by %s, whose Status reads %s"
                        % (row, label, word or "nothing parsable"))


if not NEW:
    try:
        columns = [ln.split(":", 1)[1].strip() for ln in open(schema, encoding="utf-8")
                   if ln.startswith("columns:")][0].split(" | ")
    except (OSError, IndexError) as e:
        print("BACKLOG: cannot read the columns from %s (%s)" % (schema, e or "no columns: line"))
        sys.exit(1)
    header = "| " + " | ".join(columns) + " |"
    for need in ("ID", "Title", "Status", "Ready when"):
        if need not in columns:
            print("BACKLOG: the schema's columns have no %r, which this check reads" % need)
            sys.exit(1)

    heads = [ln.strip() for ln in lines if ln.startswith("| ID ")]
    if heads != [header]:
        findings.append("the table header should be the schema's columns:\n      expected: %s\n      found:    %s"
                        % (header, " / ".join(heads) or "no '| ID ' header row"))
    for line in lines:
        if not line.startswith("| B-"):
            continue
        cells = line.split(" | ")
        if len(cells) != len(columns):
            findings.append("%s: expected %d cells (the schema's columns), found %d"
                            % (cells[0][2:], len(columns), len(cells)))
            continue
        row = cells[0][2:].strip()
        status, note = cells[columns.index("Status")].lower(), cells[columns.index("Ready when")]
        if "done" not in status and "closed" not in status:
            open_rows.append(row)
            if cells[columns.index("Title")].strip().startswith("Unexercised:"):
                unexercised.append(row)
            continue
        closed += 1
        check_closer(row, note)
else:
    # ### NNN. Title entries; "## Open" and "## Resolved" say which they are.
    section, entries = None, []
    for line in lines:
        h = re.match(r"^## (\w+)", line)
        if h:
            section = h.group(1).lower()
            continue
        e = re.match(r"^### (\d+)\. (.*\S)\s*$", line)
        if e and section in ("open", "resolved"):
            entries.append([section, e.group(1), e.group(2), []])
        elif entries and not line.startswith("### "):
            entries[-1][3].append(line)
    seen = set()
    for section, num, title, body in entries:
        row = "### " + num
        if num in seen:
            findings.append("%s appears twice" % row)
        seen.add(num)
        if section == "open":
            open_rows.append(row)
            if title.startswith("Unexercised:"):
                unexercised.append(row)
        else:
            closed += 1
            check_closer(row, "\n".join(body))

counts = [m for line in lines
          for m in [re.match(r"^\*\*(\w+) items? (?:are|is) open\*\*", line)] if m]
if NEW and not counts:
    pass                      # the numbered list carries no count sentence
elif len(counts) != 1:
    findings.append("expected one '**<N> items are open**' sentence, found %d" % len(counts))
else:
    said = counts[0].group(1).lower()
    n = int(said) if said.isdigit() else (WORDS.index(said) if said in WORDS else None)
    if n != len(open_rows):
        findings.append("the open-item sentence says %s, but %d rows are open (%s)"
                        % (said, len(open_rows), ", ".join(open_rows) or "none"))

if len(unexercised) > UNEXERCISED_CAP:
    findings.append("%d open rows are titled 'Unexercised:' (%s), over the cap of %d "
                    "(ADR-0039): exercise or retire one first"
                    % (len(unexercised), ", ".join(unexercised), UNEXERCISED_CAP))

for f in findings:
    print("BACKLOG: " + f)
if findings:
    sys.exit(1)
print("check-backlog-closures: OK (%d closed rows, %d open, matching the sentence; "
      "%d of %d unexercised)" % (closed, len(open_rows), len(unexercised), UNEXERCISED_CAP))
