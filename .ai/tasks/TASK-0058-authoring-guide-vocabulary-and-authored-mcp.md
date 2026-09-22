# TASK-0058 — Settle `worktree-only` for Claude Code, add the delegation rule, and verify the authored-MCP section

## Objective

Make three definitional changes to `docs/development/authoring-guide.md` **before
anything enforces or emits them**, per `ADR-0008`. Two close standing gaps that
predate this sprint; one is needed by the nine roles that follow.

## Minimal context

`ADR-0008`'s order is definition → enforcement → emission, and this repo has
paid for breaking it. The guide's own Gated column exists because a sentence
claiming it *"enforces every frontmatter rule below"* was **false in both
halves**.

Three items:

1. **`worktree-only` has no settled Claude Code emission.** `ADR-0018` clause 7
   assigned it to `TASK-0040`; it is still open. The guide marks it *partial*:
   OpenCode's `external_directory: deny` **refuses** tool calls outside the
   working directory, while Claude Code's `isolation: worktree` gives an
   **isolated copy**. Confinement by refusal versus by redirection — not a
   drop-in translation. **Every existing role declares it, and all nine new ones
   will.** For the *acting* roles the difference is material: an isolated copy
   is the wrong confinement for a role that must commit to the real tree.
2. **A `delegates_to` entry may name a role that is never emitted for the
   delegating role's client.** `agents/designer-manager/` does this today with
   `git-ops`. `TASK-0056` establishes whether it is silent.
3. **The authored (Python) MCP section describes a path nobody has walked.**
   `ADR-0010`'s obligation 2, becoming due because `TASK-0067` will walk it.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/decisions/0022-*.md` | `TASK-0057` | **`Accepted`.** This task does not start otherwise |
| `.ai/tasks/TASK-0056-*.md` | `TASK-0056` | `done`; `isolation: worktree` characterised, or explicitly left open |
| `.ai/tasks/TASK-0055-*.md` | `TASK-0055` | `done`; F1's verdict, which decides whether the `mode` row changes |
| `docs/development/authoring-guide.md` | pre-existing | Agents section with the ten-term vocabulary and Gated columns |
| `.ai/decisions/0018-*.md` | pre-existing | clause 7 (the open `worktree-only` question) and clause 8 |
| `.ai/decisions/0010-*.md` | pre-existing | its three reopen obligations |
| `mcp-servers/_template/` | pre-existing | the authored template — note it is `_template/`, **not** `_template-python/` |

**Verify the expected state; don't assume it.** ADR-0022 must actually read
`Accepted`; a `Proposed` ADR does not open this gate.

## Scope

### Included

- **Settle `worktree-only` for Claude Code**: emit `isolation: worktree`, or
  refuse the client. Record the decision and its reason in the guide. If
  `TASK-0056` left it open, **say so in the guide explicitly** and scope the
  affected roles — an honest open question beats a silent resolution that
  affects all nine roles plus the six that exist.
- Add the **`delegates_to` cross-client rule**: a delegate must be emitted for
  every client the delegating role declares. Definition only; `TASK-0059`
  enforces it.
- **Verify the authored-MCP section against `mcp-servers/_template/` as it
  actually is**, and correct it. Include the launch convention, and note the
  discrepancy to be resolved in `TASK-0067`: `install.sh` prints a
  `cd <dir> && uv run <name>` form, while client configs need a cwd-independent
  `uv --directory <abs> run <name>`.
- Amend the `mode` row **only if** F1 forced it.
- Update the Gated column for every row touched. A rule whose gate does not
  exist yet is marked **no**, and `TASK-0059` flips it.

### Not included

- Any change to `tests/validate.sh`. That is `TASK-0059`, deliberately separate,
  so definition and enforcement are distinguishable in the history.
- Any change to `scripts/emit-agents.py`.
- Fixing `agents/designer-manager/`.
- A new vocabulary term. The nine roles are designed to need none; if one turns
  out to be needed, that is a finding and its own task, not an improvisation
  here. `ADR-0018` clause 8.1: *a term is not admitted merely because it can be
  written.*

## Likely files

- `docs/development/authoring-guide.md`
- This task file

## Execution plan

1. Confirm ADR-0022 reads `Accepted`. Stop if not.
2. Read `TASK-0055` and `TASK-0056`'s findings.
3. Settle `worktree-only`, or record it as open with its scope.
4. Write the `delegates_to` cross-client rule, Gated **no** for now.
5. Read `mcp-servers/_template/` and correct the authored-MCP section against it.
6. Apply the `mode` row change if F1 forced it.
7. Re-read every Gated cell touched and confirm it matches what `validate.sh`
   does **today**, not what `TASK-0059` will do.
8. `tests/validate.sh`, review the diff, commit.

## Acceptance criteria

- [ ] `worktree-only`'s Claude Code emission is settled, or recorded as open
      with the affected roles named.
- [ ] The `delegates_to` cross-client rule is written and marked Gated **no**.
- [ ] The authored-MCP section matches `mcp-servers/_template/` as read, and the
      launch-form discrepancy is named with its owning task.
- [ ] Every Gated cell touched is true of `validate.sh` **as it stands**.
- [ ] No claim in the guide is left asserting something this task did not check.
- [ ] `tests/validate.sh` passes.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` — no component changed, so this must be a no-op

## Risks and rollback

- **Marking a row Gated yes before the gate exists.** That is the exact defect
  the Gated column was introduced to fix, reappearing in the guide that governs
  the gate.
- **Resolving `worktree-only` silently.** It affects fifteen roles. ADR-0018
  clause 8.2 requires a loud failure over a quiet degradation.
- **Inventing a vocabulary term under time pressure.** Out of scope, and the
  ADR says why.
- Rollback: revert the commit. Nothing depends on this until `TASK-0059`.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `docs/development/authoring-guide.md` | `worktree-only` settled or scoped-open; `delegates_to` cross-client rule present, Gated no; authored-MCP section verified against the real template; `mode` row amended only if F1 forced it |
| `tests/validate.sh` | **Unchanged**, deliberately |
| `scripts/emit-agents.py` | **Unchanged**, deliberately |

**Next task starts here**: `TASK-0059` enforces the `delegates_to` rule and
flips its Gated cell to yes. If `worktree-only` was left open, say so here in one
line — `TASK-0063` and `TASK-0064` both need to know before they declare it on
nine roles.

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
