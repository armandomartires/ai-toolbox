# TASK-0057 — Author ADR-0022 from the spike evidence, and leave it proposed

## Objective

Write `.ai/decisions/0022-unattended-runs-and-the-narrowed-workflow-clause.md`
from `TASK-0055` and `TASK-0056`'s findings, and leave it **`Proposed`**. This
task does not ratify it and must not author anything it unblocks.

## Minimal context

A draft of ADR-0022 exists, written alongside `PLAN-0006` before the spikes ran.
**That draft is a proposal, not a record**, and three of its nine falsifiable
claims (F1, F2, F4, F5) are exactly what the spikes settle. This task's real
work is to reconcile the draft with what was observed and to **correct it in
place where the two disagree** — the handling ADR-0018 and ADR-0019 both used
for their own corrections, and for the stated reason: *"a decision whose own
factual basis has been corrected must show the correction, or a later reader
cannot tell which claims were tested."*

Leaving it `Proposed` is not caution. ADR-0022 narrows two clauses of an
accepted ADR, and ADR-0019 set the rule for precisely this: it was itself
proposed rather than accepted *"because it **narrows a stated requirement**, and
narrowing a requirement is the human's call, not the agent's."*

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/tasks/TASK-0055-*.md` | `TASK-0055` | `done`; F1, F2, F4 each carry a verdict |
| `.ai/tasks/TASK-0056-*.md` | `TASK-0056` | `done`; F5 carries a verdict; `isolation: worktree` characterised or explicitly left open |
| `.ai/decisions/0022-*.md` | `PLAN-0006` session, pre-existing | the draft, status `Proposed` |
| `.ai/decisions/0019-*.md` | pre-existing | `Accepted`; clauses 2.2, 2.4, 2.5 and 3 read in full |
| `.ai/decisions/0018-*.md` | pre-existing | `Accepted`; clause 8 and clause 8.5 |
| `.ai/decisions/0010-*.md` | pre-existing | `Accepted`; its three reopen obligations |
| `.ai/templates/ADR.md` | pre-existing | Status / Context / Decision / Consequences |

**Verify the expected state; don't assume it.** If either spike left a claim
unsettled, the ADR says so — an unsettled claim is a legitimate ADR content, a
guessed one is not.

## Scope

### Included

- Reconcile every factual claim in the draft against the spike findings.
- **Correct in place, visibly**, wherever they disagree. Do not silently rewrite:
  a reader must be able to see which claims were tested and which were replaced.
- If F1 is falsified, the ADR must say so and name the consequence — every role
  becomes `primary` or `all`, and `TASK-0058`/`TASK-0059` gain a schema change.
- If F5 is confirmed, the ADR cites it as the justification for `TASK-0059`'s
  new check, and names the live `designer-manager` defect.
- Record the `opencode` and `claude` versions the evidence was gathered on, with
  the date, per ADR-0018's stamping practice.
- Keep the status `Proposed` and state what ratification unblocks.

### Not included

- **Ratifying it.** That is the human's, and it is a gate rather than a task.
- Authoring the loop, the skill, any role, any binding or the MCP server.
- Editing `ADR-0019` itself. ADR-0022 narrows it by reference; ADR-0019 is a
  dated record and stays as written. If a cross-reference note is wanted in
  ADR-0019, that is a separate, explicit decision.
- Changing `ADR-0010`'s status. Its supersession belongs to `TASK-0067`, which
  is the task that actually exercises the authored shape.

## Likely files

- `.ai/decisions/0022-unattended-runs-and-the-narrowed-workflow-clause.md`
- `.ai/planning/sprints/SPRINT-S9-unattended-runs.md` — only if a falsified
  claim changes the task table
- This task file

## Execution plan

1. Read both spike files in full, including anything recorded as unsettled.
2. Read the draft ADR against them, claim by claim.
3. Correct in place, marking each correction and its source, as ADR-0018's
   "Corrections made at ratification" section does.
4. Add the version stamps and the evidence date.
5. Re-check that the four Decision clauses still follow from the evidence. **If a
   clause no longer does, change the clause** — not the evidence.
6. Confirm the status line still reads `Proposed`, and that the closing section
   names what ratification unblocks and what stays blocked.
7. `tests/validate.sh`, review the diff, commit.

## Acceptance criteria

- [ ] Every falsifiable claim carries the verdict the spikes produced, or is
      explicitly marked unsettled with the reason.
- [ ] Every disagreement between the draft and the evidence is corrected **and
      the correction is visible**, not silently applied.
- [ ] Both client versions and the evidence date are recorded.
- [ ] Status reads `Proposed`.
- [ ] The four Decision clauses are each traceable to evidence or to an existing
      accepted ADR.
- [ ] Clause 4's list of what is *not* narrowed is present and correct against
      ADR-0019 as actually written.
- [ ] No component file changed.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `git status --porcelain` — `.ai/` only

## Risks and rollback

- **Ratifying by implication.** Writing "Accepted", or authoring anything the
  ADR unblocks, both amount to the agent making the human's decision. The
  ambiguity policy in `AGENTS.md` applies directly.
- **Preserving a draft claim the spike falsified** because the surrounding
  argument reads well. ADR-0018's ratification corrected four of its own stated
  facts and kept the corrections visible; that is the standard.
- **Miscounting its own clauses.** ADR-0019 shipped saying "Two clauses" while
  containing three. Count them.
- Rollback: the ADR is a new file; reverting the commit removes it and nothing
  depends on it yet.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `.ai/decisions/0022-*.md` | Reconciled against both spikes, corrections visible, versions stamped, status `Proposed` |
| `SPRINT-S9-*.md` | Task table adjusted only if a falsified claim changed it |
| Component layer | Unchanged |

**Next task starts here**: nothing. **The next step is the human ratification
gate.** `TASK-0058`, `0060`, `0061` and `0067` each open with a check that
ADR-0022 reads `Accepted`, and none may start before it does. Record here which
tasks the final clause set unblocks, so the next session does not re-derive it.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)
- Actions:
  1. Read both spike files in full, including what each left unsettled.
  2. Read the draft claim by claim against them.
  3. **Corrected in place and visibly** — a `## Corrections made after the
     spikes` section listing six corrections with their source, plus inline
     block quotes at each corrected passage, the handling `ADR-0018` used.
  4. Added the evidence stamp (`opencode 1.18.31`, `claude 2.1.246`, both
     observed 2026-09-23) per `ADR-0018`'s practice.
  5. Re-checked the four Decision clauses against the evidence. Three survive
     unchanged; **clause 4.1's stated reason did not survive and was rewritten**
     (see below). **Added clause 5**, because F1's falsification imposes
     schema consequences the draft had no clause for.
  6. Gave every row of the Falsifiable claims table a **Verdict** column: four
     settled, five explicitly marked `UNTESTED` so a reader cannot mistake a
     claim for a finding.
- Observations:
  - **Six corrections**, the material ones being: F1 assumed true and false;
    `mode: all` real and rejected by this repo's `MODES`; the capability count
    stale at "six of ten" (now seven of eleven — `TASK-0071` changed it hours
    after the draft was written); and F4 confirmed but constraining the
    command *form*.
  - **Clause 4.1 is the interesting correction, because its conclusion
    survived while its argument did not.** The draft rejected `ask` on the
    grounds that unattended it is *"either a hang or … an approval."* Neither
    occurs: it **auto-denies** and reports *"The user rejected permission"*
    **with no user present**. The clause now argues from that misattribution,
    which is a stronger reason than the one it replaced — an unattended run
    would otherwise log a human decision that never happened. It also puts a
    claim on `push-requires-confirmation`: the term is **meaningless** in an
    unattended run.
  - **Clause 5 is the only clause in this ADR that exists because a claim was
    falsified rather than because a design was chosen.** It carries the four
    consequences: driver-invoked roles must be `primary`; `all` must be
    admitted or rejected **explicitly**; a binding must pass `-m` or hang
    forever; the closer stages with `git add -- <path>`, always.
  - **Status is unchanged at `Proposed`, and the closing section now says what
    that means.** The spikes settled *facts*. They did not decide whether this
    repo accepts a narrowing of `ADR-0019` clauses 2.5 and 3, which is the
    actual gate. F1 arguably raises the stakes on that decision rather than
    lowering them, and the ADR says so.
  - `isolation: worktree` remains open; the ADR now records **that
    `TASK-0056` tried and why the attempt was confounded**, rather than
    leaving an unexplained gap.
- Validation:
  - `tests/validate.sh` — **OK**
  - Structure re-checked: status still `Proposed`; five clause headings; all
    nine claim rows carry 5 cells matching the header
  - No component file changed
- Result: **done.** `ADR-0022` is reconciled with evidence and left
  `Proposed`. **This task did not ratify it and authored nothing it
  unblocks.** The next step is a human decision, not a task.
- Commit: `de22cd2`. Pre-commit hook ran `tests/validate.sh`: OK.
- Push: **confirmed** — pushed to `origin/master`.

### Attempt 1 (template scaffold, retained)
### Attempt 1
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
