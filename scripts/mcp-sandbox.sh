#!/usr/bin/env bash
# Run a pinned external MCP server in a container with only its declared
# egress (issue #7). stdio passes through, so a client wires THIS script in
# place of `npx -y ...`:
#
#   scripts/mcp-sandbox.sh <server> [--print] [-- extra server args]
#
# The image gets: the lockfile install (npm ci, integrity-verified) mounted
# read-only, the current directory as /work, a read-only root, no
# capabilities, no-new-privileges and --network none. An egress.allow list
# that is not empty is REFUSED: allowlisted egress needs a filtering proxy
# this repo does not ship yet, and silently granting full network would be
# worse than failing. Requires docker or podman (MCP_SANDBOX_ENGINE).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
name="${1:?usage: mcp-sandbox.sh <server> [--print] [-- args]}"; shift
print=0
if [ "${1:-}" = "--print" ]; then print=1; shift; fi
[ "${1:-}" = "--" ] && shift
dir="$here/mcp-servers/$name"
[ -f "$dir/server.json" ] || { echo "mcp-sandbox: no manifest $dir/server.json" >&2; exit 2; }
mapfile -t spec < <(python3 - "$dir/server.json" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))
pl, eg = m.get("pinned_launch"), m.get("egress")
if not pl or eg is None:
    sys.exit("mcp-sandbox: %s has no pinned_launch/egress (issue #7)" % m["name"])
if eg.get("allow"):
    sys.exit("mcp-sandbox: %s declares egress %s; allowlisted egress needs a proxy that is not implemented - refusing rather than granting full network" % (m["name"], eg["allow"]))
print(pl["cwd"])
for a in pl["command"]:
    print(a)
PY
)
lock="$dir/${spec[0]}"
cmd=("${spec[@]:1}")
[ -d "$lock/node_modules" ] || [ $print -eq 1 ] || { echo "mcp-sandbox: run 'npm ci --ignore-scripts' in $lock first" >&2; exit 2; }
engine="${MCP_SANDBOX_ENGINE:-docker}"
image="${MCP_SANDBOX_IMAGE:-node:22-bookworm-slim}"
argv=("$engine" run --rm -i --network none --read-only --cap-drop ALL
      --security-opt no-new-privileges --tmpfs /tmp
      --user "$(id -u):$(id -g)"
      -v "$lock:/srv/mcp:ro" -v "$PWD:/work" -w /work)
# Pass through only the variables the manifest declares, by name.
while read -r var; do
  [ -n "$var" ] && [ -n "${!var:-}" ] && argv+=(-e "$var")
done < <(python3 -c 'import json,sys;[print(k) for k in json.load(open(sys.argv[1])).get("environment",{})]' "$dir/server.json")
argv+=("$image" "/srv/mcp/${cmd[0]}" "${cmd[@]:1}" "$@")
if [ $print -eq 1 ]; then printf '%s\n' "${argv[@]}"; exit 0; fi
exec "${argv[@]}"
