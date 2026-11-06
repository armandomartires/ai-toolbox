#!/usr/bin/env bash
# Issue #14: start a real OpenTelemetry Collector, run one gate through the
# gates server with OTEL_EXPORTER_OTLP_ENDPOINT pointing at it, and require
# the `execute_tool` spans in the collector's own output. Needs network once,
# to download the pinned collector.
set -euo pipefail
V="${OTELCOL_VERSION:-0.164.0}"
SHA="${OTELCOL_SHA256:-5db7cf88c2e73a7fdce02b5fa967fcd5dc73bab00b871d947481918dc5093861}"
here="$(cd "$(dirname "$0")/../.." && pwd)"
work="$(mktemp -d)"
trap 'kill "${pid:-0}" 2>/dev/null || true; rm -rf "$work"' EXIT
curl -sSfL -o "$work/otelcol.tgz" "https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v$V/otelcol_${V}_linux_amd64.tar.gz"
echo "$SHA  $work/otelcol.tgz" | sha256sum -c -
tar xzf "$work/otelcol.tgz" -C "$work" otelcol
"$work/otelcol" --config "$here/tests/otel/collector.yaml" >"$work/collector.log" 2>&1 &
pid=$!
for _ in $(seq 40); do grep -q "Everything is ready" "$work/collector.log" && break; sleep 0.5; done
cd "$here/mcp-servers/gates"
# Issue #6 (!13): hash-pinned map and allowlist. GATES_SANDBOX=none because
# this job's container cannot create user namespaces; the sandbox itself is
# tested by gates-sandbox.
GATES_MAP_SHA256="$(sha256sum tests/fixtures/gates.json | cut -d' ' -f1)" \
GATES_ALLOWED_EXECUTABLES=sh,false GATES_ALLOWED_LAUNCHERS=sh GATES_SANDBOX=none \
GATES_MAP=tests/fixtures/gates.json GATES_RUN_ROOT="$work/run" GATES_REPO_ROOT="$work" \
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318 OTEL_SERVICE_NAME=gates-ci \
  uv run --extra otel python - <<'PY'
import asyncio
from gates import server, telemetry
h = server.start_gate("ok")["handle"]
print(asyncio.run(server.wait_gate(h, 30))["line"])
telemetry.flush()
PY
sleep 2
for want in "execute_tool start_gate" "execute_tool wait_gate" "gen_ai.operation.name: Str(execute_tool)" "gates.state: Str(PASSED)" "service.name: Str(gates-ci)"; do
  if ! grep -qF "$want" "$work/collector.log"; then
    echo "OTEL: the collector did not receive: $want"; cat "$work/collector.log"; exit 1
  fi
done
echo "OTEL: spans visible in the collector:"; grep -E "Name +: execute_tool" "$work/collector.log"
