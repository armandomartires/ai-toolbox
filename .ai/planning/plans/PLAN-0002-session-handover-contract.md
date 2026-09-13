# PLAN-0002 — Session handover contract for the project-workflow skill

## Objective
Give the `project-workflow` skill an explicit **handover contract**, so
that any task can be picked up cold in a fresh session from its task file
plus the two index files — without inheriting a quarter-million tokens of
prior conversation. Then adopt that contract in `ai-toolbox` itself.

The problem is real and currently unaddressed: the skill's task template
(`skills/project-workflow/templates/tasks/0000_TEMPLATE.md`) has Goal,
Plan, Files touched, Verification, Status notes. **Nothing in it names
what a task consumes, and nothing names what the next task picks up.**
The skill presumes multiple sessions — `00.CONVENTIONS.md:6` says
"mandatory-read every session", `reference/size-budgets.md:6` says both
index files are "read at the start of every session" — but states no
session boundary rule and no cold-start read order anywhere.

## Context consulted
- `skills/project-workflow/SKILL.md` — `metadata.version: "3.0.0"`; the
  version any content change must bump (ADR-0003, ADR-0004).
- `skills/project-workflow/templates/00.CONVENTIONS.md` — **3087 bytes
  against its own declared ≲3 KB (3072) budget.** Already 15 bytes over
  before this plan adds anything.
- `skills/project-workflow/templates/reference/size-budgets.md:35-38` —
  raising a budget to fit what already exists is explicitly forbidden;
  the fix is to move content, not to raise the cap.
- `skills/project-workflow/templates/reference/skill-maintenance.md:23-26`
  — lessons learned in a consuming project propagate **back to the
  skill**, never retroactively into an already-scaffolded project.
- `.ai/templates/TASK.md` — this repo's own task template, which already
  has `Minimal context`, `Preconditions`, `Dependencies`, and
  `Expected result`. Roughly 60% of the proposed contract already exists
  here, unnamed as such, and **none of it has propagated to the skill.**
- `.ai/sessions/` + `.ai/sessions/INDEX.md` — eleven session records.
  This repo already practises file-based narrative bridging; the skill
  has no equivalent concept at all.
- `.ai/sessions/INDEX.md:15` — `SESSION-20260914-0100` completed
  ADR-0008/0009/0010 + TASK-0012…0016 + REVIEW-0006 in one session. The
  counter-example to a blanket one-task-one-session rule.
- `ADR-0004` — `ai-toolbox` owns this skill's evolution; every ADR number
  the skill cites must resolve inside this repo.
- `ADR-0009` — validation checks *documentation completeness*, never
  runtime presence. Directly constrains what a handover check may claim.
- `ADR-0011` — registry validation is deterministic and hermetic; a
  subagent cannot gate a commit. Same constraint shape applies here.
- `.ai/context/CURRENT_STATE.md:99-104` — "a check that cannot fail is
  worse than no check, because it is still trusted."
- `tests/validate.sh` (373 lines) — the gate. Offline, hermetic, ~0.375 s.
  Currently validates skill frontmatter, MCP shape, loops, configs, hook
  mode, and registry integrity. **It does not read `.ai/` at all.**

## Resolved ambiguities (decided at plan time, 2026-09-13)

**1. Session boundary: invariant, not a hard rule.** The source proposal
was to codify "one task = one session" outright. Rejected against this
repo's own evidence: `SESSION-20260914-0100` closed five tasks, three
ADRs and a review checkpoint in a single session, and it was the sprint
that emptied the backlog. A blanket rule would have forbidden the most
productive session in this repo's history.

Decided: the **mandatory** property is *resumability* — every task must
be startable cold in a fresh session from its own file plus the indexes.
Session-per-task is one way to achieve it; proactive rotation (sync the
durable files at ~60–70% context, hand off before ~80%) is another. The
invariant is testable by inspection; the percentages are a heuristic and
are labelled as such, because they are a property of today's context
windows rather than of the convention.

**2. `Inputs`/`Outputs` is a restructure, not an addition.** In this
repo, `Minimal context` + `Preconditions` + `Dependencies` already carry
input-shaped information, and `Expected result` carries output-shaped
information. Adding two more sections alongside them would put the same
fact in two places — a direct violation of the skill's own governing
one-owner rule, in the very artifact that states it.

Decided: in the skill's template (which has none of those sections)
`## Inputs` and `## Outputs / handover` are **added**. In this repo's
template (which has all of them) they are a **rename-and-merge**: the
three input-shaped sections collapse into `## Inputs`, and
`Expected result` becomes `## Outputs / handover`. Net section count in
this repo does not grow.

