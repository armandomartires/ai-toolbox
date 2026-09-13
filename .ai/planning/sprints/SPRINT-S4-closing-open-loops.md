# Sprint S4 — Closing the open loops (closed)

Phase 4. Opened and closed 2026-09-13. Checkpoint: REVIEW-0006.

Goal: close every backlog item that could be closed, and convert the ones
that could not into a recorded decision or a written human-action procedure.

## Tasks

| Task | Subject | Backlog | Commit | Status |
|------|---------|---------|--------|--------|
| TASK-0012 | Skill linter — frontmatter rules only | B-002 | 9151bb0 | done |
| TASK-0013 | MIT LICENSE backing the skills' `license:` claims | B-004 | 741f698 | done |
| TASK-0014 | `install.sh` warns on the `core.filemode=false` hook trap | — | 05b6e59 | done |
| TASK-0015 | Env vars documented + enforced; git remote wired; CI verified | B-001 (unblocked) | ea5372e, d586ed0 | done |
| TASK-0016 | Human-action runbook; Python-shape decision | — | bd916bc | done |

## Decisions recorded
- **ADR-0008** — skill linting is frontmatter-only; no `SKILL.md` line
  budget was invented, and the precondition for adding one is stated.
- **ADR-0009** — configuration is environment-supplied; validation checks
  documentation completeness, never runtime variable presence.
- **ADR-0010** — the authored Python MCP shape stays unexercised until a
  real use case exists, with a concrete reopen trigger.

## Outcome
All five exit criteria met. B-002 and B-004 closed. `origin` wired
(private) and CI verified by an observed run rather than assumed. Two
items that had recycled through three candidate lists are now a runbook
procedure and an ADR.

## What this sprint was really about
Not code — process. Of seven open items, only two were agent-completable.
The rest needed a human decision, a GUI, or a use case that did not exist.
Nothing had distinguished "not yet done" from "cannot be done by an agent",
so the same items resurfaced every sprint.

Two carried-forward items turned out not to be blocked at all, merely
undocumented: the git remote (credentials had been in the environment the
whole time) and B-002 (its title bundled a specified requirement with an
unspecified one). See REVIEW-0006 findings 1–2.

Full findings, including the test harness that proved nothing and the two
checks that could not fail: REVIEW-0006.
