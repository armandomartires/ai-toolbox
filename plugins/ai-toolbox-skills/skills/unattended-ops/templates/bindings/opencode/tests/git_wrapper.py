#!/usr/bin/env python3
"""Installed as `git` ahead of the real one in the tests' PATH. Logs every
invocation with its caller — "stub" when a stubbed role ran it, "driver"
otherwise — then execs the real git (REAL_GIT). This is how the tests see
every git command the driver itself spawns."""
import json
import os
import sys

with open(os.environ["GIT_LOG"], "a", encoding="utf-8") as fh:
    fh.write(json.dumps({"caller": os.environ.get("GIT_CALLER", "driver"),
                         "argv": sys.argv[1:]}) + "\n")
os.execv(os.environ["REAL_GIT"], [os.environ["REAL_GIT"], *sys.argv[1:]])
