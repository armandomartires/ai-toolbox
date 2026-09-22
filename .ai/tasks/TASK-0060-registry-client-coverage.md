# TASK-0060 — Show a role's client coverage in the registry

## Objective

Give `docs/registry.md`'s Agents section a **Clients** column, so an
OpenCode-only role is visible as such rather than appearing universal. Closes
`ADR-0018` clause 8.5, which has been unsatisfied since S7, and `B-026`.

## Minimal context

`ADR-0018` clause 8.5 is normative and reads:

> *"The registry must show a role's client coverage, so an OpenCode-only role is
> visible as such rather than appearing universal."*

It has never been implemented. The Agents section is
`| Name | Description | Path |`, and **three of the six existing roles are
OpenCode-only** — `git-ops`, `qa-test` and `review` — while the registry
presents all six identically.

**This sprint makes it actively misleading rather than merely incomplete.**
`TASK-0064` adds five more OpenCode-only roles, taking the total to eight of
fifteen. A registry advertising fifteen universal roles when seven of them
cannot be emitted for Claude Code is the same class of false self-claim as
`B-021` — *"The role makes a false claim about itself"* — except at the index
level, where a reader is least likely to check.

**So this must land before `TASK-0064`, not after.**

There is a precedent for the mechanism and a precedent against over-reaching.
The MCP section already carries a fourth column (Shape), so `emit_section`
supports one. But `sync-registry.sh` records why agents got **no** Shape column:
`mode` is *self-declared* frontmatter rather than derived, and `ADR-0005`'s
Clarification prefers derived over declared. `clients` is self-declared too —
but unlike `mode` it is the field the **emitter acts on**, and `validate.sh`
already constrains it to a closed set. Record that distinction rather than
letting a later reader assume the earlier decision was simply reversed.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/decisions/0022-*.md` | `TASK-0057` | **`Accepted`** |
| `scripts/sync-registry.sh` | pre-existing | four `emit_section` calls; `extract()` with the per-kind branch; the MCP Shape column as the precedent |
| `tests/validate.sh` | pre-existing | the registry checks, including the header-derived column count and the `_template*` path assertion |
| `docs/registry.md` | generated | six agent rows, three columns |
| `agents/*/agent.md` | pre-existing | six roles; `git-ops`, `qa-test`, `review` declare `clients: [opencode]` |
| `.ai/decisions/0018-*.md` | pre-existing | clause 8.5 |

**Verify the expected state; don't assume it.** Re-read `validate.sh`'s registry
check before changing column counts — it derives the expected width from each
section's own header row, and the header detection matches on `| Name `.

## Scope

### Included

- `extract()` returns a third field for `kind=agent`: the `clients` list,
  comma-joined, in a stable order.
- The Agents `emit_section` call takes the extra-column flag.
- Regenerate `docs/registry.md`.
- Confirm `validate.sh`'s registry checks still pass with the new width, and that
  the `_template*` exclusion still holds.
- One line in `sync-registry.sh`'s header recording **why `clients` gets a column
  while `mode` did not** — the emitter acts on `clients`, and `validate.sh`
  constrains it to a closed set. Without that line the file contradicts its own
  existing comment.

### Not included

- A Clients column for skills, loops or MCP servers. Skills and loops have no
  per-client variation to show; MCP servers already carry Shape and their client
  reach is a wiring fact, not a manifest one.
- Changing any role's `clients` list.
- Adding a `mode` column. `sync-registry.sh`'s stated reason against it stands
  and is not weakened by this change.
- Any `validate.sh` change. If the registry check needs one, that is a finding —
  record it rather than absorbing it here.

## Likely files

- `scripts/sync-registry.sh`
- `docs/registry.md` (generated)
- `.ai/planning/BACKLOG.md` — `B-026`
- This task file

## Execution plan

1. Confirm ADR-0022 reads `Accepted`. Stop if not.
2. Read `validate.sh`'s registry checks and note exactly how the expected column
   count is derived.
3. Extend `extract()` for `kind=agent`; extend the Agents `emit_section` call.
4. Add the header comment recording the `clients`-versus-`mode` distinction.
5. Regenerate and inspect: six rows, `git-ops`, `qa-test` and `review` showing
   `opencode` alone.
6. `tests/validate.sh`. Confirm the registry staleness and integrity checks pass.
7. Close `B-026` with evidence. Review the diff, commit.

## Acceptance criteria

- [ ] The Agents section carries a Clients column.
- [ ] `git-ops`, `qa-test` and `review` show `opencode` only; the other three
      show both clients.
- [ ] `docs/registry.md` is regenerated and
      `git diff --exit-code docs/registry.md` is clean afterwards.
- [ ] `validate.sh`'s registry checks pass, including the column-count and
      `_template*` assertions.
- [ ] `sync-registry.sh`'s header records why `clients` gets a column and `mode`
      does not.
- [ ] `ADR-0018` clause 8.5 is satisfied, and this task names it as closed.
- [ ] `B-026` is `done`.

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `scripts/sync-registry.sh` followed by `git diff --exit-code docs/registry.md`

## Risks and rollback

- **Breaking the registry column-count check for the other three sections.** The
  count is derived per section; verify all four, not just Agents.
- **Reading the `mode` decision as reversed.** It is not. The header comment is
  what prevents a later reader concluding otherwise.
- **Landing after `TASK-0064`.** Then five OpenCode-only roles are advertised as
  universal in a committed, generated file. Sequence enforced by the sprint table.
- Rollback: revert the commit and regenerate. The registry is generated, so
  recovery is a script run.

## Outputs / handover

*Forecast until verified.*

| Artifact | End state |
|----------|-----------|
| `scripts/sync-registry.sh` | Agents section emits a Clients column; header records the `clients`-vs-`mode` distinction |
| `docs/registry.md` | Regenerated; six agent rows with client coverage visible |
| `.ai/planning/BACKLOG.md` | `B-026` done |
| `agents/*/agent.md` | Unchanged |

**Next task starts here**: `TASK-0064` may add five OpenCode-only roles to a
registry that can say so. `ADR-0018` clause 8.5 is satisfied and should not be
re-raised.

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
