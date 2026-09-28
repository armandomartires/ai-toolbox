#!/usr/bin/env bash
# check-change-record.sh — validate one Ansible change record's frontmatter.
#
# Usage:
#   ./check-change-record.sh <path-to-record.md>
#
# Exits non-zero NAMING the offending field — naming it is the requirement,
# not merely a non-zero status, because the field name is what identifies the
# gate that was skipped.
#
# The rejection conditions are the full set below, not just presence and
# `unknown`. Stating it as "exits 0 when the nine fields are present and none
# says unknown" would be WRONG in both directions: it is not sufficient (a
# record can satisfy it and still be rejected as a duplicate, a placeholder,
# a blank, a tenth field, or an uncovered module) and the caller would read a
# non-zero exit on one of those as a bug. A record is rejected when:
#
#   - a required field is MISSING
#   - a required field is present but EMPTY (a blank is missing, never an
#     implicit `not-applicable`)
#   - any value decodes to `unknown`, at any depth
#   - any value is a `<FILL: ...>` template placeholder
#   - a required field is DECLARED TWICE (two answers record neither)
#   - a field outside the nine appears at all
#   - a module in `modules_touched` carries no `check_mode_fidelity` verdict
#
# READ-ONLY AND IDEMPOTENT. It opens one file for reading and writes nothing,
# anywhere — no temp file, no cache, no edit to the record. Running it twice
# on the same record produces identical output and leaves the filesystem
# unchanged.
#
# WHAT THIS PROVES: that a record's fields are present, not `unknown`, and
# that every module in `modules_touched` carries a `check_mode_fidelity`
# verdict.
# WHAT IT DOES NOT PROVE: that the gates were performed honestly, that the
# snapshot is restorable, that check mode meant anything, or that a node
# cannot hang. It validates a record, not the act. Do not soften this.
#
# BOUNDED SCOPE, deliberately: it reads a record's frontmatter and nothing
# else. It never parses playbook content, never inspects a play's `hosts:`,
# and never looks at a play's or a `group_vars` file's `gather_subset` value.
# It reads the record's `gather_subset_reviewed` FIELD — that is a claim the
# operator wrote down, not the setting itself, and the difference is the whole
# boundary. That boundary is what keeps it honest about what it checks.
#
# The frontmatter is PARSED, never grepped: `unknown` is a value in a
# structured document, and a record body may legitimately discuss
# `snapshot_ref:` or the word unknown in prose — so a grep would answer a
# different question than the one asked.
#
# The parser is a deliberately small YAML SUBSET written against the python3
# standard library alone. PyYAML is not used and must not be: this script is
# NOT run from `tests/validate.sh` — see the WIRING note below. PyYAML is
# still deliberately not used: an operator runs this from a checkout with
# nothing installed, and a checker that needs `pip install` is a checker that
# does not run.
#
# The subset covers the spellings BELOW. It is not a YAML parser and does not
# cover every legal spelling of the schema — that claim was false, and the
# gaps are enumerated as gaps rather than left to be discovered:
#
#   - plain, single-quoted and double-quoted scalars
#   - trailing `#` comments — stripped, but NOT when the `#` is inside a
#     quoted string or unspaced inside a token (`snap#0001` is data)
#   - block sequences (`- item`) and flow sequences (`[a, b]`)
#   - block mappings and flow mappings (`{k: v}`), including nesting
#   - block and folded scalars (`|`, `>`, with any chomping indicator)
#   - multi-line plain scalars
#   - any casing, and leading or trailing whitespace
#   - duplicate keys — reported, and EVERY occurrence is inspected
#
# KNOWN GAPS — legal YAML that decodes to `unknown` and is NOT caught. Each
# was observed passing as a green record against this script:
#
#   - anchors and aliases:  `snapshot_ref: &a unknown`
#   - explicit tags:        `snapshot_ref: !!str unknown`
#   - double-quoted escapes that spell the word: `"unkno\x77n"`
#
# These are recorded rather than fixed because closing them properly means a
# real YAML parser, which the offline constraint above forbids. They are a
# real hole in a record written adversarially; they are unlikely in one
# written by hand, which is the only case this checker is claimed to cover.
# Do not restore the "every spelling" wording without closing them.
#
# Of the covered spellings, the ones that were VERIFIED holes in the earlier
# grep-based version — i.e. through which `unknown` actually passed green —
# are the trailing comment, flow sequences, flow mappings, block and folded
# scalars, and duplicate keys. Plain, quoted, block-sequence and multi-line
# plain values were already caught before; they are covered here, but calling
# them former holes overstated what the rewrite fixed.
#
# A value is compared only after it has been decoded to the string YAML would
# yield, so `snapshot_ref: unknown  # admin unreachable`,
# `snapshot_ref: [unknown]` and a block scalar holding `unknown` are the same
# fatal answer written three ways.
#
# WIRING — nothing in this repository runs this script. `tests/validate.sh`
# checks skill frontmatter, MCP manifests, loop sections, agent definitions,
# the registry and the handover contract; it never executes a skill's script,
# and it never reads a change record or either fixture. Neither does
# `.githooks/pre-commit` (which runs only `validate.sh`) nor CI (same, plus
# the registry-staleness check). The ONLY caller is step 9 of
# `loops/ansible-change/loop.md`, performed by whoever runs the loop. The
# fixtures under `fixtures/` are therefore evidence an author produced by
# hand, not a suite anything re-runs.
set -euo pipefail

