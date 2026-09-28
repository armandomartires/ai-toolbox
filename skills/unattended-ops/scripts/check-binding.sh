#!/usr/bin/env bash
# check-binding.sh — validate one unattended-run binding declaration.
#
# Usage:
#   ./check-binding.sh <path-to-binding.md> [<path-to-loop.md>]
#
# Exits non-zero NAMING the offending slot, step or line — naming it is the
# requirement, not merely a non-zero status, because the name is what
# identifies the thing to go and fix.
#
# A binding is rejected when:
#
#   - a required slot is MISSING
#   - a required slot is present but EMPTY (a blank is missing, never an
#     implicit `not-applicable`)
#   - any value decodes to `unknown`, at any depth
#   - any value is a `<FILL: ...>` template placeholder
#   - a slot is DECLARED TWICE (two answers record neither)
#   - a numbered step of the loop is NOT DECLARED in `steps_declared`
#   - `steps_declared` names a step number the loop does not have
#   - a paragraph of the body states a rule and CITES NOTHING
#
# THE STEP NUMBERS ARE READ FROM THE LOOP FILE, never from a copy held here.
# The loop is authoritative for the sequence (ADR-0022, "loop.md is
# authoritative, a binding cites it"), so a checker holding its own copy of
# the step count would become the second owner it exists to prevent. If the
# loop gains a step, this script follows without being edited.
#
# READ-ONLY AND IDEMPOTENT. It opens two files for reading and writes nothing,
# anywhere — no temp file, no cache, no edit to the binding. Running it twice
# on the same binding produces identical output and leaves the filesystem
# unchanged.
#
# WHAT THIS PROVES: that a binding's slots are present and answered, that it
# declares every numbered step of the loop, and that no paragraph of its body
# states a rule without citing a source.
# WHAT IT DOES NOT PROVE: that the binding implements any step correctly, that
# its gate commands do any work, that the roles it names exist or are
# `primary`, that its model resolves, or that a run driven by it would be
# safe. It validates a declaration, not a driver. Do not soften this.
#
# THE UNCITED-RULE CHECK HAS A STATED CEILING, in both directions:
#   - It judges a PARAGRAPH, not a sentence. One citation anywhere in a
#     paragraph exempts the whole paragraph, so an uncited rule sitting beside
#     a cited one passes.
#   - It matches the FORM of a rule — a modal verb — and not its meaning. A
#     rule phrased without a modal ("the driver stages everything") passes,
#     and a description that happens to use "never" needs a citation it might
#     not otherwise want.
# This is the same accepted limit as the wiring-claim check in
# docs/development/authoring-guide.md: judging polarity from prose catches a
# decidable subset, and a check that guesses at meaning fires on correct text
# and gets deleted. The rest of the class — whether a declared step is
# implemented faithfully — is left to review, which is where it belongs.
#
# The frontmatter is PARSED, never grepped: `unknown` is a value in a
# structured document, and a binding's body may legitimately discuss
# `evidence_file:` or the word unknown in prose — so a grep would answer a
# different question than the one asked.
#
# The parser is a deliberately small YAML SUBSET written against the python3
# standard library alone. PyYAML is deliberately not used: an operator runs
# this from a checkout with nothing installed, and a checker that needs
# `pip install` is a checker that does not run.
#
# The subset covers the spellings BELOW, and is not a YAML parser:
#
#   - plain, single-quoted and double-quoted scalars
#   - trailing `#` comments — stripped, but NOT when the `#` is inside a
#     quoted string or unspaced inside a token (`run#0001` is data)
#   - block sequences (`- item`) and flow sequences (`[a, b]`)
#   - block mappings and flow mappings (`{k: v}`), including nesting
#   - any casing, and leading or trailing whitespace
#   - duplicate keys — reported, and EVERY occurrence is inspected
#
# KNOWN GAPS — legal YAML that decodes to `unknown` and is NOT caught:
#
#   - anchors and aliases:  `model: &a unknown`
#   - explicit tags:        `model: !!str unknown`
#   - double-quoted escapes that spell the word: `"unkno\x77n"`
#   - block and folded scalars (`|`, `>`), which this subset does not read
#
# These are recorded rather than fixed because closing them properly means a
# real YAML parser, which the offline constraint above forbids. They are a
# real hole in a binding written adversarially; they are unlikely in one
# written by hand, which is the only case this checker is claimed to cover.
#
# EXTRA SLOTS ARE ALLOWED, and are checked like every other slot. This
# deliberately differs from skills/ansible-ops/scripts/check-change-record.sh,
# which rejects a tenth field: a change record is one fixed schema, whereas a
# binding is per-client, and a closed slot list across three clients would
# force `not-applicable` noise on every client-specific setting. What is NOT
# allowed is an extra slot that is blank, `unknown` or a placeholder.
#
# WIRING — nothing in this repository runs this script. tests/validate.sh
# checks skill frontmatter, MCP manifests, loop sections, agent definitions,
# the registry and the handover contract; it never executes a skill's script,
# and it never reads a binding or either fixture. Neither does the pre-commit
# hook (which runs only that gate) nor CI (the same, plus the registry
# staleness check). The mandatory gate is offline and hermetic (ADR-0007), and
# a real binding lives in a CONSUMING repository, so there is nothing here for
# a gate to point at. The only caller is a person, or a binding's own CI,
# pointing it at a binding. The files under fixtures/ are therefore evidence
# an author produced by hand, not a suite anything re-runs.
set -euo pipefail

