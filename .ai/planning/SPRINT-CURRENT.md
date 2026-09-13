# Sprint S5 — Session handover contract

**Phase 5. Opened 2026-09-13.** The first sprint since S1 to start from a
written plan rather than a backlog item: `PLAN-0002`.

## What this sprint is for
Give the `project-workflow` skill an explicit **handover contract**, so a
task can be picked up cold in a fresh session from its own file plus the
two index files — then adopt that contract in `ai-toolbox` itself.

The gap is concrete. The skill's task template
(`skills/project-workflow/templates/tasks/0000_TEMPLATE.md`) has Goal,
Plan, Files touched, Verification, Status notes. **Nothing names what a
task consumes; nothing names what the next task picks up.** Meanwhile the
skill presumes multi-session work in three places
(`00.CONVENTIONS.md:6`, `reference/size-budgets.md:6`, and the byte
budgets themselves, which exist *because* files are re-read cold) without
ever stating a session boundary or a read order.

This repo is ahead of the skill it owns: `.ai/templates/TASK.md` already
has `Minimal context`/`Preconditions`/`Dependencies`/`Expected result`,
and `.ai/sessions/` has been a working narrative bridge for eleven
sessions. None of it propagated back, which
`reference/skill-maintenance.md:23-26` requires and ADR-0004 makes this
repo's job.

## Tasks

| Task | Depends on | Status | What |
|------|-----------|--------|------|
| ADR-0012 | — | **accepted** | Handover is a contract; resumability is the invariant; what validation may claim |
| TASK-0020 | ADR-0012 | planned | Skill: `reference/session-handover.md`; restore `00.CONVENTIONS.md` to its byte budget |
| TASK-0021 | TASK-0020 | planned | Skill: template `Inputs`/`Outputs`; version → `3.1.0`; re-sync deployed copy |
| TASK-0022 | TASK-0021 | planned | This repo: merge four sections into the two contract sections |
| TASK-0023 | TASK-0022 | planned | `validate.sh`: omission check, `≥ 0020` boundary |

Order matters. The skill is canonical (ADR-0004), so its shape settles
first (0020, 0021) and this repo adopts a finished contract (0022) before
anything is enforced against it (0023). Enforcing a still-moving shape is
how a check ends up written against headings that then change.

Sequenced to run one task per session, but that is the default rather
than a rule — see ADR-0012's second decision.

## Decisions taken at plan time — do not re-open
1. **Resumability is the mandatory invariant; one-task-one-session is
   the default, not a rule.** `INDEX.md:15` records `SESSION-20260914-0100`
   closing five tasks, three ADRs and a review — the session that emptied
   the backlog. A blanket rule would have forbidden it.
2. **The validation check detects omission, not correctness**, and says
   so in its own source. Per ADR-0009 and the standing lesson that a check
   which cannot fail is still trusted.
3. **Skill first, then this repo adopts deliberately.**
   Copy-never-symlink means improving the skill changes nothing here on
   its own.

All three were human decisions this session. ADR-0012 records the
evidence for each.

## Known debt this sprint pays rather than inherits
`skills/project-workflow/templates/00.CONVENTIONS.md` is **3087 bytes
against its own declared ≲3 KB cap** — over before this sprint adds a
row. `reference/size-budgets.md:35-38` forbids raising a cap to fit what
already exists, so TASK-0020 moves content out. Found while reading for
PLAN-0002; nobody had measured it.

## Standing constraints
Unchanged from S4, and two bind this sprint directly:

- `tests/validate.sh` is a commit gate. Offline, hermetic, sub-second —
  all three load-bearing. TASK-0023 must not weaken any of them, and must
  never add a check requiring an env var or the network.
- A check that cannot fail is worse than no check, because it is still
  trusted. Prove every new check fails for the right reason.
- Local git mandatory, remote recommended (ADR-0007); a private remote
  exists. Credentials from the environment only (ADR-0009).
- CI is a second opinion, not the gate.
- Check whether an item is blocked or merely unwritten. S4 found two that
  looked blocked and were only undocumented.

## Out of scope, recorded not hidden
- **Retrofitting TASK-0001…0019** to the new template. ADR-0012
  Decision 4: they are records of what happened, and a brief written
  retroactively to look tidy is not compliance.
- **`.ai/decisions/` dual naming** — `ADR-0001-…` through `ADR-0007-…`,
  then `0008-…` through `0011-…`. Real inconsistency, found while reading
  for PLAN-0002, unrelated to handover. Logged as B-008.
- **Automating `.ai/sessions/` records.** Works by hand; no evidence it
  needs tooling.
- **`opencode-customization`'s stale skill copy** — that repo's
  follow-up per ADR-0004.
