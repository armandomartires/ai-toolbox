# ADR-0012 — Task handover is a contract; resumability is the invariant

## Status
Accepted (2026-09-13)

## Context
The `project-workflow` skill's task template
(`skills/project-workflow/templates/tasks/0000_TEMPLATE.md`) has five
sections: Goal, Plan, Files touched, Verification, Status notes. **None
of them names what a task consumes, and none names what the next task
picks up.** A task file therefore describes its own work but not its
place in a chain.

The skill nonetheless presumes work spans multiple sessions.
`00.CONVENTIONS.md:6` calls itself "mandatory-read every session";
`reference/size-budgets.md:6` says both index files "are read at the
start of every session"; the size budgets exist *because* those files are
re-read cold. Yet the skill states no session boundary rule, no cold-start
read order, and no handover mechanism anywhere. The presumption is load-
bearing and unwritten.

`ai-toolbox` itself is further along than the skill it owns.
`.ai/templates/TASK.md` already carries `Minimal context`,
`Preconditions`, `Dependencies` and `Expected result`; `.ai/sessions/`
plus `INDEX.md` already implement file-based narrative bridging across
eleven sessions. Roughly 60% of a handover contract exists here, unnamed
as such — and **none of it has propagated back to the skill**, which
`reference/skill-maintenance.md:23-26` requires. ADR-0004 makes this repo
the skill's canonical owner, so that gap is this repo's to close.

Three separate questions had to be answered before writing any of it, and
each has a wrong answer that looks right.

**Session boundaries.** The proposal that prompted this work was to
codify "one task = one session" outright, citing production agent
practice: rotate proactively, sync durable state at ~60–70% context, hand
off before 80%, use files as narrative bridges. The mechanism is sound.
The rule, stated absolutely, contradicts this repo's own record:
`.ai/sessions/INDEX.md:15` shows `SESSION-20260914-0100` completing
ADR-0008, ADR-0009, ADR-0010, TASK-0012…TASK-0016 and REVIEW-0006 in a
single session — the sprint that emptied the backlog. A blanket rule
would have forbidden the most productive session in this project's
history.

**What a check can prove.** The same proposal described the contract as
turning prose into "a machine-checkable contract". A check can verify a
heading exists and has content beneath it. It cannot verify that the
declared inputs are the real inputs, or that the declared output state
matches the tree. ADR-0009 already settled the general form of this:
validation checks *documentation completeness*, never runtime presence.
ADR-0011 settled the adjacent one: a gate must be deterministic and
hermetic. And `CURRENT_STATE.md:99-104` records the lesson that keeps
recurring — **a check that cannot fail is worse than no check, because it
is still trusted** — with TASK-0017's corollary that a green signal is
not a validated configuration.

**Existing history.** Nineteen completed task files predate this
convention. The skill's own guidance is that "a task brief invented
retroactively to look tidy is not compliant with this convention";
rewriting TASK-0001…0019 to satisfy a rule invented afterwards would
manufacture exactly that.

## Decision

### 1. Every task file carries an explicit handover contract
Two sections, tabular rather than prose, because a table forces the
facts a paragraph lets an author omit:

- **`## Inputs`** — each artifact the task consumes: what it is, which
  prior task produced it, and the state it is expected to be in.
- **`## Outputs / handover`** — each artifact the task produces or
  modifies, its expected end state, and a single
  `**Next task starts here**:` line.

In the skill's template, `## Inputs` is **added** and
`## Outputs / handover` **absorbs the existing `Files touched`**. In this
repo's `.ai/templates/TASK.md` both are a **rename-and-merge**:
`Minimal context`, `Preconditions` and `Dependencies` collapse into
`## Inputs`, and `Expected result` becomes `## Outputs / handover`.
Adding new sections alongside ones that already carry the same
information would put one fact in two places — violating the governing
one-owner rule inside the very artifact that states it. Net section count
grows by one in the skill's template and not at all in this repo's.

**Correction (2026-09-13, during TASK-0021).** This paragraph originally
read "In the skill's template these are **added** (it has no equivalent
sections)." That was wrong: `Files touched` is output-shaped, so adding
`Outputs / handover` beside it created exactly the duplication this
decision forbids. Caught while reading the rendered template, not by any
check. Corrected rather than silently rewritten, because the error is
instructive — the ADR asserted a fact about a five-section file without
enumerating those five sections against the rule it was stating.

### 2. Resumability is the mandatory invariant; session rotation is a heuristic
**Mandatory:** every task must be startable cold, in a brand-new session,
from its own task file plus the two index files — with no dependency on
conversation history. This is the property that actually matters, and it
is checkable by inspection: open the task file in a fresh session and see
whether you know where to begin.

**Advisory:** one task per session is the *default* way to achieve it.
Proactive rotation — sync the durable files at ~60–70% context, hand off
before ~80% — is the other. Neither is mandatory. A session may close
several tasks (S4 did) provided each one's file independently satisfies
the invariant.

