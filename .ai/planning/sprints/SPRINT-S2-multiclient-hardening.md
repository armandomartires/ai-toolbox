# Sprint — S2 Multi-client hardening (CLOSED 2026-09-13)

> Archived. The active sprint is `.ai/planning/SPRINT-CURRENT.md`.
> End-of-sprint checkpoint:
> `.ai/reviews/REVIEW-0004-sprint-s2-multiclient-hardening.md`.

- Objective: close Phase 2 by exercising the two component shapes that
  exist only as scaffolding (loops) or only as manual steps (MCP server
  startup verification), and by resolving the two roadmap claims S1 found
  to be unsatisfiable.
- Time reference: follows S1, closed 2026-09-13.
- Previous sprint: `.ai/planning/sprints/SPRINT-S1-foundation.md`;
  checkpoint `.ai/reviews/REVIEW-0003-sprint-s1-foundation.md`.

## Included tasks
| Task | Title | Depends on | Status |
|------|-------|-----------|--------|
| TASK-0008 | Author the first loop component (`release-check`) | ADR-0006 | **done** |
| TASK-0009 | MCP server smoke-test harness (backlog B-003) | TASK-0007 | **done** |

Recommended order: 0008 → 0009. No hard dependency between them; 0008 is
first because it is smaller and because the loop it authors describes the
validate/commit cycle that 0009 then adds a step to.

## Already resolved this sprint (before task work)
- **ADR-0006** settles both items S1 carried forward:
  - Phase 2's exit criterion, previously unmeetable ("one skill and one
    MCP server working in all clients" — LM Studio has no Agent Skills
    target), restated per capability in `ROADMAP.md`.
  - `AGENTS.md`'s portability sentence scoped per capability to match.
  - Backlog B-005 closed by that ADR; B-006 re-verbed from "port a loop"
    to "author a loop" after investigation found no first-party loop
    artifact existed to port.

## Success criteria
- `loops/` holds at least one real, non-template component, listed in the
  registry, and `tests/validate.sh` checks loop structure as it does
  skills and MCP manifests.
- A repeatable command verifies that an MCP server actually starts and
  speaks the protocol — replacing the by-hand `initialize` handshake used
  in TASK-0006.
- Every new check is observed failing for its own expected reason before
  being trusted (the S1 lesson: a script reporting success is not
  evidence the effect happened).
- `tests/validate.sh` green; registry regenerated; no templates listed as
  real components.

## Risks
- **Loop content duplicating `AGENTS.md`.** The first loop describes this
  repo's own validate/commit cycle, which `AGENTS.md` owns normatively.
  Mitigation: the loop states sequence and exit conditions and *links* for
  the rules — the one-owner rule applies to loops too (ADR-0006).
- **Smoke test needing network and a real package.** `npx -y` fetches
  upstream, so the harness is not hermetic and will fail offline.
  Mitigation: keep it out of `validate.sh`'s default path, or make it skip
  cleanly when offline rather than reporting a false failure. Decide in
  TASK-0009 and state the reasoning.
- **Scope creep into Phase 3.** CI wiring is Phase 3's objective, not
  this sprint's. A harness that runs locally is in scope; wiring it into
  CI or a pre-commit hook is not.

## Out of scope
- LM Studio UI verification of the ansible server (needs the GUI launched
  interactively; recorded as a known gap, not a task).
- Porting `bmad-workflow.md` from `opencode-customization`, or vendoring
  third-party loop skills — both rejected in ADR-0006, and neither
  foreclosed for later.
- CI/pre-commit integration (Phase 3).

## Status
- Completed tasks: TASK-0008, TASK-0009. Blocked tasks: none.
- **Sprint S2 is complete.** No open tasks remain.
- Criteria status: `loops/` holds a real component and `tests/validate.sh`
  enforces loop structure (TASK-0008) — met. A repeatable command verifies
  MCP servers actually start and speak the protocol, replacing TASK-0006's
  by-hand handshake (TASK-0009, `tests/smoke-mcp.sh`) — met. Every new
  check was observed failing for its own reason before being trusted — met
  (6 loop fixtures, 7 smoke fixtures). Registry regenerated with no
  template rows — met.
- Phase 2 exit criteria (as restated by ADR-0006): all met except the LM
  Studio UI verification, which is a recorded known gap rather than a task
  (needs the GUI launched interactively). Phase 2 can close; Phase 3
  (CI/pre-commit automation) is next, and `tests/smoke-mcp.sh` was
  deliberately built to be CI-callable without being CI-wired.
- Noted at TASK-0008: the template-leak defect recurred a **third** time,
  in the loops registry loop (after the MCP loop in TASK-0005 and the
  skills loop in TASK-0006). All three are now fixed and the registry
  contains no template rows. Three instances of one defect in one
  codebase suggests the generator's per-section duplication is itself the
  problem — worth a refactor if a fourth section is ever added.