usage() {
  sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

case "${1:-}" in
  ""|-h|--help) usage ;;
esac
[ "$#" -eq 1 ] || usage

RECORD="$1"

command -v python3 >/dev/null 2>&1 || {
  echo "MISSING prerequisite: python3" >&2
  exit 2
}

[ -f "$RECORD" ] || {
  echo "NOT A FILE: $RECORD" >&2
  exit 2
}

python3 - "$RECORD" <<'PY'
import re
import sys

path = sys.argv[1]

# Exactly these nine, in the order the TEMPLATE lists them — which is NOT
# gate order: `gather_subset_reviewed` is filled at gate 1 and `lint_run` at
# gate 2, yet both sit after the gate-4, -5 and -6 fields. Gate order would
# be hosts_limit, modules_touched, gather_subset_reviewed, lint_run,
# check_mode_run, check_mode_fidelity, snapshot_ref, rollback_verified,
# approver. This list matches `templates/change-record.md`'s row order so the
# two can be compared line by line; nothing here depends on the order, since
# every field is checked. Do not describe it as gate order.
#
# "No more" is enforced too: a tenth field is a schema this repo did not
# agree to, and silently accepting one is how a record grows into an index.
REQUIRED = [
    "hosts_limit",
    "modules_touched",
    "check_mode_run",
    "check_mode_fidelity",
    "snapshot_ref",
    "rollback_verified",
    "gather_subset_reviewed",
    "lint_run",
    "approver",
]

NOT_APPLICABLE = "not-applicable"

with open(path, encoding="utf-8") as fh:
    lines = fh.read().split("\n")

problems = []

# --- Locate the frontmatter -------------------------------------------------
# It must be the first thing in the file. A record whose frontmatter is
# elsewhere is a record whose checked surface is not where the checker looks.
if not lines or lines[0].strip() != "---":
    print("INVALID RECORD: %s: frontmatter must open with '---' on line 1"
          % path)
    sys.exit(1)
try:
    end = next(i for i, l in enumerate(lines[1:], 1) if l.strip() == "---")
except StopIteration:
    print("INVALID RECORD: %s: frontmatter is not terminated by a closing "
          "'---'" % path)
    sys.exit(1)
fm = lines[1:end]


# --- The YAML subset --------------------------------------------------------
# Nodes are tagged tuples so a mapping can keep DUPLICATE keys instead of
# silently discarding one — a discarded `snapshot_ref: unknown` is exactly the
# defect this parser exists to close.
#   ("str", text)  ("seq", [node, ...])  ("map", [(key, node), ...])

BLOCK_SCALAR = re.compile(r"^[|>](?:[+-]?\d*|\d*[+-]?)$")


