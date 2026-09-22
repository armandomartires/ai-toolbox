# TASK-0059 — Enforce the delegation rule, and close the authored-MCP validation gap

## Objective

Add two checks to `tests/validate.sh`, each with a fixture proving it **fails**
before any passing result from it is trusted:

1. A `delegates_to` entry must name a role emitted for every client the
   delegating role declares.
2. The destructive-capability gate and the `.env.example` completeness check
   must cover the **authored** MCP shape, not `server.json` only.

The second closes `B-024` and is a precondition for `TASK-0067`.

## Minimal context

**The second check is the urgent one.** `validate.sh`'s manifest checks —
required keys, `capabilities.destructive` → non-empty `destructive_tools` →
`authorization.granted` → `authorization.task` is a file that exists — run on
`server.json` only. So does the `.env.example` completeness loop. The first
authored server this repo will ship (`TASK-0067`) is a **command runner**: it
launches builds measured at ~70 minutes, rewrites workbook VBA and queries, and
force-terminates Excel processes. Under the current gate its authorization block
would be **prose that nothing checks** — which is the authoring guide's own
"Claims a component makes about its own wiring" defect class, in the file that
polices it.

`AGENTS.md` states the rule this gate is the mechanical form of: *"MCP servers
must not expose destructive capabilities without explicit human authorization in
the task file."*

**The fixture requirement is not ceremony.** This repo has shipped a check that
could not fail **twice**, and knowing that did not prevent the second. The
registry `.md` claim check auto-passed because `validate.sh` contained the very
strings it searched for. Both new checks here are therefore accepted only on a
demonstrated red.

`ADR-0005`'s shape rule is not negotiable: a server directory holds **exactly
one** marker file. Carrying both `pyproject.toml` and `server.json` to reuse the
existing check is closed — `validate.sh` fails it as `AMBIGUOUS SHAPE`, and
deliberately.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `docs/development/authoring-guide.md` | `TASK-0058` | `delegates_to` cross-client rule present, Gated **no**; authored-MCP section verified |
| `.ai/tasks/TASK-0056-*.md` | `TASK-0056` | F5's verdict — the evidence justifying check 1 |
| `tests/validate.sh` | pre-existing | the agent checks; the `server.json`-only manifest checks; the `.env.example` loop |
| `mcp-servers/_template/` | pre-existing | the authored template, for the metadata location |
| `.ai/decisions/0005-*.md` | pre-existing | shape derived from the marker file; the Clarification |
| `.ai/planning/BACKLOG.md` | this sprint | `B-024` present |

**Verify the expected state; don't assume it.** Read the guide as `TASK-0058`
left it — if `worktree-only` was left open there, nothing here changes, but the
roles downstream need to know.

## Scope

### Included

- **Check 1** — `delegates_to` cross-client. For each role declaring
  `delegation-allowlist`, every name in `delegates_to` must resolve to a role
  directory whose `clients` is a superset of the delegating role's.
- **Check 2** — extend the destructive and `.env.example` gates to the authored
  shape, reading the metadata from `pyproject.toml`. The same four assertions,
  including that `authorization.task` names a file that exists.
- **A fixture per check, each shown to fail**, then removed. Record the failing
  output verbatim in this task file.
- Flip the Gated cells in the authoring guide to **yes** for both rules.
- Update `B-024`'s backlog entry to `done` with the closing evidence.

### Not included

- Fixing `agents/designer-manager/` if check 1 fails against it. If the gate goes
  red on an existing role, **that is the check working**; record it and raise it.
  A fix is its own task — but note that a red gate blocks commits, so this task
  must say plainly how it is handled rather than leaving the next session stuck.
- Authoring the server. `TASK-0067`.
- A new vocabulary term (`B-025`).
- Any change to `scripts/emit-agents.py`.

## Likely files

- `tests/validate.sh`
- `docs/development/authoring-guide.md` — Gated cells only
- `.ai/planning/BACKLOG.md`
- This task file

## Execution plan

1. Read the guide as `TASK-0058` left it; both rules must already be defined
   there. If either is absent, stop — the order is definition first.
2. Write check 1. Build a fixture role that violates it. **Run the gate and
   confirm it fails**, capturing the message verbatim. Remove the fixture.
3. Run the gate against the **real** `agents/` tree and record the result. If
   `designer-manager` goes red, record it and decide the handling explicitly.
4. Write check 2. Build a fixture authored server declaring `destructive: true`
   with no authorization, and a second whose `authorization.task` points at a
   path that does not exist. **Confirm both fail.** Remove them.
5. Extend the `.env.example` loop to the authored shape; fixture the same way.
6. Flip both Gated cells to yes.
7. Close `B-024` with evidence.
8. `tests/validate.sh` on a clean tree, review the diff, commit.

## Acceptance criteria

- [ ] Both checks exist and their authoring-guide rows read Gated **yes**.
- [ ] **Each check was observed failing on a fixture**, and the failing output is
      recorded verbatim in this file. A check accepted on a green alone does not
      satisfy this criterion.
- [ ] Every fixture is removed, and its removal verified.
- [ ] `validate.sh` passes on the real tree — or, if check 1 reds an existing
      role, that is recorded with the chosen handling stated explicitly and a
      backlog item raised.
- [ ] Check 2 asserts all four of: `destructive` boolean present;
      `destructive_tools` non-empty when true; `authorization.granted`;
      `authorization.task` is an existing file.
- [ ] `B-024` is `done` with its evidence.
- [ ] No shape rule is weakened. No directory gains a second marker file.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` — no-op expected

## Risks and rollback

- **Shipping a check that cannot fail.** The named risk, twice realised. The
  fixture-first order is the control, and the verbatim failing output is the
  evidence that it was followed.
- **A red gate on an existing role blocking every commit.** Anticipate it: the
  handling is decided in this task, not discovered by the next session. Note that
  `git commit --no-verify` exists for fixing the gate itself and **never** for
  dodging a real failure.
- **Weakening the shape rule to make check 2 easy.** Closed by `ADR-0005`.
- Rollback: revert the commit; both checks are additive.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `tests/validate.sh` | Two new checks, each demonstrated red on a fixture first |
| `docs/development/authoring-guide.md` | Both Gated cells read yes |
| `.ai/planning/BACKLOG.md` | `B-024` done with evidence; a new item if check 1 reds an existing role |
| This task file | The verbatim failing output of both fixtures |
| `agents/` | Unchanged |

**Next task starts here**: `TASK-0063` may author the four thinking roles
against a gate that now enforces the delegation rule. `TASK-0067` may author the
gate server knowing its authorization block is mechanically checked. State here
whether check 1 reds anything in the existing tree — the next session must not
discover that from a failing commit.

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
