#!/usr/bin/env bash
# Mandatory validation: skill frontmatter, and MCP server shape/manifest
# integrity (ADR-0005). Requires python3 for JSON parsing.
set -euo pipefail
cd "$(dirname "$0")/.."
fail=0

command -v python3 >/dev/null 2>&1 || { echo "MISSING prerequisite: python3"; exit 1; }

# Skills: the frontmatter rules docs/development/authoring-guide.md states
# (TASK-0012, closing B-002). Parsed rather than grepped because "the
# description is a single line" is not a grep-shaped question: an earlier
# version only tested that `^name:` and `^description:` appeared somewhere,
# which passed a skill whose name disagreed with its directory — the same
# defect class that let templates leak into the registry three times.
#
# NOT checked: any SKILL.md length cap. B-002's title said "frontmatter +
# line budget", but no budget is defined in the authoring guide, any ADR,
# or AGENTS.md. Enforcing an invented number would make this gate the
# author of a requirement rather than the enforcer of one — see ADR-0008.
for f in skills/*/SKILL.md; do
  [ -f "$f" ] || continue
  python3 - "$f" "$(basename "$(dirname "$f")")" <<'PY' || fail=1
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

for msg in bad:
    print("INVALID SKILL: %s: %s" % (path, msg))
sys.exit(1 if bad else 0)
PY
done

# MCP servers: exactly one shape marker per directory, and every external
# manifest must parse, carry its required keys, and — if it exposes
# destructive tools — carry a granted authorization pointing at a task
# file that actually exists (AGENTS.md, Security and secrets).

for d in mcp-servers/*/; do
  d="${d%/}"
  [ -d "$d" ] || continue
  case "$(basename "$d")" in _template) continue ;; esac

  has_py=0; has_ext=0
  [ -f "$d/pyproject.toml" ] && has_py=1
  [ -f "$d/server.json" ] && has_ext=1

  if [ "$has_py" -eq 1 ] && [ "$has_ext" -eq 1 ]; then
    echo "AMBIGUOUS SHAPE: $d has both pyproject.toml and server.json"
    fail=1
    continue
  fi
  if [ "$has_py" -eq 0 ] && [ "$has_ext" -eq 0 ]; then
    echo "NO SHAPE: $d has neither pyproject.toml nor server.json"
    fail=1
    continue
  fi
  [ "$has_ext" -eq 1 ] || continue

  python3 - "$d/server.json" "$(basename "$d")" <<'PY' || fail=1
import json, os, sys

path, dirname = sys.argv[1], sys.argv[2]
try:
    with open(path) as fh:
        m = json.load(fh)
except (json.JSONDecodeError, UnicodeDecodeError) as exc:
    print("INVALID JSON: %s: %s" % (path, exc))
    sys.exit(1)

bad = []
for key in ("name", "description", "upstream", "launch", "runtime",
            "environment", "capabilities"):
    if key not in m:
        bad.append("missing required key: %s" % key)
for parent, child in (("upstream", "registry"), ("upstream", "package"),
                      ("upstream", "version"), ("upstream", "license"),
                      ("launch", "command"), ("launch", "transport"),
                      ("runtime", "declared"), ("runtime", "tested"),
                      ("capabilities", "destructive")):
    if isinstance(m.get(parent), dict) and child not in m[parent]:
        bad.append("missing required key: %s.%s" % (parent, child))

# Template dirs are validated for schema drift but are named _template*,
# so the name-matches-directory rule cannot apply to them.
if (m.get("name") and m["name"] != dirname
        and not dirname.startswith("_")):
    bad.append("name %r does not match directory %r" % (m["name"], dirname))
cmd = m.get("launch", {}).get("command")
if cmd is not None and (not isinstance(cmd, list) or not cmd):
    bad.append("launch.command must be a non-empty array")

caps = m.get("capabilities", {})
if caps.get("destructive") is True:
    if not caps.get("destructive_tools"):
        bad.append("capabilities.destructive is true but "
                   "destructive_tools is empty")
    auth = m.get("authorization")
    if not isinstance(auth, dict) or auth.get("granted") is not True:
        bad.append("capabilities.destructive is true but "
                   "authorization.granted is not true (AGENTS.md requires "
                   "explicit human authorization in the task file)")
    else:
        for key in ("by", "date", "task"):
            if not auth.get(key):
                bad.append("authorization.%s is required when destructive"
                           % key)
        task = auth.get("task")
        if task and not os.path.isfile(task):
            bad.append("authorization.task points at a nonexistent file: %s"
                       % task)

for msg in bad:
    print("INVALID MANIFEST: %s: %s" % (path, msg))
sys.exit(1 if bad else 0)
PY
done

# AUTHORED (Python) MCP servers: the same destructive-capability assertions
# the external manifest check makes just above, plus the same .env.example
# completeness rule, read from `pyproject.toml` (TASK-0059, closing B-024).
#
# WHY THIS EXISTS: every MCP check that preceded it parses `server.json`, so
# each one effectively began `[ -f "$d/server.json" ] || continue` and an
# AUTHORED server was invisible to all of them. Every server shipped so far
# is external, so nothing ever noticed. The first authored server this repo
# will ship is a command runner — it launches ~70-minute builds, rewrites
# workbook VBA, and force-terminates processes — and under the gate as it
# stood its `authorization` block would have been PROSE NOTHING CHECKS. That
# is the authoring guide's own "Claims a component makes about its own
# wiring" defect class, occurring in the file that polices it, and it would
# have left AGENTS.md's rule ("MCP servers must not expose destructive
# capabilities without explicit human authorization in the task file") with
# no mechanical form for half the shapes.
#
# THE METADATA LIVES IN `[tool.ai-toolbox]` in pyproject.toml. Not in a
# second marker file: ADR-0005 derives the shape from which marker a
# directory holds, `AMBIGUOUS SHAPE` above fails a directory carrying both,
# and weakening that to make this check easy was closed by B-024 itself. The
# sub-tables mirror `server.json` key for key — `capabilities.destructive`,
# `capabilities.destructive_tools`, `authorization.{granted,by,date,task}`,
# `environment.<VAR>.required` — so the two shapes answer the same questions
# with the same words, in two file formats. `mcp-servers/_template/` models
# the block.
#
# HOW IT IS PARSED, and what that does and does not handle:
#   - `tomllib` (standard library, Python 3.11+). NOT grepped. The repo has
#     been bitten by parsers that silently accepted a shape they could not
#     read, and `scripts/sync-registry.sh` is the live precedent: it reads
#     the registry row with `grep '^name = '` / `grep '^description = '`,
#     first match, quotes stripped — sound only for a single-line
#     double-quoted value at column 1, and hopeless here. A grep for
#     `^destructive = false` would be satisfied by that text in a COMMENT, in
#     some unrelated `[tool.*]` table, or in a `[project]` key of the same
#     name, and would miss the value entirely if it were indented under an
#     inline table. Nesting and booleans are not grep-shaped questions.
#   - If `tomllib` is ABSENT (python3 < 3.11) this pass FAILS LOUDLY rather
#     than skipping. A gate that quietly does nothing on an older interpreter
#     is a gate that cannot fail, which is this repo's most-repeated lesson.
#     It raises the gate's floor from "python3" (AGENTS.md, Commands) to
#     python3 >= 3.11, and says so in the failure.
#
# WHAT THIS PROVES: that an authored server declares whether it is
# destructive, and that if it is, a human granted that in a task file which
# EXISTS; and that every environment variable it marks required is
# documented in .env.example.
#
# WHAT IT DOES NOT PROVE: that `destructive_tools` names the tools the server
# actually registers — nothing here imports the server, and ADR-0009 keeps
# this gate to source completeness. Nor that the authorization task file SAYS
# anything; only that it exists, exactly the limit the external check accepts.
# Nor anything about the rest of pyproject.toml — build backend, src layout,
# dependencies, entry point are all Gated **no** in the authoring guide and
# stay that way; enforcing them here would make the gate the author of a
# requirement (ADR-0008).
#
# THE `_template*` CARVE-OUT IS SPLIT, deliberately, and the split is not the
# one every other loop makes:
#   - The DESTRUCTIVE half runs on templates too. That is parity with the
#     external manifest check above, which validates `_template-external/
#     server.json` for schema drift and carves out only the
#     name-matches-directory rule, because that rule cannot apply to a
#     `_template*` name. No rule in this half is name-derived, so nothing
#     needs carving out — and the template is what every authored server is
#     copied from, so a template that could not pass this gate would ship the
#     defect to the first server that copied it.
#   - The .env.example half SKIPS templates, matching the external
#     .env.example loop below, which skips them because `_template-external`
#     declares a required variable and would otherwise demand a .env.example
#     entry for a server nobody runs.
python3 - <<'PY' || fail=1
import glob, os, re, sys

try:
    import tomllib
except ModuleNotFoundError:
    print("MISSING prerequisite: python3 >= 3.11 (tomllib). The authored-MCP "
          "gate parses pyproject.toml and refuses to skip silently — a check "
          "that cannot fail is worse than no check, because it is still "
          "trusted.")
    raise SystemExit(1)

# Read once. A missing .env.example is reported by its own check further
# down; here it simply documents nothing, so required variables are reported
# rather than waved through.
try:
    with open(".env.example", encoding="utf-8") as fh:
        env_body = fh.read()
except OSError:
    env_body = ""
# Assignment at line start, so a variable named only inside a comment does
# not count as documented — the same rule the external loop applies.
documented = set(re.findall(r"(?m)^([A-Z_][A-Z0-9_]*)=", env_body))

bad = []      # INVALID AUTHORED MANIFEST
undoc = []    # UNDOCUMENTED ENV

