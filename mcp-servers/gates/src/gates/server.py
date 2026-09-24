"""gates — run named verification gates, detached, and report them in bounded polls.

The MCP form of the unattended-ops skill's gate entry point
(skills/unattended-ops/references/long-gates.md), so rule 2 (gate commands
come from a hardcoded map, never from a caller) and rule 3 (long gates run
detached behind a watchdog) hold on any client that can call an MCP tool.

No tool accepts a command, an argv or a path: a caller can only NAME a gate
the consuming repository's map declares. State on disk and the evidence line
are byte-compatible with the OpenCode binding's run-gate.sh, so an evidence
file reads the same whichever entry point wrote it.

Destructive, and authorized: .ai/tasks/TASK-0088-gates-mcp-server.md.
"""
from __future__ import annotations

import asyncio
import json
import os
import signal
import subprocess
import sys
import time
from itertools import count
from pathlib import Path
from typing import Annotated, Any

from mcp.server.fastmcp import FastMCP
from pydantic import Field

HANDLE = r"^[A-Za-z0-9._-]{1,128}$"
NAME = r"^[A-Za-z0-9._-]{1,64}$"
TERMINAL = {"PASSED", "FAILED", "SKIPPED", "TIMEOUT", "KILLED", "MISSING"}
OWNER = "gates-mcp-server"
MAX_WAIT_SECONDS = 420          # inside an agent's ten-minute call cap
DEFAULT_TIMEOUT_SECONDS = 3600

mcp = FastMCP("gates")
_serial = count(1)


class ConfigError(RuntimeError):
    """The server cannot run gates as configured; stated, never guessed."""


def config() -> dict[str, Any]:
    """Read and validate the environment and the gate map."""
    map_path = os.environ.get("GATES_MAP", "")
    run_root = os.environ.get("GATES_RUN_ROOT", "")
    if not map_path:
        raise ConfigError("GATES_MAP is not set: the gate map is the consuming "
                          "repository's, and there is no default")
    if not os.path.isfile(map_path):
        raise ConfigError("GATES_MAP %r is not a file" % map_path)
    if not run_root:
        raise ConfigError("GATES_RUN_ROOT is not set")
    try:
        with open(map_path, encoding="utf-8") as fh:
            data = json.load(fh)
    except ValueError as exc:
        raise ConfigError("GATES_MAP does not parse as JSON: %s" % exc) from exc
    gates = data.get("gates") if isinstance(data, dict) else None
    if not isinstance(gates, dict):
        raise ConfigError("the gate map has no `gates` object")
    for name, entry in gates.items():
        argv = entry.get("argv") if isinstance(entry, dict) else None
        if not (isinstance(argv, list) and argv and all(isinstance(a, str) for a in argv)):
            raise ConfigError("gate %r: `argv` must be a non-empty list of strings" % name)
        for key in ("timeout_seconds", "skip_exit"):
            if key in entry and not isinstance(entry[key], int):
                raise ConfigError("gate %r: `%s` must be an integer" % (name, key))
    timeout = os.environ.get("GATES_TIMEOUT_SECONDS") or str(DEFAULT_TIMEOUT_SECONDS)
    if not timeout.isdigit() or int(timeout) < 1:
        raise ConfigError("GATES_TIMEOUT_SECONDS must be a positive integer")
    return {
        "gates": gates,
        "run_root": Path(run_root).absolute(),
        "repo_root": Path(os.environ.get("GATES_REPO_ROOT")
                          or os.path.dirname(os.path.abspath(map_path))),
        "timeout": int(timeout),
    }


def _dir(cfg: dict[str, Any], handle: str) -> Path:
    return cfg["run_root"] / "gates" / handle


def _read(d: Path, name: str, default: str) -> str:
    try:
        return (d / name).read_text(encoding="utf-8").strip()
    except OSError:
        return default


def summary(d: Path) -> dict[str, Any]:
    """One gate's state, and the one line run-gate.sh would print for it."""
    handle = d.name
    state = _read(d, "state", "MISSING")
    name = _read(d, "name", "?")
    code = int(_read(d, "exit", "-1"))
    started = int(_read(d, "started", "0"))
    finished = int(_read(d, "finished", str(int(time.time()))))
    elapsed = 0 if started == 0 else finished - started
    line = "GATE %s NAME=%s STATE=%s EXIT=%d ELAPSED=%ds LOG=%s" % (
        handle, name, state, code, elapsed, d / "log")
    return {"handle": handle, "gate": name, "state": state, "exit": code,
            "elapsed_seconds": elapsed, "log": str(d / "log"), "line": line}


def _terminal(d: Path) -> bool:
    return _read(d, "state", "MISSING") in TERMINAL


