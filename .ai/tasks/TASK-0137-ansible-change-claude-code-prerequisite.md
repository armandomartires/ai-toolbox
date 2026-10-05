# TASK-0137 — Name what loops/ansible-change needs from a Claude Code session (B-046)

## Objective

Close `B-046`. `loops/ansible-change/` is written to be agent-runnable end to
end, but from a Claude Code session it runs only to gate 3 unless the human
grants more. `TASK-0116` measured what the rest takes over three attempts,
and the loop says none of it. Add that prerequisite to the loop, so the next
operator meets it before gate 4 rather than at it. Routed by the human on
2026-10-05.

## Minimal context

What `TASK-0116` measured (its attempts 1-3, and the `B-046` row):

- **Gate 4**, the first gate that touches hosts, was denied by Claude Code's
  auto-mode classifier, although the command was read-only by construction.
  One **exact-match allow rule** in the gitignored
  `.claude/settings.local.json` let it through (attempt 2).
- **ansible-core 2.21.4 then refused to start**:
  `Ansible requires blocking IO on stdin/stdout/stderr. Non-blocking file
  handles detected: <stdout>, <stderr>`. The harness's Bash tool hands it
  non-blocking handles. Redirecting, `> log 2>&1 < /dev/null`, cleared it,
  and gate 4 ran with exit 0.
- **Gates 6-8**: even with the human's authorization written into the task
  file, the classifier refused three phase-2 actions. It weighs the outcome,
  not the command. What worked was the human executing them while the agent
  recorded the evidence (attempt 3).
- **Not a defect in `skills/ansible-ops/`**; this is a client capability
  asymmetry of the class `ADR-0018` records for `worktree-only`.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `loops/ansible-change/loop.md` | `TASK-0062` and later | sections Trigger, Steps, Exit conditions; no client prerequisite |
| `.ai/tasks/TASK-0116-exercise-ansible-ops-live.md` | `TASK-0116` | the measurements above |
| `.ai/planning/BACKLOG.md` | `TASK-0136` | `B-046` `ready`; ten open |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. `loops/ansible-change/loop.md`: a section *Running it from Claude Code*,
   between *Trigger* and *Steps*. It states:
   - the gate-4 allow rule;
   - the output redirect, and the error that shows it is missing;
   - for gates 6-8, either per-command rules or human execution, with the
     agent recording the evidence;
   - that OpenCode has not been exercised against this loop.
2. `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md`, this brief.

### Not included

- Any change to `skills/ansible-ops/`; the row says it is not a defect
  there.
- Writing an allow rule into any settings file. That is the human's grant,
  per change.

## Likely files

`loops/ansible-change/loop.md`, the ledger, this brief.

## Execution plan

1. This brief first.
2. Write the section, citing `TASK-0116` for the measurements.
3. `tests/validate.sh`; ledger; commit; push both remotes; record commit.

## Acceptance criteria

- [x] The loop names both parts of the gate-4 prerequisite, the error that
      shows the second is missing, and the two routes for gates 6-8.
- [x] It says which client was measured, and that OpenCode was not.
- [x] `tests/validate.sh` passes, with the loop's required sections intact.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed): the loop's
      description is unchanged, so no registry diff is expected

## Risks and rollback

- **Reading as a workaround to the classifier.** The section names the
  human's grant as the route, never a way past a refusal.
- **Rollback:** `git revert` the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `loops/ansible-change/loop.md` | a *Running it from Claude Code* section before *Steps* |
| `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md` | `B-046` done; nine open |

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
- Actions: wrote the brief, then the section, from `TASK-0116`'s attempts
  1-3 and the `B-046` row.
- Observations: the section sits between *Trigger* and *Steps*. The gate's
  loop-shape check requires only *Trigger*, *Steps* and *Exit conditions*,
  and it still passes. The registry is unchanged, because the loop's
  description did not change.
- Validation: `tests/validate.sh` printed `validate.sh: OK`.
- Result: done.
- Commit: `d79f4ec` — *Name what ansible-change needs from a Claude Code session (TASK-0137)*, plus the record-keeping commit after it
- Push: **confirmed to both remotes** — `a4b8c40..d79f4ec master -> master` to
  `origin` and to `github`; `HEAD`, `origin/master` and `github/master` all
  read `d79f4ec`, and `git remote -v` is token-free
