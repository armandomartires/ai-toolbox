# Sprint — S3 Automation (not yet scoped)

> **Status: awaiting human confirmation of scope.** No task briefs are
> written yet, deliberately. `AGENTS.md`'s ambiguity policy says not to
> invent requirements — the candidate list below comes from
> REVIEW-0004's follow-ups and the roadmap's Phase 3, but which of them
> belong in one sprint is a decision, not a deduction.

- Phase: 3 — Automation (`ROADMAP.md`).
- Phase 3 objectives as written: CI checks (frontmatter validation,
  server smoke tests); registry automation in task flow.
- Phase 3 exit criterion as written: `tests/validate.sh` wired into CI
  or pre-commit.
- Previous sprint: `.ai/planning/sprints/SPRINT-S2-multiclient-hardening.md`;
  checkpoint `.ai/reviews/REVIEW-0004-sprint-s2-multiclient-hardening.md`.

## Candidate scope (from REVIEW-0004's follow-ups)

| # | Candidate | Why now | Size |
|---|-----------|---------|------|
| 1 | Wire `tests/validate.sh` into pre-commit and/or CI | Phase 3's stated exit criterion; the gate exists and is hermetic, so wiring it is mechanical | small |
| 2 | B-007: de-duplicate `sync-registry.sh`'s per-section loops, or assert no registry row points at a `_template*` path | The same template-leak defect was fixed three times; the duplication is the cause | small |
| 3 | Decide CI's treatment of `tests/smoke-mcp.sh` | It is CI-callable but network-dependent; a CI job must handle SKIP correctly rather than reading it as pass | small |
| 4 | B-002: skill linter (frontmatter + line budget) | "ready" for two sprints; either scope it or drop it honestly | medium |

## Known gaps that are *not* candidates
- **LM Studio UI verification** of the ansible server — needs a human with
  the GUI open. Not a task until someone can do it.
- **The authored (Python) MCP server shape has never run.** Only
  `mcp-servers/_template/` uses it, and `smoke-mcp.sh` handles external
  manifests only. Building for a shape with no instance is what ADR-0005's
  paper-check deliberately avoided; noted, not scheduled.

## Open questions for the human
1. Does CI mean GitHub Actions? **There is still no git remote
   configured** — every task so far has recorded "nothing to push". A CI
   sprint presupposes a remote, so that comes first or CI means a local
   pre-commit hook instead.
2. Is a pre-commit hook acceptable given the repo is developed in WSL
   against a `/mnt/c` working tree? Hook performance there is worth
   measuring before committing to one.

## Status
- Completed tasks: none. Blocked tasks: none — scope not yet set.
- Recommended next action: confirm scope, then write task briefs.
