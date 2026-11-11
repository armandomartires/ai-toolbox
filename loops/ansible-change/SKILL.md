---
name: run-ansible-change
description: "Run the ansible-change loop by hand: loop.md in this folder is the procedure. Invoke with /run-ansible-change."
argument-hint: "[change to apply: playbook, role or inventory]"
disable-model-invocation: true
---

# run-ansible-change

Run the **ansible-change** loop on $ARGUMENTS.

The procedure, its exit conditions and the rules it enforces are in
[loop.md](loop.md) (`loops/ansible-change/loop.md` in a checkout). Open it and
follow it from its first step. This wrapper adds nothing to it.
