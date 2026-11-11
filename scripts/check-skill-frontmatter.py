#!/usr/bin/env python3
"""Lint one SKILL.md frontmatter: check-skill-frontmatter.py PATH DIRNAME.

Rules: docs/development/authoring-guide.md skill table (ADR-0003, ADR-0008).
Moved out of tests/validate.sh in TASK-0274 so a test can run it on a fixture;
validate.sh calls it once per skill. Exit 1 on any violation.
"""
import re, sys

path, dirname = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as fh:
    lines = fh.read().split("\n")

bad = []

# Frontmatter must be the first thing in the file and properly terminated;
# a skill whose delimiters are wrong is one an agent loader will reject.
if not lines or lines[0].strip() != "---":
    bad.append("frontmatter must open with '---' on line 1")
    fm = []
else:
    try:
        end = next(i for i, l in enumerate(lines[1:], 1) if l.strip() == "---")
        fm = lines[1:end]
    except StopIteration:
        bad.append("frontmatter is not terminated by a closing '---'")
        fm = []


def scalar(key):
    """Value of a top-level key, plus how many lines it spans."""
    for i, line in enumerate(fm):
        m = re.match(r"^%s:(.*)$" % re.escape(key), line)
        if not m:
            continue
        val = m.group(1).strip()
        span = 1
        for cont in fm[i + 1:]:
            # A following line that is indented (and not a comment) is a
            # YAML continuation of this value.
            if cont.strip() and cont[0] in " \t" and not cont.strip().startswith("#"):
                span += 1
            else:
                break
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        return val, span
    return None, 0


name, _ = scalar("name")
if name is None:
    bad.append("missing required key: name")
elif not name:
    bad.append("key 'name' is empty")
elif not dirname.startswith("_template") and name != dirname:
    # Templates are named _template*, so the rule cannot apply to them —
    # the same carve-out the MCP and loop checks already make.
    bad.append("name '%s' does not match directory '%s'" % (name, dirname))
if name and len(name) > 64:
    # The Agent Skills spec's limits (TASK-0173), stated in the authoring
    # guide first so this gate enforces a requirement rather than authors
    # one (ADR-0008). Characters, not bytes: the spec counts characters.
    bad.append("name is %d characters — the spec allows at most 64" % len(name))
if name and not re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", name):
    bad.append("name '%s' must be a-z, 0-9 and single hyphens, not leading "
               "or trailing (Agent Skills spec)" % name)

desc, desc_span = scalar("description")
if desc is None:
    bad.append("missing required key: description")
elif not desc:
    bad.append("key 'description' is empty")
elif desc_span > 1:
    # The registry renders description into a single table cell; a folded
    # or block scalar breaks that row.
    bad.append("description spans %d lines — must be a single line" % desc_span)
elif desc in (">", ">-", ">+", "|", "|-", "|+"):
    # A one-token fold reaches the registry as the literal sigil with the
    # text DROPPED, and the row still has the right column count — so the
    # registry integrity check cannot see it. Observed in TASK-0039 against
    # `description: >-`, fixed for agents by TASK-0038, and left live for
    # skills and loops until now: the span test above cannot catch it,
    # because the value occupies one line.
    bad.append("description is the bare block sigil %r — the registry would "
               "render the sigil and drop the text" % desc)
elif len(desc) > 1024:
    # TASK-0173: project-workflow carried 1062 characters past this gate,
    # which then checked only presence and one line.
    bad.append("description is %d characters — the spec allows at most 1024"
               % len(desc))

compat, _ = scalar("compatibility")
if compat is not None and not 1 <= len(compat) <= 500:
    bad.append("compatibility is %d characters — the spec requires 1 to 500"
               % len(compat))

lic, _ = scalar("license")
if lic is not None and not lic:
    bad.append("key 'license' is present but empty")

# metadata.version is optional (ADR-0003), but must be semver when given,
# so the registry's version column can be compared and sorted.
for line in fm:
    m = re.match(r"^\s+version:(.*)$", line)
    if not m:
        continue
    v = m.group(1).strip().strip("\"'")
    if not re.match(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$", v):
        bad.append("metadata.version '%s' is not semver (MAJOR.MINOR.PATCH)" % v)
    break

# Claude Code controls (TASK-0274, ADR-0060). Optional; other clients ignore or
# strip them (scripts/install.sh), so a malformed value is the only error.
tools, tools_span = scalar("allowed-tools")
if tools is not None and (not tools or tools in (">", ">-", "|", "|-")) and tools_span <= 1:
    bad.append("key 'allowed-tools' is present but empty")
dmi, _ = scalar("disable-model-invocation")
if dmi is not None and dmi not in ("true", "false"):
    bad.append("disable-model-invocation is '%s' — must be true or false" % dmi)
ctx, _ = scalar("context")
if ctx is not None and ctx != "fork":
    bad.append("context is '%s' — the only value Claude Code defines is fork" % ctx)

for msg in bad:
    print("INVALID SKILL: %s: %s" % (path, msg))
sys.exit(1 if bad else 0)