@mcp.tool()
def list_gates() -> list[dict[str, Any]]:
    """List the gates the consuming repository's map declares, by name.

    Commands are deliberately not returned: callers name gates and never see
    or compose a command (skills/unattended-ops/ rule 2).
    """
    cfg = config()
    return [{"name": n, "timeout_seconds": e.get("timeout_seconds", cfg["timeout"]),
             "skips_on_exit": e.get("skip_exit")}
            for n, e in sorted(cfg["gates"].items())]


@mcp.tool()
def start_gate(
    name: Annotated[str, Field(pattern=NAME, description="A gate name from list_gates")],
) -> dict[str, Any]:
    """Start one gate detached behind a watchdog and return its handle at once.

    DESTRUCTIVE: runs the command the consuming repository's map declares for
    this name. The watchdog owns the timeout and outlives this server.

    Args:
        name: A gate name the map declares. Anything else returns MISSING.
    """
    cfg = config()
    handle = "%s.%s-%d-%d" % (name, time.strftime("%Y%m%dT%H%M%S"), os.getpid(), next(_serial))
    d = _dir(cfg, handle)
    d.mkdir(parents=True)
    (d / "name").write_text(name, encoding="utf-8")
    (d / "owner").write_text(OWNER, encoding="utf-8")
    entry = cfg["gates"].get(name)
    if entry is None:
        (d / "state").write_text("MISSING", encoding="utf-8")
        return summary(d)
    spec = {"argv": entry["argv"],
            "cwd": str(cfg["repo_root"] / entry.get("cwd", ".")),
            "timeout_seconds": entry.get("timeout_seconds", cfg["timeout"]),
            "skip_exit": entry.get("skip_exit"),
            "evidence_file": str(cfg["run_root"] / "gates.txt")}
    (d / "spec.json").write_text(json.dumps(spec), encoding="utf-8")
    (d / "started").write_text(str(int(time.time())), encoding="utf-8")
    (d / "state").write_text("RUNNING", encoding="utf-8")
    watchdog = subprocess.Popen(
        [sys.executable, "-m", "gates.watchdog", str(d)],
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL, start_new_session=True)
    (d / "watchdog.pid").write_text(str(watchdog.pid), encoding="utf-8")
    return summary(d)


@mcp.tool()
async def wait_gate(
    handle: Annotated[str, Field(pattern=HANDLE, description="A handle from start_gate")],
    max_wait_seconds: Annotated[int, Field(ge=0, le=MAX_WAIT_SECONDS,
                                           description="Upper bound on this call, at most 420")] = 300,
) -> dict[str, Any]:
    """Wait at most max_wait_seconds for a gate to finish, then report it.

    Call again while state is RUNNING: a seventy-minute gate is simply a
    sequence of bounded waits (references/long-gates.md).

    Args:
        handle: The handle start_gate returned.
        max_wait_seconds: The most this call may block, 0 to 420.
    """
    d = _dir(config(), handle)
    waited = 0.0
    while d.is_dir() and not _terminal(d) and waited < max_wait_seconds:
        await asyncio.sleep(0.5)
        waited += 0.5
    return summary(d)


@mcp.tool()
def gate_status(
    handle: Annotated[str, Field(pattern=HANDLE, description="A handle from start_gate")],
) -> dict[str, Any]:
    """Report a gate's state without waiting.

    Args:
        handle: The handle start_gate returned.
    """
    return summary(_dir(config(), handle))


@mcp.tool()
async def kill_gate(
    handle: Annotated[str, Field(pattern=HANDLE, description="A handle from start_gate")],
) -> dict[str, Any]:
    """Stop a running gate's own process group. Never kills anything by name.

    DESTRUCTIVE: terminates the process group of a gate THIS server started.
    A handle this server did not start is refused.

    Args:
        handle: The handle start_gate returned.
    """
    d = _dir(config(), handle)
    if not d.is_dir():
        return summary(d)
    if _read(d, "owner", "") != OWNER:
        raise ValueError("refusing to kill %s: it was not started by this server" % handle)
    for _ in range(20):
        if (d / "pgid").exists() or _terminal(d):
            break
        await asyncio.sleep(0.5)
    if (d / "pgid").exists() and not _terminal(d):
        (d / "killed").touch()
        pgid = int(_read(d, "pgid", "0"))
        for sig, wait in ((signal.SIGTERM, 15), (signal.SIGKILL, 5)):
            try:
                os.killpg(pgid, sig)
            except ProcessLookupError:
                break
            for _ in range(wait * 2):
                if _terminal(d):
                    break
                await asyncio.sleep(0.5)
            if _terminal(d):
                break
    return summary(d)


def main() -> None:
    try:
        config()
    except ConfigError as exc:
        print("gates: refusing to start: %s" % exc, file=sys.stderr)
        raise SystemExit(2)
    mcp.run()


if __name__ == "__main__":
    main()
