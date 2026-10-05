# TASK-0138 — Give role 5 a derived verdict for task-loading actions (B-050)

## Objective

Close `B-050` by the route the human chose on 2026-10-05: **a role-5
carve-out**. Gate 1 keeps listing control-flow actions in `modules_touched`,
so the inventory stays honest. `references/derivation.md` gains a rule that
makes `not-applicable` the *derived* verdict for an action whose only effect
is to load further tasks, with its reason. Today role 5, applied literally,
yields no legal verdict for `include_tasks`, and so stops a change whose
every state-touching module documents `full`.

## Minimal context

- **The evidence** (`TASK-0116` attempt 2, the `B-050` row): for
  `ansible.builtin.include_tasks` (ansible-core 2.21.4), the documentation
  says `check_mode.support: none`, with the generic *"if not supported the
  action will be skipped"*. It was **not** skipped: its included tasks ran
  under `--check`, visibly. The attribute describes the action plugin, and
  the sentence is shared boilerplate. That is not a documentation defect,
  but role 5 cannot derive a verdict from it.
- **Why the route matters**: excluding these actions at gate 1 would hide
  that an include happened. The carve-out keeps them listed and answers for
  them by rule.
- **What the rule must not do**: launder an `unknown`. The included tasks'
  own modules stay in `modules_touched` and are judged on their own
  documentation. An include whose target gate 1 cannot resolve by reading
  leaves those modules `unknown`, and the change stops as before.
- **Scope of the list**, by property, not by the row's examples:
  - `include_tasks`, `include_role`, `import_tasks`, `import_role` and
    `import_playbook` only load tasks on the controller;
  - `block` is a keyword, not an action, so it is never in `modules_touched`;
  - `meta` is **not** covered: some of its forms act on connections and
    inventory, so it is judged by the normal rule.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/ansible-ops/references/derivation.md` | `TASK-0062` and later | role 5 has no control-flow rule |
| `skills/ansible-ops/references/check-mode-fidelity.md` | same | `not-applicable` row: "a deliberate declaration with a reason" |
| `skills/ansible-ops/SKILL.md` | ongoing | `version: "1.1.0"` |
| `.ai/planning/BACKLOG.md` | `TASK-0137` | `B-050` `ready`; nine open |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. `references/derivation.md`, in the notes on the role set: the carve-out,
   its property, its list, its reason, and its limit.
2. `references/check-mode-fidelity.md`: one sentence under the verdict table
   pointing to the rule, so the verdict's meaning keeps a single owner.
3. `SKILL.md` `1.2.0`.
4. `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md`, this brief.

### Not included

- Gate 1 and `loops/ansible-change/loop.md`, whose gate-5 summary is
  subordinate to the skill, as the loop itself states.
- `scripts/check-change-record.sh`, which already accepts `not-applicable`.
- `meta`, for the reason above.

## Likely files

`skills/ansible-ops/references/derivation.md`,
`skills/ansible-ops/references/check-mode-fidelity.md`,
`skills/ansible-ops/SKILL.md`, the ledger, this brief.

## Execution plan

1. This brief first.
2. Write the rule and the pointer; bump the version.
3. `tests/validate.sh` and `sync-registry.sh`; the ansible-ops checker's own
   test, if one exists, must still pass.
4. Ledger; commit; push both remotes; record commit.

## Acceptance criteria

- [x] `derivation.md` makes `not-applicable` the derived verdict for the
      named task-loading actions, with the reason, and states that the
      loaded tasks' modules are still judged.
- [x] It says `block` never appears and `meta` is not covered.
- [x] `check-mode-fidelity.md` points to the rule; `SKILL.md` reads `1.2.0`.
- [x] `tests/validate.sh` passes.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed): description
      unchanged, so no diff

## Risks and rollback

- **A laundering route.** The rule applies by a stated property and a
  closed list, and it never covers the loaded tasks.
- **Rollback:** `git revert` the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `references/derivation.md` | a *task-loading actions* note in the role-set notes |
| `references/check-mode-fidelity.md` | one pointer sentence under the verdict table |
| `SKILL.md` | `1.2.0` |
| `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md` | `B-050` done; eight open |

**Next task starts here**: `master` at the record commit.

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-05
- Updated: 2026-10-05

## Execution log

### Attempt 1

- Date: 2026-10-05
- Agent: Claude Code (Opus 5.5), main checkout
- Actions: wrote the brief, then the rule in `derivation.md`, the pointer in
  `check-mode-fidelity.md`, and the version.
- Observations:
  - The rule went into the notes on the role set, beside *Role 5 is
    per-module and per-version*, which it qualifies.
  - The skill ships no test for its prose. `check-change-record.sh` already
    accepts `not-applicable`, so it is unchanged.
- Validation: `tests/validate.sh` printed `validate.sh: OK`, and
  `sync-registry.sh` left the registry unchanged.
- Result: done.
- Commit: recorded in the follow-up record commit
- Push: recorded in the follow-up record commit
