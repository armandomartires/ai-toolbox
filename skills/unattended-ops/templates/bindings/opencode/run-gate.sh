#!/usr/bin/env bash
# run-gate.sh — the one detaching gate entry point for the OpenCode binding.
#
# Usage:
#   run-gate.sh start  <handle> <gate>   launch <gate> from the map, detached
#   run-gate.sh wait   <handle> [secs]   block at most [secs] (default 60)
#   run-gate.sh status <handle>          report without waiting
#   run-gate.sh kill   <handle>          stop the gate's own process group
#
# THIS IS A TEMPLATE. It implements rule 3 of skills/unattended-ops/
# (references/long-gates.md): one choke point, a watchdog that owns the
# timeout, bounded polling, and evidence written where the gate runs. It is
# the generalised interface of asset-management's Invoke-Gate.ps1 (A119), and
# its name is the convention agents/gate-runner/ allowlists (`*run-gate.sh*`).
#
# Every action prints exactly one summary line:
#
#     GATE <handle> NAME=<gate> STATE=<state> EXIT=<n> ELAPSED=<s>s LOG=<path>
#
# STATE is RUNNING, PASSED, FAILED, SKIPPED, TIMEOUT, KILLED or MISSING —
# PASS, FAIL and SKIP kept distinct (references/gate-map.md, rule D). Exit
# codes are the caller's loop control: 0 passed, 1 finished but not green,
# 2 still running, 3 no such gate or handle.
#
# Environment, set by the driver and never by an agent:
#   GATE_MAP              JSON gate map (the binding's `gate_map` slot)
#   GATE_REPO_ROOT        root that a map entry's `cwd` is relative to
#   GATE_RUN_ROOT         where per-handle state and logs are kept
#   EVIDENCE_FILE         the run's evidence file; one line per finished gate
#   GATE_TIMEOUT_SECONDS  the watchdog default (the `watchdog_timeout` slot)
#
# NO SHELL BETWEEN THE MAP AND THE COMMAND. A map entry's `argv` is a JSON
# list handed to exec as-is, never joined into a string: quoting through a
# shell is where Invoke-Gate.ps1's first cut broke on a path with a space.
#
# KILL SCOPE. The command runs in its own session; `kill` and the watchdog
# signal that process group and nothing else. Nothing is ever killed by name.
# A grandchild that calls setsid itself escapes the group — a stated limit,
# not a handled case.
#
# NOT run from tests/validate.sh. Its tests live beside it, under tests/, and
# nothing in this repository runs them automatically.
set -euo pipefail

usage() {
  sed -n '4,8p' "$0" | sed 's/^# \{0,1\}//'
  exit 3
}

action="${1:-}"
handle="${2:-}"
case "$action" in
  start|wait|status|kill|_watchdog) ;;
  *) usage ;;
esac
[[ "$handle" =~ ^[A-Za-z0-9._-]+$ ]] || {
  echo "GATE ${handle:-?} NAME=? STATE=MISSING EXIT=-1 ELAPSED=0s LOG=- (bad handle)"
  exit 3
}
: "${GATE_RUN_ROOT:?GATE_RUN_ROOT is not set}"
dir="$GATE_RUN_ROOT/gates/$handle"

field() { cat "$dir/$1" 2>/dev/null || printf '%s' "$2"; }

summary() {
  local state name code started finished elapsed
  state=$(field state MISSING)
  name=$(field name '?')
  code=$(field exit -1)
  started=$(field started 0)
  finished=$(field finished "$(date +%s)")
  if [ "$started" = 0 ]; then elapsed=0; else elapsed=$((finished - started)); fi
  echo "GATE $handle NAME=$name STATE=$state EXIT=$code ELAPSED=${elapsed}s LOG=$dir/log"
  case "$state" in
    PASSED) return 0 ;;
    RUNNING) return 2 ;;
    MISSING) return 3 ;;
    *) return 1 ;;
  esac
}

terminal() {
  case "$(field state MISSING)" in
    RUNNING) return 1 ;;
    *) return 0 ;;
  esac
}

