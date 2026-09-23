# TASK-0080 — State the OpenCode-first asymmetry in all three wiring snapshots

## Objective

Meet **Phase 9 exit criterion 7**, the one `REVIEW-0011` found unmet: the
unattended harness's OpenCode-first asymmetry is stated in
`skills/unattended-ops/SKILL.md` and in **none** of the three
`configs/*/README.md`.

## Minimal context

`PLAN-0006` pre-committed S9's checkpoint question **before the work**:

> *Did the documentation state the OpenCode-first asymmetry plainly, or did it
> describe three clients as if they were equivalent?*

`REVIEW-0011` answered it by grepping rather than assuming. The skill states
it plainly. The three snapshots **say nothing about the unattended harness at
all**.

**The failure is not the one the question predicted, and is worse in one
respect.** Nobody wrote that the clients are equivalent; the snapshots are
**silent**, and silence reads as equivalence by omission. A Claude Code user
reading their own wiring snapshot learns nothing about seven roles they will
never receive. That is the `B-021` defect class at the wiring layer — where a
reader goes *specifically* to find out what their client gets.

**The facts, read from the registry rather than recalled:**

| | |
|---|---|
| Port to both | `task-planner`, `adjudicator` — **the two that only think** |
| OpenCode-only | `preflight`, `refuter`, `implementer`, `gate-runner`, `closer`, `park-steward`, `run-scribe` — **seven** |
| Why | Each needs a per-agent *command* boundary, and `tools`/`disallowedTools` gate whole tools with no `ask` state (`ADR-0018` clause 8.3) |

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/reviews/REVIEW-0011-*.md` | `REVIEW-0011` | Criterion 7 recorded unmet; the grep table |
| `skills/unattended-ops/SKILL.md` | `TASK-0062` | The asymmetry paragraph the snapshots must agree with, **not restate** |
| `docs/registry.md` | `TASK-0060` | The Clients column — the checkable source for which role goes where |
| `configs/*/README.md` | various | Each has an `## Agents` section; none mentions the harness |
| `.ai/decisions/0020-*.md` | `TASK-0047` | Bionic has subagents but **no user-authored agent-role directory** |

**Verify the expected state; don't assume it.** Read the registry's Clients
column for the split rather than trusting any prose count — three documents in
this repo have already been wrong about exactly this kind of number.

## Scope

### Included

- A subsection in each of the three `configs/*/README.md`, under `## Agents`,
  stating what that client gets from the unattended harness and what it does
  not.
- **Linking to the skill, not restating it.** The skill owns the method and
  the reasoning; a snapshot says what *this client* receives. A second owner
  of the rule will drift.
- The honest state for all three: **no binding exists yet**, so nothing runs
  unattended on any client today.

### Not included

- **Asserting that Bionic "cannot orchestrate".** `SPRINT-S10`'s row S10.4
  plans to *establish and record* that. What **is** established is narrower
  and sufficient: `ADR-0020` found no user-authored agent-role directory, so
  Bionic receives **zero** of the nine roles. Say the established thing.
- Any change to the skill, the loop, the roles or the registry.
- Writing a binding. All three are S10.
- Closing S9. Still a human decision.

## Likely files

- `configs/claude-code/README.md`, `configs/opencode/README.md`,
  `configs/lm-studio-bionic/README.md`
- `.ai/reviews/REVIEW-0011-*.md` — criterion 7's verdict updated
- **No component file.**

## Execution plan

1. Re-read the registry's Clients column for the split.
2. Write the three subsections, each naming what that client gets.
3. Re-run `REVIEW-0011`'s own grep as the acceptance test.
4. `tests/validate.sh`, `sync-registry.sh`, diff, commit, push.

## Acceptance criteria

- [ ] Each of the three snapshots names the unattended harness and states this
      client's coverage.
- [ ] Claude Code's says **seven of nine roles are not emitted here**, and
      names the two that are.
- [ ] Bionic's says it receives **zero** roles, on `ADR-0020`'s established
      finding rather than on S10's unestablished one.
- [ ] All three state that **no binding exists yet**.
- [ ] None restates the skill's method; each links to it.
- [ ] `REVIEW-0011`'s grep — the checkpoint's own test — now passes.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` (expect no diff)
- [ ] `git status --porcelain`

## Risks and rollback

- **Restating the skill.** The commonest failure here; a snapshot that carries
  the reasoning becomes a second owner of it. Mitigated by linking.
- **Over-claiming about Bionic.** Mitigated by the Not-included note above.
- **Writing a count instead of reading one.** Mitigated by taking the split
  from the registry's Clients column.
- Rollback is `git revert` of one commit; documentation only.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `configs/claude-code/README.md` | Seven roles absent, two present, no binding yet |
| `configs/opencode/README.md` | The reference client; all nine emit |
| `configs/lm-studio-bionic/README.md` | Zero roles, on `ADR-0020` |
| `REVIEW-0011` | Criterion 7 recorded as met, with the date and this task |

**Next task starts here**: **closing S9** — a human decision, and now with no
unmet exit criterion standing against it.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)
- Actions: read the split from `docs/registry.md`'s Clients column rather than
  from prose; wrote one subsection per snapshot under each `## Agents`
  heading; re-ran `REVIEW-0011`'s own grep as the acceptance test; updated the
  checkpoint's criterion-7 verdict.
- Observations:
  - **Each snapshot names its own coverage**, which is the point — a reader
    goes to *their* client's file to find out what *they* get:
    Claude Code **two of nine** with the seven it does not get listed;
    OpenCode **all nine**, seven of them exclusively; Bionic **zero**.
  - **Bionic's section is deliberately narrower than S10 plans to be.**
    `SPRINT-S10` row S10.4 will establish that Bionic *cannot orchestrate*;
    that is not established today, so it is not claimed. The established fact
    — no user-authored agent-role directory (`ADR-0020`), therefore no surface
    to emit into, therefore zero roles — is sufficient for a reader and is
    what is written. Over-claiming here would have been the `hub/skills`
    inference error in a new place, in the very file that documents it.
  - **All three link `skills/unattended-ops/SKILL.md` rather than restating
    its reasoning.** The skill owns the method; a snapshot says what this
    client receives. A second owner of the rule would drift.
  - **All three state that no binding exists yet**, so nothing runs unattended
    on any client. Without that, a reader finding the components installed
    would reasonably conclude the capability is available — the same
    inference-from-presence this repo has been bitten by before.
  - **The OpenCode snapshot gained two client-specific operational facts** the
    others do not need: a driver must pass `-m` explicitly or `opencode run`
    hangs with no output, and every driver-invoked role must be
    `mode: primary` or it is silently replaced by the default agent. Both
    observed in `TASK-0055`, both belong where the driver will be wired.
  - **`REVIEW-0011` is annotated, not rewritten.** Its finding stands exactly
    as the checkpoint found it, with the closure noted beneath. A review
    edited to match its own follow-up stops being evidence that the
    pre-committed question worked, which was the whole point of committing it
    in advance.
- Validation:
  - `tests/validate.sh` — **OK**
  - `scripts/sync-registry.sh` — no diff
  - `REVIEW-0011`'s grep re-run: all four files now name the harness; each
    names its own coverage
- Result: **done.** Exit criterion 7 is met. **All seven Phase 9 criteria are
  now met**, and nothing stands against closing S9 but the decision.
- Commit: *pending — recorded in the follow-up commit*
- Push: *pending*