for path in sorted(glob.glob("mcp-servers/*/pyproject.toml")):
    d = os.path.dirname(path)
    base = os.path.basename(d)
    # A directory holding both markers is already reported as AMBIGUOUS
    # SHAPE above; reporting it twice would just be noise.
    if os.path.isfile(os.path.join(d, "server.json")):
        continue

    try:
        with open(path, "rb") as fh:
            data = tomllib.load(fh)
    except tomllib.TOMLDecodeError as exc:
        bad.append("%s: does not parse as TOML: %s" % (path, exc))
        continue

    tool = data.get("tool")
    meta = tool.get("ai-toolbox") if isinstance(tool, dict) else None
    if not isinstance(meta, dict):
        bad.append("%s: missing required table [tool.ai-toolbox] — an "
                   "authored server declares its capabilities there, exactly "
                   "as an external one declares them in server.json. Without "
                   "it this server would be the only shape that can expose "
                   "destructive tools with nothing checking its "
                   "authorization (B-024). Copy the block from "
                   "mcp-servers/_template/pyproject.toml." % path)
        continue

    caps = meta.get("capabilities")
    if not isinstance(caps, dict) or "destructive" not in caps:
        bad.append("%s: missing required key: "
                   "tool.ai-toolbox.capabilities.destructive" % path)
        caps = {}
    elif not isinstance(caps["destructive"], bool):
        # TOML has real booleans, so a string "true" here is an author who
        # meant a boolean and got a truthy value that no branch below reads
        # the way they expect.
        bad.append("%s: tool.ai-toolbox.capabilities.destructive must be a "
                   "TOML boolean (true/false), not %r"
                   % (path, caps["destructive"]))

    if caps.get("destructive") is True:
        if not caps.get("destructive_tools"):
            bad.append("%s: capabilities.destructive is true but "
                       "destructive_tools is empty" % path)
        auth = meta.get("authorization")
        if not isinstance(auth, dict) or auth.get("granted") is not True:
            bad.append("%s: capabilities.destructive is true but "
                       "authorization.granted is not true (AGENTS.md requires "
                       "explicit human authorization in the task file)" % path)
        else:
            for key in ("by", "date", "task"):
                if not auth.get(key):
                    bad.append("%s: authorization.%s is required when "
                               "destructive" % (path, key))
            task = auth.get("task")
            if task and not os.path.isfile(task):
                bad.append("%s: authorization.task points at a nonexistent "
                           "file: %s" % (path, task))

    if base.startswith("_template"):
        continue

    env = meta.get("environment")
    if env is not None and not isinstance(env, dict):
        bad.append("%s: tool.ai-toolbox.environment must be a table of "
                   "<VAR> tables" % path)
        env = {}
    for k, v in sorted((env or {}).items()):
        if isinstance(v, dict) and v.get("required") and k not in documented:
            undoc.append("%s requires '%s' but .env.example does not list it"
                         % (path, k))

for msg in bad:
    print("INVALID AUTHORED MANIFEST: %s" % msg)
for msg in undoc:
    print("UNDOCUMENTED ENV: %s" % msg)
sys.exit(1 if (bad or undoc) else 0)
PY

# Loops: frontmatter name/description, name matches directory, and the
# three structural sections. A loop without exit conditions is an
# unbounded instruction, which is the failure mode worth catching.
for f in loops/*/loop.md; do
  [ -f "$f" ] || continue
  d=$(dirname "$f")
  base=$(basename "$d")
  name=$(awk '/^name:/{sub(/^name: */,"");print;exit}' "$f")
  [ -n "$name" ] || { echo "MISSING name: $f"; fail=1; }
  grep -q '^description:' "$f" || { echo "MISSING description: $f"; fail=1; }
  # The registry renders description into one cell, exactly as for skills and
  # agents. This was the weakest description test in the file — presence only,
  # so a folded scalar or an empty value passed. Same defect TASK-0039 found.
  ldesc=$(awk '/^description:/{sub(/^description: */,"");print;exit}' "$f")
  # Strip one layer of matching quotes, so `description: ""` and
  # `description: '>-'` are judged on their content rather than their
  # punctuation. The skills check does this via its scalar() helper; doing it
  # here too is what keeps the two categories' rules actually identical.
  case "$ldesc" in
    \"*\") ldesc=${ldesc#\"}; ldesc=${ldesc%\"} ;;
    \'*\') ldesc=${ldesc#\'}; ldesc=${ldesc%\'} ;;
  esac
  # A following indented, non-comment line is a YAML continuation, so the
  # value is not a single line. The registry renders it into one cell.
  ldesc_next=$(awk '/^description:/{getline nxt; print nxt; exit}' "$f")
  case "$ldesc_next" in
    [' 	']*)
      case "$(printf '%s' "$ldesc_next" | sed 's/^[ \t]*//')" in
        ""|'#'*) ;;   # blank or comment ends the value
        *) echo "MULTILINE description: $f — description must be a single line, so the registry renders it into one cell"
           fail=1 ;;
      esac ;;
  esac
  case "$ldesc" in
    "") echo "EMPTY description: $f"; fail=1 ;;
    ">"|">-"|">+"|"|"|"|-"|"|+")
      echo "FOLDED description: $f declares the bare block sigil '$ldesc' — the registry would render the sigil and drop the text"
      fail=1 ;;
  esac
  case "$base" in
    _template*) ;;   # templates are named _template*, so cannot match
    *) [ -z "$name" ] || [ "$name" = "$base" ] || {
         echo "NAME MISMATCH: $f declares '$name' but directory is '$base'"
         fail=1; } ;;
  esac
  for section in Trigger Steps "Exit conditions"; do
    grep -q "^## ${section}\$" "$f" || {
      echo "MISSING SECTION '## ${section}': $f"; fail=1; }
  done
done

# Wiring claims in shipped scripts. A script that claims a named runner in
# THIS repository executes it must actually be referenced by that runner. The
# rule is defined in docs/development/authoring-guide.md under "Claims a
# component makes about its own wiring", written there first so this gate
# enforces a requirement rather than authoring one (ADR-0008).
#
# WHY THIS EXISTS: TASK-0046 found twelve false claims in one new skill, each
# an assertion about the artifact's own structure that the artifact falsified.
# The worst (W1) was a script header stating it "is run from
# tests/validate.sh" when NOTHING in the repo ran it — an artifact claiming
# to be enforced while inert. Five review rounds each found a different
# instance by reading; nothing mechanical could.
#
# SCOPE: skills/*/scripts/* only — the file type W1 occurred in, and the only
# one where "is this run?" is a meaningful question, because only a script can
# be run. An earlier version of this check also scanned SKILL.md, loop.md and
# agent.md and was VACUOUS for all three: it tested whether the runner's text
# contained the claiming file's path or basename, and validate.sh legitimately
# contains the strings "skills/*/SKILL.md", "loops/*/loop.md" and
# "agents/*/agent.md" in its own loop headers — so every .md claim auto-passed.
# Verified by injecting a false claim into a SKILL.md and watching the gate
# return 0. A check that cannot fail is worse than no check, because it is
# still trusted.
#
# WHAT THIS PROVES: that a positive wiring claim in a shipped script names a
# runner whose text contains that script's path.
# WHAT IT DOES NOT PROVE: that the runner invokes it usefully, on the right
# input, or at the right time. Nothing about .md prose — including
# templates/change-record.md, where two of the twelve false claims lived. And
# nothing about the REST of the class: "every gate maps to a field", "so it
# cannot drift" and "never restated" are not mechanically decidable. Do not
# extend this by pattern-matching prose for meaning; a check that guesses
# fires on correct text and gets deleted.
#
# THREE EXEMPTIONS, each verified necessary against a real false positive:
#   1. Negative claims — "NOT run from tests/validate.sh", "Nothing in this
#      repository runs this script". They assert an ABSENCE, which is what the
#      positive branch would otherwise verify.
#   2. Discussion — "Example of a bad claim: ...", "would be false",
#      "do not write". Observed firing on a comment that explained the rule,
#      which is the fires-on-correct-text failure mode that gets a check
#      deleted rather than fixed.
#   3. Quoted claims — an odd number of quotes before the runner path means
#      the claim is being shown, not made.
# The exemptions are why this check is worth having; they are also its ceiling.
# A false claim phrased to look like discussion passes. That is the accepted
# limit of judging polarity from prose, and the reason the rest of the class
# is left to reading rather than pattern-matched here.
#
# An unwired script is not a defect (skills/ansible-ops/ ships one
# deliberately — the mandatory gate must stay offline and hermetic, ADR-0007);
# claiming to be wired when you are not is the defect.
#
# COST, measured rather than assumed. This pass alone: ~43 ms, scanning the
# 3 shipped scripts. All three checks added by this change, end to end on a
# native filesystem: 476 ms baseline -> ~540 ms. The gate stays sub-second
# where ADR-0009 measured it (0.366 s) and on any native checkout.
#
# On a /mnt/c WSL working copy the whole gate runs ~920 ms BEFORE this change
# and ~1000 ms after — the Windows filesystem bridge, not this pass, is the
# cause. Measure on a native path before concluding a check is expensive, and
# do not delete checks to buy back time the filesystem is spending.
python3 - <<'PY' || fail=1
import glob, os, re, sys

