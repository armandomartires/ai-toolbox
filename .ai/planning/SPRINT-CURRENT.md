# No active sprint

Phases 1–4 are complete. No sprint is in progress and no phase is currently
defined.

Closed sprints are archived in `.ai/planning/sprints/`:

| Sprint | Phase | Tasks | Checkpoint |
|--------|-------|-------|-----------|
| S1 Foundation | 1 | TASK-0001…0007 | REVIEW-0003 |
| S2 Multi-client hardening | 2 | TASK-0008, TASK-0009 | REVIEW-0004 |
| S3 Automation | 3 | TASK-0011, TASK-0010 | REVIEW-0005 |
| S4 Closing the open loops | 4 | TASK-0012…0016 | REVIEW-0006 |

## Open items — and what each one actually is

S4 deliberately ended the practice of listing everything as a "candidate",
which had let two uncompletable items recycle through three sprints. Each
open item is now labelled with who can act on it.

| Item | Kind | Where |
|------|------|-------|
| ~~LM Studio UI verification~~ | **CLOSED 2026-09-13** by TASK-0017 — passed, and found the `WORKSPACE_ROOT` placeholder defect while doing so | `configs/lm-studio/README.md` |
| Authored (Python) MCP shape never exercised | **decided** — deferred with a reopen trigger. Not a candidate. | ADR-0010 |
| ~~B-001 subagent-run registry validation~~ | **CLOSED 2026-09-13** by TASK-0018 as *superseded*, not implemented (ADR-0011). Scoping it found and fixed two real registry defects. | ADR-0011 |
| Default branch mismatch (`main` on GitHub vs `master` local) | **needs authorization** — renaming a default branch is destructive-ish | REVIEW-0006 follow-up 3 |
| ~~`WORKSPACE_ROOT` placeholder in the live `mcp.json`~~ | **CLOSED** — human corrected it to a real Ansible project directory; re-verified to exist | `configs/lm-studio/README.md` |

TASK-0017 is evidence for the reframing above: the LM Studio item survived
three sprints as a candidate bullet and was closed within a day of becoming
a written procedure. The blocker was the *form of the record*, not the work.

**The backlog is now empty** — every item B-001…B-007 is closed. New work
needs a new item with its own justification, not a revived old one.

## If you are scoping Phase 5

Nothing is in flight, and **nothing above is pending agent work.** Of the
five items, three are closed, one is a standing decision (ADR-0010), and one
needs the human's authorization. Confirm scope before starting anything.

## Standing constraints
- Local git is mandatory; a remote is recommended (ADR-0007). One now
  exists (private) but that does not promote it to mandatory.
- Credentials come from the environment; `.env.example` documents names and
  meanings only, never values (ADR-0009). Never put a token in a remote URL
  or a tracked file.
- `tests/validate.sh` is a commit gate. Its hermeticity — offline, no
  network, sub-second — is load-bearing. Never add `tests/smoke-mcp.sh` to
  the hook, and never add a check that requires an environment variable to
  be set: it would fail on every fresh clone and in CI.
- CI is a second opinion, not the gate. The hook prevents a bad commit; CI
  only reports one already made.
- **Check whether an item is blocked or merely unwritten.** ADR-0005 through
  ADR-0010 exist because a criterion written at scaffold time met reality
  and lost. S4 found two items that looked blocked and were only
  undocumented.
- A check that cannot fail is worse than no check, because it is still
  trusted. Prove every new check fails for the right reason.
