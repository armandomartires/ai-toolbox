# TASK-0145 — Gate BACKLOG.md's open-item count against the rows (B-047)

## Objective

Close `B-047`. `BACKLOG.md` carries a hand-maintained sentence, **"N items
are open"**, and it has drifted from the rows at least three times
(`TASK-0115`, `TASK-0118`, `TASK-0122`). The row says closing it needs a
*mechanism*, not another hand pass. Extend `TASK-0142`'s
`scripts/check-backlog-closures.py` so the gate recounts the open rows and
fails when the sentence disagrees.

## Minimal context

- **Open** means what the closure check already uses: a row whose Status
  cell contains neither `done` nor `closed`. The recount helper used
  throughout this session's closures applies the same rule. That one rule now
  decides both what the check checks and what the count counts.
- The sentence starts **"Two items are open"** today, in words, and two rows
  are open (`B-042`, `B-047`). The check reads a word up to twenty, or
  digits.
- `B-047`'s own row notes that the dashboard generator also counts the rows.
  But nothing gates the dashboard, so it is not the mechanism.
- The rule goes into `.ai/README.md`'s *Closing a backlog row*, beside
  `TASK-0142`'s, before the gate enforces it (`ADR-0008`).

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `scripts/check-backlog-closures.py` | `TASK-0142` | checks closers only; `OK (51 closed rows)` |
| `.ai/planning/BACKLOG.md` | `TASK-0144` | sentence reads `**Two items are open**`; rows: `B-042`, `B-047` open |
| `.ai/README.md` | `TASK-0142` | the closure rule |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. The script also finds the one `**<N> items are open**` sentence (or
   `item is`), and compares N with the recount. It fails on a mismatch, on
   no such sentence, or on more than one.
2. `.ai/README.md`: one sentence added to the rule.
3. Fixture proofs on `mktemp` copies:
   - a wrong number;
   - a reopened row;
   - the sentence removed;
   - a digit count, which must pass.
4. `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md`, this brief.

### Not included

- Generating the sentence. A checked hand count keeps the paragraph's
  dated history, which a generated one would replace.

## Likely files

`scripts/check-backlog-closures.py`, `.ai/README.md`,
`.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`,
`.ai/context/CURRENT_STATE.md`, this brief.

## Execution plan

1. This brief first.
2. Extend the script; run it on the repository and see what it says.
3. Fixture proofs; correct the sentence; the rule; ledger.
4. `tests/validate.sh`; commit; push both remotes; record commit.

## Acceptance criteria

- [x] The gate fails when the sentence's number differs from the recount,
      or when the sentence is missing or duplicated, and names both numbers.
- [x] `.ai/README.md` states it.
- [x] `tests/validate.sh` passes with the corrected sentence.

## Mandatory validations

- [x] tests/validate.sh
- [x] the four fixture proofs

## Risks and rollback

- **Every closing commit must now update the sentence.** That is the point,
  and each one in this session already did.
- **Rollback:** `git revert` the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `scripts/check-backlog-closures.py` | also checks the open-item count |
| `.ai/README.md` | the count rule |
| `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md` | `B-047` done; one open (`B-042`) |

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
- Actions: wrote the brief, then extended the script, ran it, and ran the
  fixture proofs. Then the rule, the gate comment, and the closure.
- Observations:
  - On this repository, before closing `B-047`: `OK (51 closed rows, 2 open,
    matching the sentence)`. The brief's first draft said the sentence was
    wrong. It was not: the recount helper has counted from the rows all
    session, and only a hand listing had missed `B-047`. Corrected before
    any code.
  - **Fixture proofs**, on `mktemp` copies of `.ai/`:

    | Mutation | Output | Exit |
    |---|---|---|
    | (a) "Three" for two | `the open-item sentence says three, but 2 rows are open (B-042, B-047)` | 1 |
    | (b) `B-049` back to `ready` | `… says two, but 3 rows are open (B-042, B-047, B-049)` | 1 |
    | (c) sentence un-bolded | `expected one '**<N> items are open**' sentence, found 0` | 1 |
    | (d) `**2 items are open**` | `OK (51 closed rows, 2 open, …)` | 0 |

  - **`TASK-0142`'s check, live again**: with `B-047` closed and this brief
    still `in_progress`, it printed `BACKLOG: B-047 is closed by TASK-0145,
    whose Status reads in_progress`, exit 1.
  - After this brief read `done`, the helper had rewritten the sentence to
    "One", and the check agreed.
- Validation: `tests/validate.sh` printed `validate.sh: OK`.
- Result: done.
- Commit: `f722576` — *Gate the backlog's open-item count against its rows (TASK-0145)*, plus the record-keeping commit after it
- Push: **confirmed to both remotes** — `fccc6ad..f722576 master -> master` to
  `origin` and to `github`; `HEAD`, `origin/master` and `github/master` all
  read `f722576`, and `git remote -v` is token-free
