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
import hashlib
import json
import os
import shutil
import signal
import subprocess
import sys
import time
from itertools import count
from pathlib import Path
from typing import Annotated, Any

from mcp.server.fastmcp import FastMCP
from pydantic import Field

from gates import telemetry

HANDLE = r"^[A-Za-z0-9._-]{1,128}$"
NAME = r"^[A-Za-z0-9._-]{1,64}$"
TERMINAL = {"PASSED", "FAILED", "SKIPPED", "TIMEOUT", "KILLED", "MISSING", "REFUSED"}
SANDBOXES = ("bwrap", "none")
OWNER = "gates-mcp-server"
MAX_WAIT_SECONDS = 420          # inside an agent's ten-minute call cap
DEFAULT_TIMEOUT_SECONDS = 3600
# Review note_1346 item 1. Pure launchers run whatever their arguments name,
# so they are never allowed. Shells and interpreters run code from their
# arguments or the (agent-writable) repo; an operator who needs one must name
# it a second time in GATES_ALLOWED_LAUNCHERS, accepting that for those gates
# the hash-pinned argv and the sandbox are the boundary, not the allowlist.
NEVER_ALLOWED = {"env", "xargs", "sudo", "doas", "nohup", "timeout", "nice", "setsid",
                 "chroot", "busybox", "stdbuf", "ionice", "taskset", "unshare", "nsenter"}
LAUNCHERS = {"sh", "bash", "dash", "zsh", "ksh", "fish", "node", "npx", "npm", "uv", "uvx",
             "perl", "ruby", "make", "git", "deno", "bun", "php", "lua", "tclsh"}
SANDBOX_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

mcp = FastMCP("gates")
_serial = count(1)


class ConfigError(RuntimeError):
    """The server cannot run gates as configured; stated, never guessed."""


def sha256_file(path: str) -> str:
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def _names(var: str) -> set[str]:
    return {x.strip() for x in os.environ.get(var, "").split(",") if x.strip()}


def allowed_executables() -> set[str]:
    """GATES_ALLOWED_EXECUTABLES: the operator's allowlist (issue #6).

    Comma-separated. It lives in the server's environment, NOT in the gate
    map, so a map edit cannot widen it. An entry with no slash matches a bare
    argv[0], resolved ONCE at startup to an absolute path outside the repo; an
    absolute entry matches that exact path.
    """
    return _names("GATES_ALLOWED_EXECUTABLES")


def _is_launcher(exe: str) -> str | None:
    base = os.path.basename(exe)
    if base in NEVER_ALLOWED:
        return "never"
    if base in LAUNCHERS or base.startswith("python"):
        return "launcher"
    return None


def check_allowlist(allow: set[str], launchers: set[str]) -> None:
    for exe in sorted(allow):
        kind = _is_launcher(exe)
        if kind == "never":
            raise ConfigError("GATES_ALLOWED_EXECUTABLES names %r, a launcher that runs "
                              "whatever its arguments say; it is never allowed" % exe)
        if kind == "launcher" and os.path.basename(exe) not in launchers:
            raise ConfigError("GATES_ALLOWED_EXECUTABLES names %r, a shell or interpreter; "
                              "name it in GATES_ALLOWED_LAUNCHERS too to accept that the "
                              "pinned argv and the sandbox, not the allowlist, bound it" % exe)


def resolve_executable(exe: str, repo_root: Path) -> str:
    """argv[0] as an absolute path, resolved on PATH once; refused when PATH
    gives a relative entry or a path inside the repository."""
    if os.path.isabs(exe):
        return exe
    for entry in os.environ.get("PATH", "").split(os.pathsep):
        if not entry or not os.path.isabs(entry):
            continue  # relative PATH entries are never searched
        cand = os.path.join(entry, exe)
        if os.path.isfile(cand) and os.access(cand, os.X_OK):
            real = Path(cand).resolve()
            if real == repo_root or repo_root in real.parents:
                raise ConfigError("%r resolves inside the repository (%s)" % (exe, real))
            return str(real)
    raise ConfigError("%r is not on PATH" % exe)


def refusal(argv: list[str], allow: set[str]) -> str | None:
    """Why argv[0] may not run, or None."""
    exe = argv[0]
    if _is_launcher(exe) == "never":
        return "executable %r is a launcher and is never allowed" % exe
    if exe in allow and ("/" not in exe or os.path.isabs(exe)):
        return None
    return "executable %r is not in GATES_ALLOWED_EXECUTABLES" % exe


def gate_env() -> dict[str, str]:
    """The only environment a gate gets (review note_1346 item 4)."""
    return {"PATH": SANDBOX_PATH, "HOME": "/tmp", "LANG": os.environ.get("LANG", "C.UTF-8")}


