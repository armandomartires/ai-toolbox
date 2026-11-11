#!/usr/bin/env python3
"""MCP tool-surface checks (TASK-0269). Needs node_modules installed per server
(`npm ci --ignore-scripts` in <server>/lock) and, for gates, `uv` with its
dependencies; it is NOT part of tests/validate.sh (it installs and launches
servers).

  1. Every server named in .gitlab/ci/mcp-tool-lock.yml: the live tools/list
     equals the locked tools (add, remove or change fails).
  2. The gates server's live tools/list carries the safety annotations:
     start_gate and kill_gate destructiveHint=true; list_gates, gate_status and
     wait_gate readOnlyHint=true.

Env: MCP_LOCK_LAUNCH_<SERVER>=<json argv> overrides tool_lock.command for a
server that has a server.json (ansible, graphify) only, on a host that cannot
exec node_modules/.bin shims (e.g. Windows); the working directory stays the
manifest's. It does not apply to gates (use GATES_LAUNCH=<json argv>).
MCP_LOCK_PASS_ENV=A,B names host variables handed to the launched servers on top
of the lock script's minimal environment (Windows: UV_PROJECT_ENVIRONMENT,
APPDATA, LOCALAPPDATA, USERPROFILE). Refused when CI is set.
MCP_TOOLS_ONLY=a,b limits the run to those server basenames; an empty value or a
name that matches no server in the CI loop fails. With it unset, the CI loop must
name exactly ansible, graphify and gates.
"""
from __future__ import annotations

import importlib.util
import json
import os
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("mcp_tool_lock", ROOT / "scripts" / "mcp-tool-lock.py")
lock = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lock)

_orig_list_tools = lock.list_tools


def _list_tools(argv, cwd, env, timeout=120):
    env = dict(env)
    for k in filter(None, os.environ.get("MCP_LOCK_PASS_ENV", "").split(",")):
        if k in os.environ:
            env[k] = os.environ[k]
    return _orig_list_tools(argv, cwd, env, timeout)


lock.list_tools = _list_tools

EXPECTED_SERVERS = {"ansible", "graphify", "gates"}
GATES_EXPECT = {"start_gate": "destructiveHint", "kill_gate": "destructiveHint",
                "list_gates": "readOnlyHint", "gate_status": "readOnlyHint",
                "wait_gate": "readOnlyHint"}


def job_servers() -> list[str]:
    """The servers of the CI loop, filtered by MCP_TOOLS_ONLY; exits on a vacuous result."""
    text = (ROOT / ".gitlab/ci/mcp-tool-lock.yml").read_text()
    m = re.search(r"for d in ([^;]+);\s*do", text)
    servers = m.group(1).split() if m else []
    if not servers:
        raise SystemExit("MCP-TOOLS FAIL: no server list found in .gitlab/ci/mcp-tool-lock.yml")
    known = {Path(x).name for x in servers}
    only = os.environ.get("MCP_TOOLS_ONLY")
    if only is None:
        if known != EXPECTED_SERVERS:
            raise SystemExit("MCP-TOOLS FAIL: the CI loop names %s, expected %s"
                             % (sorted(known), sorted(EXPECTED_SERVERS)))
        return servers
    wanted = [x.strip() for x in only.split(",")]
    unknown = [w for w in wanted if w not in known]
    if unknown:
        raise SystemExit("MCP-TOOLS FAIL: MCP_TOOLS_ONLY names no known server: %r (CI loop: %s)"
                         % (unknown, sorted(known)))
    return [x for x in servers if Path(x).name in wanted]


def check_lock(server: str) -> list[str]:
    d = ROOT / server
    override = os.environ.get("MCP_LOCK_LAUNCH_" + d.name.upper())
    if override and (d / "server.json").is_file():  # same manifest, a different argv
        man = json.loads((d / "server.json").read_text())
        tl = man.setdefault("tool_lock", {})
        tl["command"] = json.loads(override)
        tl["cwd"] = str(d / tl.get("cwd", (man.get("pinned_launch") or {}).get("cwd", ".")))
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "server.json").write_text(json.dumps(man))
            new = lock.snapshot(Path(tmp))
    else:
        new = lock.snapshot(d)
    old = json.loads((d / lock.LOCK).read_text())
    out = ["%s: %s" % (server, x) for x in lock.compare(old, new)]
    if not new["tools"]:
        out.append("%s: live tools/list is empty" % server)
    return out


def check_gates_annotations() -> list[str]:
    d = ROOT / "mcp-servers/gates"
    # The environment mcp-tool-lock.py snapshot() builds: PATH, LANG, SYSTEMROOT,
    # a temporary HOME and the pyproject table's explicit env; nothing else.
    tl = lock.load_manifest(d)["tool_lock"]
    env = {k: os.environ[k] for k in ("PATH", "LANG", "SYSTEMROOT") if k in os.environ}
    env["HOME"] = tempfile.gettempdir()
    env.update({k: os.path.expandvars(v) for k, v in tl.get("env", {}).items()})
    argv = json.loads(os.environ["GATES_LAUNCH"]) if "GATES_LAUNCH" in os.environ else tl["command"]
    cwd = str((d / tl.get("cwd", ".")).resolve())
    tools = {t["name"]: t for t in lock.list_tools(argv, cwd, env)}
    bad = []
    if set(tools) != set(GATES_EXPECT):
        bad.append("gates tools %s != %s" % (sorted(tools), sorted(GATES_EXPECT)))
    for name, hint in GATES_EXPECT.items():
        ann = (tools.get(name) or {}).get("annotations") or {}
        if ann.get(hint) is not True:
            bad.append("gates.%s: annotations.%s is not true (annotations=%r)" % (name, hint, ann))
    return bad


def main() -> int:
    if os.environ.get("MCP_LOCK_PASS_ENV") and os.environ.get("CI"):
        print("MCP-TOOLS FAIL: MCP_LOCK_PASS_ENV is set while CI is set; host variables must "
              "never reach a server in CI. Unset MCP_LOCK_PASS_ENV.")
        return 1
    servers = job_servers()
    bad = []
    for s in servers:
        bad += check_lock(s)
    bad += check_gates_annotations()
    for b in bad:
        print("MCP-TOOLS FAIL: " + b)
    if not bad:
        print("mcp-tools: locks match the live tools/list for %s; gates annotations present"
              % ", ".join(servers))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
