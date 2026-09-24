"""The watchdog: one detached process per gate, started by start_gate.

    python -m gates.watchdog <gate-dir>

Runs the gate's argv WITHOUT a shell in its own session, owns the timeout,
writes the terminal state, and appends the gate's one evidence line. It runs
in a session of its own (start_new_session), so the gate stays bounded even
if the MCP server — or the agent calling it — goes away.
"""
from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

from gates.server import summary


def run(d: Path) -> None:
    spec = json.loads((d / "spec.json").read_text(encoding="utf-8"))
    started = int((d / "started").read_text(encoding="utf-8"))
    limit = int(spec["timeout_seconds"])
    with open(d / "log", "w", encoding="utf-8") as log:
        try:
            proc = subprocess.Popen(spec["argv"], cwd=spec["cwd"], stdin=subprocess.DEVNULL,
                                    stdout=log, stderr=subprocess.STDOUT,
                                    start_new_session=True)
        except OSError as exc:
            log.write("gates: could not start %r: %s\n" % (spec["argv"][0], exc))
            proc = None
        if proc is not None:
            (d / "pgid").write_text(str(proc.pid), encoding="utf-8")
            while proc.poll() is None:
                if time.time() - started >= limit:
                    (d / "timed-out").touch()
                    for sig in (signal.SIGTERM, signal.SIGKILL):
                        try:
                            os.killpg(proc.pid, sig)
                        except ProcessLookupError:
                            break
                        for _ in range(10):
                            if proc.poll() is not None:
                                break
                            time.sleep(0.5)
                        if proc.poll() is not None:
                            break
                    break
                time.sleep(0.5)
            rc = proc.wait()
            # A signalled child reports -N; the shell convention is 128+N,
            # which is what run-gate.sh records for the same event.
            rc = 128 - rc if rc < 0 else rc
        else:
            rc = 127
    (d / "finished").write_text(str(int(time.time())), encoding="utf-8")
    (d / "exit").write_text(str(rc), encoding="utf-8")
    if (d / "killed").exists():
        state = "KILLED"
    elif (d / "timed-out").exists():
        state = "TIMEOUT"
    elif rc == 0:
        state = "PASSED"
    elif spec.get("skip_exit") is not None and rc == spec["skip_exit"]:
        state = "SKIPPED"
    else:
        state = "FAILED"
    tmp = d / "state.tmp"
    tmp.write_text(state, encoding="utf-8")
    tmp.replace(d / "state")
    with open(spec["evidence_file"], "a", encoding="utf-8") as fh:
        fh.write(summary(d)["line"] + "\n")


if __name__ == "__main__":
    run(Path(sys.argv[1]))
