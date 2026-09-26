#!/usr/bin/env python3
"""Schema parser, renderer and checker for planning artifacts (ADR-0027).

ONE OWNER. The schema file owns an artifact's shape; this module owns how a
schema is read. new-artifact.sh renders through it and check-artifact.sh
checks through it, so neither holds its own copy of what a schema means --
the rule check-binding.sh already follows by reading loop.md's step numbers
out of the loop rather than restating them.

Nothing here resolves a model tier. --guidance selects prose density inside
<!-- FILL: ... --> comments and nothing else; the rendered body is identical
at every level, which is what makes "same output at any model size" a
checkable claim. See ADR-0027 clause 4 and ADR-0018 clause 7.

python3 stdlib only, deliberately: a checker that needs `pip install` is a
checker that does not run.
"""
import os
import re
import sys

LEVELS = ["terse", "standard", "explicit", "literal"]
HEADING = re.compile(r"^#{2,6} \S")
FENCE = re.compile(r"^\s*(```|~~~)")
PLACEHOLDER = re.compile(r"\{([a-z_]+)\}")
# A surviving generator marker. Deliberately an illegal value, the rule
# skills/unattended-ops/templates/binding.md and
# skills/ansible-ops/templates/change-record.md both attach to a placeholder:
# a template pointed at its own checker must fail.
#
# Matches the generator's full marker, not a bare "FILL:". Observed firing on
# fixtures/incomplete-task.md's own blockquote, which NAMES the marker while
# explaining the defect -- the fires-on-correct-text failure mode that gets a
# check deleted rather than fixed. Prose may discuss the marker; only the
# emitted comment form is the defect.
LEFTOVER = re.compile(r"<!--\s*FILL:")
# A marker inside an inline code span is being SHOWN, not left behind -- the
# same "quoted claims are discussion" exemption tests/validate.sh's wiring
# scanner needs, and for the same reason. Observed on TASK-0109, which has to
# name the pattern in order to record why it was narrowed. An exemption like
# this is the ceiling of judging intent from text, and is why the check is
# worth having rather than deleted for firing on correct prose.
SHOWN = re.compile(r"`[^`]*<!--\s*FILL:[^`]*`")


def die(msg):
    sys.stderr.write("artifact_lib: %s\n" % msg)
    raise SystemExit(2)


def trim(lines):
    """Drop leading and trailing blank lines, keeping interior ones."""
    out = list(lines)
    while out and not out[0].strip():
        out.pop(0)
    while out and not out[-1].strip():
        out.pop()
    return out


def parse_schema(path):
    try:
        with open(path, encoding="utf-8") as fh:
            lines = fh.read().split("\n")
    except OSError as exc:
        die("cannot read schema %s: %s" % (path, exc))

    if not lines or lines[0].strip() != "---":
        die("%s: schema must begin with '---' frontmatter" % path)
    try:
        end = lines.index("---", 1)
    except ValueError:
        die("%s: unterminated frontmatter" % path)

    fm = {}
    for raw in lines[1:end]:
        s = raw.strip()
        if not s or s.startswith("#"):
            continue
        if ":" not in s:
            die("%s: frontmatter line is not 'key: value': %r" % (path, raw))
        k, v = s.split(":", 1)
        fm[k.strip()] = v.strip().strip('"').strip("'")

    def new_section(heading):
        return {"heading": heading, "phase": "before", "required": True,
                "guidance": {}, "body": []}

    preamble, sections, cur, sink = None, [], None, None
    for raw in lines[end + 1:]:
        if HEADING.match(raw):
            cur = new_section(raw.rstrip())
            sections.append(cur)
            sink = None
            continue
        s = raw.strip()
        if s.startswith("!"):
            parts = s[1:].split(None, 1)
            name = parts[0]
            arg = parts[1].strip() if len(parts) > 1 else ""
            if name == "preamble":
                # A pseudo-section with no heading, rendered under the H1. It
                # takes guidance and body like any other, so every artifact
                # kind gets the same treatment -- including an ad-hoc entry,
                # which is five labelled lines and no headings at all.
                if preamble is None:
                    preamble = new_section(None)
                cur = preamble
                sink = cur["body"]
            elif name == "body":
                if cur is None:
                    die("%s: !body before any heading" % path)
                sink = cur["body"]
            elif name in LEVELS:
                if cur is None:
                    die("%s: !%s before any heading" % (path, name))
                cur["guidance"][name] = []
                sink = cur["guidance"][name]
            elif name == "phase":
                if arg not in ("before", "after"):
                    die("%s: !phase must be 'before' or 'after'" % path)
                cur["phase"] = arg
            elif name == "required":
                cur["required"] = arg == "true"
            else:
                die("%s: unknown directive !%s" % (path, name))
            continue
        if sink is not None:
            sink.append(raw)

    # A schema with neither is empty and generates nothing. One or the other
    # is enough: an ad-hoc entry is a labelled field block with no headings of
    # its own, because it lives inside a shared list rather than its own file.
    if not sections and preamble is None:
        die("%s: schema declares neither sections nor a preamble" % path)
    for sec in sections:
        if not sec["guidance"].get("standard"):
            die("%s: section %r has no !standard guidance; every other level "
                "falls back to it" % (path, sec["heading"]))
    return fm, preamble, sections