# A claim that some named runner executes this file. Captures the runner path
# and the words around it, so polarity can be judged.
CLAIM = re.compile(
    r"(?P<lead>[^.\n]{0,80}?)"
    r"\b(?:run|runs|invoked|invokes|executed|executes|called|calls)\b"
    r"(?P<mid>[^.\n]{0,40}?)"
    r"`(?P<runner>tests/validate\.sh|\.githooks/pre-commit"
    r"|scripts/[A-Za-z0-9_.\-]+\.sh)`"
)
# Polarity markers. A negative claim asserts absence and needs no check.
NEG = re.compile(r"\b(?:not|never|nothing|no|neither|nor|without|cannot|"
                 r"can't|unwired|un-wired)\b", re.I)
# Text that is TALKING ABOUT wiring claims rather than making one. Verified
# necessary: a comment reading `Example of a bad claim: writing "run from
# tests/validate.sh" when nothing does` fired this check, which is the
# fires-on-correct-text failure mode that gets a check deleted. A quoted or
# hypothetical claim is discussion, so it is exempt.
DISCUSSION = re.compile(r"\b(?:example|e\.g\.|counter-?example|hypothetic|"
                        r"claim(?:s|ed|ing)?\s+that|wrongly|falsely|"
                        r"incorrectly|would be|do not write|don't write|"
                        r"instead of|rather than)\b", re.I)

runner_cache = {}


def runner_text(path):
    if path not in runner_cache:
        try:
            with open(path, encoding="utf-8") as fh:
                runner_cache[path] = fh.read()
        except OSError:
            runner_cache[path] = None
    return runner_cache[path]


bad = []
for path in sorted(glob.glob("skills/*/scripts/*")):
    if "_template" in path or not os.path.isfile(path):
        continue
    with open(path, encoding="utf-8") as fh:
        body = fh.read()
    for n, line in enumerate(body.split("\n"), 1):
        for m in CLAIM.finditer(line):
            context = m.group("lead") + " " + m.group("mid")
            if NEG.search(context) or DISCUSSION.search(line):
                continue
            # A claim inside a quoted string is being shown, not made.
            before = line[:m.start("runner")]
            if before.count('"') % 2 == 1 or before.count("'") % 2 == 1:
                continue
            rp = m.group("runner")
            text = runner_text(rp)
            if text is None:
                bad.append("%s:%d claims it is run from %s, which does not "
                           "exist" % (path, n, rp))
            elif path not in text:
                # Full path only. A basename test would be satisfied by the
                # runner merely mentioning a glob that happens to match.
                bad.append("%s:%d claims it is run from %s, but that file "
                           "never references it — write 'NOT run from %s' if "
                           "it is deliberately unwired" % (path, n, rp, rp))

for msg in bad:
    print("FALSE WIRING CLAIM: %s" % msg)
sys.exit(1 if bad else 0)
PY

# Assets a skill script declares must EXIST and be TRACKED.
#
# WHY THIS EXISTS: TASK-0122 added `dashboard.html` and `docs/dashboard.html`
# to .gitignore so a generated dashboard could not be committed. A gitignore
# pattern without a leading slash matches at EVERY depth, so `dashboard.html`
# also matched the generator's own shell template at
# skills/project-workflow/assets/dashboard.html. `git add -A` skipped it in
# silence, the commit went green, `git status` stayed clean, and the skill
# shipped unable to run from a fresh clone -- `missing asset dashboard.html`.
# It was found by cloning the repo, not by any gate. Nothing in this file
# could see it, because every check here reads the WORKING TREE, where the
# file was present the whole time.
#
# That is the worst shape a defect can have here: invisible locally, fatal to
# every consumer, and green at every step.
#
# WHAT THIS PROVES: that every path a shipped skill script passes to a
# literal asset("...") call exists on disk and, when git is available, is
# tracked by it.
# WHAT IT DOES NOT PROVE: anything about an asset resolved through a
# variable, a glob or a computed name -- only literal calls are visible to a
# regex, and guessing at the rest fires on correct code. Nor that the asset's
# CONTENT is right; that is the component's own checker's job.
#
# The tracked half degrades rather than lying: outside a git work tree it
# announces that it could not run instead of passing silently, and the
# exists half still runs. A gate that cannot fail is worse than no gate.
python3 - <<'ASSETS' || fail=1
import glob
import os
import re
import subprocess
import sys

# Only a literal call. asset(name) with a variable is invisible here, and
# deliberately so -- see the header.
CALL = re.compile(r'\basset\(\s*"([^"]+)"\s*\)')

