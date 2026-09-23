# TASK-0075 — A delegate must exist for every client its caller is emitted for

## Objective

Close `B-028`. Narrow `agents/designer-manager/agent.md` to
`clients: [opencode]`, and add the **cross-client `delegates_to` check** to
`tests/validate.sh` so the defect class cannot recur.

## Minimal context

`B-028` was raised by `TASK-0056` **from a live defect on this machine, not
from inspection**. `designer-manager` declares
`clients: [claude-code, opencode]` and `delegates_to: [ideator, critic,
git-ops]`, while `git-ops` declares `clients: [opencode]`. So
`~/.claude/agents/designer-manager.md` ships `tools: Agent(ideator, critic,
git-ops)` and `~/.claude/agents/git-ops.md` does not exist.

**Observed, not reasoned:** Claude Code says **nothing** — no warning, no
error, exit 0. A control fixture naming *only* an absent delegate produced
**0 bytes of stderr** and a role reporting *"No subagent types were listed in
this session — I have no permitted delegates."* A second control proved the
channel works: `claude -p --agent <absent>` fails with exit 1 and 182 bytes of
stderr. **Claude Code validates the top-level `--agent` and does not validate
the contents of an agent definition's `Agent(...)` allowlist.**

**Human decision, 2026-09-23: narrow the role and add the gate now.**

**Why narrowing is the honest fix rather than a loss to be minimised.**
`git-ops` cannot exist for Claude Code — it exists to enforce
`bash-allowlist`, which has no per-agent expression there (`ADR-0018` clause
8.3). `designer-manager` needs it for `ADR-0019`'s lock commit, *"the commit
is the lock"*. The alternative — per-client `delegates_to` — was offered and
**declined**; it is a schema change that belongs inside a sprint, not a
backlog fix.

**The consequence is real and must be stated, not buried:** the design-brief
loop becomes **OpenCode-only**. Claude Code keeps `ideator` and `critic` but
loses the primary that orchestrates them, so it has the workers and no loop.
That is a genuine reduction in capability, and it is the *accurate* one —
today Claude Code appears to have the loop and does not.

**On pulling the check forward.** This check is scoped as S9's `TASK-0059`,
which is gated on `ADR-0022` being `Accepted`. Adding it here is a deliberate
partial pull-forward, authorised by the same decision, on the grounds that
`B-028` is a **live** defect and `TASK-0056` already produced the evidence
that justifies the check. `TASK-0059`'s brief must be annotated so its author
does not write it twice.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `agents/designer-manager/agent.md` | `TASK-0043` | `clients: [claude-code, opencode]`; `delegates_to: [ideator, critic, git-ops]` |
| `agents/git-ops/agent.md` | `TASK-0045` | `clients: [opencode]` |
| `tests/validate.sh` | `TASK-0074` | per-role loop; no cross-role check exists |
| `configs/claude-code/README.md` | `TASK-0040` | *"Currently deployed: three of six roles"* at line 49 |
| `configs/opencode/README.md` | `TASK-0045` | *"Currently deployed: six roles"* at line 66 |
| `.ai/tasks/TASK-0059-*.md` | `PLAN-0006` | `planned`; owns the `delegates_to` cross-client check |

**Verify the expected state; don't assume it.** Re-read every role's
`clients` and `delegates_to` before writing the check — `designer-manager` is
the only role with delegates today, and a check written against one example
is a check shaped by one example.

## Scope

### Included

- `agents/designer-manager/agent.md`: `clients` narrowed to `opencode`.
- `tests/validate.sh`: a **cross-role** pass asserting that for every role
  `R` with `delegates_to`, each named delegate **exists**, and for each client
  in `R.clients` that delegate declares the **same client**.
- Fixtures proving both failure modes, plus **a demonstration that the check
  fires on `designer-manager`'s pre-fix state** — the defect it was written
  for.
- `configs/claude-code/README.md` and `configs/opencode/README.md`: the role
  counts, and the OpenCode-only consequence for the design-brief loop.
- An annotation in `TASK-0059`'s brief recording what is already done.
- `B-028` closed.

### Not included

- **Per-client `delegates_to`.** Offered and declined.
- Any change to `git-ops`, `ideator` or `critic`.
- `loops/design-brief/loop.md`. The loop's *steps* do not change; only which
  clients can run it, which is a wiring fact and belongs in `configs/`.
- The rest of `TASK-0059` — the authored-MCP gates and `B-024` stay S9's.

## Likely files

- `agents/designer-manager/agent.md`, `tests/validate.sh`
- `configs/claude-code/README.md`, `configs/opencode/README.md`
- `.ai/tasks/TASK-0059-*.md`, `.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`,
  `.ai/context/CURRENT_STATE.md`
- `docs/registry.md` — only if the generated rows actually move.

## Execution plan

1. Re-read every role's `clients`/`delegates_to`.
2. Write the cross-role check. **Prove it fires on the pre-fix
   `designer-manager`** before narrowing the role — the defect is the fixture.
3. Narrow the role; confirm the gate goes green.
4. Prove the missing-delegate case with a fixture.
5. Re-emit for both clients and confirm `designer-manager` is now **skipped**
   for claude-code rather than emitted with a dead reference.
