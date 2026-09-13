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
fi

[ $fail -eq 0 ] && echo "validate.sh: OK"
exit $fail