usage() {
  sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

case "${1:-}" in
  ""|-h|--help) usage ;;
esac
[ "$#" -ge 1 ] && [ "$#" -le 2 ] || usage

BINDING="$1"

# The loop file: given explicitly, or resolved relative to this script, which
# lives at <repo>/skills/unattended-ops/scripts/. Resolved rather than assumed
# from the caller's working directory, so the checker works from anywhere.
HERE="$(cd "$(dirname "$0")" && pwd)"
LOOP="${2:-$HERE/../../../loops/unattended-run/loop.md}"

command -v python3 >/dev/null 2>&1 || {
  echo "MISSING prerequisite: python3" >&2
  exit 2
}

[ -f "$BINDING" ] || {
  echo "NOT A FILE: $BINDING" >&2
  exit 2
}

[ -f "$LOOP" ] || {
  echo "NOT A FILE: $LOOP" >&2
  echo "  The loop file is where the step numbers come from. Pass it as the" >&2
  echo "  second argument when it is not beside this skill." >&2
  exit 2
}

python3 - "$BINDING" "$LOOP" <<'PY'
import re
import sys

binding_path, loop_path = sys.argv[1], sys.argv[2]

# The slots a run cannot derive. Documented one-for-one in
# skills/unattended-ops/templates/binding.md, whose table states why each one
# is un-derivable. Changing this list means changing that table too.
REQUIRED = [
    "binding_name",
    "client",
    "driver_entry",
    "model",
    "queue_source",
    "task_file_glob",
    "tracker_path",
    "gate_map",
    "gate_entry_point",
    "long_gate_groups",
    "watchdog_timeout",
    "evidence_file",
    "journal_file",
    "run_id_source",
    "commit_shape",
    "stash_namespace",
    "handover_path",
    "task_cap",
    "roles",
    "steps_declared",
]

problems = []

with open(binding_path, encoding="utf-8") as fh:
    lines = fh.read().split("\n")


# --- Locate the frontmatter -------------------------------------------------
# It must be the first thing in the file. A binding whose frontmatter is
# elsewhere is a binding whose checked surface is not where the checker looks.
if not lines or lines[0].strip() != "---":
    print("INVALID BINDING: %s: frontmatter must open with '---' on line 1"
          % binding_path)
    sys.exit(1)