tracked = None
try:
    inside = subprocess.run(["git", "rev-parse", "--is-inside-work-tree"],
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    if inside.returncode == 0 and inside.stdout.strip() == b"true":
        out = subprocess.run(["git", "ls-files"], stdout=subprocess.PIPE,
                             stderr=subprocess.DEVNULL, check=True)
        tracked = set(out.stdout.decode("utf-8", "replace").split("\n"))
except (OSError, subprocess.SubprocessError):
    tracked = None

bad = []
for found in sorted(glob.glob("skills/*/scripts/*")):
    # `glob` returns OS-native separators, so on Windows these come back
    # backslash-separated. Normalising here fixes two separate faults, and the
    # first of them took the WHOLE GATE down rather than failing a check:
    #
    #   1. `path.split("/")[1]` yielded a one-element list and raised
    #      IndexError, so validate.sh exited 1 on any Windows checkout with no
    #      indication of which check had died.
    #   2. `rel` is compared against `git ls-files`, which always emits forward
    #      slashes -- so every declared asset would have been reported NOT
    #      TRACKED even once the split was fixed. A check that reports a
    #      correct repository as broken gets disabled.
    #
    # CI runs on Linux, which is why neither was ever visible there.
    path = found.replace(os.sep, "/")
    if "_template" in path or not os.path.isfile(path):
        continue
    with open(path, encoding="utf-8", errors="replace") as fh:
        body = fh.read()
    skill = path.split("/")[1]
    for m in CALL.finditer(body):
        rel = "skills/%s/assets/%s" % (skill, m.group(1))
        if not os.path.exists(rel):
            bad.append("%s declares asset %s, which does not exist"
                       % (path, rel))
        elif tracked is not None and rel not in tracked:
            bad.append("%s declares asset %s, which exists but is NOT TRACKED "
                       "by git -- a .gitignore pattern is swallowing it, so a "
                       "fresh clone cannot run this script. Anchor the pattern "
                       "with a leading slash and `git add` the file"
                       % (path, rel))

if tracked is None:
    print("NOTICE: not a git work tree - declared assets were checked for "
          "existence only, not for being tracked")

for msg in bad:
    print("UNTRACKED ASSET: %s" % msg)
sys.exit(1 if bad else 0)
ASSETS

# A tracked file with a shebang must be recorded EXECUTABLE by git.
#
# WHY THIS EXISTS: this repository is developed on a /mnt/c WSL checkout,
# where `core.filemode` is false. `chmod +x` therefore changes nothing git can
# see, and the drvfs mount reports every file as executable anyway -- so a
# script that git records as 100644 runs perfectly here and fails everywhere
# else. TASK-0014 already documented one face of this trap for the hook; this
# is the other.
#
# WHAT IT COST: scripts/sync-decision-standard.sh went in at 100644, and
# tests/validate.sh invokes it WITHOUT an interpreter prefix. Every CI run
# since has failed at `STANDARD: scripts/sync-decision-standard.sh failed`,
# for at least fourteen consecutive commits, while this gate passed locally
# every time and validate.yml's header said `STATUS: VERIFIED`. Eleven tracked
# scripts were in that state when this check was written, including three
# added the same day. Reproduced by cloning to ext4 and running the gate: the
# CI message appears verbatim.
#
# A second opinion that has been failing unnoticed is the ADR-0009 shape
# again -- not a check that broke, a check whose failure nobody could see.
#
# WHAT THIS PROVES: that every tracked file beginning `#!` is mode 100755 in
# the index, so it runs on a filesystem where the bit means something.
# WHAT IT DOES NOT PROVE: that a file WITHOUT a shebang does not need to be
# executable, or that an executable one is correct. Shebang-implies-runnable
# is the rule with no carve-outs, which is the only kind that survives.
python3 - <<'MODES' || fail=1
import os
import subprocess
import sys

try:
    inside = subprocess.run(["git", "rev-parse", "--is-inside-work-tree"],
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    if inside.returncode != 0 or inside.stdout.strip() != b"true":
        raise OSError("not a work tree")
    out = subprocess.run(["git", "ls-files", "-s"], stdout=subprocess.PIPE,
                         stderr=subprocess.DEVNULL, check=True)
except (OSError, subprocess.SubprocessError):
    print("NOTICE: not a git work tree - recorded file modes were not checked")
    sys.exit(0)

bad = []
for line in out.stdout.decode("utf-8", "replace").split("\n"):
    if not line.strip():
        continue
    meta, _, path = line.partition("\t")
    mode = meta.split()[0]
    if mode not in ("100644", "100755"):
        continue                      # symlink, submodule: not our business
    try:
        with open(path, "rb") as fh:
            if fh.read(2) != b"#!":
                continue
    except OSError:
        continue
    if mode != "100755":
        bad.append(path)

for path in bad:
    print("NOT EXECUTABLE: %s has a shebang but git records it 100644 - it "
          "will fail to run anywhere core.filemode is honoured. Fix with "
          "`git update-index --chmod=+x %s` (plain chmod does nothing on a "
          "core.filemode=false checkout)" % (path, path))
sys.exit(1 if bad else 0)
MODES

# Agents: the frontmatter rules docs/development/authoring-guide.md states
# under "Agents", mirrored here so guide and gate cannot drift (ADR-0008).
# Parsed with python3, never grepped: an agent body IS a system prompt and
# may legitimately discuss `description:` or `permission:` in prose or an
# example, so a grep would fail the first role whose prompt explains the
# schema.
#
# Iterates DIRECTORIES, not agents/*/agent.md, so a role directory holding
# a misnamed file is reported rather than silently skipped — the same rule
# the handover check applies, because a renaming scheme must not be able to
# disable a check.
#
# WHAT THIS PROVES: agents/<role>/agent.md parses, carries its required
# keys, names a valid mode, and draws its capability profile from the
# closed vocabulary the guide defines.
#
# WHAT THIS DOES NOT PROVE: that any emitted per-client agent file exists,
# is current, or grants the permissions the profile intended. Emission
# produces a copy whose freshness nothing here can verify, and ADR-0018
# clause 4 forbids adding such a check: "anyone who later fixes this by
# checking the deployed copy breaks every fresh clone and CI." Per ADR-0009,
# this gate checks SOURCE COMPLETENESS only. Do not add a check that reads
# ~/.claude/agents/ or ~/.config/opencode/agents/.
#
# NOT checked: any agent.md length cap or description byte limit. No budget
# is defined in the authoring guide (which says so explicitly), so enforcing
# one would make this gate the author of a requirement — ADR-0008 again.
for d in agents/*/; do
  d="${d%/}"
  [ -d "$d" ] || continue
  base=$(basename "$d")

  # Report, never skip. A directory under agents/ that holds no agent.md is
  # either a mistake or a rename that would disable this check.
  if [ ! -f "$d/agent.md" ]; then
    echo "MISSING agent.md: $d (found: $(ls -A "$d" 2>/dev/null | tr '\n' ' ' | sed 's/ $//'))"
    fail=1
    continue
  fi

  python3 - "$d/agent.md" "$base" <<'PY' || fail=1
import re, sys

path, dirname = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as fh:
    lines = fh.read().split("\n")

bad = []

# The closed capability vocabulary from the authoring guide's Agents
# section. Closed on purpose: an unknown term is a term the emitter has no
# mapping for, and ADR-0018 clause 8 requires emission to refuse rather
# than silently drop it. A typo must fail here, not degrade there.
VOCAB = {
    "read-only", "no-delegation", "delegation-allowlist", "no-webfetch",
    "worktree-only", "test-files-only", "bash-allowlist", "test-allowlist",
    "no-bash", "no-bypass", "no-force-push", "push-requires-confirmation",
    "webfetch-requires-confirmation",
}

# Terms that write a `bash` permission rule. `no-bash` denies the whole tool,
# so pairing it with any of these is a contradiction rather than a
# refinement — and under OpenCode's last-match-wins resolution the EMITTED
# ORDER would silently decide which one won. Rejected here instead.
BASH_SHAPING = {"bash-allowlist", "test-allowlist", "no-force-push",
                "no-bypass", "push-requires-confirmation"}
MODES = {"primary", "subagent"}
# Values that are REAL in a client and REJECTED here, kept separate from the
# unknown-string case so the message says which it is (TASK-0058, discharging
# ADR-0022 clause 5.2; the message wording is TASK-0059's half).
#
# WHY THIS DISTINCTION IS WORTH A TABLE: `mode 'all' is not one of: primary,
# subagent` reads like a caught typo. `all` is not a typo — OpenCode accepts
# it, `opencode agent list` reports it beside `(primary)` and `(subagent)`,
# and `--agent` selects such a role correctly (TASK-0055). An author who has
# just watched it work in OpenCode and is then told it is "not one of" the
# valid values will reasonably conclude this gate is out of date and widen
# MODES. The rejection has to argue its own case at the point it fires.
#
# MODES itself is unchanged: `all` was rejected, not admitted.
REJECTED_MODES = {
    "all": "OpenCode accepts 'all' and this repo rejects it deliberately: "
           "'all' means BOTH primary and subagent, so a role carrying "
           "'delegation-allowlist' would have that boundary enforced or "
           "silently widened depending on how it happened to be invoked, "
           "which no reader can determine from the file. Nothing in this "
           "repo needs it, and what 'all' does beyond selection is untested. "
           "Do not widen MODES to make this pass — see "
           "docs/development/authoring-guide.md, \"`mode: all` is rejected "
           "on purpose, not overlooked\", which states what would reopen it",
}
CLIENTS = {"claude-code", "opencode"}

if not lines or lines[0].strip() != "---":
    bad.append("frontmatter must open with '---' on line 1")
    fm = []
else:
    try:
        end = next(i for i, l in enumerate(lines[1:], 1) if l.strip() == "---")
        fm = lines[1:end]
        body = "\n".join(lines[end + 1:])
    except StopIteration:
        bad.append("frontmatter is not terminated by a closing '---'")
        fm = []
        body = ""
if not fm:
    body = ""


def scalar(key):
    """Value of a top-level key, plus how many lines it spans."""
    for i, line in enumerate(fm):
        m = re.match(r"^%s:(.*)$" % re.escape(key), line)
        if not m:
            continue
        val = m.group(1).strip()
        span = 1
        for cont in fm[i + 1:]:
            if cont.strip() and cont[0] in " \t" and not cont.strip().startswith("#"):
                span += 1
            else:
                break
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        return val, span
    return None, 0


def seq(key):
    """Items of a top-level block sequence, or None if the key is absent."""
    for i, line in enumerate(fm):
        if not re.match(r"^%s:\s*$" % re.escape(key), line):
            continue
        items = []
        for cont in fm[i + 1:]:
            if not cont.strip() or cont.strip().startswith("#"):
                break
            if not cont[0] in " \t":
                break
            m = re.match(r"^\s+-\s+(.*)$", cont)
            if not m:
                break
            items.append(m.group(1).strip().strip("\"'"))
        return items
    return None


name, _ = scalar("name")
if name is None:
    bad.append("missing required key: name")
elif not name:
    bad.append("key 'name' is empty")
elif not dirname.startswith("_template") and name != dirname:
    # Templates are named _template*, so the rule cannot apply to them —
    # the same carve-out the skill, MCP and loop checks already make.
    bad.append("name '%s' does not match directory '%s'" % (name, dirname))

desc, desc_span = scalar("description")
if desc is None:
    bad.append("missing required key: description")
elif not desc:
    bad.append("key 'description' is empty")
elif desc_span > 1 or desc in (">", ">-", "|", "|-", ">+", "|+"):
    # The registry renders description into a single table cell. A folded
    # scalar reaches it as the literal sigil ">-" with the text dropped,
    # and the row still has the right column count, so the registry
    # integrity check cannot see it (observed in TASK-0039).
    bad.append("description must be a single line, not a folded/block scalar")

mode, _ = scalar("mode")
if mode is None:
    bad.append("missing required key: mode")
elif mode in REJECTED_MODES:
    bad.append("mode '%s' is a real client value this repo REJECTS ON "
               "PURPOSE, not an unrecognised string. %s"
               % (mode, REJECTED_MODES[mode]))
elif mode not in MODES:
    # Not inferred: OpenCode has an explicit mode field, Claude Code has
    # none, so the emitter must be told rather than guess.
    bad.append("mode '%s' is not one of: %s" % (mode, ", ".join(sorted(MODES))))

caps = seq("capabilities")
if caps is None:
    bad.append("missing required key: capabilities")
elif not caps:
    bad.append("key 'capabilities' is empty")
else:
    for c in caps:
        if c not in VOCAB:
            bad.append("capability '%s' is not in the vocabulary (see "
                       "authoring-guide.md 'Agents')" % c)

clients = seq("clients")
if clients is None:
    bad.append("missing required key: clients")
elif not clients:
    bad.append("key 'clients' is empty")
else:
    for c in clients:
        if c not in CLIENTS:
            bad.append("client '%s' is not one of: %s"
                       % (c, ", ".join(sorted(CLIENTS))))

# delegation-allowlist is the one parameterised term: its argument lives in
# `delegates_to` rather than inside `capabilities`, because every other
# vocabulary entry is a plain string. Checked in BOTH directions so neither
# half can drift from the other.
delegates = seq("delegates_to")
has_allowlist = bool(caps) and "delegation-allowlist" in caps
if has_allowlist:
    if delegates is None:
        # seq() reads block sequences (`- item` on following lines) only, so
        # an inline flow list (`delegates_to: [a, b]`) also lands here. That
        # is the safe direction — it fails loudly rather than emitting an
        # agent with an allowlist nobody parsed — but the message has to say
        # so, or the author reads "missing" while looking at a present key.
        bad.append("capability 'delegation-allowlist' requires a "
                   "'delegates_to' block list naming the roles it may "
                   "invoke (one '- name' per line; inline [a, b] form is "
                   "not read)")
    elif not delegates:
        bad.append("key 'delegates_to' is empty — an allowlist that allows "
                   "nothing is 'no-delegation'")
    # Claude Code honours an Agent(...) allowlist ONLY for a main-thread
    # agent; in a subagent definition the type list is IGNORED, so the
    # subagent gets unrestricted spawning instead. Emitting that would be
    # silent widening — the failure ADR-0018 clause 8 forbids.
    if mode is not None and mode != "primary":
        bad.append("capability 'delegation-allowlist' requires mode: "
                   "primary (Claude Code ignores a subagent's allowlist, "
                   "which would silently widen it)")
    if caps and "no-delegation" in caps:
        bad.append("capabilities 'delegation-allowlist' and "
                   "'no-delegation' contradict each other")

elif delegates is not None:
    bad.append("key 'delegates_to' is present without capability "
               "'delegation-allowlist' — it would have no effect")

# `no-bash` denies the bash tool outright, so pairing it with any term that
# SHAPES bash is a contradiction rather than a refinement — and under
# OpenCode's last-match-wins resolution the emitted order would silently
# decide which one applied.
#
# Kept clear of the delegation if/elif chain above deliberately: an earlier
# version of this check was inserted between that chain's last `bad.append`
# and its `elif`, which re-bound the `elif` to the new `if` and made every
# role carrying `delegates_to` fail with "present without capability
# 'delegation-allowlist'". The gate caught it on `designer-manager`
# immediately, which is the argument for running it rather than reading it.
if caps and "no-bash" in caps:
    clash = sorted(BASH_SHAPING & set(caps))
    if clash:
        bad.append("capability 'no-bash' denies the bash tool outright and "
                   "contradicts %s, which shape what bash may run. Under "
                   "last-match-wins the emitted order would decide which "
                   "applies. Use one or the other."
                   % ", ".join("'%s'" % c for c in clash))

# The two COMMAND allowlists — bash_allow and test_allow — take the same
# argument shape and the same entry guards. Checked by one function so the
# two cannot drift apart (TASK-0074, closing B-027).
#
# THE TWO ENTRY GUARDS, AND WHY EACH IS EXACTLY THIS WIDE:
#
#   1. A BARE "*" is rejected. Under OpenCode's last-match-wins resolution,
#      `"*": deny` followed by `"*": allow` IS `bash: allow` with extra
#      steps — the resolution B-021 forbade. Note this rejects the bare
#      wildcard ONLY. A pattern like "*pytest*" is narrow and legitimate and
#      is ACCEPTED: it matches commands containing pytest, not everything.
#
#      TASK-0071 rejected every entry *beginning* with "*", which enforced
#      more than its own justification supported and would have rejected
#      "*pytest*". Corrected here rather than left: a rule that fires on a
#      legitimate case gets deleted by the next author instead of argued
#      with. The authoring guide records the correction.
#
#   2. A SHELL CHAINING METACHARACTER is rejected, so one entry is one
#      command. Without it `'git status; curl evil.sh'` is a single legal
#      entry and the allowlist is decorative.
#
# NOT checked, and not checkable here: whether OpenCode's matcher actually
# matches a given pattern against a given command line. That is a property
# of the client; TASK-0055's F4 settled it for the `git add -- *` case by
# running it, and ADR-0020 clause 6 forbids inferring the rest.
CHAINERS = (";", "&&", "||", "|", "$(", "`", "\n")


def check_command_allowlist(term, key, items, declared):
    """Both directions of the iff, non-emptiness, and the two entry guards."""
    if declared:
        if items is None:
            bad.append("capability '%s' requires a '%s' block list naming "
                       "the command patterns it may run (one quoted "
                       "'- pattern' per line; inline [a, b] form is not "
                       "read)" % (term, key))
            return
        if not items:
            bad.append("key '%s' is empty — an allowlist that permits "
                       "nothing denies everything, which is not what this "
                       "term means" % key)
            return
        for pattern in items:
            if pattern == "*":
                bad.append("%s entry '*' is a bare wildcard — under "
                           "last-match-wins that resolves to allowing "
                           "everything, which is the `bash: allow` "
                           "resolution B-021 forbids. A narrower pattern "
                           "such as '*pytest*' is fine." % key)
            for ch in CHAINERS:
                if ch in pattern:
                    bad.append("%s entry '%s' contains the shell chaining "
                               "metacharacter '%s' — one entry must be one "
                               "command, or the allowlist is decorative"
                               % (key, pattern, ch.replace("\n", "\\n")))
                    break
    elif items is not None:
        bad.append("key '%s' is present without capability '%s' — it would "
                   "have no effect" % (key, term))


check_command_allowlist("bash-allowlist", "bash_allow", seq("bash_allow"),
                        bool(caps) and "bash-allowlist" in caps)
check_command_allowlist("test-allowlist", "test_allow", seq("test_allow"),
                        bool(caps) and "test-allowlist" in caps)

# metadata.version is optional, but must be semver when given, matching the
# skill rule so the registry's version column stays comparable.
for line in fm:
    m = re.match(r"^\s+version:(.*)$", line)
    if not m:
        continue
    v = m.group(1).strip().strip("\"'")
    if not re.match(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$", v):
        bad.append("metadata.version '%s' is not semver (MAJOR.MINOR.PATCH)" % v)
    break

if not body.strip():
    bad.append("body is empty — the body is the system prompt")

# Client-native syntax is forbidden in a role file (ADR-0018 clause 2). This
# is the one rule whose violation silently defeats the whole one-source
# mechanism: a `permission:` block reaches Claude Code, is parsed as an
# unknown key, and is DISCARDED WITHOUT A WARNING, leaving the denied tools
# in the agent's pool (observed by fixture in TASK-0036).
#
# Checked against FRONTMATTER KEYS ONLY, at line start. The body is a system
# prompt and may legitimately name these keys while explaining why they are
# forbidden — the template itself did exactly that during TASK-0037.
for forbidden in ("permission", "disallowedTools", "tools", "permissionMode"):
    for line in fm:
        if re.match(r"^%s:" % re.escape(forbidden), line):
            bad.append("forbidden client-native key '%s:' — capability "
                       "boundaries go in 'capabilities' as abstract terms"
                       % forbidden)
            break

for msg in bad:
    print("INVALID AGENT: %s: %s" % (path, msg))
sys.exit(1 if bad else 0)
PY
done

# A delegate must exist, and must be emitted for every client its CALLER is
# emitted for (TASK-0075, closing B-028).
#
# WHY THIS IS A SEPARATE PASS: it is the only agent rule that is CROSS-ROLE.
# The per-role loop above cannot see other roles, and this defect is invisible
# from inside either file — designer-manager is valid, git-ops is valid, and
# the pair is broken.
#
# WHY IT EXISTS, from evidence rather than analogy (TASK-0056, claude 2.1.246):
# Claude Code validates the top-level `--agent` LOUDLY (exit 1, names the
# available agents) and does NOT validate names inside an agent definition's
# `tools: Agent(...)` allowlist. A dead delegate there is silent - a control
# fixture naming only an absent delegate produced 0 bytes of stderr and a role
# that reported having no delegates at all. A role whose purpose is delegation
# can therefore load, run and look correct while being unable to delegate.
#
# This is ADR-0018 clause 8's invisible degradation, and the emitter cannot
# catch it: emit-agents.py sees one role at a time and has no reason to doubt
# a name. So it is caught here, at source, before emission.
python3 - <<'PY' || fail=1
import os, re

def field(text, key):
    m = re.search(r"(?m)^%s:\s*$" % re.escape(key), text)
    if not m:
        return None
    out = []
    for line in text[m.end():].split("\n")[1:]:
        if not line.strip() or not line[0] in " \t":
            break
        im = re.match(r"^\s+-\s+(.*)$", line)
        if not im:
            break
        out.append(im.group(1).strip().strip("\"'"))
    return out

roles = {}
for name in sorted(os.listdir("agents")):
    path = os.path.join("agents", name, "agent.md")
    if name.startswith("_template") or not os.path.isfile(path):
        continue
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    roles[name] = (field(text, "clients") or [], field(text, "delegates_to"))

bad = []
for name, (clients, delegates) in sorted(roles.items()):
    for delegate in delegates or []:
        if delegate not in roles:
            bad.append("agents/%s/agent.md: delegates_to names '%s', which is "
                       "not a role in agents/" % (name, delegate))
            continue
        missing = [c for c in clients if c not in roles[delegate][0]]
        if missing:
            bad.append(
                "agents/%s/agent.md: delegates_to names '%s', which is not "
                "emitted for %s — the caller IS emitted for %s, so that "
                "client gets an Agent(%s) allowlist naming an agent it does "
                "not have, and neither client warns (TASK-0056). Narrow the "
                "caller's clients, or widen the delegate's."
                % (name, delegate, ", ".join(missing), ", ".join(missing),
                   delegate))

for msg in bad:
    print("INVALID DELEGATION: %s" % msg)
raise SystemExit(1 if bad else 0)
PY

# Every client scripts/install.sh can deploy to must have a wiring
# snapshot, so a new client cannot be added to the script without one.
# The client list is read from install.sh itself to keep them in sync.
for client in $(sed -n '/^CLIENTS="$/,/^"$/p' scripts/install.sh \
                | grep -oE '^[a-z0-9_-]+\|' | tr -d '|'); do
  [ -f "configs/$client/README.md" ] || {
    echo "MISSING wiring snapshot: configs/$client/README.md (client '$client' is in scripts/install.sh)"
    fail=1
  }
done

# An MCP server that declares a REQUIRED environment variable or a
# DESTRUCTIVE capability must be named in every configs/*/README.md
# (TASK-0073, closing B-023). The authoring guide states the rule and its
# third, ungated trigger.
#
# WHY ONLY THESE TWO CONDITIONS: they are the ones a file can decide. The
# guide's third trigger — "a launch a client cannot perform from the manifest
# alone" — is a judgment call, and a check that cannot really decide it is a
# check that cannot fail, which is this repo's most expensive recurring
# lesson. It is left to a human deliberately, not forgotten.
#
# WHAT THIS PROVES: that a server needing per-client prose has somewhere in
# each snapshot to put it. NOT that the prose is correct, current, or says
# anything useful — only that the section exists. graphify is exempt under
# the rule and is expected to appear in NO snapshot; that is the arrangement
# the rule describes, not a gap it tolerates.
for d in mcp-servers/*/; do
  d="${d%/}"
  name=$(basename "$d")
  # Same _template* carve-out every other loop makes. _template-external
  # declares a REQUIRED variable and would otherwise demand three sections
  # for a server nobody runs.
  case "$name" in _template*) continue ;; esac
  # BOTH SHAPES. This read `server.json` only until TASK-0088 shipped the
  # first authored server, which has a required variable AND a destructive
  # tool and so would have owed three sections nobody asked for — the hole
  # TASK-0059 named in advance. The authored declarations live in
  # `[tool.ai-toolbox]`, key for key the same as server.json's.
  if [ -f "$d/server.json" ]; then
    marker="$d/server.json"
  elif [ -f "$d/pyproject.toml" ]; then
    marker="$d/pyproject.toml"
  else
    continue
  fi
  owes=$(python3 - "$marker" <<'PY'
import json, sys
path = sys.argv[1]
if path.endswith(".toml"):
    import tomllib   # the authored-manifest pass above already fails loudly without it
    m = (tomllib.load(open(path, "rb")).get("tool") or {}).get("ai-toolbox") or {}
else:
    m = json.load(open(path))
req = any(v.get("required") for v in (m.get("environment") or {}).values()
          if isinstance(v, dict))
print("yes" if req or (m.get("capabilities") or {}).get("destructive") is True
      else "no")
PY
)
  [ "$owes" = "yes" ] || continue
  for snap in configs/*/README.md; do
    # A HEADING naming the server, not a mention of it anywhere in the file.
    # A substring match was the first version and it was already unsound when
    # written: these snapshots now carry a pointer paragraph naming graphify
    # by way of explaining why it has no section, so "is the name present?"
    # would be satisfied by the very sentence saying there is no section. A
    # check a passing mention can satisfy is a check that cannot fail.
    grep -qE "^#+[[:space:]].*(^|[^a-zA-Z0-9_-])$name([^a-zA-Z0-9_-]|$)" "$snap" || {
      echo "MISSING wiring section: $snap has no heading for '$name', which"
      echo "  declares a required environment variable or a destructive"
      echo "  capability (docs/development/authoring-guide.md, 'When a server"
      echo "  owes a per-client wiring section')"
      fail=1
    }
  done
done

# The tracked pre-commit hook must exist and be executable (ADR-0007).
# Unconditional: an earlier version guarded this with `[ -d .githooks ]`,
# which meant deleting the hook directory made the check silently pass —
# the check could not detect the very thing it exists to detect. A missing
# hook is a failure, not an absence of opinion.
#
# Deliberately NOT asserting core.hooksPath is set: a fresh clone has not
# run scripts/install.sh yet, and failing validation there would block the
# first commit someone makes. Presence and runnability are the repo's
# business; activation is install.sh's.
if [ ! -f .githooks/pre-commit ]; then
  echo "MISSING hook: .githooks/pre-commit (ADR-0007 requires the tracked pre-commit gate)"
  fail=1
else
  # Check the mode git RECORDS, not the filesystem bit. This repo is
  # developed on a WSL /mnt/c 9p mount where every file reports
  # rwxrwxrwx and `chmod -x` is silently ignored, so `[ -x ]` can never
  # fail and would be a check that cannot detect its own failure case.
  # Git's index is the portable truth: a hook committed as 100644 is
  # silently ignored by git on a machine that does honour the bit.
  if git rev-parse --git-dir >/dev/null 2>&1; then
    mode=$(git ls-files -s .githooks/pre-commit 2>/dev/null | awk '{print $1}')
    if [ -n "$mode" ] && [ "$mode" != "100755" ]; then
      echo "HOOK NOT EXECUTABLE IN GIT: .githooks/pre-commit recorded as $mode, needs 100755 — run 'git update-index --chmod=+x .githooks/pre-commit'"
      fail=1
    fi
  fi
fi

# Every environment variable a manifest marks `required` must be documented
# in .env.example (TASK-0015, ADR-0009), so a new MCP server cannot
# introduce a requirement a contributor has no way to discover.
#
# This checks DOCUMENTATION COMPLETENESS, deliberately not whether any
# variable is SET. Checking presence would tie this hermetic gate to one
# machine's environment and fail on every fresh clone and CI run — a gate
# that cannot pass on a clean checkout stops being run.
#
# EXTERNAL SHAPE ONLY. The authored shape's identical rule is enforced in the
# authored-MCP pass above, in the same parse as its destructive checks, so
# pyproject.toml is read once rather than twice (TASK-0059, B-024). Do not
# "fix" this loop by pointing it at pyproject.toml as well.
if [ -f .env.example ]; then
  for d in mcp-servers/*/; do
    d="${d%/}"
    case "$(basename "$d")" in _template*) continue ;; esac
    [ -f "$d/server.json" ] || continue
    python3 - "$d/server.json" .env.example <<'PY' || fail=1
import json, re, sys

manifest, template = sys.argv[1], sys.argv[2]
with open(manifest) as fh:
    m = json.load(fh)
with open(template, encoding="utf-8") as fh:
    body = fh.read()

# Match an assignment at line start so a variable named only inside a
# comment does not count as documented.
documented = set(re.findall(r"(?m)^([A-Z_][A-Z0-9_]*)=", body))

missing = [k for k, v in sorted(m.get("environment", {}).items())
           if isinstance(v, dict) and v.get("required") and k not in documented]
for k in missing:
    print("UNDOCUMENTED ENV: %s requires '%s' but .env.example does not list it"
          % (manifest, k))
sys.exit(1 if missing else 0)
PY
  done
else
  echo "MISSING .env.example (TASK-0015: environment requirements must be documented)"
  fail=1
fi

# No registry row may point at a template. scripts/sync-registry.sh skips
# templates in one place, but this check is independent of it on purpose:
# the same leak was fixed three times (TASK-0005/0006/0008) before the
# generator was de-duplicated, so a regression must fail a check rather
# than reach a commit. Matches the PATH column only — a description may
# legitimately contain the word "template".
if [ -f docs/registry.md ]; then
  while IFS= read -r row; do
    path=$(printf '%s\n' "$row" | awk -F'|' '{gsub(/^ +| +$/,"",$(NF-1)); print $(NF-1)}')
    case "$path" in
      *_template*)
        echo "TEMPLATE IN REGISTRY: docs/registry.md lists '$path' — templates are not deployable components (run scripts/sync-registry.sh)"
        fail=1
        ;;
    esac
  done < <(grep '^| ' docs/registry.md | grep -v '^| Name ' | grep -v '^|---')

  # Registry content integrity (TASK-0018, closing B-001). Three defect
  # classes, all of which reach a generated file silently rather than
  # erroring:
  #   1. Leaked YAML quotes — was visible in exactly the two components
  #      that quote their frontmatter, invisible in the rest, and so
  #      survived four sprints.
  #   2. A `|` inside a cell — injects columns and breaks the table with
  #      no error. Reachable today: project-migration's body text already
  #      contains pipes; one edit into its description would do it.
  #   3. Wrong column count — the shape of a half-applied format change.
  # Expected column count is derived from each section's own header row,
  # not hardcoded, so adding a column to a section does not require
  # editing this check.
  python3 - docs/registry.md <<'PY' || fail=1
import sys

path = sys.argv[1]
bad = []
expected = None
section = None

for n, raw in enumerate(open(path, encoding="utf-8"), 1):
    line = raw.rstrip("\n")
    if line.startswith("## "):
        section, expected = line[3:], None
        continue
    if not line.startswith("|"):
        continue
    if set(line) <= set("|- "):        # separator row
        continue

    cells = line.split("|")
    if line.startswith("| Name "):     # header defines the contract
        expected = len(cells)
        continue

    if expected is not None and len(cells) != expected:
        # Direction matters for the diagnosis: too many cells is almost
        # always an unescaped pipe in a description, too few is a
        # half-applied format change. A hint pointing the wrong way costs
        # the reader more than no hint.
        why = ("an unescaped '|' in a description?" if len(cells) > expected
               else "a missing cell, or a format change applied to the "
                    "header but not the rows?")
        bad.append("line %d (%s): %d columns, header declares %d — %s"
                   % (n, section, len(cells), expected, why))
        continue

    for cell in cells[1:-1]:
        v = cell.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            bad.append("line %d (%s): cell is still quoted (%s…) — "
                       "sync-registry.sh should have stripped it"
                       % (n, section, v[:28]))

for msg in bad:
    print("REGISTRY INTEGRITY: %s" % msg)
sys.exit(1 if bad else 0)
PY
fi

# Handover sections in the task template and in task briefs (TASK-0023,
# ADR-0012). This is the first check that reads .ai/ — the gate has until
# now policed components only, so a governance-only edit can now fail a
# commit. That is deliberate: a deleted handover section is silent, and
# silence is the regression worth catching.
#
# WHAT THIS PROVES: the headings exist and something non-placeholder is
# written under them.
#
# WHAT THIS DOES NOT PROVE: that the declared inputs are the real inputs,
# or that the declared end state matches the tree. That is not
# mechanically decidable, and a green result here must never be read as
# "the handovers are good" — only as "no section is missing or empty".
# Per ADR-0009 (validation checks documentation completeness, never
# runtime state) and the standing lesson that a check which cannot fail
# is worse than no check, because it is still trusted.
#
# Content presence only, never table shape: the four briefs that prove
# the contract works (TASK-0020…0023) were written before the template
# existed, and a format check would reject them.
if [ -f .ai/templates/TASK.md ]; then
  python3 - <<'PY' || fail=1
import os, re, sys

# Task briefs numbered below this predate the convention (ADR-0012
# Decision 4). They are records of what happened, not instances of the
# current template; rewriting them to satisfy a rule invented afterwards
# would fabricate compliance. A numeric boundary rather than an allowlist:
# an allowlist needs an edit per new task and rots the first time someone
# forgets.
FIRST_CONTRACT_TASK = 20

REQUIRED = ["## Inputs", "## Outputs / handover"]
bad = []


def body_after(text, heading):
    """Lines under `heading` up to the next `## `, minus placeholder noise."""
    lines = text.split("\n")
    try:
        start = lines.index(heading)
    except ValueError:
        return None                      # heading absent entirely
    out = []
    for line in lines[start + 1:]:
        if line.startswith("## "):
            break
        s = line.strip()
        if not s:
            continue
        if s.startswith("<!--") or s.startswith("-->") or s.startswith(">"):
            continue                     # template guidance, not content
        if set(s) <= set("|- "):
            continue                     # empty table separator
        out.append(s)
    return out


def check(path, label):
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    for heading in REQUIRED:
        body = body_after(text, heading)
        if body is None:
            bad.append("%s: missing '%s'" % (label, heading))
        elif not body:
            bad.append("%s: '%s' is present but empty" % (label, heading))


# 1. The template itself must keep carrying both headings.
check(".ai/templates/TASK.md", "templates/TASK.md")

# 2. Task briefs at or past the boundary must have filled them in.
#
# Walks recursively: `.ai/README.md` documents `.ai/tasks/completed/` as a
# destination for task files, and a flat listdir() let a brief escape the
# check simply by being archived. Verified by fixture — a TASK-0099 with no
# handover sections passed while one level down.
for dirpath, _dirnames, filenames in os.walk(".ai/tasks"):
    for name in sorted(filenames):
        if not name.endswith(".md") or name == "TODO.md":
            continue
        m = re.match(r"^TASK-(\d{4})-", name)
        rel = os.path.relpath(os.path.join(dirpath, name), ".ai/tasks")
        if not m:
            # Reported, never skipped: a silently skipped file is an
            # unchecked file, and a renaming scheme could otherwise
            # disable this check without anyone noticing.
            bad.append("%s: filename does not match TASK-####-*.md, so it "
                       "cannot be checked — rename it or update this check"
                       % rel)
            continue
        if int(m.group(1)) >= FIRST_CONTRACT_TASK:
            check(os.path.join(dirpath, name), rel)

for msg in bad:
    print("HANDOVER: %s" % msg)
sys.exit(1 if bad else 0)
PY
fi

# --- The adjudicator's decision standard is a faithful copy ----------------
#
# The OpenCode binding ships decision-standard.md so the adjudicator can be
# given the standard it applies: every role declares `worktree-only`, so it
# cannot open the skill that owns that standard, and driver.py is a template
# that gets copied out of this skill anyway (B-035, TASK-0106).
#
# A copy with no check is how the gap B-035 names reappears: the references
# get edited, the binding keeps prompting with last month's standard, and
# nothing says so. This is the docs/registry.md arrangement — a derived file
# is allowed exactly as long as a gate proves it still matches its sources.
STANDARD=skills/unattended-ops/templates/bindings/opencode/decision-standard.md
if [ -e skills/unattended-ops/references/verdicts.md ]; then
  if [ ! -r "$STANDARD" ]; then
    echo "STANDARD: missing $STANDARD — run scripts/sync-decision-standard.sh"
    fail=1
  elif ! STANDARD_OUT="$STANDARD.check" scripts/sync-decision-standard.sh >/dev/null 2>&1; then
    echo "STANDARD: scripts/sync-decision-standard.sh failed"
    fail=1
  # Compared against a fresh generation, not against `git diff`: an
  # untracked file has no diff, so the git form would have passed
  # vacuously for exactly as long as the file went uncommitted — a check
  # that cannot fail, which is this repo's most-repeated lesson.
  elif ! cmp -s "$STANDARD" "$STANDARD.check"; then
    echo "STANDARD: $STANDARD is stale against references/verdicts.md and"
    echo "STANDARD: references/evidence.md — run scripts/sync-decision-standard.sh"
    echo "STANDARD: and commit the result"
    fail=1
  fi
  rm -f "$STANDARD.check"
fi

# The dashboard's publishing pipelines are RENDERED from the skill's templates
# and must still match them (TASK-0127, closing B-048).
#
# WHY: the hand-written .github/workflows/dashboard.yml carried rules learned
# by publishing a wrong page -- above all that a shallow clone produces a
# complete-looking dashboard with a truncated history. As a hand-kept copy
# those rules lasted until the next edit; B-040 found five templates here that
# had rotted exactly that way. Rendered and checked, the copy cannot diverge.
#
# check-publish.sh runs the renderer's refusals and the guard's failure cases
# in a throwaway repository under mktemp: hermetic, offline, about a second.
# It is in the gate because B-037 measured what a suite outside it costs.
#
# WHAT THIS PROVES: that this repository's pipelines are exactly what the
# templates render, and that the renderer and guard behave as documented.
# WHAT IT DOES NOT PROVE: that either pipeline runs. Each rendered file's
# STATUS line says whether a run has been observed.
PUBLISH=skills/project-workflow/scripts/publish-dashboard.sh
if [ -e dashboard-publish.conf ]; then
  if ! PUBLISH_OUT="$(bash "$PUBLISH" render --check 2>&1)"; then
    printf '%s\n' "$PUBLISH_OUT" | sed 's/^/PUBLISH: /'
    echo "PUBLISH: run bash $PUBLISH render and commit the result"
    fail=1
  fi
fi
if [ -e skills/project-workflow/scripts/check-publish.sh ]; then
  if ! PUBLISH_OUT="$(bash skills/project-workflow/scripts/check-publish.sh 2>&1)"; then
    printf '%s\n' "$PUBLISH_OUT" | grep -v '^PASS' | sed 's/^/PUBLISH: /'
    fail=1
  fi
fi

# --------------------------------------------------------------------------
# ci-alert's issue rule, proven offline (TASK-0130).
#
# WHY: .github/workflows/ci-alert.yml's `workflow_run` path only runs for the
# copy on the default branch, so it cannot be exercised before it lands, and
# the path that matters most - a green run that must NOT close the alert while
# another watched workflow is red - cannot be shown live without a red default
# branch. tests/test-ci-alert.sh extracts the program the workflow embeds and
# runs it against a fake API: one python3, no network, no git.
#
# WHAT THIS PROVES: the embedded program's action and requests for every
# fixture, and that its watched list, concurrency and permissions match what
# it relies on.
# WHAT IT DOES NOT PROVE: that GitHub delivers the events or answers the API
# as the fixtures assume; ci-alert.yml's STATUS line says what was observed.
# Deliberately unconditional: a deleted test fails here rather than skipping
# quietly (ADR-0009).
if ! CI_ALERT_OUT="$(bash tests/test-ci-alert.sh 2>&1)"; then
  printf '%s\n' "$CI_ALERT_OUT" | grep -v '^PASS' | sed 's/^/CI-ALERT: /'
  fail=1
fi

# --------------------------------------------------------------------------
# The vault-secrets loader, proven offline (TASK-0131, ADR-0030; AppRole and
# several maps, TASK-0132, ADR-0031).
#
# WHY: skills/vault-secrets/scripts/vault_secrets.py decides which token lands
# on disk, which secrets reach a command, and whether a request may go out in
# cleartext. None of that can be shown against the real Vault without real
# credentials, and an agent may not hold those (ADR-0019). The test drives the
# script against a stub Vault on 127.0.0.1 with a throwaway HOME and no
# controlling terminal, so a password prompt cannot block this gate. It also
# checks that secrets.map is well-formed and that every variable in it is
# documented in .env.example.
#
# WHAT THIS PROVES: the loader's decisions and requests for each case, and that
# no password, token or value appears in its output.
# WHAT IT DOES NOT PROVE: that the real Vault, its policies or its certificate
# behave as the stub does; TASK-0131's live verification records that.
# COST, measured 2026-10-04: ~2.2 s on a native filesystem, ~5.3 s on a
# /mnt/c checkout -- 28 interpreter starts, which the Windows filesystem bridge
# roughly triples (2026-10-03, before the AppRole cases: ~1.6 s and ~3.7 s).
# Deliberately unconditional: a deleted test fails here rather than skipping
# quietly (ADR-0009).
if ! VAULT_SECRETS_OUT="$(bash tests/test-vault-secrets.sh 2>&1)"; then
  printf '%s\n' "$VAULT_SECRETS_OUT" | grep -v '^PASS' | sed 's/^/VAULT-SECRETS: /'
  fail=1
fi

# --------------------------------------------------------------------------
# Local secret files stay out of git (TASK-0133, B-053).
#
# WHY: the mirror is public (ADR-0028), so a committed `.env.local` is a
# published credential. Until 2026-10-04 `.gitignore` ignored exactly `.env`,
# and every other variant was committable. `.env.example` must stay addable,
# or a fresh copy is skipped in silence -- TASK-0122's dashboard.html shape.
#
# WHAT THIS PROVES: git's own ignore resolution for these four names, with no
# such file needed (--no-index).
# WHAT IT DOES NOT PROVE: anything about other secret-bearing names, or about
# a file already tracked -- an ignore rule never untracks one.
# Outside a git work tree it says it could not run, rather than passing.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  for f in .env .env.local .env.production; do
    if ! git check-ignore -q --no-index "$f"; then
      echo "NOT IGNORED: $f -- a local secret file could be committed (B-053)"
      fail=1
    fi
  done
  if git check-ignore -q --no-index .env.example; then
    echo "IGNORED: .env.example -- git add would skip the tracked template (B-053)"
    fail=1
  fi
else
  echo "SKIPPED: the .env ignore check needs a git work tree (B-053)"
fi

# --------------------------------------------------------------------------
# scripts/worktree.sh `remove` deletes a landed branch and says what it did
# (TASK-0135, B-049).
#
# WHY: it used to run `git branch -d`, which refuses after every documented
# landing, and print "removed ... and branch ..." anyway. A script that claims
# a success it did not achieve is this repo's most-repeated failure shape.
# tests/test-worktree.sh runs the landing in a mktemp repository with a bare
# origin: local git only, no network, about 0.4 s.
# Deliberately unconditional: a deleted test fails here rather than skipping
# quietly (ADR-0009).
if ! WORKTREE_OUT="$(bash tests/test-worktree.sh 2>&1)"; then
  printf '%s\n' "$WORKTREE_OUT" | grep -v '^PASS' | sed 's/^/WORKTREE: /'
  fail=1
fi

# --------------------------------------------------------------------------
# Planning templates are derived from the schemas that own their shape
# (ADR-0027, TASK-0109), so they get the same staleness gate docs/registry.md
# and decision-standard.md already carry. Rendered to a scratch tree and
# compared, never by `git diff`: an untracked file has no diff, so the git
# form passes vacuously for as long as the file stays uncommitted.
#
# WHAT THIS PROVES: every tracked template still matches what its schema
# renders today.
# WHAT IT DOES NOT PROVE: that any schema describes a useful artifact. Shape
# is not content.
if [ -x scripts/sync-templates.sh ]; then
  if ! scripts/sync-templates.sh --check; then
    fail=1
  fi
fi

# --------------------------------------------------------------------------
# project-migration carries a byte-identical copy of the artifact engine and
# its two wrappers, so it can generate and check its own artifacts when
# installed without project-workflow (B-036, TASK-0117).
#
# WHY: the copies are only safe while they ARE copies. One edited in place
# becomes a second owner of how a schema is read -- the defect ADR-0027
# exists to prevent -- and would go unnoticed, because inside this repo every
# caller reaches the owner, never the copy.
#
# HOW: `cmp` of each copy against its owner, in memory. Never `git diff`,
# which passes vacuously on an untracked copy. Deliberately unconditional:
# no `[ -x ]` guard, so a deleted regenerator fails here rather than
# skipping quietly (ADR-0009).
#
# WHAT THIS PROVES: that the three copies are byte-identical to their owners.
# WHAT IT DOES NOT PROVE: that the copies work installed alone. That was
# shown once, by hand, with project-workflow removed (TASK-0117 step 7), and
# nothing here re-runs it.
if ! bash scripts/sync-artifact-engine.sh --check; then
  fail=1
fi

# --------------------------------------------------------------------------
# The migration scaffold emits its four schema-backed templates by READING
# skills/project-migration/templates/, not by carrying its own copy (B-040,
# TASK-0119). The check above proves those files match their schemas; this
# one proves the scaffold still uses them.
#
# Both halves are required and neither implies the other. Re-inlining a
# heredoc would leave the check above passing -- the templates would still be
# correct, they would simply no longer be what a migrated repository gets.
# That is precisely how the original defect survived: the shipped copies here
# were gated and right, while the scaffold's inline TASK.md was missing
# ## Inputs and ## Outputs / handover and still carried the three headings
# ADR-0012 retired, and its REVIEW.md was missing four required sections.
#
# A grep, not a byte comparison, because there is no second artifact to
# compare: the question is which mechanism the script uses. PLAN.md is
# deliberately excluded -- it has no schema in either framework (B-042).
#
# WHAT THIS PROVES: the scaffold reads all four templates from TEMPLATE_DIR
# and carries no heredoc for any of them.
# WHAT IT DOES NOT PROVE: that the scaffold runs, or that what it writes
# lands where a migrated repository expects it. Only running it shows that.
SCAFFOLD=skills/project-migration/scripts/ai-project-scaffold.sh
if [ -r "$SCAFFOLD" ]; then
  for kind in TASK ADR REVIEW SESSION; do
    if ! grep -q "^mkfile \.ai/templates/$kind\.md < \"\$TEMPLATE_DIR/$kind\.md\"" "$SCAFFOLD"; then
      echo "SCAFFOLD: $SCAFFOLD does not emit .ai/templates/$kind.md by reading"
      echo "SCAFFOLD: \$TEMPLATE_DIR/$kind.md — shape is owned by"
      echo "SCAFFOLD: skills/project-migration/schemas/, not by this script (ADR-0027)"
      fail=1
    fi
    if grep -q "^mkfile \.ai/templates/$kind\.md <<" "$SCAFFOLD"; then
      echo "SCAFFOLD: $SCAFFOLD carries an inline heredoc for $kind.md — that is"
      echo "SCAFFOLD: a second owner of artifact shape (ADR-0027, B-040)"
      fail=1
    fi
  done
  for kind in TASK ADR REVIEW SESSION; do
    if [ ! -r "skills/project-migration/templates/$kind.md" ]; then
      echo "SCAFFOLD: skills/project-migration/templates/$kind.md is missing —"
      echo "SCAFFOLD: run scripts/sync-templates.sh and commit the result"
      fail=1
    fi
  done
  # The closing report must not send the author back to `cp`, which
  # SKILL.md's hard rules forbid: "Generate planning artifacts; do not copy a
  # template and imitate it."
  if grep -q 'cp \.ai/templates/' "$SCAFFOLD"; then
    echo "SCAFFOLD: $SCAFFOLD tells the author to cp a template; SKILL.md's"
    echo "SCAFFOLD: hard rules require generating the artifact instead"
    fail=1
  fi
fi

# --------------------------------------------------------------------------
# Task briefs match the schema that owns their shape. Delegated to the skill's
# own checker rather than reimplemented here, so the heading list has exactly
# one owner (ADR-0027); a copy in this file would be the second owner the
# schema exists to remove.
#
# THE BOUNDARY IS REQUIRED, and for the same reason FIRST_CONTRACT_TASK = 20
# above carries one: the 105 briefs written before the schema existed are
# records of what happened, not instances of it. 23 of them carry a
# `## Preconditions` heading superseded by ADR-0012, and rewriting them to
# satisfy a rule invented afterwards would fabricate compliance. Raising this
# number is how a future convention change is absorbed; lowering it is how
# history gets falsified.
#
# WHAT THIS PROVES: that briefs from TASK-0109 onward carry the schema's
# required headings, in its order, with no generator markers left behind.
# WHAT IT DOES NOT PROVE: that a word of any of them is true.
# Boundary applies to TASK BRIEFS ONLY. ADRs, reviews and sessions carry no
# boundary because none is needed: at the time this gate was added every one
# of 27 ADRs, 30 sessions and 12 reviews already matched its schema, so there
# is no pre-convention population to exempt (TASK-0110, measured 2026-09-27).
FIRST_GENERATED_TASK=24
SCHEMA_DIR=skills/project-migration/schemas
ARTIFACT_LIB=skills/project-workflow/scripts/artifact_lib.py
if [ -d "$SCHEMA_DIR" ] && [ -r "$ARTIFACT_LIB" ]; then
  groups=""
  add_group() {  # $1 = kind, $2 = artifact path
    [ -r "$SCHEMA_DIR/$1.md" ] || return 0
    groups="$groups$SCHEMA_DIR/$1.md	$2
"
  }

  # Briefs below the boundary are exempt, for the reason FIRST_CONTRACT_TASK
  # states above: they are records of what happened, not instances of a schema
  # invented afterwards, and rewriting them would fabricate compliance.
  # Raising this number absorbs a future convention change. LOWERING it
  # falsifies history -- TASK-0110 lowered it to 24 only after repairing every
  # brief it newly covered, and deliberately stopped at the 23 ADR-0012 exempts.
  for brief in .ai/tasks/TASK-*.md; do
    [ -e "$brief" ] || continue
    num="$(basename "$brief" | sed -n 's/^TASK-0*\([0-9]\{1,\}\).*/\1/p')"
    [ -n "$num" ] || continue
    [ "$num" -ge "$FIRST_GENERATED_TASK" ] || continue
    add_group task "$brief"
  done

  # INDEX.md is an index over these directories, not an instance of any
  # schema -- the same distinction that keeps 20.PLAN.md out of the
  # generator's targets.
  for f in .ai/decisions/*.md; do
    [ -e "$f" ] && [ "$(basename "$f")" != "INDEX.md" ] && add_group adr "$f"
  done
  # REVIEW-0012 is exempt BY NAME, and the name is the honest form here: a
  # numeric boundary would claim "reviews before N predate the schema" when
  # eleven of the twelve match it exactly, in byte-identical section order.
  # REVIEW-0012 alone uses `## Closing`/`## Follow-ups` and orders them
  # differently. Making it pass needs its sections relocated, and a review is
  # a point-in-time snapshot that is written once and not edited retroactively
  # -- the rule the review schemas state, so honouring the schema here means
  # NOT rewriting the artifact to satisfy it. Human-authorized 2026-09-27
  # (TASK-0110). If a second review ever needs this, it is drift, not an
  # outlier, and the answer is to fix the review.
  for f in .ai/reviews/*.md; do
    [ -e "$f" ] || continue
    case "$(basename "$f")" in
      INDEX.md) continue ;;
      REVIEW-0012-*) continue ;;
    esac
    add_group review "$f"
  done
  for f in .ai/sessions/*.md; do
    [ -e "$f" ] && [ "$(basename "$f")" != "INDEX.md" ] && add_group session "$f"
  done

  # One interpreter for all four kinds: each schema is parsed once however
  # many artifacts cite it.
  if [ -n "$groups" ]; then
    ARTIFACT_GROUPS="$groups" python3 "$ARTIFACT_LIB" check-groups || fail=1
  fi
fi

[ $fail -eq 0 ] && echo "validate.sh: OK"
exit $fail
