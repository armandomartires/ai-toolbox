# REVIEW-0004 — Sprint S2 (Multi-client hardening) end-of-sprint checkpoint

- Task(s) reviewed: TASK-0008, TASK-0009; ADR-0006
- Reviewer: agent (opencode), 2026-09-13
- Diff summary: `7bcd453..9336f5b` — 2 tasks, 1 ADR, 3 commits. Added the
  repo's first loop component, loop structure validation, and a
  manifest-driven MCP smoke-test harness. Resolved the two roadmap claims
  S1 found unsatisfiable.

## Sprint objective vs. outcome

Objective was to "close Phase 2 by exercising the two component shapes
that exist only as scaffolding (loops) or only as manual steps (MCP server
startup verification), and by resolving the two roadmap claims S1 found to
be unsatisfiable."

| Success criterion | Result |
|---|---|
| `loops/` holds a real component; `validate.sh` checks loop structure | pass |
| Repeatable command verifies an MCP server starts and speaks the protocol | pass — `tests/smoke-mcp.sh` |
| Every new check observed failing for its own reason before being trusted | pass — 6 loop fixtures + 7 smoke fixtures |
| `validate.sh` green; registry regenerated; no templates listed | pass |

All four met. Unlike S1, nothing in the objective went undelivered.

## Phase 2 exit criteria (as restated by ADR-0006)

| Criterion | Status |
|---|---|
| One skill working in every client that supports skills | met (TASK-0006) |
| One MCP server wired in all three clients | met — Claude Code `✔ Connected`, OpenCode in live use, LM Studio config + handshake verified |
| `configs/<client>/README.md` complete for every client | met |
| At least one loop component exists and is exercisable | met — and exercised twice, on its own commit and TASK-0009's |
| MCP startup verified by a repeatable check | met |

**Phase 2 can close.** One known gap remains, recorded rather than
counted as done: LM Studio's ansible server is unverified *in the app's
own UI*, which needs the GUI launched interactively. That is a client-side
manual step, not repo work.

## Findings

### What this sprint got right
- **ADR-0006 fixed the criteria rather than the scoreboard.** Phase 2's
  original exit criterion was unmeetable because LM Studio has no Agent
  Skills target — a client capability gap, not a repo defect. Splitting it
  per capability preserved LM Studio's *real* MCP coverage instead of
  either failing forever or dropping the client wholesale.
- **A wrong verb was caught before it wasted work.** Backlog B-006 said
  "port a loop". A filesystem-wide search found nothing in `loop.md` shape
  anywhere, and the three near-candidates each failed for a different
  reason (vendor-bundled third-party; canonically owned by another repo
  and coupled to OpenCode-specific agent names; already owned normatively
  by `AGENTS.md`). The row was corrected to "author", not deleted —
  the verb was the defect and the record says so.
- **The loop was dogfooded, and it earned its keep immediately.** Its
  step 3 surfaced a *third* instance of the template-leak defect, in the
  loops registry loop; its step 6 caught it before the commit. Its step 4
  ("verify the effect, not the exit code") drove the direct checks in
  TASK-0009 rather than trusting a clean `git status`.
- **SKIP was kept a first-class outcome.** `smoke-mcp.sh` reports PASS,
  FAIL, and SKIP distinctly, prints "SKIP is not a pass" in its summary,
  and was proven to exit 0 on SKIP and 1 on FAIL. Collapsing the two is
  the standard way a harness becomes theatre.
- **The mandatory gate stayed hermetic.** The smoke test needs the network
  and tens of seconds; `validate.sh` is 326 ms with zero network calls and
  was verified untouched. Folding them together would have made every
  task's validation fail on an offline laptop.

### The recurring defect, and what it actually says
The template-leak bug had to be fixed **three times** — the MCP loop
(TASK-0005), the skills loop (TASK-0006), the loops loop (TASK-0008). Each
fix was correct; the pattern is the finding. `scripts/sync-registry.sh`
duplicates near-identical iteration logic per component section, so a
rule added to one section does not reach the others.

The right response is not a fourth fix. It is either a refactor to a
single parameterized loop, or a validation check that no registry row
points at a `_template*` path. Recorded as backlog B-007 rather than done
opportunistically inside an unrelated task.

Notably, `tests/smoke-mcp.sh` skips templates from the outset — the lesson
transferred to new code even though the old code still carries the shape.

### Process observations
- **Both S2 tasks landed without splitting**, unlike S1 where one TODO
  line became three tasks. The difference: S2's tasks were scoped against
  observed reality (a search for loops, a working handshake already in
  hand) rather than against a plan's wording.
- **A brief deliberately left one decision open** (smoke test inside
  `validate.sh` or beside it) with the tension stated and a
  recommendation. The executing session decided it, verified the decision
  held, and recorded the reasoning. That is the right amount of
  pre-commitment for a judgement that benefits from seeing the code.
- Two ADRs in two sprints now exist because a rule written at scaffold
  time met reality and lost (ADR-0005: Python-only MCP servers; ADR-0006:
  skills in all clients). Both were written before any real instance
  existed to check against. Worth remembering when writing the Phase 3
  criteria.

## Validation results
- `bash tests/validate.sh` → OK, 326 ms, no network calls, unmodified by
  TASK-0009.
- `bash tests/smoke-mcp.sh` → `PASS ansible: serverInfo.name=ansible-mcp-server
  version=0.1.0 protocol=2024-11-05 capabilities=resources, tools`.
- Fails-when-broken proofs: 6/6 loop checks, 7/7 smoke outcomes, each for
  its own distinct reason, including a valid case per suite to prove the
  checks are not failing unconditionally.
- `bash scripts/sync-registry.sh` → no template rows in any table.
- `bash scripts/install.sh link` → clean, idempotent.
- `git status` clean; all fixtures removed.

## Verdict
**approve.** Sprint S2 met every criterion it set. Phase 2 can close.

## Follow-up tasks
1. **B-007 (new): de-duplicate `scripts/sync-registry.sh`'s per-section
   loops**, or add a check that no registry row points at a `_template*`
   path. Three identical fixes is sufficient evidence the shape is wrong.
2. **Phase 3 planning** — CI/pre-commit wiring. `tests/smoke-mcp.sh` was
   built CI-callable (manifest-driven, bounded timeouts, distinct exit
   codes) but deliberately not CI-wired; that is Phase 3's job. Note the
   network dependency: a CI job running it must treat SKIP correctly.
3. **B-002 (skill linter)** — still open, condition long met. Either scope
   it or drop it honestly; it has been "ready" for two sprints.
4. **LM Studio UI verification** — unchanged known gap, needs a human
   with the GUI open. Not a task until someone can do it.
5. **Authored (Python) MCP server shape is still untested.** Only
   `mcp-servers/_template/` uses it; `smoke-mcp.sh` currently handles
   external manifests only. Not a defect — building for a shape with no
   instance is what ADR-0005's paper-check avoided — but worth noting that
   half the MCP convention has never run.