def comment_start(text):
    """Index of the `#` that opens a YAML comment, or -1.

    A `#` is a comment only outside quotes AND at the start of a token — so
    `"a # b"` and `snap#0001` both keep their hash, while `unknown  # note`
    loses it. Getting this wrong in either direction is a defect: strip too
    eagerly and a legitimate identifier is corrupted; strip too timidly and
    `unknown  # ...` reads as a value that is not `unknown`.
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


def collect_block_scalar(idx, indent, style):
    """Gather the indented body of a `|` or `>` scalar.

    Comments are NOT stripped here: inside a block scalar a `#` is literal
    content, and stripping it would change the value being judged.
    """
    body = []
    while idx < len(fm):
        raw = fm[idx]
        if raw.strip() == "":
            body.append("")
            idx += 1
            continue
        if indent_of(raw) <= indent:
            break
        body.append(raw.strip())
        idx += 1
    joiner = "\n" if style.startswith("|") else " "
    return joiner.join(body).strip(), idx


def parse_block(idx, indent):
    """Parse a block-level node whose keys/items sit at `indent`."""
    pairs = []
    seq = []
    plain = []
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
            key, rest = split_key(item)
            if key is not None and not item.startswith(("[", "{", '"', "'")):
                seq.append(("map", [(unquote(key), parse_value(rest))]))
            else:
                seq.append(parse_value(item))
            idx += 1
            continue

        key, rest = split_key(line)
        if key is None:
            plain.append(line)    # multi-line plain scalar continuation
            idx += 1
            continue

        key = unquote(key)
        rest = rest.strip()
        idx += 1
        if BLOCK_SCALAR.match(rest):
            value, idx = collect_block_scalar(idx, indent, rest)
            pairs.append((key, ("str", value)))
            continue
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
    if plain:
        return ("str", " ".join(plain).strip()), idx
    return ("str", ""), idx


base_indent = 0
for raw in fm:
    if not skippable(raw):
        base_indent = indent_of(raw)
        break
root, _ = parse_block(0, base_indent)
if root[0] != "map":
    print("INVALID RECORD: %s: frontmatter is not a mapping of fields" % path)
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


def module_names(node):
    """The modules a `modules_touched` value names.

    `not-applicable` names no module, so a record that legitimately touches
    none does not acquire a coverage obligation out of thin air. Placeholders
    and `unknown` are excluded because they are already reported as their own
    defect, and repeating them as a coverage miss would only obscure it.
    """
    collected = []
    out = []
    leaves(node, "modules_touched", out)
    for _, val in out:
        for name in (val.split(",") if "," in val else [val]):
            name = name.strip()
            if not name or is_placeholder(name):
                continue
            if name.lower() in (NOT_APPLICABLE, "unknown"):
                continue
            collected.append(name)
    return collected


# --- The checks -------------------------------------------------------------
order = [k for k, _ in top]
first = {}
for key, node in top:
    first.setdefault(key, node)

for key in REQUIRED:
    if key not in first:
        problems.append("MISSING FIELD: %s" % key)

# Duplicate keys are inspected, never collapsed: a real YAML loader keeps the
# LAST value, so a `snapshot_ref: unknown` line followed by a good one would
# vanish. Both are judged, and the duplication itself is reported, because two
# answers to one gate is not a record anybody can act on.
seen = {}
for key in order:
    seen[key] = seen.get(key, 0) + 1
for key, count in seen.items():
    if count > 1:
        problems.append("DUPLICATE FIELD: %s (declared %d times; a field with "
                        "two answers records neither)" % (key, count))

for key, node in top:
    if key not in REQUIRED:
        continue
    collected = []
    leaves(node, key, collected)
    for label, val in collected:
        if not val:
            # An empty value is missing, never an implicit `not-applicable`:
            # `not-applicable` is a deliberate declaration by a person, and a
            # blank is nobody having declared anything.
            problems.append("EMPTY FIELD: %s (a blank is missing, not "
                            "'not-applicable')" % label)
        elif is_placeholder(val):
            problems.append("PLACEHOLDER FIELD: %s (value %r is a template "
                            "placeholder, not an answer)" % (label, val))
        elif val.strip().lower() == "unknown":
            # `unknown` is fatal WHEREVER it appears — not only in
            # check_mode_fidelity. A record with `snapshot_ref: unknown` says
            # nobody knows whether a rollback exists, which is the assumption
            # that turns a change into an outage. `not-applicable` is the
            # explicit legal alternative when a field genuinely does not apply.
            problems.append("UNKNOWN FIELD: %s (unknown is not a pass; use "
                            "'not-applicable' explicitly if it genuinely does "
                            "not apply)" % label)

# Coverage: `check_mode_fidelity` must carry a verdict for EVERY module in
# `modules_touched`. Presence of both fields was never the question — a
# module with no verdict is `unknown` by omission, and `unknown` is not a
# pass. Without this, two modules and one verdict exits 0, and the module
# nobody assessed is the one that behaves differently under `--check`.
if "modules_touched" in first and "check_mode_fidelity" in first:
    modules = module_names(first["modules_touched"])
    verdicts = child_keys(first["check_mode_fidelity"])
    for name in modules:
        if name not in verdicts:
            problems.append(
                "UNCOVERED MODULE: check_mode_fidelity has no verdict for "
                "modules_touched entry %r (a module with no verdict is "
                "unknown, and unknown is not a pass)" % name)

for key in order:
    if key not in REQUIRED:
        problems.append("UNEXPECTED FIELD: %s (the record schema is exactly "
                        "the nine required fields)" % key)

if problems:
    print("RECORD NOT ACCEPTED: %s" % path)
    seen_msgs = set()
    for msg in problems:
        if msg in seen_msgs:
            continue
        seen_msgs.add(msg)
        print("  %s" % msg)
    sys.exit(1)

print("RECORD OK: %s (nine fields present, none unknown, every module "
      "covered)" % path)
print("  Proves the fields are present. Does not prove the gates were "
      "performed, that the snapshot is restorable, or that a node cannot "
      "hang.")
print("  Silent about gates 3, 7 and 8 by construction: they fill no "
      "frontmatter field.")
sys.exit(0)
PY
