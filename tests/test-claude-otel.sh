#!/usr/bin/env bash
# Offline check of the Claude Code telemetry settings (TASK-0279, P1.9, R-10).
# configs/claude-code/settings.otel.json must turn telemetry on, export metrics
# over OTLP, point at a collector with no credential in the file, and must not
# turn on prompt logging or carry a header/token. The live proof (a collector
# receives claude_code metrics) is tests/otel/claude-code-check.sh, in CI.
#
# Red proof: delete CLAUDE_CODE_ENABLE_TELEMETRY from the file (or pass another
# file as $1) and the first case FAILs.
set -uo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
f="${1:-$here/configs/claude-code/settings.otel.json}"
rc=0
python3 -I - "$f" <<'PY' || rc=1
import json, re, sys
try:
    env = json.load(open(sys.argv[1], encoding="utf-8"))["env"]
except Exception as e:
    print(f"FAIL cannot read an env block from {sys.argv[1]}: {e}"); sys.exit(1)
bad = 0
def chk(ok, msg):
    global bad
    print(("PASS " if ok else "FAIL ") + msg)
    bad |= (not ok)
chk(env.get("CLAUDE_CODE_ENABLE_TELEMETRY") == "1", "CLAUDE_CODE_ENABLE_TELEMETRY is 1")
chk("otlp" in env.get("OTEL_METRICS_EXPORTER", "").split(","), "OTEL_METRICS_EXPORTER includes otlp")
from urllib.parse import urlparse
chk(urlparse(env.get("OTEL_EXPORTER_OTLP_ENDPOINT", "")).hostname in ("localhost", "127.0.0.1"),
    "endpoint is a local placeholder, never a real host")
chk("OTEL_LOG_USER_PROMPTS" not in env or env["OTEL_LOG_USER_PROMPTS"] in ("", "0"),
    "prompt logging is not enabled")
chk("otlp" not in env.get("OTEL_LOGS_EXPORTER", "").split(","), "no logs/events exporter (events carry prompt metadata)")
chk(not any(re.search(r"HEADERS|TOKEN|SECRET|KEY|PASSWORD|AUTH", k) for k in env), "no credential-bearing variable")
sys.exit(bad)
PY
exit $rc