The percentages are deliberately labelled a heuristic, not a rule: they
are a property of current context-window sizes, and a number baked into a
convention outlives the hardware assumption that justified it.

Within a single task, delegating research or bulk mechanical work to a
subagent stays sanctioned, with the main agent verifying results —
unchanged from `AGENTS.md`. ADR-0011's limit also stands: a subagent
cannot gate a commit.

### 3. Validation detects omission, and says so
`tests/validate.sh` gains a check that the task template still carries
both headings, and that task files numbered **≥ 0020** have non-empty
`## Inputs` and `## Outputs / handover` sections.

This is **omission and template-rot detection, not contract
verification**, and it is labelled as such in its own source comment —
the place a future reader will actually encounter it. It answers "did
someone delete these sections or leave them empty", a real regression
class. It does not answer "is this handover accurate", and must not be
presented as if it does.

The boundary is a **numeric constant (`0020`), not an allowlist** of
grandfathered files. An allowlist requires an edit for every new task and
rots the first time someone forgets; a boundary requires none. It is
commented with its reason — historical records are not retrofitted — not
merely its value.

### 4. Existing task files are not retrofitted
TASK-0001…TASK-0019 stay exactly as written. They are records of what
happened, not instances of the current template.

## Alternatives considered

- **Codify "one task = one session" as a hard rule.** Rejected on this
  repo's own evidence (see Context). It would have forbidden
  `SESSION-20260914-0100`. Kept as the documented default rather than a
  constraint, so the guidance survives without the false absolute.

- **Add `## Inputs`/`## Outputs` alongside this repo's existing
  `Preconditions`/`Dependencies`/`Expected result`.** Rejected: it
  creates two owners for the same fact. The merge costs one template edit
  now; the duplication would cost a divergence later, and this repo has
  already watched a test count drift between two files for exactly that
  reason (`reference/size-budgets.md:10-13`).

- **Describe the contract as machine-checkable and check it accordingly.**
  Rejected as overclaiming, per ADR-0009 and the recurring lesson at
  `CURRENT_STATE.md:99-104`. The check ships; the claim does not.

- **Skip validation entirely — document the convention and rely on
  discipline.** Rejected, but it was the closest call. The argument for
  it is that a presence check risks being read as a correctness check.
  The argument against is stronger: an unenforced template section is the
  first thing to disappear under time pressure, and the failure is
  silent. Mitigated by naming the limit in the source comment rather than
  by dropping the check.

- **Retrofit the nineteen existing task files.** Rejected — see
  Decision 4. It would fabricate compliance and destroy the record of how
  the convention actually evolved.

- **Put the handover rules in `00.CONVENTIONS.md`.** Rejected on budget
  grounds: that file is mandatory-read every session and is *already*
  3087 bytes against its own declared ≲3 KB cap. The rules go in
  `reference/session-handover.md` (load-on-demand) and the entry point
  gains one table row — and TASK-0020 pays the pre-existing 15-byte
  overage rather than inheriting it, since
  `reference/size-budgets.md:35-38` forbids raising a cap to fit what is
  already there.

## Consequences

- **The skill gains a session-boundary concept it has never had**, in
  `reference/session-handover.md`. `metadata.version` goes to `3.1.0`
  (ADR-0003's semver rule), and the deployed copy is re-synced and
  verified with `diff -rq` in the same task — REVIEW-0002 found three
  copies claiming `2.1.0` while differing in content, and that class of
  drift is not to be recreated.

- **`tests/validate.sh` begins reading `.ai/`.** It never has; the gate
  has been about components, not governance. A governance-only edit can
  now fail a commit. Accepted deliberately — that failure is the omission
  worth catching — but recorded as the genuine scope change it is rather
  than slipped in. The gate's hermeticity, offline operation and
  sub-second runtime remain non-negotiable (`SPRINT-CURRENT.md` standing
  constraints).

- **A green gate does not mean the handovers are good.** It means no
  section is missing or empty. Anyone reading the check's result as
  stronger than that is making TASK-0017's mistake — a green connection
  is not a validated configuration.

- **TASK-0019 and earlier will pass without the new sections**, which
  will look like a broken check to a reader who does not know about the
  boundary. The constant carries a comment explaining why, at the place
  it is defined.

- **A future project scaffolded from this skill inherits the contract;
  already-scaffolded projects do not.** The copy-never-symlink rule is
  unchanged. `ai-toolbox`'s own adoption is therefore a separate,
  deliberate task (TASK-0022, TASK-0023), not a side effect of improving
  the skill.

- **The handover artifact is the commit.** Because a task's outputs are
  declared in its file and its commit hash is recorded there, per-task
  rollback and audit come for free — no new mechanism needed.

## Implementation
`.ai/planning/plans/PLAN-0002-session-handover-contract.md` — four
phases: this ADR, then TASK-0020 (skill reference + budget), TASK-0021
(skill template + version), TASK-0022/TASK-0023 (this repo's adoption and
the check).
