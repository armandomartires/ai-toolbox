"""Issue #14: start_gate and wait_gate emit GenAI `execute_tool` spans."""
import asyncio
import shutil

import pytest

from gates import server, telemetry
from test_server import FIXTURE

sdk = pytest.importorskip("opentelemetry.sdk.trace")
from opentelemetry.sdk.trace.export import SimpleSpanProcessor  # noqa: E402
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter  # noqa: E402


@pytest.fixture
def spans(tmp_path, monkeypatch):
    monkeypatch.setenv("GATES_MAP", str(FIXTURE))
    monkeypatch.setenv("GATES_RUN_ROOT", str(tmp_path / "run"))
    monkeypatch.setenv("GATES_REPO_ROOT", str(tmp_path))
    # Issue #6 (!13): the map is hash-pinned and argv[0] allowlisted.
    monkeypatch.setenv("GATES_MAP_SHA256", server.sha256_file(str(FIXTURE)))
    monkeypatch.setenv("GATES_ALLOWED_EXECUTABLES", "sh,false")
    monkeypatch.setenv("GATES_ALLOWED_LAUNCHERS", "sh")
    monkeypatch.setenv("GATES_SANDBOX", "bwrap" if shutil.which("bwrap") else "none")
    exp = InMemorySpanExporter()
    provider = sdk.TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exp))
    telemetry.use(provider)
    yield exp
    telemetry.use(None)


def test_tool_calls_emit_execute_tool_spans(spans):
    h = server.start_gate("ok")["handle"]
    asyncio.run(server.wait_gate(h, 30))
    got = {s.name: s for s in spans.get_finished_spans()}
    assert set(got) == {"execute_tool start_gate", "execute_tool wait_gate"}
    w = got["execute_tool wait_gate"].attributes
    assert w["gen_ai.operation.name"] == "execute_tool"
    assert w["gen_ai.tool.name"] == "wait_gate"
    assert w["gates.state"] == "PASSED" and w["gates.gate"] == "ok"


def test_a_failed_gate_marks_its_span_as_an_error(spans):
    h = server.start_gate("bad")["handle"]
    asyncio.run(server.wait_gate(h, 30))
    w = [s for s in spans.get_finished_spans() if s.name.endswith("wait_gate")][0]
    assert w.status.status_code.name == "ERROR"


def test_no_endpoint_means_no_telemetry(monkeypatch):
    telemetry.use(None)
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    with telemetry.tool_span("start_gate") as span:
        assert span is None