def sandbox_argv(argv: list[str], cwd: str, mode: str, repo_root: str | None = None,
                 bwrap: str = "bwrap") -> list[str]:
    """Wrap argv so the gate has no network, no host secrets and a read-only
    filesystem.

    bwrap: the host is bound read-only, then the home directory and /tmp are
    hidden under empty tmpfs mounts, the repository and the gate's cwd are
    re-exposed read-only, the environment is cleared down to gate_env(), every
    capability is dropped, and the user, network, PID, IPC and UTS namespaces
    are unshared. `none` is an explicit opt-out the operator must set; it is
    never a fallback when bwrap is missing.
    """
    if mode == "none":
        return list(argv)
    home = os.path.expanduser("~")
    out = [bwrap, "--ro-bind", "/", "/", "--dev", "/dev", "--proc", "/proc",
           "--tmpfs", "/tmp"]
    if home not in ("/", "") and os.path.isdir(home):
        out += ["--tmpfs", home]
    for p in dict.fromkeys(x for x in (repo_root, cwd) if x):
        out += ["--ro-bind", p, p]
    out += ["--clearenv"]
    for k, v in gate_env().items():
        out += ["--setenv", k, v]
    out += ["--unshare-user", "--unshare-net", "--unshare-pid", "--unshare-ipc",
            "--unshare-uts", "--cap-drop", "ALL", "--new-session", "--die-with-parent",
            "--chdir", cwd, "--"]
    return out + list(argv)


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
    pinned = os.environ.get("GATES_MAP_SHA256", "").strip().lower()
    if not pinned:
        raise ConfigError("GATES_MAP_SHA256 is not set: the gate map must be "
                          "hash-pinned (issue #6)")
    # Read the bytes ONCE: hash and parse the same bytes (review note_1346 item 2).
    with open(map_path, "rb") as fh:
        raw = fh.read()
    actual = hashlib.sha256(raw).hexdigest()
    if actual != pinned:
        raise ConfigError("GATES_MAP hash %s does not match GATES_MAP_SHA256 %s: "
                          "the map changed since it was approved" % (actual, pinned))
    if not allowed_executables():
        raise ConfigError("GATES_ALLOWED_EXECUTABLES is not set: there is no "
                          "default allowlist")
    check_allowlist(allowed_executables(), _names("GATES_ALLOWED_LAUNCHERS"))
    sandbox = os.environ.get("GATES_SANDBOX", "bwrap")
    if sandbox not in SANDBOXES:
        raise ConfigError("GATES_SANDBOX must be one of %s" % ", ".join(SANDBOXES))
    bwrap = shutil.which("bwrap") if sandbox == "bwrap" else None
    if sandbox == "bwrap" and bwrap is None:
        raise ConfigError("GATES_SANDBOX=bwrap but bwrap is not on PATH; install "
                          "bubblewrap or set GATES_SANDBOX=none explicitly")
    try:
        data = json.loads(raw.decode("utf-8"))
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
    repo_root = Path(os.environ.get("GATES_REPO_ROOT")
                     or os.path.dirname(os.path.abspath(map_path))).resolve()
    return {
        "gates": gates,
        "run_root": Path(run_root).absolute(),
        "repo_root": repo_root,
        "bwrap": str(Path(bwrap).resolve()) if bwrap else None,
        "timeout": int(timeout),
        "allow": allowed_executables(),
        "sandbox": sandbox,
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
    out = {"handle": handle, "gate": name, "state": state, "exit": code,
           "elapsed_seconds": elapsed, "log": str(d / "log"), "line": line}
    if state == "REFUSED":
        out["reason"] = _read(d, "refused", "")
    return out


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
    with telemetry.tool_span("start_gate", name=name) as span:
        out = _start_gate(name)
        telemetry.record(span, out)
        return out


def _start_gate(name: str) -> dict[str, Any]:
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
    why = refusal(entry["argv"], cfg["allow"])
    if why is not None:
        (d / "state").write_text("REFUSED", encoding="utf-8")
        (d / "refused").write_text(why, encoding="utf-8")
        return summary(d)
    root = cfg["repo_root"]
    cwd_path = (root / entry.get("cwd", ".")).resolve()
    if cwd_path != root and root not in cwd_path.parents:
        # Review note_1346 item 5: a gate never runs outside the repository.
        (d / "state").write_text("REFUSED", encoding="utf-8")
        (d / "refused").write_text("cwd %r leaves the repository" % entry.get("cwd"), encoding="utf-8")
        return summary(d)
    cwd = str(cwd_path)
    try:
        exe = resolve_executable(entry["argv"][0], root)
    except ConfigError as exc:
        (d / "state").write_text("REFUSED", encoding="utf-8")
        (d / "refused").write_text(str(exc), encoding="utf-8")
        return summary(d)
    argv = [exe] + entry["argv"][1:]
    spec = {"argv": sandbox_argv(argv, cwd, cfg["sandbox"], str(root), cfg["bwrap"] or "bwrap"),
            "env": gate_env(),
            "sandbox": cfg["sandbox"],
            "cwd": cwd,
            "timeout_seconds": entry.get("timeout_seconds", cfg["timeout"]),
            "skip_exit": entry.get("skip_exit"),
            "evidence_file": str(cfg["run_root"] / "gates.txt")}
    (d / "started").write_text(str(int(time.time())), encoding="utf-8")
    (d / "state").write_text("RUNNING", encoding="utf-8")
    # The spec goes to the watchdog over its stdin, never through a file the
    # agent could rewrite in the run directory (review note_1346 item 3).
    watchdog = subprocess.Popen(
        [sys.executable, "-m", "gates.watchdog", str(d)],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL, start_new_session=True)
    watchdog.stdin.write(json.dumps(spec).encode("utf-8"))
    watchdog.stdin.close()
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
    with telemetry.tool_span("wait_gate", handle=handle) as span:
        d = _dir(config(), handle)
        waited = 0.0
        while d.is_dir() and not _terminal(d) and waited < max_wait_seconds:
            await asyncio.sleep(0.5)
            waited += 0.5
        out = summary(d)
        telemetry.record(span, out)
        return out


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
