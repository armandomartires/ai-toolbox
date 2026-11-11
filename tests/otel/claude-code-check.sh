#!/usr/bin/env bash
# TASK-0279 (P1.9, R-10): the collector receives `claude_code` metrics when the
# shipped settings (configs/claude-code/settings.otel.json) are applied, and no
# prompt text. Starts the same pinned collector as collector-check.sh and drives
# it with tests/otel/claude_code_replay.py (no Claude Code binary or login is
# available offline or in CI; the replay behaves as the client does with the
# shipped env). Needs network once, to download the pinned collector.
#
# Red proofs: remove the flag from the settings, or run with
# CLAUDE_OTEL_DROP=CLAUDE_CODE_ENABLE_TELEMETRY, and this script exits 1.
set -euo pipefail
V="${OTELCOL_VERSION:-0.164.0}"
SHA="${OTELCOL_SHA256:-5db7cf88c2e73a7fdce02b5fa967fcd5dc73bab00b871d947481918dc5093861}"
here="$(cd "$(dirname "$0")/../.." && pwd)"
settings="${CLAUDE_OTEL_SETTINGS:-$here/configs/claude-code/settings.otel.json}"
work="$(mktemp -d)"
trap 'rc=$?; [ -n "${pid:-}" ] && { kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; }; rm -rf "$work"; exit $rc' EXIT
curl -sSfL -o "$work/otelcol.tgz" "https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v$V/otelcol_${V}_linux_amd64.tar.gz"
echo "$SHA  $work/otelcol.tgz" | sha256sum -c -
tar xzf "$work/otelcol.tgz" -C "$work" otelcol
"$work/otelcol" --config "$here/tests/otel/collector.yaml" >"$work/collector.log" 2>&1 &
pid=$!
ready=0
for _ in $(seq 40); do grep -q "Everything is ready" "$work/collector.log" && { ready=1; break; }; sleep 0.5; done
[ "$ready" = 1 ] || { echo "OTEL: the collector never became ready"; cat "$work/collector.log"; exit 1; }

replay() { OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318 python3 -I "$here/tests/otel/claude_code_replay.py" "$settings" "$1"; }

# 1. The shipped settings: claude_code metrics must arrive.
replay run-shipped
sleep 2
for want in "claude_code.session.count" "claude_code.token.usage" "run.id: Str(run-shipped)"; do
  if ! grep -qF "$want" "$work/collector.log"; then
    echo "OTEL: the collector did not receive claude_code telemetry: $want"; cat "$work/collector.log"; exit 1
  fi
done
echo "OTEL: claude_code metrics visible in the collector:"
grep -E "Name: claude_code\." "$work/collector.log" | sort -u || true

# 2. No prompt text. First prove the detector: forcing OTEL_LOG_USER_PROMPTS=1
#    with the logs exporter on must put the canary in the collector's output.
canary="$(python3 -I "$here/tests/otel/claude_code_replay.py" --canary)"
OTEL_LOGS_EXPORTER=otlp OTEL_LOG_USER_PROMPTS=1 replay run-forced
sleep 2
grep -qF "$canary" "$work/collector.log" || { echo "OTEL: prompt detector blind: forced prompt logging not visible"; exit 1; }
# Then the shipped settings, even with the logs exporter added, must not leak it.
mark="$(wc -c <"$work/collector.log")"
OTEL_LOGS_EXPORTER=otlp replay run-shipped-logs
sleep 2
tail -c +"$((mark + 1))" "$work/collector.log" >"$work/region.log"
if grep -qF "$canary" "$work/region.log"; then
  echo "OTEL: prompt text reached the collector under the shipped settings"; exit 1
fi
grep -qF "<REDACTED>" "$work/region.log" || { echo "OTEL: expected the redacted prompt marker"; exit 1; }
echo "OTEL: no prompt text under the shipped settings (prompt field was <REDACTED>)"
