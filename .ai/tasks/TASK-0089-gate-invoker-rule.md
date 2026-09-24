# TASK-0089 — One rule for who starts a gate, and who writes the evidence

## Objective

Resolve the three-way disagreement `TASK-0086` found and `TASK-0087`
inherited, **by the human's decision of 2026-09-24**, recorded as `ADR-0025`
and applied to every artifact that states it.

## Minimal context

### The disagreement, as found

| Source | Who starts a gate | Who writes the evidence file |
|---|---|---|
| `loops/unattended-run/loop.md` step 7 | `gate-runner` | `gate-runner` ("writing every outcome to the run's evidence file") |
| `agents/gate-runner/` | `gate-runner` ("You may run one command: the binding's gate entry point") | **the entry point** — "you do not hand-write it" |
| `ADR-0022` ("two things the port makes better") | the **driver** | — |
| `references/gate-map.md` | the **driver** | `gate-runner` ("receives the evidence and writes it") |
| OpenCode binding (`TASK-0086`) | driver — deviation 1 | entry point |
| Claude Code binding (`TASK-0087`) | gate-runner — deviation 1 | entry point |

### The decision — the human's, 2026-09-24, from four multiple-choice questions

1. **Who starts a gate:** *the driver wherever it has a shell; the
   gate-runner, through the one entry point, only where the driver has none.*
   The same shape loop step 12 already uses for the journal ("run-scribe, or
   the driver where it has filesystem access").
2. **Who writes the evidence file:** *the entry point.* The gate-runner reads
   it and reports; it never writes it.
3. **Recorded as** an ADR plus one task.
4. **Done now**, before S10.5, so the pilot runs against artifacts that agree.

The agent chose none of these; each was the human's selected option.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `loops/unattended-run/loop.md` | `TASK-0061` | Steps 7 and 13 name `gate-runner` as sole actor |
| `agents/gate-runner/agent.md` | `TASK-0064` | "You may run one command"; evidence written by the entry point |
| `skills/unattended-ops/references/gate-map.md` | `TASK-0062` | Driver invokes; gate-runner writes the evidence |
| `skills/unattended-ops/SKILL.md` | `TASK-0087` | `1.2.0`; role table row for `gate-runner` |
| Both bindings' `binding.md` | `TASK-0086`, `TASK-0087` | Deviation 1 in each, opposite directions |
| `.ai/decisions/0022-*.md` | `TASK-0057` | `Accepted`; says the driver *can* invoke |

## Scope

### Included

- `ADR-0025`, `Accepted` (the human made the decision).
- loop.md steps 7 and 13; `agents/gate-runner/` body; `gate-map.md`'s
  "Where it lives" paragraph; `SKILL.md`'s role row and version.
- Both bindings: deviation 1 marked resolved, numbering kept so the two
  lists still read side by side.

### Not included

- **`agents/gate-runner/`'s allowlist (`*run-gate.sh*`).** Under the rule, an
  OpenCode gate-runner no longer needs to run anything; narrowing its
  boundary is a separate decision, recorded as a finding, not taken here.
- Any code change. Both bindings already behave as the rule says; only
  their declarations change.
- `ADR-0022`'s text. It said the driver *can* invoke — the new rule is
  compatible with it; `ADR-0025` cites it.

## Likely files

`.ai/decisions/0025-*.md`, `loops/unattended-run/loop.md`,
`agents/gate-runner/agent.md`, `skills/unattended-ops/{SKILL.md,references/gate-map.md}`,
`skills/unattended-ops/templates/bindings/{opencode,claude-code}/binding.md`,
`.ai/context/CURRENT_STATE.md`, `.ai/tasks/TODO.md`.

## Execution plan

1. Write `ADR-0025`.
2. Amend the four normative artifacts to state the rule once each, citing it.
3. Mark deviation 1 resolved in both bindings.
4. Re-run both bindings' suites (`check-binding.sh` runs inside them),
   `tests/validate.sh`, `scripts/sync-registry.sh`.

## Acceptance criteria

- [x] `ADR-0025` states both rules and cites the human's decision.
- [x] loop.md steps 7 and 13 name the actor as the rule does, and no longer
      say the gate-runner writes the evidence file.
- [x] `agents/gate-runner/` says when it invokes and when it only reads.
- [x] `gate-map.md` no longer says the gate-runner writes the evidence file.
- [x] Neither binding lists the gate invoker as a deviation.
- [x] A grep finds no remaining statement that the gate-runner *writes* the
      evidence file.
- [x] Both bindings' test suites pass (each includes `check-binding.sh` on a
      filled copy); `tests/validate.sh` passes.

## Mandatory validations

- [x] `tests/validate.sh`
- [x] `python3 -m unittest discover -s tests` (OpenCode binding dir)
- [x] `node --test …/claude-code/tests/unattended-run.test.mjs`
- [x] `scripts/sync-registry.sh` (expect no diff)

## Risks and rollback

- **A documentation change with no failing test to prove it.** The
  fails-when-reverted rule applies to behaviour; there is none here. The
  grep criterion is the check, and it is run before and after.
- Rollback: `git revert` of one commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `.ai/decisions/0025-*.md` | New, `Accepted`: the driver starts a gate where it has a shell, otherwise the gate-runner; the entry point writes the evidence |
| `loops/unattended-run/loop.md` | Steps 7 and 13 name the actors per `ADR-0025`; step 7 no longer has the gate-runner writing the evidence |
| `agents/gate-runner/agent.md` | Says when it starts gates and when it only reads; **allowlist unchanged** |
| `references/gate-map.md`, **`references/evidence.md`** | Both corrected; `evidence.md` was not in the brief's list — found by widening the grep |
| `SKILL.md` | `1.3.0`; role row updated |
| Both bindings | Deviation 1 marked resolved, numbering kept |
| Code | **Unchanged** — both bindings already behaved as the rule says |

**Next task starts here**: the loop, the role, the references and both
bindings agree. One finding is left for the human: `agents/gate-runner/`
still allowlists `*run-gate.sh*`, wider than an OpenCode gate-runner now needs.

**Deviations from the Plan:** `references/evidence.md` added to scope — two
of its sentences said the gate-runner writes the file.

## Status
- Status: done
- Owner: agent (decision: human)
- Created: 2026-09-24
- Updated: 2026-09-24

## Execution log
### Attempt 1
- Date: 2026-09-24
- Agent: Claude Opus 5.5 (1M context)
- Actions: put the decision to the human as four multiple-choice questions;
  recorded the chosen options in the brief before editing; wrote `ADR-0025`;
  amended the loop, the role, two references, `SKILL.md` and both bindings.
- Observations:
  1. **The first grep was too narrow.** Searching for "writes … the evidence
     file" found one sentence (`gate-map.md`); the loop says "writing every
     outcome to…" and `evidence.md` said it twice more in other words. A
     widened grep — every line near "evidence file" mentioning the
     gate-runner or a write — found five. The before/after grep is the only
     check this task has, so the narrow version would have passed a
     half-done change.
  2. **No behaviour changed, so there is no fails-when-reverted test.** The
     rule described what both bindings already did; the proof that the
     declarations still hold is the checker, run inside both suites.
- Validation: widened grep empty after the change; `tests/validate.sh` OK;
  OpenCode suite OK (23); Claude Code suite 23/23; both templates rejected by
  `check-binding.sh` on placeholders only (no uncited rule);
  `scripts/sync-registry.sh` no diff.
- Result: **done.**
- Commit: `8c5bbe0`. Pre-commit hook ran `tests/validate.sh`: OK.
- Push: **confirmed** — `origin/master` `4099981..8c5bbe0`.
