# TASK-0147 — Give the backlog entry a schema that owns its columns (B-042, part 2)

## Objective

The second half of `B-042`, which closes the row. The backlog entry, one row
of `BACKLOG.md`'s table, has no schema. Its columns are named in prose in
`references/governance-spec.md`, in the scaffold's heredoc header, and,
since `TASK-0142`, as a hard-coded `8` in `scripts/check-backlog-closures.py`.
That makes three owners. Transcribe an entry schema from a count of the
rows. The generator then prints a pasteable row, and the two copies are
checked against it.

## Minimal context

**The count**, 2026-10-05, from `.ai/planning/BACKLOG.md`:

- 53 rows, every one with exactly 8 cells, under the header
  `| ID | Title | Priority | Value | Dependencies | Risk | Status | Ready when |`.
- Priority: `medium` 21, `low` 18, `high` 14. Value: `medium` 30, `high`
  20, `low` 3. Risk: `low` 46, `medium` 7. Every one of the 159 values is
  `low`, `medium` or `high`.
- Status: bold words. `**done**` (48) and `**ready**` (1), then four longer
  forms beginning `**done …**`, `**CLOSED …**` or `**closed …**`.
- Dependencies: `none` in 40 rows; the rest are free text.
- *Ready when*: free prose. 26 of 53 rows open with *"Raised <date> by
  …"*, and closed rows carry *"Closed <date> by …"* (`.ai/README.md`).

**What can be transcribed**: the 8 columns and their order, the header
line, and a starting row of `low|medium|high` values with `**ready**`.
**What cannot**: the prose cells. They are free text by evidence, so they
stay guidance.

**Format fit**: an entry kind, like `project-workflow`'s `adhoc`.
`title_prefix` and `title_pattern` produce the row itself, and a new
`columns:` frontmatter scalar names the columns once. The generator
ignores keys it does not know (`parse_schema` keeps every `key: value`).

**Nothing writes rows mechanically** (`git grep` for `BACKLOG` in the
verdicts reference, `agents/closer` and the loop, 2026-10-05). So the
generator is for an author pasting one row, as `adhoc` is.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/planning/BACKLOG.md` | `TASK-0146` | as counted; `B-042` the one open row |
| `scripts/check-backlog-closures.py` | `TASK-0142`, `TASK-0145` | hard-codes 8 cells |
| `skills/project-migration/scripts/ai-project-scaffold.sh` | ongoing | `BACKLOG.md` heredoc with the 8-column header |
| `skills/project-migration/SKILL.md` | `TASK-0146` | `3.2.0` |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. `skills/project-migration/schemas/backlog.md`: an entry kind, with
   `columns:`, a row-producing `title_pattern`, and the count in its header.
2. `check-backlog-closures.py` reads `columns:` from the schema, relative to
   the script itself, not to a fixture root. It checks that `BACKLOG.md`'s
   header row equals the schema's columns and that every row has that many
   cells.
3. `tests/validate.sh`: the scaffold's `BACKLOG.md` heredoc header must
   equal the schema's columns.
4. `governance-spec.md` and `SKILL.md` point to the schema; `SKILL.md`
   `3.3.0`.
5. Red proofs: a header column renamed; a row with a cell missing; the
   scaffold header changed.
6. `B-042` closed, citing both tasks; `TODO.md`, `CURRENT_STATE.md`, this
   brief.

### Not included

- Enforcing `low|medium|high` or a status vocabulary. The values are
  uniform, but no rule states them yet, and a gate must not invent one
  (`ADR-0008`). The schema's guidance names them.
- Generating `BACKLOG.md` itself. It is an index, which the generator does
  not regenerate (`sync-templates.sh`'s note on indexes).

## Likely files

`skills/project-migration/schemas/backlog.md` (new),
`scripts/check-backlog-closures.py`, `tests/validate.sh`,
`skills/project-migration/references/governance-spec.md`,
`skills/project-migration/SKILL.md`, the ledger, this brief.

## Execution plan

1. This brief first.
2. The schema; print a row with `new-artifact.sh --kind backlog`.
3. The checker and the gate; the red proofs.
4. Docs; `tests/validate.sh`; close `B-042`; commit; push both remotes;
   record commit.

## Acceptance criteria

- [x] `new-artifact.sh --kind backlog --framework project-migration` prints
      one 8-cell row that the checker accepts.
- [x] The column list exists once, in the schema; the checker and the gate
      read it from there, and each red proof fails naming the difference.
- [x] `tests/validate.sh` passes; `B-042` is closed.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed)
- [x] the three red proofs

## Risks and rollback

- **A schema read by a script outside the skill.** The checker is
  ai-toolbox's, and the schema ships with the skill in this repository, so
  the path is stable here. A missing schema fails loudly, never by
  defaulting to 8.
- **Rollback:** `git revert` the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `schemas/backlog.md` | new entry kind; `columns:` is the one owner of the columns |
| `check-backlog-closures.py` | reads the columns; checks the header and every row's cell count |
| `tests/validate.sh` | the scaffold's header is checked against the schema |
| `BACKLOG.md` | `B-042` done; **no open items** |

**Next task starts here**: the backlog is empty; `master` at the record
commit.

**Deviation from the plan**: closing `B-042` exposed a parsing weakness in
`check-backlog-closures.py` (`TASK-0142`). It took the first `- Status:` line
anywhere in a brief, and this brief's count bullet begins
`- Status: bold words`, so it reported *"whose Status reads bold"*. It now
reads the line under `## Status`, which is fixed and proven here.

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-05
- Updated: 2026-10-05

## Execution log

### Attempt 1

- Date: 2026-10-05
- Agent: Claude Code (Opus 5.5), main checkout
- Actions: wrote the brief from the count, then the schema, printed a row,
  changed the checker to read the columns, added the gate check for the
  scaffold, and pointed the docs at the schema (`3.3.0`).
- Observations:
  - `new-artifact.sh --kind backlog --framework project-migration --id
    B-054 --title Example` printed `| B-054 | Example | medium | medium |
    none | low | **ready** | Raised {date} by `{task}`. … |`, 8 cells.
  - **Red proofs**:

    | Mutation | Output | Exit |
    |---|---|---|
    | (a) header `Title` renamed `Name` (fixture) | `the table header should be the schema's columns:`, with both lines | 1 |
    | (b) `B-003` missing its Dependencies cell (fixture) | `B-003: expected 8 cells (the schema's columns), found 7` | 1 |
    | (c) the schema loses `Dependencies` | the header mismatch, with the 7-column line expected | 1 |
    | (d) the scaffold's header says `Deps` | `SCAFFOLD: … BACKLOG.md header is not the columns of …backlog.md` from `tests/validate.sh` | gate fails |
    | (e) a brief quoting `- Status:` above a real `done` (fixture) | `OK (53 closed rows, 0 open, …)` | 0 |

    The files mutated in (c) and (d) were restored from copies, and
    `git diff --quiet` confirmed each restore.
  - The status-parsing defect was found live: before the fix, the check
    printed `B-042 is closed by TASK-0147, whose Status reads bold`. After
    it, while this brief was still open, it printed `… reads in_progress`.
- Validation: `tests/validate.sh` printed `validate.sh: OK`, and the registry
  is unchanged.
- Result: done. **Zero backlog items are open.**
- Commit: recorded in the follow-up record commit
- Push: recorded in the follow-up record commit
