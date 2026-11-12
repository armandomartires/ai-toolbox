---
name: run-project-build
description: "Run the project-build loop by hand: loop.md in this folder is the procedure. Invoke with /ai-toolbox-skills:run-project-build."
argument-hint: "[locked design brief to build]"
disable-model-invocation: true
---

# run-project-build

Run the **project-build** loop on $ARGUMENTS.

The procedure, its exit conditions and the rules it enforces are in
[loop.md](loop.md) (`loops/project-build/loop.md` in a checkout). Open it and
follow it from its first step. This wrapper adds nothing to it.

Paths in loop.md are an ai-toolbox checkout's. In this plugin, `skills/<x>/`
is the sibling folder `../<x>/`, `docs/security/untrusted-content.md` is
`untrusted-content.md` here, and `AGENTS.md` is the project's own.