try:
    end = next(i for i, l in enumerate(lines[1:], 1) if l.strip() == "---")
except StopIteration:
    print("INVALID BINDING: %s: frontmatter is not terminated by a closing "
          "'---'" % binding_path)
    sys.exit(1)
fm = lines[1:end]
body = lines[end + 1:]
body_offset = end + 2          # 1-based line number of body[0]


# --- The YAML subset --------------------------------------------------------
# Nodes are tagged tuples so a mapping can keep DUPLICATE keys instead of
# silently discarding one — a discarded `model: unknown` is exactly the defect
# this parser exists to close.
#   ("str", text)  ("seq", [node, ...])  ("map", [(key, node), ...])

def comment_start(text):
    """Index of the `#` that opens a YAML comment, or -1.

    A `#` is a comment only outside quotes AND at the start of a token — so
    `"a # b"` and `run#0001` both keep their hash, while `unknown  # note`
    loses it.
    """
    quote = None
    i = 0
    while i < len(text):
        ch = text[i]
        if quote is not None:
            if quote == '"' and ch == "\\":
                i += 2
                continue
            if ch == quote:
                quote = None
        elif ch in "\"'":
            quote = ch
        elif ch == "#" and (i == 0 or text[i - 1] in " \t"):
            return i
        i += 1
    return -1


def strip_comment(text):
    idx = comment_start(text)
    return text if idx < 0 else text[:idx]


def unquote(text):
    text = text.strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in "\"'":
        inner = text[1:-1]
        if text[0] == '"':
            inner = inner.replace('\\"', '"').replace("\\\\", "\\")
        else:
            inner = inner.replace("''", "'")
        return inner.strip()
    return text


def split_flow(text):
    """Split a flow collection's interior on top-level commas."""
    parts, buf, depth, quote = [], "", 0, None
    for ch in text:
        if quote is not None:
            buf += ch
            if ch == quote:
                quote = None
            continue
        if ch in "\"'":
            quote = ch
        elif ch in "[{":
            depth += 1
        elif ch in "]}":
            depth -= 1
        elif ch == "," and depth == 0:
            parts.append(buf)
            buf = ""
            continue
        buf += ch
    if buf.strip() or parts:
        parts.append(buf)
    return [p.strip() for p in parts]


def split_key(text):
    """Split `key: value` on the first colon that is outside quotes."""
    quote = None
    i = 0
    while i < len(text):
        ch = text[i]
        if quote is not None:
            if quote == '"' and ch == "\\":
                i += 2
                continue
            if ch == quote:
                quote = None
        elif ch in "\"'":
            quote = ch
        elif ch == ":":
            return text[:i], text[i + 1:]
        i += 1
    return None, None


def parse_value(text):
    """Parse an inline value: flow collection, or a scalar."""
    t = text.strip()
    if t.startswith("[") and t.endswith("]"):
        return ("seq", [parse_value(p) for p in split_flow(t[1:-1])])
    if t.startswith("{") and t.endswith("}"):
        pairs = []
        for part in split_flow(t[1:-1]):
            key, rest = split_key(part)
            if key is None:
                pairs.append((unquote(part), ("str", "")))
            else:
                pairs.append((unquote(key), parse_value(rest)))
        return ("map", pairs)
    return ("str", unquote(t))


def indent_of(raw):
    return len(raw) - len(raw.lstrip(" \t"))


def skippable(raw):
    stripped = raw.strip()
    return stripped == "" or stripped.startswith("#")


