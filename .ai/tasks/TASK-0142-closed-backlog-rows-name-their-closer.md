# TASK-0142 — Gate that a closed backlog row names a closer that agrees (B-038)

## Objective

Close `B-038` with the **narrow forward check** the human chose on
2026-10-05. Every backlog row marked done or closed must cite the task, ADR or
review that closed it, that artifact must exist, and a cited task's status
must read `done` or `cancelled`. State the rule first, then gate it.

## Minimal context

- **Why**: `TASK-0118` existed because `B-035` sat at `ready` for a day
  after `TASK-0106` closed it. Every claim it repaired was valid in shape and
  false. Shape is gated and content is not (`ADR-0027`'s stated limit).
- **Why only the forward direction**: briefs cite backlog items in free
  prose ("Discharges …"). Of 131 briefs, 14 use the word at all, in
  different forms (measured 2026-10-05). So the reverse check, a row left
  open after its task closed, has nothing structured to read. The human
  declined to add a structured field to the task schema.
- **What it must not touch**: the dated records that describe a row as it
  once stood. The check reads only the backlog's status and *Ready when*
  cells, and the cited task's `- Status:` line.
- **`ADR-0008` forbids a gate inventing a rule**, so the rule is written into
  `.ai/README.md` first.
- **A survey before writing the check**, of 47 closed rows (one per closing
  id, taken as the id after *Closed … by*, else the first cited):
  - every row cites a TASK, ADR or REVIEW;
  - `TASK-0106`'s status reads `**done**`, so the parser strips the bold;
  - the other cited tasks read `done`.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/planning/BACKLOG.md` | `TASK-0141` | `B-038` `ready`; five open; 48 closed rows |
| `.ai/README.md` | `TASK-0024` and earlier | 14 lines; no backlog-closure rule |
| `tests/validate.sh` | `TASK-0139` | `validate.sh: OK` |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. `.ai/README.md`: the rule, under `planning/`.
2. `scripts/check-backlog-closures.py`, standard library only, taking an
   optional fixture root for red proofs; it states what it does not prove.
3. `tests/validate.sh` runs it unconditionally.
4. Red proofs on `mktemp` copies:
   - a closed row citing nothing;
   - a closer with no file;
   - a closer whose status is `in_progress`;
   - a bold `**done**` status, which must pass.
5. `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md`, this brief.

### Not included

- The reverse direction, and any change to the task schema.
- Rewriting any closed row's note; none fails today.

## Likely files

`.ai/README.md`, `scripts/check-backlog-closures.py` (new),
`tests/validate.sh`, the ledger, this brief.

## Execution plan

1. This brief first; then the rule.
2. The script; run it on the repository; red proofs on copies.
3. Gate wiring; `tests/validate.sh`; ledger; commit; push both remotes;
   record commit.

## Acceptance criteria

- [x] `.ai/README.md` states the rule, and the script's header points to it.
- [x] The script passes on this repository and fails on each red fixture,
      naming the row.
- [x] `tests/validate.sh` runs it, and passes.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed)
- [x] the four fixture proofs

## Risks and rollback

- **The ledger moves, and the check blocks a commit.** That is the purpose.
  A closing commit changes the row and the task's status together, as every
  task in this sweep does.
- **The first-cited heuristic picks the wrong id.** A row whose note opens
  with another artifact names its closer as *Closed … by*, which wins.
- **Rollback:** `git revert` the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `.ai/README.md` | the closure rule under `planning/` |
| `scripts/check-backlog-closures.py` | new, `100755` |
| `tests/validate.sh` | runs it |
| `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md` | `B-038` done; four open |

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
- Actions: wrote the brief, then the rule, then the script, which was drafted
  and run against the ledger before it was installed. Then the gate wiring.
- Observations:
  - On this repository: `check-backlog-closures: OK (48 closed rows)`.
  - **Fixture proofs**, each on a `mktemp` copy of `.ai/`:

    | Mutation | Output | Exit |
    |---|---|---|
    | (a) `B-002`'s note stripped of its ids | `BACKLOG: B-002 is closed but cites no TASK, ADR or REVIEW` | 1 |
    | (b) `TASK-0135`'s file deleted | `BACKLOG: B-049 is closed by TASK-0135, which has no file under .ai/` | 1 |
    | (c) `TASK-0136` set to `in_progress` | `BACKLOG: B-045 is closed by TASK-0136, whose Status reads in_progress` | 1 |
    | (d) `TASK-0137` set to `**done**` | `OK (48 closed rows)` | 0 |

  - This task's own closing commit is the check's first live use: `B-038`
    is closed by this brief, so the hook requires its status to read `done`
    in the same commit.
- Validation: `tests/validate.sh` printed `validate.sh: OK`, and the registry
  is unchanged.
- Result: done.
- Commit: recorded in the follow-up record commit
- Push: recorded in the follow-up record commit
