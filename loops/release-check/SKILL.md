---
name: run-release-check
description: "Run the release-check loop by hand: loop.md in this folder is the procedure. Invoke with /run-release-check."
argument-hint: "[task id or unit of work to close out]"
disable-model-invocation: true
---

# run-release-check

Run the **release-check** loop on $ARGUMENTS.

The procedure, its exit conditions and the rules it enforces are in
[loop.md](loop.md) (`loops/release-check/loop.md` in a checkout). Open it and
follow it from its first step. This wrapper adds nothing to it.
