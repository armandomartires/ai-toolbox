#!/usr/bin/env bash
# test-emit-turns.sh — prove emit_claude_code in scripts/emit-agents.py writes
# `maxTurns` (and `autoCompactWindow` where set) from
# docs/development/turn-limits.md for every role, and nothing for a role the table
# does not list (TASK-0282).
#
# Hermetic: reads the repo, writes only inside a temp directory it removes.
# The last case runs the emitter from a copy of the repo with the table
# removed, and expects every emitted file to lose `maxTurns`: that is the
# "revert the emitter change and see it fail" check, kept in the test.
set -euo pipefail
cd "$(dirname "$0")/.."

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT

python3 scripts/emit-agents.py claude-code "$T/out" >/dev/null

python3 - "$T" <<'PY'
import importlib.util, os, re, shutil, subprocess, sys
tmp = sys.argv[1]
out = os.path.join(tmp, "out")
fail = 0
def check(name, ok):
    global fail
    print(("ok   " if ok else "FAIL ") + name)
    if not ok:
        fail = 1

spec = importlib.util.spec_from_file_location("emit_agents", "scripts/emit-agents.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

table = {}
# The table is where the emitter reads it, docs/development/turn-limits.md; the test follows it.
TABLE = mod.TURN_TABLE
for line in open(TABLE, encoding="utf-8"):
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) == 3 and re.fullmatch(r"[a-z][a-z-]*", cells[0]):
        table[cells[0]] = (cells[1], cells[2])

def key(text, k):
    fm = text.split("\n---\n", 1)[0]
    m = re.search(r"^%s: (.+)$" % k, fm, re.M)
    return m.group(1).strip() if m else None

check("the table covers every role in agents/", sorted(mod.known_roles()) == sorted(table))
for role, (turns, window) in sorted(table.items()):
    check("%s: maxTurns is a positive integer" % role, bool(re.fullmatch(r"[1-9][0-9]*", turns)))
    check("%s: autoCompactWindow is - or 100000..1000000" % role,
          window == "-" or (window.isdigit() and 100000 <= int(window) <= 1000000))
    text = mod.emit_claude_code(role, {"capabilities": [], "description": "x"}, "body")
    check("%s -> maxTurns %s" % (role, turns), key(text, "maxTurns") == turns)
    check("%s -> autoCompactWindow %s" % (role, window),
          key(text, "autoCompactWindow") == (None if window == "-" else window))
unlisted = mod.emit_claude_code("no-such-role", {"capabilities": [], "description": "x"}, "body")
check("an unlisted role emits no maxTurns", key(unlisted, "maxTurns") is None)

files = sorted(f for f in os.listdir(out) if f.endswith(".md"))
check("claude-code emission wrote agent files", len(files) > 0)
for f in files:
    text = open(os.path.join(out, f), encoding="utf-8").read()
    check("emitted %s carries maxTurns" % f[:-3], key(text, "maxTurns") == table[f[:-3]][0])

# A bad cell fails loudly instead of emitting a key Claude Code would drop.
mod.TURN_TABLE = os.path.join(tmp, "bad.md")
with open(mod.TURN_TABLE, "w", encoding="utf-8") as fh:
    fh.write("| implementer | 250 | 200k |\n")
try:
    mod.emit_claude_code("implementer", {"capabilities": [], "description": "x"}, "body")
    check("a 200k autoCompactWindow is refused", False)
except ValueError:
    check("a 200k autoCompactWindow is refused", True)

# Without the table, emission carries no maxTurns: the check above would fail.
copy = os.path.join(tmp, "repo")
for d in ("agents", "scripts", os.path.dirname(TABLE)):
    shutil.copytree(d, os.path.join(copy, d), dirs_exist_ok=True)
os.remove(os.path.join(copy, TABLE))
subprocess.run([sys.executable, "scripts/emit-agents.py", "claude-code", os.path.join(tmp, "bare")],
               cwd=copy, check=True, capture_output=True)
bare = [open(os.path.join(tmp, "bare", f), encoding="utf-8").read()
        for f in os.listdir(os.path.join(tmp, "bare"))]
check("without the table no emitted agent carries maxTurns",
      bool(bare) and all(key(t, "maxTurns") is None for t in bare))

sys.exit(fail)
PY
echo "test-emit-turns.sh: OK"