def parse_block(idx, indent):
    """Parse a block-level node whose keys/items sit at `indent`."""
    pairs = []
    seq = []
    while idx < len(fm):
        raw = fm[idx]
        if skippable(raw):
            idx += 1
            continue
        here = indent_of(raw)
        if here < indent:
            break
        if here > indent:
            idx += 1          # deeper than anything we opened; not our surface
            continue
        line = strip_comment(raw).strip()
        if not line:
            idx += 1
            continue

        if line == "-" or line.startswith("- "):
            item = line[1:].strip()
            if item == "":
                seq.append(("str", ""))
                idx += 1
                continue
            seq.append(parse_value(item))
            idx += 1
            continue

        key, rest = split_key(line)
        if key is None:
            idx += 1
            continue

        key = unquote(key)
        rest = rest.strip()
        idx += 1
        if rest == "":
            child_indent = None
            probe = idx
            while probe < len(fm):
                if skippable(fm[probe]):
                    probe += 1
                    continue
                if indent_of(fm[probe]) > indent:
                    child_indent = indent_of(fm[probe])
                break
            if child_indent is None:
                pairs.append((key, ("str", "")))
            else:
                child, idx = parse_block(idx, child_indent)
                pairs.append((key, child))
            continue
        pairs.append((key, parse_value(rest)))

    if pairs:
        return ("map", pairs), idx
    if seq:
        return ("seq", seq), idx
    return ("str", ""), idx


base_indent = 0
for raw in fm:
    if not skippable(raw):
        base_indent = indent_of(raw)
        break
root, _ = parse_block(0, base_indent)
if root[0] != "map":
    print("INVALID BINDING: %s: frontmatter is not a mapping of slots"
          % binding_path)
    sys.exit(1)
top = root[1]


def leaves(node, label, out):
    """Every scalar reachable from `node`, labelled by its path."""
    kind, data = node
    if kind == "str":
        out.append((label, data))
        return
    if not data:
        out.append((label, ""))
        return
    if kind == "seq":
        for i, item in enumerate(data):
            leaves(item, "%s[%d]" % (label, i), out)
        return
    for key, value in data:
        leaves(value, "%s.%s" % (label, key), out)


def is_placeholder(val):
    """A <FILL: ...> style value is not an answer; it is the absence of one."""
    return val.startswith("<") and val.endswith(">")


def child_keys(node):
    return [k for k, _ in node[1]] if node[0] == "map" else []


# --- Slot checks ------------------------------------------------------------
order = [k for k, _ in top]
first = {}
for key, node in top:
    first.setdefault(key, node)

for key in REQUIRED:
    if key not in first:
        problems.append("MISSING SLOT: %s" % key)

# Duplicate keys are inspected, never collapsed: a real YAML loader keeps the
# LAST value, so a `model: unknown` line followed by a good one would vanish.
seen = {}
for key in order:
    seen[key] = seen.get(key, 0) + 1
for key, count in seen.items():
    if count > 1:
        problems.append("DUPLICATE SLOT: %s (declared %d times; a slot with "
                        "two answers records neither)" % (key, count))

for key, node in top:
    collected = []
    leaves(node, key, collected)
    for label, val in collected:
        if not val:
            # A blank is missing, never an implicit `not-applicable`:
            # `not-applicable` is a deliberate declaration by a person, and a
            # blank is nobody having declared anything.
            problems.append("EMPTY SLOT: %s (a blank is missing, not "
                            "'not-applicable')" % label)
        elif is_placeholder(val):
            problems.append("PLACEHOLDER SLOT: %s (value %r is a template "
                            "placeholder, not an answer)" % (label, val))
        elif val.strip().lower() == "unknown":
            # `unknown` is fatal WHEREVER it appears. A binding with
            # `model: unknown` is a run that will hang at 3am with no output,
            # no error and no exit. `not-applicable` is the explicit legal
            # alternative when a slot genuinely does not apply.
            problems.append("UNKNOWN SLOT: %s (unknown is a stop; use "
                            "'not-applicable' explicitly, with its reason in "
                            "the body, if it genuinely does not apply)"
                            % label)


# --- Step coverage ----------------------------------------------------------
# Read the step numbers from the loop, so this checker never becomes a second
# owner of the sequence.
with open(loop_path, encoding="utf-8") as fh:
    loop_lines = fh.read().split("\n")

