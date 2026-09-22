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
    "worktree-only", "test-files-only", "bash-allowlist", "no-force-push",
    "push-requires-confirmation", "webfetch-requires-confirmation",
}
MODES = {"primary", "subagent"}
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

# bash-allowlist is the second parameterised term, same shape as the first:
# the set it permits lives in its own key. Without it the emitter cannot say
# WHICH commands, and an allowlist that names nothing is not an allowlist.
bash_allow = seq("bash_allow")
has_bash_allowlist = bool(caps) and "bash-allowlist" in caps
if has_bash_allowlist:
    if bash_allow is None:
        bad.append("capability 'bash-allowlist' requires a 'bash_allow' "
                   "block list naming the command patterns it may run "
                   "(one quoted '- pattern' per line; inline [a, b] form is "
                   "not read)")
    elif not bash_allow:
        bad.append("key 'bash_allow' is empty — an allowlist that permits "
                   "nothing denies everything, which is not what this term "
                   "means")
elif bash_allow is not None:
    bad.append("key 'bash_allow' is present without capability "
               "'bash-allowlist' — it would have no effect")

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

[ $fail -eq 0 ] && echo "validate.sh: OK"
exit $fail
