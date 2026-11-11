#!/usr/bin/env python3
"""Replay what Claude Code exports, driven by the shipped settings env (TASK-0279).

No Claude Code binary or login is available to a CI job, so this stands in for
the client: it reads the `env` block of configs/claude-code/settings.otel.json
and behaves as the documented client does with it. It exports nothing unless
CLAUDE_CODE_ENABLE_TELEMETRY=1, sends the `claude_code.*` metrics over OTLP/HTTP
JSON to the endpoint, and puts prompt text in a log event only when
OTEL_LOG_USER_PROMPTS=1 and the logs exporter is on (otherwise the documented
"<REDACTED>"). It proves what the SHIPPED SETTINGS cause, not that a live
client behaves so; see the brief's risks.

Usage: claude_code_replay.py <settings.otel.json> <run-id>
Process env overrides the file (the CI endpoint; CLAUDE_OTEL_DROP=NAME removes
a variable, the red proof for "unsetting the flag").
"""
import json
import os
import sys
import time
import urllib.request

CANARY = "CANARY-prompt-text-do-not-export-7f3a"


def attr(k, v):
    return {"key": k, "value": {"stringValue": v}}


def post(endpoint, path, body):
    req = urllib.request.Request(endpoint.rstrip("/") + path, json.dumps(body).encode(),
                                 {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        r.read()


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--canary":
        print(CANARY)
        return
    env = dict(json.load(open(sys.argv[1], encoding="utf-8"))["env"])
    for k, v in os.environ.items():
        if k.startswith(("OTEL_", "CLAUDE_CODE_")):
            env[k] = v
    for k in filter(None, os.environ.get("CLAUDE_OTEL_DROP", "").split(",")):
        env.pop(k, None)
    if env.get("CLAUDE_CODE_ENABLE_TELEMETRY") != "1":
        print("replay: telemetry flag not set, exporting nothing")
        return
    endpoint = env.get("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")
    now = str(time.time_ns())
    res = {"attributes": [attr("service.name", "claude-code"), attr("run.id", sys.argv[2])]}
    scope = {"name": "com.anthropic.claude_code"}

    def sum_metric(name, unit, val):
        return {"name": name, "unit": unit, "sum": {
            "aggregationTemporality": 1, "isMonotonic": True,
            "dataPoints": [{"asInt": str(val), "timeUnixNano": now,
                            "attributes": [attr("session.id", "replay")]}]}}

    if "otlp" in env.get("OTEL_METRICS_EXPORTER", "").split(","):
        post(endpoint, "/v1/metrics", {"resourceMetrics": [{"resource": res, "scopeMetrics": [
            {"scope": scope, "metrics": [sum_metric("claude_code.session.count", "count", 1),
                                         sum_metric("claude_code.token.usage", "tokens", 42)]}]}]})
    if "otlp" in env.get("OTEL_LOGS_EXPORTER", "").split(","):
        prompt = CANARY if env.get("OTEL_LOG_USER_PROMPTS") == "1" else "<REDACTED>"
        post(endpoint, "/v1/logs", {"resourceLogs": [{"resource": res, "scopeLogs": [{
            "scope": scope,
            "logRecords": [{"timeUnixNano": now,
                            "body": {"stringValue": "claude_code.user_prompt"},
                            "attributes": [attr("event.name", "user_prompt"),
                                           attr("prompt", prompt)]}]}]}]})
    print("replay: exported")


main()
