# Sprint — S3 Automation

- Objective: make `tests/validate.sh` run automatically before every
  commit, and remove the structural cause of the template-leak defect that
  had to be fixed three times — so the newly-automated gate is protecting
  a generator that cannot silently regress in the same way again.
- Phase: 3 — Automation (`ROADMAP.md`).
- Previous sprint: `.ai/planning/sprints/SPRINT-S2-multiclient-hardening.md`;
  checkpoint `.ai/reviews/REVIEW-0004-sprint-s2-multiclient-hardening.md`.

## Decisions taken before task work (ADR-0007)
- **Local git is mandatory; a remote is recommended, not required.** Human
  rule, 2026-09-13. This repo has no remote and never has.
- Phase 3's exit criterion is therefore restated from "wired into CI or
  pre-commit" to **"`tests/validate.sh` runs automatically before every
  commit"** — a criterion that can actually be met here. CI ships as an
  inert workflow file, documented as unverified until a remote exists.
- Measured, not assumed: `validate.sh` costs ~330 ms against `git status`'s
  ~640 ms on this `/mnt/c` 9p tree. The performance objection to a hook
  does not survive measurement.

## Included tasks
| Task | Title | Depends on | Status |
|------|-------|-----------|--------|
| TASK-0011 | De-duplicate the registry generator; assert no template rows (B-007) | none | planned |
| TASK-0010 | Pre-commit hook running validate.sh; optional CI workflow | ADR-0007 | planned |

**Order: 0011 → 0010**, deliberately inverted from their numbering.
TASK-0011 changes `sync-registry.sh` and adds a `validate.sh` check;
TASK-0010 then makes `validate.sh` gate every commit. Doing 0011 first means
the hook is switched on *after* the generator defect is closed, so the
first thing the hook ever guards is already correct. Reversed, the hook
would be introduced while a known defect class is still open.

## Success criteria
- `scripts/sync-registry.sh` has one iteration path per component *kind*,
  not three near-copies of the same loop — a rule added once applies
  everywhere.
- `tests/validate.sh` fails if any registry row points at a `_template*`
  path, so the leak cannot recur silently even if the generator regresses.
- A tracked `.githooks/pre-commit` runs `validate.sh` and blocks a commit
  that fails it; `scripts/install.sh` activates it via `core.hooksPath`.
- The bypass (`git commit --no-verify`) is documented, not hidden.
- `validate.sh` remains hermetic: offline, no network, well under a second.
  `tests/smoke-mcp.sh` is never added to the hook.
- Every new check observed failing for its own reason before being trusted.

## Risks
- **The hook blocks legitimate work.** Mitigated by `--no-verify` being
  documented rather than pretended away, per ADR-0007.
- **`install.sh` now modifies repo config** (`core.hooksPath`), widening
  its role beyond client directories. Acceptable — it is already the
  post-clone entry point — but it must stay idempotent and must announce
  what it changed.
- **Refactoring the generator could change registry output.** The registry
  is generated, so a diff is the detector: regenerate and confirm the
  output is byte-identical apart from intended changes. A refactor that
  alters output silently is a failed refactor.
- **Scope creep into B-002 (skill linter).** Explicitly out of this sprint.

## Out of scope
- **B-002 skill linter** — deferred again, consciously. It overlaps
  `validate.sh`'s existing frontmatter checks and needs its own scoping;
  it has been "ready" for two sprints and should either be scoped properly
  or dropped, not bolted onto a sprint about automation.
- **Adding a git remote.** A recommendation, not this sprint's work, and
  not the agent's call to make.
- **LM Studio UI verification** — unchanged known gap; needs a human with
  the GUI open.
- **Authored (Python) MCP server shape** — still has no instance; not
  built for speculatively (ADR-0005 precedent).

## Status
- Completed tasks: none yet. Blocked tasks: none.
- Recommended next task: TASK-0011.