loop_steps = []
in_steps = False
for raw in loop_lines:
    if raw.startswith("## "):
        in_steps = raw.strip() == "## Steps"
        continue
    if in_steps:
        m = re.match(r"^(\d+)\.\s", raw)
        if m:
            loop_steps.append(int(m.group(1)))

if not loop_steps:
    print("INVALID LOOP: %s: no numbered steps found under '## Steps'"
          % loop_path)
    sys.exit(2)

dupes = sorted({n for n in loop_steps if loop_steps.count(n) > 1})
if dupes:
    # A mis-numbered loop is a defect in the loop, reported here rather than
    # worked around, because a binding cannot declare a step number twice.
    problems.append("LOOP DEFECT: %s numbers step(s) %s more than once"
                    % (loop_path, ", ".join(str(n) for n in dupes)))

declared = []
if "steps_declared" in first:
    for key in child_keys(first["steps_declared"]):
        k = key.strip().rstrip(".")
        if k.isdigit():
            declared.append(int(k))
        else:
            problems.append("UNREADABLE STEP KEY: steps_declared.%s (a step "
                            "key is the step's number)" % key)

for n in sorted(set(loop_steps)):
    if n not in declared:
        problems.append("UNDECLARED STEP: %d (the loop numbers it; this "
                        "binding does not say what implements it)" % n)

for n in sorted(set(declared)):
    if n not in loop_steps:
        problems.append("PHANTOM STEP: %d (declared here; the loop has no "
                        "such step)" % n)


# --- Uncited rules in the body ----------------------------------------------
# A binding implements the loop's steps and CITES their rules; it states none
# of its own (ADR-0022 clause 1.4). Judged per paragraph, with the ceiling the
# header states.
MODAL = re.compile(r"\b(?:must not|must|shall not|shall|never|always|"
                   r"may not|is forbidden|are forbidden|required to)\b", re.I)
CITE = re.compile(r"(?:ADR-\d{4}|AGENTS\.md|loops/[a-z0-9-]+|"
                  r"skills/[a-z0-9-]+|agents/[a-z0-9-]+|"
                  r"references/[a-z0-9-]+\.md|templates/[a-z0-9-]+\.md|"
                  r"\brule [1-5]\b)", re.I)

blocks = []
current = []
fenced = False
for i, raw in enumerate(body):
    if raw.strip().startswith("```"):
        fenced = not fenced
        if current:
            blocks.append(current)
            current = []
        continue
    if fenced:
        continue
    if raw.strip() == "" or raw.lstrip().startswith("#"):
        if current:
            blocks.append(current)
            current = []
        continue
    current.append((body_offset + i, raw))
if current:
    blocks.append(current)

for block in blocks:
    text = " ".join(raw for _, raw in block)
    if not MODAL.search(text) or CITE.search(text):
        continue
    hit = MODAL.search(text)
    snippet = text.strip()
    if len(snippet) > 90:
        snippet = snippet[:87] + "..."
    problems.append("UNCITED RULE: line %d: %r states a rule (%r) and cites "
                    "nothing (a binding cites the loop, the skill, an ADR or "
                    "AGENTS.md; it states no rule of its own)"
                    % (block[0][0], snippet, hit.group(0)))


# --- Verdict ----------------------------------------------------------------
if problems:
    print("BINDING NOT ACCEPTED: %s" % binding_path)
    seen_msgs = set()
    for msg in problems:
        if msg in seen_msgs:
            continue
        seen_msgs.add(msg)
        print("  %s" % msg)
    sys.exit(1)

print("BINDING OK: %s (%d slots answered, all %d loop steps declared, no "
      "uncited rule)" % (binding_path, len(REQUIRED), len(set(loop_steps))))
print("  Step numbers read from %s." % loop_path)
print("  Proves the declaration is complete. Does not prove any step is "
      "implemented correctly, that the gate commands do work, that the roles "
      "exist, or that a run would be safe.")
sys.exit(0)
PY