6. Docs, `sync-registry.sh`, remove fixtures, diff, commit, push.

## Acceptance criteria

- [ ] The check **fires on `designer-manager`'s pre-fix state** — observed,
      with the message recorded here. This is the acceptance criterion that
      matters; a check that only fires on invented fixtures has not been shown
      to catch the thing it exists for.
- [ ] The check fires on a delegate that does not exist at all — observed.
- [ ] The gate passes on the corrected tree.
- [ ] `~/.claude/agents/designer-manager.md` is no longer emitted; emission
      **skips** the role for claude-code with exit 0, rather than refusing.
- [ ] Both wiring snapshots state the new counts **and** that the design-brief
      loop is OpenCode-only.
- [ ] `TASK-0059`'s brief records what this task already did.
- [ ] Fixtures removed, removal verified.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh`
- [ ] `git status --porcelain`

## Risks and rollback

- **Silently reducing capability.** Narrowing the role removes the design
  loop from a client. Mitigated by stating it in both snapshots and in
  `CURRENT_STATE.md` rather than only in this log.
- **A stale emitted file outliving the change.** Nothing prunes
  `~/.claude/agents/designer-manager.md` (ADR-0018 clause 4 forbids a
  freshness check). It must be **removed by hand**, and this task says so
  rather than assuming re-running `install.sh` is enough.
- **Writing a check shaped by one example.** `designer-manager` is the only
  role with delegates. Mitigated by testing the non-existent-delegate case
  too, which no current role exhibits.
- Rollback is `git revert` of one commit.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `agents/designer-manager/agent.md` | `clients: [opencode]` |
| `tests/validate.sh` | Cross-role `delegates_to` check, observed firing on the real defect |
| `configs/*/README.md` | Counts corrected; design-brief loop stated as OpenCode-only |
| `~/.claude/agents/designer-manager.md` | **Stale on this machine; must be deleted by hand** |
| `agents/git-ops/agent.md` | **Unchanged** |

**Next task starts here**: the unscheduled backlog queue is **empty**. The
next step is the `ADR-0022` ratification gate.

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
  1. Re-read every role's `clients`/`delegates_to`. **`designer-manager` is
     the only role with delegates**, so the check was deliberately tested
     against a case no current role exhibits as well.
  2. Wrote the cross-role pass in `tests/validate.sh` **before** touching the
     role, so the live defect was the fixture.
  3. Narrowed `designer-manager` to `clients: [opencode]`.
  4. Both wiring snapshots updated; `TASK-0059`'s brief annotated.
- Observations:
  - **The check fired on the real defect, which is the whole point.** Run
    against the unmodified tree it produced, exit 1:

    > `INVALID DELEGATION: agents/designer-manager/agent.md: delegates_to
    > names 'git-ops', which is not emitted for claude-code — the caller IS
    > emitted for claude-code, so that client gets an Agent(git-ops)
    > allowlist naming an agent it does not have, and neither client warns`

    A check first demonstrated on an invented fixture has only been shown to
    catch inventions.
  - **Second failure mode observed**: a delegate that is not a role at all →
    *"delegates_to names 'zz-no-such-role', which is not a role in agents/"*.
  - **Emission verified after the fix**: `designer-manager` is now **skipped**
    for claude-code (*"not in its clients list"*, exit 0) rather than emitted
    with a dead reference, and all six roles still emit for opencode.
  - **`docs/registry.md` did not change, and that is itself the finding.**
    Its Agents section is `| Name | Description | Path |` with no Clients
    column, so **four of six roles are now OpenCode-only and the registry
    presents all six identically**. That is `ADR-0018` clause 8.5, unsatisfied
    since S7, raised as `B-026` and scoped to `TASK-0060`. **This task made
    the case worse rather than revealing it** — the count went from three to
    four — and `TASK-0060` should be read as more urgent, not less.
  - **A stale file this repo cannot clean up.**
    `~/.claude/agents/designer-manager.md` still exists on this machine and
    **re-running `install.sh` will not remove it** (`ADR-0018` clause 4 forbids
    a freshness check). It must be deleted by hand; the command is in
    `configs/claude-code/README.md`. **Not deleted by this task** — it is
    outside the repo, in the user's client config, and removing files from
    there is theirs to authorise.
  - **The capability loss is real and is stated in three places**, not just
    here: `loops/design-brief/` is now OpenCode-only. Claude Code keeps
    `ideator` and `critic` and has no primary to orchestrate them. The honest
    framing, which both snapshots carry: **the loop did not work there
    before; it only looked as though it did.**
- Validation:
  - `tests/validate.sh` — **OK** after the fix; **exit 1 before it**
  - `scripts/sync-registry.sh` — no diff (see the `B-026` note above)
  - `git status --porcelain` — fixtures removed
- Result: **done.** `B-028` closed: the live instance fixed and the class
  gated. The unscheduled backlog queue is now **empty**.
- Commit: `607a955`. Pre-commit hook ran `tests/validate.sh`: OK.
- Push: **confirmed** — pushed to `origin/master`.
