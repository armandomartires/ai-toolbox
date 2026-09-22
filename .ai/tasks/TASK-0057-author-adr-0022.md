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
- Status: planned
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