case "$action" in
  start)
    gate="${3:-}"
    : "${GATE_MAP:?GATE_MAP is not set}"
    : "${GATE_REPO_ROOT:?GATE_REPO_ROOT is not set}"
    : "${EVIDENCE_FILE:?EVIDENCE_FILE is not set}"
    if [ -d "$dir" ]; then
      # Idempotent: a handle is started once; a second start reports it.
      summary && exit 0 || exit $?
    fi
    mkdir -p "$dir"
    printf '%s' "$gate" > "$dir/name"
    if ! python3 - "$GATE_MAP" "$gate" "$dir/spec.json" <<'PY'
import json, sys
path, gate, out = sys.argv[1:4]
with open(path, encoding="utf-8") as fh:
    entry = json.load(fh).get("gates", {}).get(gate)
if not isinstance(entry, dict):
    sys.exit(3)
argv = entry.get("argv")
if not (isinstance(argv, list) and argv and all(isinstance(a, str) for a in argv)):
    sys.exit(3)
spec = {"argv": argv, "cwd": entry.get("cwd", "."),
        "timeout_seconds": entry.get("timeout_seconds"),
        "skip_exit": entry.get("skip_exit")}
with open(out, "w", encoding="utf-8") as fh:
    json.dump(spec, fh)
PY
    then
      echo MISSING > "$dir/state"
      summary || exit $?
    fi
    date +%s > "$dir/started"
    echo RUNNING > "$dir/state"
    setsid "$0" _watchdog "$handle" </dev/null >/dev/null 2>&1 &
    summary || exit $?
    ;;

  _watchdog)
    spec="$dir/spec.json"
    mapfile -d '' argv < <(python3 -c 'import json,sys
for a in json.load(open(sys.argv[1]))["argv"]: sys.stdout.write(a + "\0")' "$spec")
    read -r cwd limit skip < <(python3 -c 'import json,os,sys
s = json.load(open(sys.argv[1]))
print(s["cwd"], s["timeout_seconds"] or os.environ["GATE_TIMEOUT_SECONDS"],
      "" if s["skip_exit"] is None else s["skip_exit"])' "$spec")
    cd "$GATE_REPO_ROOT/$cwd"
    set +e
    setsid "${argv[@]}" >"$dir/log" 2>&1 </dev/null &
    cpid=$!
    echo "$cpid" > "$dir/pgid"
    start=$(cat "$dir/started")
    while kill -0 "$cpid" 2>/dev/null; do
      if [ $(( $(date +%s) - start )) -ge "$limit" ]; then
        touch "$dir/timed-out"
        kill -TERM -- "-$cpid" 2>/dev/null
        for _ in 1 2 3 4 5; do kill -0 "$cpid" 2>/dev/null || break; sleep 1; done
        kill -KILL -- "-$cpid" 2>/dev/null
        break
      fi
      sleep 1
    done
    wait "$cpid"
    rc=$?
    set -e
    date +%s > "$dir/finished"
    echo "$rc" > "$dir/exit"
    if [ -e "$dir/killed" ]; then state=KILLED
    elif [ -e "$dir/timed-out" ]; then state=TIMEOUT
    elif [ "$rc" -eq 0 ]; then state=PASSED
    elif [ -n "$skip" ] && [ "$rc" -eq "$skip" ]; then state=SKIPPED
    else state=FAILED
    fi
    echo "$state" > "$dir/state.tmp" && mv "$dir/state.tmp" "$dir/state"
    summary >> "$EVIDENCE_FILE" || true
    ;;

  wait)
    max="${3:-60}"
    waited=0
    while ! terminal && [ "$waited" -lt "$max" ]; do
      sleep 1
      waited=$((waited + 1))
    done
    summary || exit $?
    ;;

  status)
    summary || exit $?
    ;;

  kill)
    # The watchdog records the group a moment after `start` returns; a kill
    # issued in that window waits for it rather than silently doing nothing.
    waited=0
    while [ ! -f "$dir/pgid" ] && ! terminal && [ "$waited" -lt 10 ]; do
      sleep 1
      waited=$((waited + 1))
    done
    if [ -f "$dir/pgid" ] && ! terminal; then
      touch "$dir/killed"
      kill -TERM -- "-$(cat "$dir/pgid")" 2>/dev/null || true
      waited=0
      while ! terminal && [ "$waited" -lt 15 ]; do sleep 1; waited=$((waited + 1)); done
    fi
    summary || exit $?
    ;;
esac
