# ADR-0026 — The emitter prunes a role's file from a client the role no longer declares

## Status
Accepted — 2026-09-24. **The decision is the human's**, chosen from stated
options (`TASK-0091`); this ADR records it and the narrow form it takes.
**Amended 2026-10-11** on the human's choice (`TASK-0164`): see the last
**Consequences** bullet.

## Context
`scripts/install.sh` recorded, as a deliberate absence: *"Nothing prunes a
stale emitted file … an installer that deletes files from a user's config
directory needs its own decision, not a convenience."* `TASK-0090` then found
the cost: `~/.claude/agents/designer-manager.md`, emitted before the role
became OpenCode-only, was still there — skipped by every later install and
removed by none — so a Claude Code session could load a role the repo no
longer emits for that client.

## Decision
When `scripts/emit-agents.py` emits for a client and a role in `agents/` does
**not** declare that client, it deletes `<target>/<role>.md` **only if** the
file is a regular file (never a symlink) whose frontmatter `name:` is that
role, and prints `agent pruned: …`. Nothing else in the directory is touched.

## Consequences
- A role narrowed away from a client disappears from it at the next
  `install.sh`, which is the one moment the operator is already changing that
  directory.
- **Two limits, stated:** a **refused** role's existing file stays (emission
  exits 1 and the operator acts); a role **deleted** from `agents/` is never
  pruned, because its name is no longer known — pruning it would need a record
  of what was emitted, which does not exist.
- The rule matches the emitter's existing overwrite policy — it already
  replaces a same-named file for a declared role without asking — so it
  widens what the installer may do to exactly the files it would have written.
- Proven by `tests/test-emit-prune.sh` (hermetic, not wired into
  `tests/validate.sh`), including a revert that loosened the guard and
  deleted a symlink and a foreign-named file.
- **Amendment, 2026-10-11 — deselected roles, and OpenCode.** A role left out
  of `install.sh`'s selection (`--only`, `install.selection`) is pruned too,
  under the same guard, so deselecting a component removes it from the client
  (the human's choice; skill links to this checkout are unlinked by the same
  rule). `TASK-0164` also found that the guard had **never matched an OpenCode
  file**: OpenCode emissions carry no `name:`. A file without `name:` now
  counts as ours only if it is exactly what the emitter writes for that role
  today; one that differs is left and reported. Proven by
  `tests/test-install.sh`, which runs in the gate.
