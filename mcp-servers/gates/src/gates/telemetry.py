"""Optional OpenTelemetry spans for the gates server (issue #14).

Off unless OTEL_EXPORTER_OTLP_ENDPOINT is set AND the `otel` extra is
installed (`uv sync --extra otel`). Off means a no-op context manager: the
server never needs the network or the SDK to run gates.

Span names and attributes follow the OpenTelemetry GenAI semantic
conventions for tool execution: `execute_tool <tool>`, with
gen_ai.operation.name=execute_tool and gen_ai.tool.name. Gate-specific facts
go under `gates.*`. Never a command line or a log body: names, handles,
states and exit codes only.
"""
from __future__ import annotations

import contextlib
import os
from typing import Any, Iterator

_tracer = None
_provider = None


def _init():
    global _tracer, _provider
    if _tracer is not None or not os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT"):
        return _tracer
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import SimpleSpanProcessor
    except ImportError:
        return None
    provider = TracerProvider(resource=Resource.create(
        {"service.name": os.environ.get("OTEL_SERVICE_NAME", "gates-mcp-server")}))
    provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter()))
    use(provider)
    return _tracer


def use(provider) -> None:
    """Install a tracer provider (tests pass an in-memory one)."""
    global _tracer, _provider
    _provider = provider
    _tracer = provider.get_tracer("ai-toolbox.gates") if provider else None


@contextlib.contextmanager
def tool_span(tool: str, **attrs: Any) -> Iterator[Any]:
    tracer = _tracer or _init()
    if tracer is None:
        yield None
        return
    with tracer.start_as_current_span("execute_tool %s" % tool) as span:
        span.set_attribute("gen_ai.operation.name", "execute_tool")
        span.set_attribute("gen_ai.tool.name", tool)
        span.set_attribute("gen_ai.tool.type", "function")
        for k, v in attrs.items():
            if v is not None:
                span.set_attribute("gates.%s" % k, v)
        yield span


def record(span, result: dict[str, Any]) -> None:
    """Attach a tool's summary to its span."""
    if span is None:
        return
    for key in ("handle", "gate", "state", "exit", "elapsed_seconds"):
        if key in result:
            span.set_attribute("gates.%s" % key, result[key])
    if result.get("state") in ("FAILED", "TIMEOUT", "KILLED", "REFUSED", "MISSING"):
        from opentelemetry.trace import Status, StatusCode
        span.set_status(Status(StatusCode.ERROR, result["state"]))


def flush() -> None:
    if _provider is not None and hasattr(_provider, "force_flush"):
        _provider.force_flush()
