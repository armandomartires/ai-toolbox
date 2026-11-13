#!/usr/bin/env bash
# test-emit-tiers.sh — prove emit_claude_code in scripts/emit-agents.py writes
# the alias from the model-tiers table (.ai/context/ or, in the ADR-0066 layout, docs/development/) for each role, and `inherit` for a
# role the table does not list (TASK-0268, ADR-0059).
#
# Hermetic: reads the repo, writes only inside a temp directory it removes.
# The expected values below are the D3 table, written out here on purpose: the
# test fails if the table file and the decision drift apart.
set -euo pipefail
cd "$(dirname "$0")/.."

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT

python3 scripts/emit-agents.py claude-code "$T" >/dev/null

python3 - "$T" <<'PY'
import importlib.util, os, re, sys
out = sys.argv[1]
D3 = {}
for tier, roles in (
    ("opus", "adjudicator critic designer-manager refuter task-planner"),
    ("sonnet", "git-ops ideator implementer qa-test review"),
    ("haiku", "closer gate-runner park-steward preflight run-scribe")):
    for r in roles.split():
        D3[r] = tier
VALID = {"opus", "sonnet", "haiku", "inherit"}
FULL_ID = re.compile(r"^claude-[a-z0-9.-]+$")
fail = 0
def check(name, ok):
    global fail
    print(("ok   " if ok else "FAIL ") + name)
    if not ok:
        fail = 1

spec = importlib.util.spec_from_file_location("emit_agents", "scripts/emit-agents.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def model_of(text):
    m = re.search(r"^model: (.+)$", text, re.M)
    return m.group(1).strip() if m else None

check("the table covers the 15 roles in agents/", sorted(mod.known_roles()) == sorted(D3))
for role, tier in sorted(D3.items()):
    text = mod.emit_claude_code(role, {"capabilities": [], "description": "x"}, "body")
    check("%s -> %s" % (role, tier), model_of(text) == tier)
unlisted = mod.emit_claude_code("no-such-role", {"capabilities": [], "description": "x"}, "body")
check("an unlisted role emits inherit", model_of(unlisted) == "inherit")

files = sorted(f for f in os.listdir(out) if f.endswith(".md"))
check("claude-code emission wrote agent files", len(files) > 0)
for f in files:
    text = open(os.path.join(out, f), encoding="utf-8").read()
    m = model_of(text)
    role = f[:-3]
    check("emitted %s carries its table value" % role, m == D3.get(role, "inherit"))
    check("emitted %s model is valid" % role, m in VALID or bool(m and FULL_ID.match(m)))
    check("emitted %s has no {tier: placeholder" % role, "{tier:" not in text)

sys.exit(fail)
PY
echo "test-emit-tiers.sh: OK"
