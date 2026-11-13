#!/usr/bin/env python3
"""Check that every resolved ad-hoc entry names a closer that agrees (B-038),
and that an "N items are open" sentence, if present, matches the entries (B-047).

The list is .ai/35.AD_HOC_TASKS.md (ADR-0066; the rule is in .ai/00.CONVENTIONS.md).
An entry is "### NNN. Title" under "## Open" or "## Resolved" (B-NNN keeps its
number). For each entry under Resolved:

  1. its text cites a task id (S###.T###, or an old TASK-NNNN), ADR-NNNN or REVIEW-NNNN;
  2. the closer - the id after "Closed <date> by", else the first id cited -
     exists as a file under .ai/;
  3. if the closer is a task, its Status reads done, completed or cancelled.

An old id (TASK-NNNN, REVIEW-NNNN) resolves through .ai/id-map.tsv (old_id,
new_id, old_path, new_path); an ADR keeps its number and resolves by
.ai/decisions/ADR-NNNN-*.md. A "**N items are open**" sentence is optional but
must be right if present. At most UNEXERCISED_CAP Open entries are titled
"Unexercised:" (ADR-0039): a capability nothing has run for real is an open
entry, and at the cap the next waits until one is exercised or retired.

WHAT THIS PROVES: no resolved entry points at nothing, at a missing file, or at
a task still open. WHAT IT DOES NOT PROVE: the reverse - an entry left open
after its task closed - or that a word of the closing note is true.

Usage: check-backlog-closures.py [repo-root]   (a fixture root, for red proofs)
Exit 0 clean, 1 on any finding. Python 3, standard library only.
"""
import glob
import os
import re
import sys

root = sys.argv[1] if len(sys.argv) > 1 else "."
backlog = os.path.join(root, ".ai/35.AD_HOC_TASKS.md")
ID = r"(TASK|ADR|REVIEW)-(\d{4})"
NEW_ID = r"S(\d{3})\.T(\d{3})"          # ADR-0066 task id

UNEXERCISED_CAP = 3  # chosen by the human; raise it only by amending ADR-0039
# ADR numbers are kept and only the file is renamed; old TASK and REVIEW ids
# resolve through the id map.
WHERE = {"ADR": [".ai/decisions/ADR-{n}-*.md"]}


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
    """The file a TASK/ADR/REVIEW id names: by its ADR path, else where the map moved it."""
    pats = WHERE.get(kind, [])
    files = [f for pat in pats for f in glob.glob(os.path.join(root, pat.format(n=num)))]
    mapped = ids.get("%s-%s" % (kind, num))
    if not files and mapped and os.path.isfile(mapped):
        files = [mapped]
    return files


def status_word(text):
    """A brief's status: `**Status**:`, or the `- Status:` under `## Status` that renamed older briefs carry."""
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
if not counts:
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
print("check-backlog-closures: OK (%d closed entries, %d open; "
      "%d of %d unexercised)" % (closed, len(open_rows), len(unexercised), UNEXERCISED_CAP))