def substitutions(fm, template_mode):
    """Build {placeholder: value}. Unset keys stay verbatim so a missing
    answer reads as missing rather than as an empty string someone chose."""
    subs = {}
    for item in os.environ.get("SUBS", "").split("\n"):
        if "=" in item:
            k, v = item.split("=", 1)
            subs[k.strip()] = v
    if template_mode:
        for key, val in fm.items():
            if key.endswith("_placeholder"):
                subs.setdefault(key[: -len("_placeholder")], val)
    return subs


def apply_subs(text, subs):
    return PLACEHOLDER.sub(lambda m: subs.get(m.group(1), m.group(0)), text)


def guidance_for(section, level):
    g = section["guidance"]
    return trim(g.get(level) or g.get("standard") or [])


def as_comment(lines):
    """Render guidance as an HTML comment. Guidance lives ONLY here; !body is
    emitted bare. That is the invariant making every guidance level produce a
    byte-identical file once comments are stripped."""
    lines = trim(lines)
    if not lines:
        return []
    if len(lines) == 1:
        return ["<!-- FILL: %s -->" % lines[0].strip()]
    out = ["<!-- FILL: " + lines[0].strip()]
    for line in lines[1:]:
        out.append(("     " + line.rstrip()) if line.strip() else "")
    out[-1] += " -->"
    return out


def render(schema_path, level, template_mode):
    fm, preamble, sections = parse_schema(schema_path)
    subs = substitutions(fm, template_mode)
    sub = lambda t: apply_subs(t, subs)

    # title_prefix is "# " for an artifact that owns its file, and "### " for
    # an entry generated into a shared list such as 35.AD_HOC_TASKS.md.
    out = [sub(fm.get("title_prefix", "# ") + fm.get("title_pattern", "{id}")), ""]
    for sec in ([preamble] if preamble else []) + sections:
        if sec["heading"]:
            out += [sec["heading"], ""]
        comment = as_comment(guidance_for(sec, level))
        if comment:
            out += comment + [""]
        body = trim(sec["body"])
        if body:
            out += [sub(l) for l in body] + [""]
    return "\n".join(trim(out))


def headings_of(path):
    """Headings in a finished artifact, skipping fenced code blocks -- task
    files routinely contain ``` blocks whose lines start with #."""
    try:
        with open(path, encoding="utf-8") as fh:
            lines = fh.read().split("\n")
    except OSError as exc:
        die("cannot read artifact %s: %s" % (path, exc))
    found, fenced = [], False
    for n, line in enumerate(lines, 1):
        if FENCE.match(line):
            fenced = not fenced
            continue
        if not fenced and HEADING.match(line):
            found.append((n, line.rstrip()))
    return lines, found


def depth(heading):
    return len(heading) - len(heading.lstrip("#"))


def section_bodies(lines, found):
    """Text under each heading. A heading immediately followed by a DEEPER one
    is a parent -- `## Execution log` over `### Attempt 1` -- and its content
    is its children's, so it is reported as its children's rather than empty."""
    bodies, bounds = {}, [n for n, _ in found] + [len(lines) + 1]
    for i, (n, head) in enumerate(found):
        body = lines[n:bounds[i + 1] - 1]
        if i + 1 < len(found) and depth(found[i + 1][1]) > depth(head):
            body = lines[n:bounds[-1] - 1]
        bodies[head] = body
    return bodies


