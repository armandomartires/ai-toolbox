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

And BACKLOG.md holds exactly one "**<N> items are open**" sentence (or
"item is"), whose N - a word up to twenty, or digits - equals the number of
rows whose Status says neither done nor closed (TASK-0145).

WHAT THIS PROVES: no closed row points at nothing, at a missing file, or at
a task still open. WHAT IT DOES NOT PROVE: the reverse - a row left `ready`
after its task closed (B-035's case) - because briefs cite backlog items in
free prose; or that a word of the closing note is true. It reads no dated
record other than the cited task's Status line.

Usage: check-backlog-closures.py [repo-root]   (a fixture root, for red proofs)
Exit 0 clean, 1 on any finding. Python 3, standard library only.
"""
import glob
import os
import re
import sys

root = sys.argv[1] if len(sys.argv) > 1 else "."
backlog = os.path.join(root, ".ai/planning/BACKLOG.md")
schema = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                      "skills/project-migration/schemas/backlog.md")
ID = r"(TASK|ADR|REVIEW)-(\d{4})"
WHERE = {"TASK": ".ai/tasks/TASK-{n}-*.md", "ADR": ".ai/decisions/{n}-*.md",
         "REVIEW": ".ai/reviews/REVIEW-{n}-*.md"}

try:
    lines = open(backlog, encoding="utf-8").read().split("\n")
except OSError as e:
    print("BACKLOG: cannot read %s (%s)" % (backlog, e))
    sys.exit(1)

WORDS = ("zero one two three four five six seven eight nine ten eleven twelve "
         "thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty").split()
try:
    columns = [ln.split(":", 1)[1].strip() for ln in open(schema, encoding="utf-8")
               if ln.startswith("columns:")][0].split(" | ")
except (OSError, IndexError) as e:
    print("BACKLOG: cannot read the columns from %s (%s)" % (schema, e or "no columns: line"))
    sys.exit(1)
header = "| " + " | ".join(columns) + " |"
for need in ("ID", "Status", "Ready when"):
    if need not in columns:
        print("BACKLOG: the schema's columns have no %r, which this check reads" % need)
        sys.exit(1)

findings = []
closed = 0
open_rows = []
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
        continue
    closed += 1
    m = re.search(r"Closed \d{4}-\d{2}-\d{2} by `?" + ID, note) or re.search(r"\b" + ID + r"\b", note)
    if not m:
        findings.append("%s is closed but cites no TASK, ADR or REVIEW" % row)
        continue
    kind, num = m.group(1), m.group(2)
    files = glob.glob(os.path.join(root, WHERE[kind].format(n=num)))
    if not files:
        findings.append("%s is closed by %s-%s, which has no file under .ai/" % (row, kind, num))
        continue
    if kind != "TASK":
        continue
    text = open(files[0], encoding="utf-8").read()
    # The "- Status:" line under "## Status", not the first one anywhere: a
    # brief may quote the phrase in its context (TASK-0147's did).
    sect = re.search(r"^## Status\s*$(.*?)(?=^## |\Z)", text, re.M | re.S)
    s = re.search(r"^- Status:\s*\**\s*([A-Za-z_]+)", sect.group(1) if sect else "", re.M)
    word = s.group(1).lower() if s else None
    if word not in ("done", "cancelled"):
        findings.append("%s is closed by TASK-%s, whose Status reads %s"
                        % (row, num, word or "nothing parsable"))

counts = [m for line in lines
          for m in [re.match(r"^\*\*(\w+) items? (?:are|is) open\*\*", line)] if m]
if len(counts) != 1:
    findings.append("expected one '**<N> items are open**' sentence, found %d" % len(counts))
else:
    said = counts[0].group(1).lower()
    n = int(said) if said.isdigit() else (WORDS.index(said) if said in WORDS else None)
    if n != len(open_rows):
        findings.append("the open-item sentence says %s, but %d rows are open (%s)"
                        % (said, len(open_rows), ", ".join(open_rows) or "none"))

for f in findings:
    print("BACKLOG: " + f)
if findings:
    sys.exit(1)
print("check-backlog-closures: OK (%d closed rows, %d open, matching the sentence)"
      % (closed, len(open_rows)))
