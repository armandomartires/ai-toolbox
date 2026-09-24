"""Tests for the gates server. Hermetic: the fixture map only, a throwaway
run root per test, no network. Run: cd mcp-servers/gates && uv run pytest

Per the TASK-0088 authorization's condition, nothing here wires the server
into a client, and only tests/fixtures/gates.json is ever run.
"""
import asyncio
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import pytest

from gates import server

HERE = Path(__file__).resolve().parent
FIXTURE = HERE / "fixtures" / "gates.json"
REPO = HERE.parents[2]
RUN_GATE = REPO / "skills/unattended-ops/templates/bindings/opencode/run-gate.sh"
TOOLS = {"list_gates", "start_gate", "wait_gate", "gate_status", "kill_gate"}


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("GATES_MAP", str(FIXTURE))
    monkeypatch.setenv("GATES_RUN_ROOT", str(tmp_path / "run"))
    monkeypatch.setenv("GATES_REPO_ROOT", str(tmp_path))
    monkeypatch.delenv("GATES_TIMEOUT_SECONDS", raising=False)
    return tmp_path


def finish(name, wait=30):
    h = server.start_gate(name)["handle"]
    return asyncio.run(server.wait_gate(h, wait))


def evidence(env):
    p = env / "run" / "gates.txt"
    return p.read_text().splitlines() if p.exists() else []


# --- The surface: names only, never a command -----------------------------------

def test_no_tool_accepts_a_command():
    tools = asyncio.run(server.mcp.list_tools())
    assert {t.name for t in tools} == TOOLS
    for t in tools:
        props = set((t.inputSchema or {}).get("properties", {}))
        assert props <= {"name", "handle", "max_wait_seconds"}, (t.name, props)


def test_declared_destructive_tools_are_registered():
    tomllib = pytest.importorskip("tomllib")   # 3.11+; the server itself targets 3.10
    meta = tomllib.loads((HERE.parent / "pyproject.toml").read_text())["tool"]["ai-toolbox"]
    assert set(meta["capabilities"]["destructive_tools"]) <= TOOLS


def test_list_gates_returns_no_command(env):
    rows = server.list_gates()
    assert {r["name"] for r in rows} == {"ok", "bad", "skip", "slow", "long", "literal"}
    assert "sleep" not in json.dumps(rows) and "argv" not in json.dumps(rows)


def test_schema_bounds_are_enforced(env):
    # With a valid configuration, so the only thing that can reject these is
    # the schema. (Without `env` every call failed on configuration instead,
    # and this test passed with the bounds removed — caught by its revert.)
    for tool, arguments, field in (("wait_gate", {"handle": "h", "max_wait_seconds": 999}, "max_wait_seconds"),
                                   ("gate_status", {"handle": "../escape"}, "handle"),
                                   ("start_gate", {"name": "a b"}, "name")):
        with pytest.raises(Exception, match="(?s)validation error.*" + field):
            asyncio.run(server.mcp.call_tool(tool, arguments))
    # A control: the same call inside the bounds is accepted.
    asyncio.run(server.mcp.call_tool("gate_status", {"handle": "h"}))


# --- States ---------------------------------------------------------------------

def test_three_outcomes_stay_distinct(env):
    for gate, state in (("ok", "PASSED"), ("bad", "FAILED"), ("skip", "SKIPPED")):
        assert finish(gate)["state"] == state
    assert len(evidence(env)) == 3


def test_watchdog_times_out_a_wedged_gate(env):
    got = finish("slow")
    assert got["state"] == "TIMEOUT"
    assert any("STATE=TIMEOUT" in l for l in evidence(env))


def test_missing_gate_is_missing_and_not_evidence(env):
    assert server.start_gate("nosuch")["state"] == "MISSING"
    assert evidence(env) == []


def test_wait_is_bounded_while_the_gate_runs(env):
    h = server.start_gate("long")["handle"]
    t0 = time.time()
    assert asyncio.run(server.wait_gate(h, 2))["state"] == "RUNNING"
    assert time.time() - t0 < 10
    asyncio.run(server.kill_gate(h))


def test_argv_is_not_passed_through_a_shell(env):
    got = finish("literal")
    assert Path(got["log"]).read_text() == "a b; echo INJECTED\n"


# --- Kill scope -----------------------------------------------------------------

def test_kill_stops_only_its_own_group(env):
    sibling = subprocess.Popen(["sleep", "60"])
    try:
        h = server.start_gate("long")["handle"]
        assert asyncio.run(server.kill_gate(h))["state"] == "KILLED"
        assert sibling.poll() is None, "a process the server did not start was killed"
    finally:
        sibling.kill()
        sibling.wait()


def test_kill_refuses_a_gate_this_server_did_not_start(env):
    sibling = subprocess.Popen(["sleep", "60"], start_new_session=True)
    try:
        d = env / "run" / "gates" / "foreign"
        d.mkdir(parents=True)
        (d / "state").write_text("RUNNING")
        (d / "pgid").write_text(str(sibling.pid))
        with pytest.raises(ValueError, match="not started by this server"):
            asyncio.run(server.kill_gate("foreign"))
        assert sibling.poll() is None
    finally:
        sibling.kill()
        sibling.wait()


def test_the_watchdog_runs_in_its_own_session(env):
    h = server.start_gate("long")["handle"]
    try:
        pid = int((env / "run" / "gates" / h / "watchdog.pid").read_text())
        assert os.getsid(pid) != os.getsid(0)
    finally:
        asyncio.run(server.kill_gate(h))


# --- Configuration --------------------------------------------------------------

def test_refuses_to_start_without_a_gate_map(tmp_path):
    env = {k: v for k, v in os.environ.items() if not k.startswith("GATES_")}
    env["GATES_RUN_ROOT"] = str(tmp_path)
    got = subprocess.run([sys.executable, "-c", "from gates.server import main; main()"],
                         env=env, capture_output=True, text=True, timeout=60)
    assert got.returncode == 2
    assert "GATES_MAP is not set" in got.stderr


# --- Parity with run-gate.sh ---------------------------------------------------

@pytest.mark.skipif(not RUN_GATE.exists() or not shutil.which("setsid"), reason="run-gate.sh or setsid unavailable")
def test_evidence_line_matches_run_gate_sh(env):
    """One fixture map through both entry points; the lines must agree once the
    run root and the measured elapsed time are normalised — the only two
    fields that legitimately differ between two runs."""
    ours = finish("ok")
    other_root = env / "sh-run"
    sh_env = dict(os.environ, GATE_MAP=str(FIXTURE), GATE_REPO_ROOT=str(env),
                  GATE_RUN_ROOT=str(other_root), EVIDENCE_FILE=str(other_root / "gates.txt"),
                  GATE_TIMEOUT_SECONDS="60")
    subprocess.run([str(RUN_GATE), "start", ours["handle"], "ok"], env=sh_env, capture_output=True)
    subprocess.run([str(RUN_GATE), "wait", ours["handle"], "30"], env=sh_env, capture_output=True)
    theirs = (other_root / "gates.txt").read_text().splitlines()[0]

    def norm(line, root):
        return line.replace(str(root), "<ROOT>").split(" ELAPSED=")[0] + " " + line.split(" LOG=")[1].replace(str(root), "<ROOT>")

    assert norm(evidence(env)[0], env / "run") == norm(theirs, other_root)
