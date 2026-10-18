# ADR-0038 — An unattended run on a forge tracker locks a committed issue snapshot and never touches the forge

**Status**: accepted
**Date**: 2026-10-18
**Task**: TASK-0172

## Context

`ADR-0037` let a project track its work as GitLab or GitHub issues. `loops/unattended-run/` could not run such a project, and `B-055` recorded why: both drivers and their roles read a committed task file and a tracker row. `ADR-0022` clause 3 makes that file the lock, because a field can be flipped by the next agent to open it and a commit cannot. An issue body is exactly such a field. On 2026-10-18 the human asked to close `B-055` and decided two things: the lock is a committed snapshot, and the forge is written by the human after the push.

## Decision

1. **The lock is a committed snapshot of each queued issue,** by convention `.ai/run-queue/<issue number>.md`. The human writes it before the run, from the issue body. `ADR-0022` clause 3 is unchanged: the snapshot is the committed task file.
2. **The drivers learn the tracker from `tracker.conf`,** which keeps one owner (`ADR-0037`). The Claude Code driver has no filesystem, so its preflight role reports the file. The OpenCode driver reads it. Both read only `tracker` and the project path; a conf that does not read is a halt.
3. **On a forge, preflight halts** on a `tracker_path` other than `not-applicable`, and on a queue id that is not an issue number.
4. **The commit carries `#<id>`, not followed by a digit,** and the drivers verify it. `#421` is not `#42`, and a bare `42` would also match `TASK-0042` in a `git log --grep`.
5. **The run never reads or writes the forge.** No role runs `glab` or `gh`, so no forge token is in the run. The handover ends with *Forge updates, NOT taken*, listing per closed or parked issue what the human does once the push is confirmed. This extends `ADR-0022` clause 4: merge, push and now the issue are the human's.
6. **The snapshot is temporary.** Once the issue carries it, the human removes it in its own commit; a parked issue keeps its snapshot until it is re-queued.

## Alternatives considered

- **Read the live issue and lock it by a hash in the journal:** rejected by the human. It puts a token and the network in an unattended run, and the lock becomes a journal line rather than a commit.
- **Let the closer comment on the issue:** rejected by the human. The comment would describe a commit nobody has pushed, and `tracker.md` closes an issue only after a confirmed push.
- **A `work_tracker` slot in the binding:** rejected. It would be a second owner of what `tracker.conf` says, and the two could disagree.
- **Declaring unattended runs files-only:** rejected; it would have left `ADR-0037`'s forge mode without the loop.

## Consequences

- A forge project can run `loops/unattended-run/` offline. The price is a snapshot commit before the run, and a removal commit per closed issue after it.
- Between the lock and the close, the snapshot and the issue can disagree. The snapshot wins for the run, and the human reconciles them after it.
- On Claude Code the forge boundary is prompt-level. On OpenCode the closer's allowlist already denies `glab` and `gh`.
- Neither driver has run against a real forge project; the tests are against stubs.
- `unattended-ops` is 1.4.0.