def check(artifact_path, schema_path):
    fm, _, sections = parse_schema(schema_path)
    lines, found = headings_of(artifact_path)
    present = [h for _, h in found]
    bodies = section_bodies(lines, found)
    schema_order = [s["heading"] for s in sections]
    superseded = [s.strip() for s in fm.get("superseded", "").split(",") if s.strip()]
    allow_extra = fm.get("allow_extra", "true") == "true"
    problems = []

    for sec in sections:
        if sec["required"] and sec["heading"] not in present:
            problems.append("missing required section: %s" % sec["heading"])

    for head in present:
        bare = head.lstrip("#").strip()
        if bare in superseded:
            problems.append(
                "superseded section: %s -- replaced by the current schema; "
                "see %s" % (head, os.path.basename(schema_path)))
        elif head not in schema_order and not allow_extra:
            problems.append("section not in schema: %s" % head)

    known = [h for h in present if h in schema_order]
    expected = [h for h in schema_order if h in known]
    if known != expected:
        problems.append(
            "sections out of schema order.\n      found:    %s\n      expected: %s"
            % (" > ".join(known), " > ".join(expected)))

    for n, line in enumerate(lines, 1):
        if LEFTOVER.search(SHOWN.sub("", line)):
            problems.append(
                "line %d: unfilled generator marker still present: %s"
                % (n, line.strip()[:70]))
            break

    blob = "\n".join(lines).lower()
    if re.search(r"status.{0,40}\b(completed|done)\b", blob):
        for sec in sections:
            if sec["phase"] != "after" or not sec["required"]:
                continue
            body = trim(bodies.get(sec["heading"], []))
            if not body:
                problems.append(
                    "%s is empty but the artifact is marked complete -- it is "
                    "written after the work, so an empty one means the claim "
                    "is unverified" % sec["heading"])
    return problems


def sync():
    """Render every schema:dest pair in one interpreter.

    Batched deliberately. One subprocess pair per template cost tests/
    validate.sh 1.4s of its 2.1s baseline on a /mnt/c checkout, measured
    rather than assumed; doing it in-process gave that back. The repo's rule
    is not to delete checks to buy back time the filesystem is spending --
    this was process spawn, which is ours to spend or not.
    """
    out_root = os.environ.get("OUT", ".")
    banner = os.environ["BANNER"]
    # CHECK compares in memory instead of writing. No scratch tree, so no
    # mktemp/find/cmp/rm round trip -- which on a /mnt/c checkout is most of
    # what this pass costs. It also removes the failure mode where a stale
    # scratch directory makes the comparison pass vacuously.
    check_only = os.environ.get("CHECK") == "1"
    count, stale = 0, []
    for pair in os.environ["TARGETS"].split("\n"):
        pair = pair.strip()
        if not pair or ":" not in pair:
            continue
        schema, dest = pair.split(":", 1)
        text = banner.replace("{schema}", schema) + "\n\n" \
            + render(schema, "standard", True) + "\n"
        dest_path = os.path.join(out_root, dest)
        if check_only:
            try:
                with open(dest_path, encoding="utf-8") as fh:
                    current = fh.read()
            except OSError:
                stale.append((dest, "missing"))
                continue
            if current != text:
                stale.append((dest, "stale against %s" % schema))
            continue
        os.makedirs(os.path.dirname(dest_path) or ".", exist_ok=True)
        with open(dest_path, "w", encoding="utf-8") as fh:
            fh.write(text)
        count += 1
    if check_only:
        for dest, why in stale:
            sys.stderr.write(
                "TEMPLATES: %s is %s — run scripts/sync-templates.sh and "
                "commit the result\n" % (dest, why))
        if stale:
            raise SystemExit(1)
        return
    sys.stderr.write("sync-templates.sh: wrote %d templates under %s\n"
                     % (count, out_root))


def check_many():
    """Check many artifacts against one schema, parsing the schema once."""
    schema = os.environ["SCHEMA"]
    parse_schema(schema)          # fail fast on a malformed schema
    bad = 0
    for path in os.environ["ARTIFACTS"].split("\n"):
        path = path.strip()
        if not path:
            continue
        problems = check(path, schema)
        if problems:
            bad += 1
            sys.stderr.write("FAIL %s\n" % path)
            for p in problems:
                sys.stderr.write("    - %s\n" % p)
    if bad:
        raise SystemExit(1)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    schema = os.environ.get("SCHEMA", "")
    if mode == "sync":
        sync()
    elif mode == "check-many":
        check_many()
    elif mode == "render":
        if os.environ.get("FILENAME_ONLY") == "1":
            fm, _, _ = parse_schema(schema)
            subs = substitutions(fm, os.environ.get("TEMPLATE") == "1")
            print(apply_subs(fm.get("filename_pattern", "{id}.md"), subs))
            return
        print(render(schema, os.environ.get("GUIDANCE", "standard"),
                     os.environ.get("TEMPLATE") == "1"))
    elif mode == "check":
        problems = check(os.environ["ARTIFACT"], schema)
        if problems:
            sys.stderr.write("FAIL %s\n" % os.environ["ARTIFACT"])
            for p in problems:
                sys.stderr.write("    - %s\n" % p)
            raise SystemExit(1)
        print("OK   %s" % os.environ["ARTIFACT"])
    else:
        die("mode must be 'render' or 'check'")


if __name__ == "__main__":
    main()
