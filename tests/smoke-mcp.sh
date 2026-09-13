#!/usr/bin/env bash
# Smoke-test external MCP servers: launch each one and confirm it actually
# speaks MCP, by performing a real JSON-RPC `initialize` handshake over
# stdio and asserting on the reply.
#
# Usage: smoke-mcp.sh [--server <name>] [--timeout <seconds>]
#
# This is NOT part of tests/validate.sh and must not be folded into it:
# validate.sh is the mandatory gate in AGENTS.md's Definition of done and
# is fast, offline and hermetic (~0.4s). This script needs the network,
# because `npx -y` / `uvx` fetch upstream packages, and takes tens of
# seconds. Making the mandatory gate network-dependent would make every
# task's validation slow and flaky for reasons unrelated to the repo's
# correctness.
#
# Outcomes are three, never two:
#   PASS - server started and returned a well-formed initialize result
#   FAIL - server started but did not speak MCP correctly (a real defect)
#   SKIP - could not attempt (missing runtime, no network). NOT a pass.
#
# Exit codes: 0 = no failures (all PASS, or PASS+SKIP)
#             1 = at least one FAIL
#             2 = usage error / unknown server
#
# Only `initialize` is sent. Tools are never invoked: ansible's surface
# includes playbook execution and OS package installation, and a smoke
# test must never be the thing that runs a playbook.
set -uo pipefail
cd "$(dirname "$0")/.."

TIMEOUT=90
WANT_SERVER=""
while [ $# -gt 0 ]; do
  case "$1" in
    --server)   shift; WANT_SERVER="${1:-}" ;;
    --server=*) WANT_SERVER="${1#*=}" ;;
    --timeout)   shift; TIMEOUT="${1:-90}" ;;
    --timeout=*) TIMEOUT="${1#*=}" ;;
    -h|--help) sed -n '2,29p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

command -v python3 >/dev/null 2>&1 || { echo "MISSING prerequisite: python3" >&2; exit 2; }

pass=0; failed=0; skipped=0; matched=0

for d in mcp-servers/*/; do
  d="${d%/}"
  name=$(basename "$d")
  case "$name" in _template*) continue ;; esac
  [ -f "$d/server.json" ] || continue   # authored Python servers: none yet
  if [ -n "$WANT_SERVER" ] && [ "$name" != "$WANT_SERVER" ]; then continue; fi
  matched=$((matched + 1))

  # The launch command, its transport, and the env it needs all come from
  # the manifest - nothing about this server is hard-coded here.
  transport=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["launch"].get("transport",""))' "$d/server.json")
  if [ "$transport" != "stdio" ]; then
    echo "SKIP $name: transport '$transport' not supported by this harness (stdio only)"
    skipped=$((skipped + 1))
    continue
  fi

  # Runtime presence check, so a missing interpreter is a SKIP (cannot
  # attempt) rather than a FAIL (server is broken).
  cmd0=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["launch"]["command"][0])' "$d/server.json")
  if ! command -v "$cmd0" >/dev/null 2>&1; then
    echo "SKIP $name: launcher '$cmd0' not on PATH"
    skipped=$((skipped + 1))
    continue
  fi

  echo "--- $name: initialize handshake (timeout ${TIMEOUT}s)"
  out=$(python3 - "$d/server.json" "$TIMEOUT" <<'PY'
import json, os, subprocess, sys

manifest, timeout = sys.argv[1], int(sys.argv[2])
m = json.load(open(manifest))
cmd = m["launch"]["command"]

env = dict(os.environ)
missing = []
for var, spec in (m.get("environment") or {}).items():
    if not spec.get("required"):
        continue
    if env.get(var):
        continue
    # Required-but-unset: supply the repo root for a workspace-style
    # variable so the handshake can proceed, and say so. Anything else is
    # unknowable from here, so report it rather than guessing.
    if "WORKSPACE" in var or "ROOT" in var or "DIR" in var:
        env[var] = os.getcwd()
        print("note: %s unset; using repo root for the handshake" % var,
              file=sys.stderr)
    else:
        missing.append(var)
if missing:
    print("SKIPREASON required env unset: " + ", ".join(sorted(missing)))
    sys.exit(0)

req = {"jsonrpc": "2.0", "id": 1, "method": "initialize",
       "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                  "clientInfo": {"name": "ai-toolbox-smoke", "version": "1"}}}

try:
    proc = subprocess.run(
        cmd, input=json.dumps(req) + "\n", capture_output=True,
        text=True, timeout=timeout, env=env)
except subprocess.TimeoutExpired:
    print("FAILREASON no reply within %ss (server hung or never spoke)" % timeout)
    sys.exit(0)
except (FileNotFoundError, PermissionError) as exc:
    print("SKIPREASON cannot launch: %s" % exc)
    sys.exit(0)

stdout = proc.stdout or ""
if not stdout.strip():
    tail = " ".join((proc.stderr or "").split())[-200:]
    print("FAILREASON no stdout (exit %s)%s"
          % (proc.returncode, "; stderr: " + tail if tail else ""))
    sys.exit(0)

# A server may emit banners before its JSON-RPC reply; scan for the first
# line that parses as the response to our request.
reply = None
for line in stdout.splitlines():
    line = line.strip()
    if not line:
        continue
    try:
        obj = json.loads(line)
    except json.JSONDecodeError:
        continue
    if isinstance(obj, dict) and obj.get("id") == 1:
        reply = obj
        break

if reply is None:
    first = " ".join(stdout.split())[:200]
    print("FAILREASON no JSON-RPC reply with id=1 on stdout; got: %s" % first)
    sys.exit(0)
if "error" in reply:
    print("FAILREASON server returned an error: %s" % json.dumps(reply["error"])[:200])
    sys.exit(0)

res = reply.get("result")
if not isinstance(res, dict):
    print("FAILREASON reply has no result object")
    sys.exit(0)
for key in ("protocolVersion", "serverInfo"):
    if key not in res:
        print("FAILREASON result missing '%s'" % key)
        sys.exit(0)
si = res["serverInfo"]
if not isinstance(si, dict) or not si.get("name"):
    print("FAILREASON serverInfo.name missing or empty")
    sys.exit(0)

caps = ", ".join(sorted((res.get("capabilities") or {}).keys())) or "none"
print("PASSREASON serverInfo.name=%s version=%s protocol=%s capabilities=%s"
      % (si["name"], si.get("version", "?"), res["protocolVersion"], caps))
PY
)
  rc=$?
  if [ $rc -ne 0 ]; then
    echo "FAIL $name: harness error (python3 exited $rc)"
    failed=$((failed + 1))
    continue
  fi

  case "$out" in
    PASSREASON*) echo "PASS $name: ${out#PASSREASON }"; pass=$((pass + 1)) ;;
    FAILREASON*) echo "FAIL $name: ${out#FAILREASON }"; failed=$((failed + 1)) ;;
    SKIPREASON*) echo "SKIP $name: ${out#SKIPREASON }"; skipped=$((skipped + 1)) ;;
    *)           echo "FAIL $name: unrecognized harness output: $out"
                 failed=$((failed + 1)) ;;
  esac
done

if [ -n "$WANT_SERVER" ] && [ "$matched" -eq 0 ]; then
  echo "unknown server: $WANT_SERVER (no mcp-servers/$WANT_SERVER/server.json)" >&2
  exit 2
fi

echo
echo "smoke-mcp.sh: ${pass} passed, ${failed} failed, ${skipped} skipped"
[ "$skipped" -gt 0 ] && echo "note: SKIP is not a pass - the check did not run."
[ "$failed" -eq 0 ] || exit 1
exit 0
