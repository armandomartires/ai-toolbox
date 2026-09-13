# ADR-0004 — ai-toolbox is the canonical source for the project-workflow skill

## Status
Accepted (2026-09-13)

## Context
`skills/project-workflow/` was imported into `ai-toolbox` as a copy of a
skill developed in a separate repo, `opencode-customization`
(`github.com/armandomartires/opencode-customization`). That repo has its
own `.ai/` governance layer and is running an active sprint,
`S025_WorkflowHarmonization`, specifically to fix defects in this same
skill: a live/repo mirror drift, an oversized always-loaded `SKILL.md`
and `00.CONVENTIONS.md`, and a hard-coded `.ai/` layout path. That
sprint's own accepted decision, ADR-0017 in that repo, adds a
`.ai-layout.json` declaration mechanism specifically so a project like
`ai-toolbox` (which wants `root: .ai/`, `entrypoint: AGENTS.md`, no
dedicated conventions file) can use this skill without a hard-coded path.

That repo's own roadmap (`.ai/30.ROADMAP.md`, "Next up") already planned
this outcome: **`S027`** hands `project-workflow` (and `agent-tiers`) to
`ai-toolbox` permanently, retiring `opencode-customization`'s copy;
**`S028`** bootstraps `ai-toolbox` itself, gated on `S025.T004`
(the layout-root ADR, already accepted there). Three copies of the
skill exist on this machine right now — the live install, this repo's
import, and `opencode-customization`'s own working tree — all declaring
`metadata.version: "2.1.0"` while differing in actual content (see
REVIEW-0002). That is a version-integrity defect regardless of which
repo ends up canonical.

REVIEW-0002 also found the skill, as imported, references ADR numbers
(`0005`, `0006`, `0017`) that only exist in `opencode-customization`'s
own `.ai/decisions/` — dangling citations the moment the skill is read
outside that specific checkout. A skill that ships standalone into
arbitrary target projects cannot cite another repo's private decision
numbers as its mechanism's authority.

## Decision
`ai-toolbox`'s copy of `project-workflow` becomes canonical, effective
immediately, ahead of `opencode-customization`'s own `S027`/`S028`
sequencing (human decision, 2026-09-13). Concretely:

- This skill is rewritten to be **self-contained**: every mechanism it
  describes (the `.ai-layout.json` declaration, the size-budget
  rationale, the task-ID scheme) is fully specified in its own
  `reference/` files, with no dangling citation to `opencode-customization`'s
  ADR numbers. Where that repo's ADR-0017 motivated a mechanism, this
  skill states the mechanism itself rather than pointing at a decision
  record the reader may not have access to.
- The version is bumped to `3.0.0` (see ADR-0003's semver rule) the
  moment content changes here, so `"2.1.0"` stops meaning three
  different things across three locations. Any future content change to
  this skill bumps the version again, in this repo, going forward.
- **`opencode-customization`'s retirement of its own copy, and the
  disposition of its in-progress `S025_WorkflowHarmonization` sprint, is
  explicitly out of scope for this ADR and this repo.** That repo has its
  own governance layer and needs its own task to close or redirect that
  sprint against this new reality — this ADR does not reach across repos
  to edit it. Flagged in REVIEW-0002's follow-up list.

## Alternatives considered
- **Wait for `opencode-customization`'s `S025`–`S027` to finish, then do
  the handover as that repo's own roadmap sequenced it.** Rejected by
  explicit human decision this session: the sequencing was `that repo`'s
  own plan, not a constraint `ai-toolbox` must honor, and the defects
  found in REVIEW-0002 (dangling ADR references, version-integrity) are
  real today, not contingent on the other repo's timeline.
- **Treat `ai-toolbox`'s copy as a permanent fork, unrelated to the
  source.** Rejected: it would leave the "three files claim `2.1.0`"
  defect unexplained rather than resolved, and forfeits the real
  reconciliation work already done upstream (ADR-0017's layout mechanism,
  the progressive-disclosure pattern for the two oversized files) that
  this ADR's Decision explicitly draws on, generalized rather than copied
  verbatim.

## Consequences
- `ai-toolbox` now owns this skill's future evolution. Any lesson learned
  scaffolding a real project propagates here, in `skills/project-workflow/templates/`
  — never retroactively into an already-scaffolded project (the skill's
  own copy-never-symlink rule, unchanged).
- `opencode-customization` is left with a stale copy and an unresolved
  sprint until it does its own follow-up work — a real, acknowledged gap,
  not silently fixed by this ADR.
- Every ADR-number citation this skill makes must now resolve inside
  `ai-toolbox` itself (this file, or a future `ai-toolbox` ADR) — never a
  bare "ADR 0017" with no local decisions file to back it.