**3. What a validation check may honestly claim.** The source proposal
called the contract "machine-checkable". It is not, in the sense that
matters: a check can verify a heading exists and has content under it; it
cannot verify that the declared inputs are the real inputs, or that the
declared output state is the actual output state. Per ADR-0009 and the
lesson at `CURRENT_STATE.md:99-104`, overclaiming here would produce
exactly the failure mode this repo keeps rediscovering — a check that
cannot fail, still trusted.

Decided: the check ships, but is **labelled in its own source comment as
template-rot and omission detection, not contract verification.** It
answers "did someone delete the handover sections, or leave them empty",
which is a real regression class. It does not answer "is this handover
correct", and must not be described as if it does.

**4. Existing task files are not retrofitted.** TASK-0001…TASK-0019 are
historical records of completed work. Rewriting them to satisfy a
convention invented afterwards would fabricate a compliance that never
existed — the same defect the skill warns about ("a task brief invented
retroactively to look tidy is not compliant").

Decided: the check applies to task files numbered **≥ 0020** via a
numeric boundary constant. Not an allowlist of grandfathered files: an
allowlist needs an edit per new file and rots; a boundary needs none.

## Phases

Each phase completes in one session and leaves the repo green
(`tests/validate.sh` passing, registry consistent, no half-written
component). Phase 1 is a prerequisite for 2 and 3; phase 4 depends on 3.

### Phase 1 — Record the decision (ADR-0012)
The session-boundary question, the overclaiming constraint, and the
no-retrofit rule are all things a future session would otherwise
re-litigate from scratch. They are also the reasons the implementation
looks the way it does. ADR before code.

**Exit criteria:** ADR-0012 accepted, stating the resumability invariant,
the rejection of the blanket session rule with its evidence, and the
explicit limit on what validation proves.

### Phase 2 — Skill: the handover reference (TASK-0020)
1. Write `skills/project-workflow/templates/reference/session-handover.md`
   — the cold-start read order, the resumability invariant, the rotation
   heuristic, and the sanctioned use of subagents within a task.
2. Add one row to `00.CONVENTIONS.md`'s reference table pointing at it.
3. **Bring `00.CONVENTIONS.md` back under its 3 KB budget** by moving
   content to `reference/`, not by raising the cap
   (`reference/size-budgets.md:35-38`). It is already 15 bytes over; the
   new row makes that worse. This is pre-existing debt this phase pays
   rather than inherits.

**Exit criteria:** `00.CONVENTIONS.md` ≤ 3072 bytes **measured, not
estimated**; the new reference file is reachable from it; no fact appears
in both files.

### Phase 3 — Skill: the task-template contract (TASK-0021)
1. Add `## Inputs` to `templates/tasks/0000_TEMPLATE.md` — tabular
   (artifact · produced by · expected state), because a table forces the
   three facts a prose paragraph lets an author skip.
2. Add `## Outputs / handover` — same tabular shape, plus one
   `**Next task starts here**:` line.
3. Bump `SKILL.md` `metadata.version` → `3.1.0` in the same commit
   (ADR-0003 semver rule; ADR-0004's "a version string means exactly one
   thing").
4. Re-run `scripts/install.sh` so the deployed copy stops disagreeing
   with the repo — the exact drift class REVIEW-0002 found, where three
   copies all claimed `2.1.0` while differing in content.
5. Regenerate the registry (description unchanged, so expect **no diff** —
   confirm that, don't assume it).

**Exit criteria:** template carries both sections; version is `3.1.0`;
deployed copy matches the repo byte-for-byte (`diff -rq`); `validate.sh`
passes.

### Phase 4 — This repo adopts it (TASK-0022, TASK-0023)
Separate from phases 2–3 on purpose: ADR-0004 makes this repo the skill's
owner, and the skill's own copy-never-symlink rule means an improvement
to the skill does **not** automatically apply here. Adoption is a
deliberate act with its own commit.

1. **TASK-0022** — restructure `.ai/templates/TASK.md`: merge
   `Minimal context`/`Preconditions`/`Dependencies` into `## Inputs`;
   rename `Expected result` → `## Outputs / handover`. Existing task
   files untouched (resolved ambiguity 4).
2. **TASK-0023** — add the `validate.sh` check: the template still
   carries the required headings, and every `.ai/tasks/TASK-####-*.md`
   numbered ≥ 0020 has non-empty `## Inputs` and `## Outputs / handover`.
   Must stay offline, sub-second, and hermetic — passing on a fresh clone
   with the entire environment unset.
3. Prove each new check fails for the right reason before declaring it
   done.

**Exit criteria:** the check fails on a task file with an empty `Inputs`,
fails on a template with a deleted heading, and passes on the real tree;
`validate.sh` still offline and sub-second; TASK-0001…0019 still pass
untouched.

## Tasks generated
| Task | Phase | Depends on | Status |
|------|-------|-----------|--------|
| ADR-0012 — Handover contract and the resumability invariant | 1 | none | accepted |
| TASK-0020 — Skill: `reference/session-handover.md`; restore the conventions budget | 2 | ADR-0012 | planned |
| TASK-0021 — Skill: task-template `Inputs`/`Outputs`; version 3.1.0 | 3 | TASK-0020 | planned |
| TASK-0022 — This repo: restructure `.ai/templates/TASK.md` | 4 | TASK-0021 | planned |
| TASK-0023 — `validate.sh`: handover-section presence check | 4 | TASK-0022 | planned |

TASK-0021 before TASK-0022 is deliberate: the skill is canonical
(ADR-0004), so the contract's shape is settled there first and this repo
adopts a finished shape rather than both drifting mid-change.

## Acceptance criteria (plan level)
- [ ] The skill states a session-boundary rule and a cold-start read
      order, which it currently does not state anywhere.
- [ ] `00.CONVENTIONS.md` is **under** its declared byte budget — a
      measured number, and better than the 3087 bytes it starts at.
- [ ] The skill's task template names both what a task consumes and what
      the next task picks up.
- [ ] `metadata.version` is `3.1.0` and the deployed copy matches the
      repo byte-for-byte.
- [ ] This repo's task template carries the contract with **no net
      growth in section count** and no fact owned twice.
- [ ] `validate.sh` detects a deleted or empty handover section, is
      proven to fail for the right reason, and is honest in its own
      source comment about what it does not prove.
- [ ] TASK-0001…0019 remain untouched and still pass.
- [ ] `validate.sh` stays offline, hermetic, and sub-second.

## Risks
- **The convention grows the thing it exists to bound.** This plan adds a
  reference file and two template sections to a convention whose entry
  point is *already* over budget. Mitigation: Phase 2 pays the existing
  15-byte debt as a precondition rather than leaving it, and the new
  content lands in `reference/` (load-on-demand), never in the
  mandatory-read entry point.
- **A presence check read as a correctness check.** The likeliest failure
  is social, not technical: a green gate gets read as "handovers are
  good". Mitigation: state the limit in the check's own source comment
  and in ADR-0012's Consequences, where a future reader will actually hit
  it. This is `CURRENT_STATE.md`'s lesson 1 applied before the fact
  instead of after.
- **`validate.sh` starts reading `.ai/`.** It has never done so; the gate
  has been about components, not governance. This couples the commit gate
  to the planning layer, so a governance-only edit can now fail a commit.
  Judged acceptable — the failure is precisely the omission worth
  catching — but it is a genuine scope change and is recorded as one, not
  slipped in.
- **The `≥ 0020` boundary is invisible.** A reader seeing TASK-0019 pass
  without the sections may conclude the check is broken. Mitigation: the
  constant is named and commented at its definition, with the reason
  (historical records are not retrofitted) rather than just the value.
- **Schema-fits-one-sample.** The contract is designed against this
  repo's task shape. Mitigation: sanity-check the section names on paper
  against `.ai/templates/PLAN.md` and `REVIEW.md` — if `Inputs` only
  makes sense for a TASK, it must not leak into the other templates.
- **Drift between repo and deployed skill.** REVIEW-0002 found three
  copies claiming one version. Mitigation: TASK-0021 re-runs
  `install.sh` and verifies with `diff -rq` in the same task, not "later".

## Human decisions required
All three resolved at plan time by explicit human choice (2026-09-13),
recorded here so a later session does not re-open them:
1. Session boundary — **decided**: resumability is the mandatory
   invariant; the ~60–70% / 80% rotation is an advisory heuristic.
2. Validation scope — **decided**: ship the presence check with the
   `≥ 0020` numeric boundary, labelled as omission detection.
3. Propagation order — **decided**: skill first (TASK-0020, TASK-0021),
   then this repo adopts deliberately (TASK-0022, TASK-0023).

Deferred, small enough to decide in-flight:
- Exactly which content moves out of `00.CONVENTIONS.md` to restore its
  budget (TASK-0020).
- Whether `## Outputs / handover` keeps that exact two-word heading or a
  shorter one, once seen rendered in a real task file (TASK-0021).

## Out of scope
- **Retrofitting TASK-0001…0019.** See resolved ambiguity 4.
- **The `.ai/decisions/` dual naming scheme.** `ADR-0001-…` through
  `ADR-0007-…` then `0008-…` through `0011-…` — a real inconsistency,
  found while reading for this plan, unrelated to handover. Logged as an
  ad-hoc item; not fixed here.
- **Automating session-record creation.** `.ai/sessions/` works by hand;
  no evidence it needs tooling.
- **`opencode-customization`'s stale copy** — that repo's follow-up per
  ADR-0004, unchanged by this plan.
