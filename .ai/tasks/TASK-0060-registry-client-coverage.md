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
`| Name | Description | Path |`, and **~~three~~ FOUR of the six existing roles
are OpenCode-only** — `designer-manager`, `git-ops`, `qa-test` and `review` —
while the registry presents all six identically.

**Corrected during execution, not planning.** This brief and `B-026` both said
three. `TASK-0075` narrowed `designer-manager` to `clients: [opencode]` earlier
the same day, because it delegates to `git-ops`, which cannot have a Claude Code
form. The count was found wrong by re-reading all six `agents/*/agent.md` files
rather than by trusting either document — the check this brief itself demands
below. The defect was therefore *worse* than scoped, not smaller.

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

- [x] The Agents section carries a Clients column.
- [x] `designer-manager`, `git-ops`, `qa-test` and `review` show `opencode`
      only; `critic` and `ideator` show both. **Criterion amended**: it named
      three roles and two are not what it expected — see Minimal context.
- [x] `docs/registry.md` is regenerated and re-running the generator produces
      no further diff (idempotent). Only the Agents section changed; the MCP
      separator row was briefly widened by a first cut and restored, so the
      committed diff touches one section.
- [x] `validate.sh`'s registry checks pass, including the column-count and
      `_template*` assertions. No `validate.sh` change was needed.
- [x] `sync-registry.sh`'s header records why `clients` gets a column and
      `mode` does not — and corrects the reason this brief gave.
- [x] `ADR-0018` clause 8.5 is satisfied, and this task names it as closed.
- [x] `B-026` is `done`.

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

*Verified 2026-09-23.*

| Artifact | End state |
|----------|-----------|
| `scripts/sync-registry.sh` | Agents section emits a Clients column via a labelled third-column mechanism shared with MCP's Shape; header records the `clients`-vs-`mode` distinction **and corrects the closed-set half of the reason this brief gave** |
| `docs/registry.md` | Regenerated; six agent rows, four showing `opencode` alone |
| `.ai/planning/BACKLOG.md` | `B-026` done, with the stale three-of-six count corrected in the closure record |
| `agents/*/agent.md` | Unchanged — read only |
| `tests/validate.sh` | Unchanged — the derived column count needed no edit, as forecast |

**Next task starts here**: `TASK-0064` may add five OpenCode-only roles to a
registry that can say so. `ADR-0018` clause 8.5 is satisfied and should not be
re-raised.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context), worktree `agent/t0060`
- Actions:
  1. Confirmed `ADR-0022` reads **Accepted — 2026-09-23** (ratified as written
     by `TASK-0076`). Precondition met.
  2. Read `tests/validate.sh`'s registry checks. The expected column count is
     derived per section from that section's own `| Name ` header row, so
     widening a section needs no check edit. Confirmed before changing anything.
  3. Re-read all six `agents/*/agent.md` for their real `clients` lists. **Found
     the brief and `B-026` stale**: four OpenCode-only roles, not three.
  4. `scripts/sync-registry.sh`: added `fm_seq()`, a frontmatter block-sequence
     reader deliberately accepting the same shape as `validate.sh`'s `seq()`
     (block sequences only, matching-pair unquoting, trailing whitespace after
     the key tolerated), so a list the generator cannot read is one the gate
     would reject anyway. `extract()` returns `clients` as a third field for
     `kind=agent`, **sorted** rather than in frontmatter order, so two roles with
     equal coverage cannot render differently by accident.
  5. Generalised `emit_section`'s fourth argument from the literal `shape` flag
     to a column *label*, since two sections now carry a third column with
     different headers. `Shape` and `Clients` are now the same mechanism.
  6. Wrote the `clients`-versus-`mode` paragraph into the header, immediately
     under the existing `mode` paragraph it must not appear to contradict.
  7. Regenerated, validated, demonstrated (below), closed `B-026`.
- Observations:
  - **The brief's own justification was wrong, and is corrected in the script
    rather than copied into it.** Both the brief and `B-026` distinguish
    `clients` from `mode` by two reasons: the emitter acts on `clients`, *and*
    `validate.sh` constrains it to a closed set. **The second reason does not
    separate them.** `tests/validate.sh` line 444 defines
    `MODES = {"primary", "subagent"}` one line above `CLIENTS`, and checks
    `mode` against it exactly as it checks `clients`. Had that reason been
    written into the header as instructed, the header would have contained an
    argument a reader can falsify in one grep — worse than no argument.
  - **The real distinction is the emitter, and only the emitter**, and it is
    sharper than "acts on": `scripts/emit-agents.py` line 268 *carries `mode`
    through* into the OpenCode role and drops it for Claude Code, so a wrong
    `mode` still produces a file that looks right; line 372 uses `clients` as
    the **gate** — a role not naming a client is skipped and **no file is
    written**. A registry is an index of deployable components, so `clients` is
    the field the index is *about*. The header says this, and also says plainly
    what is *not* the argument, so the `mode` decision reads as upheld with a
    test attached rather than silently reversed.
  - A first cut sized the separator row from the label alone, which silently
    narrowed the **MCP** separator from 7 dashes to 5 — an unrelated section
    changed by a change scoped to Agents. Caught by reading the diff rather than
    the output. Width is now label + 2 padding spaces, matching every other
    separator cell, and the committed diff touches the Agents section only.
- Validation:
  - `tests/validate.sh` → `validate.sh: OK`, exit 0.
  - `scripts/sync-registry.sh` run twice → identical output; second run adds no
    diff.
  - **The column is demonstrated, not asserted.** `python3
    scripts/emit-agents.py claude-code <scratch>` emits exactly `critic.md` and
    `ideator.md` — the same two roles, and only those, that the new column shows
    as reaching Claude Code. `opencode` emits all six. The registry now
    *predicts* the emitter's output rather than describing it.
  - **The integrity check was shown to still guard the widened section.** A
    stale three-column row appended to Agents fails with
    `REGISTRY INTEGRITY: line 36 (Agents): 5 columns, header declares 6 — a
    missing cell, or a format change applied to the header but not the rows?`,
    exit 1 — the correct diagnosis direction. Restored, `OK` again. The check
    needed no edit, confirming the brief's expectation about how the width is
    derived.
- Result: **done.** `ADR-0018` clause 8.5 satisfied; `B-026` closed. `TASK-0064`
  may now add OpenCode-only roles to a registry that can say so.
- Commit: `8ef2cb9` — *Show each role's client coverage in the registry* (branch
  `agent/t0060`). `tests/validate.sh` ran as the pre-commit hook and passed.
- Push: **not pushed by this session, by instruction.** This task ran in the
  `agent/t0060` worktree alongside two concurrent sessions (`ADR-0023`); the
  coordinating session lands and pushes all three branches serially and records
  the push result.
