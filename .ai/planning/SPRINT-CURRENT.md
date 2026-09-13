# Sprint S5 — Session handover contract

**Phase 5. Opened and completed 2026-09-13.** The first sprint since S1
to start from a written plan rather than a backlog item: `PLAN-0002`.

**All four tasks are done.** Awaiting `REVIEW-0007`, the S5 checkpoint.
Commits: `c240f02` (T0020), `0f36d66` (T0021), `cdedb45` (T0022), and
T0023 below.

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
| TASK-0020 | ADR-0012 | **done** | Skill: `reference/session-handover.md`; `00.CONVENTIONS.md` 3087→3060 bytes |
| TASK-0021 | TASK-0020 | **done** | Skill: template `Inputs`/`Outputs` (6 sections, not 7); version `3.1.0`; two unfailable checks struck |
| TASK-0022 | TASK-0021 | **done** | This repo: 3 sections merged (not 4) → 16→15. `Minimal context` retained as narrative |
| TASK-0023 | TASK-0022 | **done** | `validate.sh`: omission check, `≥ 0020` boundary, recursive. 7 proof cases |

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
~~`00.CONVENTIONS.md` is 3087 bytes against its own ≲3 KB cap.~~
**Paid by TASK-0020: 3087 → 3060 bytes**, by moving a provenance sentence
already owned by `skill-maintenance.md`, not by raising the cap.

TASK-0020 also found *why* it had gone unnoticed for four sprints: the
target read "**≲3 KB**", which is either 3000 or 3072 depending on the
reader. A budget whose number is ambiguous cannot be checked. Now stated
as the exact `≤3072 bytes`. **12 bytes of headroom remain** — any later
task touching that file must re-measure.

## Resolved: the unfailable deployment checks (TASK-0020 → TASK-0021)
**Both** skill deployments are symlinks (ADR-0002, `install.sh link`):
`~/.claude/skills/…` and `~/.config/opencode/skills/…` both
`readlink -f` to the repo path. So `diff -rq` against "the deployed copy"
compares a directory with itself, and grepping it for a new version reads
the repo file. Both checks came from PLAN-0002 and cannot fail.

**Resolution (TASK-0021): recorded, not substituted.** No
`copy`-installed client exists on this machine, so rather than invent a
test, the finding stands as a property of the install mode:
**repo↔deployed drift is structurally impossible in this environment**,
and any future check claiming to detect it is checking nothing. The
checks were struck *before* being run, so the record shows the decision
preceding the convenient pass.

## The recurring defect in this sprint — four for four
Every executed task hit the same class: **a confident claim about a
small, readable artifact that nobody actually read.**

- TASK-0020: the handover note asserted the deployed copy was stale. It
  was a symlink. Caught by verifying before committing.
- TASK-0021: **ADR-0012 stated the skill's task template "has no
  equivalent sections"** to `Inputs`/`Outputs`. `Files touched` is
  output-shaped, so following the ADR literally created the exact
  duplication it forbids. Sections merged; ADR corrected in place.
- TASK-0022: PLAN-0002 specified a **four**-section merge. Measuring the
  23 real task files showed `Minimal context` carries narrative averaging
  ~25 lines and reaching 82 — root-cause analysis, sub-headings, its own
  tables. Merged three; kept it. Also found `Likely files` in the same
  ownership grey zone `Files touched` had occupied.

- TASK-0023: **its own check** silently exempted `.ai/tasks/completed/`
  — a directory `.ai/README.md` documents as a destination for task
  files. A brief could have evaded the gate by being archived. Found by
  the fails-when-reverted proofs, fixed with a recursive walk before
  shipping.

**The plan is a hypothesis about files, not a description of them.**
Four for four is not a run of bad luck; it is the working assumption for
REVIEW-0007.

The sharper finding for the checkpoint: **the convention's own step
("verify the declared state; don't assume it") caught all four, and the
check that now exists caught none of them.** The value S5 delivered was
the verification discipline. The check is worth having — it prevents a
regression class that is otherwise silent — but it must not be mistaken
for what did the work.

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
