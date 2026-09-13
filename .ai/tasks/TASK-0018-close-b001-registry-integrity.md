# TASK-0018 — Close B-001; fix the registry content defects found while scoping it

## Objective
Resolve B-001, the last open backlog item, by deciding its fate rather than
implementing its literal wording — and fix the two real registry defects
that scoping it exposed.

## Minimal context
B-001, "Subagent-run registry validation", `status: idea`, `Ready when: CI
exists`. TASK-0015 satisfied that condition, making it the only open item in
the backlog.

**Its provenance matters.** `git log -S` traces it to `e72b78c`, the initial
scaffold commit — it arrived as part of the `.ai/` template's example
backlog, alongside B-002 and B-003, and was never scoped, discussed, or
justified by an observed need. It has sat at `idea` for four sprints.

**Its stated mechanism is now the wrong shape.** `AGENTS.md:83` permits
delegating simple checks to a subagent while the main agent verifies
results, and that is a reasonable rule for *reviewing*. But registry
validation is no longer a judgment task:

- `scripts/sync-registry.sh` generates `docs/registry.md` deterministically
  from one emit path (TASK-0011).
- `tests/validate.sh` independently rejects any row pointing at a
  `_template*` path.
- `.githooks/pre-commit` runs that gate on every commit (ADR-0007).
- CI re-runs both and fails on a stale registry (verified, run #1).

A subagent added to this would be slower, nondeterministic, unable to gate a
commit, and would re-check what a grep already proves. That is strictly
worse than what exists. The honest resolution is to close it — but the
scoping was not wasted, because it surfaced two genuine defects.

### Defect 1 — YAML quote leakage (active, visible)
`docs/registry.md:8-9` carry literal double-quotes:

```
| project-migration | "Harmonize an existing repository with … |
```

`sync-registry.sh`'s `extract()` strips the `description:` key with `awk`
but never strips surrounding quotes. The MCP path is unaffected because
`json.load()` parses quotes away, and `loops/release-check` is unaffected
because its description happens to be unquoted. So the defect is visible in
exactly the two components that quote their YAML — and invisible in the
others, which is why it survived four sprints and TASK-0012's linter work.

Note the interaction: ADR-0008's skill linter *accepts* both quoted and
unquoted frontmatter deliberately (both real skills pass). That is correct.
The generator, not the schema, is what must normalize.

### Defect 2 — pipe-in-description hazard (latent, silent)
A description containing `|` would inject extra columns and break the
markdown table with no error. Confirmed reachable:
`skills/project-migration/SKILL.md` already contains pipes at lines 28 and
37 — in body text, not the description line, so nothing is broken today. The
hazard is one edit away, and its failure mode is a silently malformed table
rather than a loud failure. Worth a check precisely because it would not
announce itself.

## Scope
### Included
- ADR-0011 closing B-001 as **superseded**, recording why a subagent is the
  wrong mechanism and what replaced it.
- Fix the quote leak in `sync-registry.sh`; regenerate `docs/registry.md`.
- Three `validate.sh` registry-integrity checks: no leaked quote in a cell,
  no `|` inside a cell, and correct column count per section.
- Close B-001 in `BACKLOG.md`; update the planning/state files.

### Not included
- Implementing subagent-driven validation. See ADR-0011.
- Changing the skill frontmatter schema to forbid quotes. ADR-0008 accepts
  both forms on purpose; the generator normalizes. Forbidding them would
  invalidate a currently-valid skill for a generator bug.
- Rewriting either skill's description. They are correct as authored.
- Escaping pipes so they render. A check that *rejects* the ambiguity is
  right: the registry is generated, so the fix belongs in the source
  description, not in escaping downstream.

## Preconditions
- Working tree clean at `9404060`; `validate.sh` passing.
- Human confirmed: close B-001, fix both defects.

## Likely files
- `scripts/sync-registry.sh`, `tests/validate.sh`, `docs/registry.md`
  (generated), `.ai/decisions/0011-close-b001-registry-validation.md`,
  `.ai/planning/BACKLOG.md`, `.ai/tasks/TODO.md`,
  `.ai/context/CURRENT_STATE.md`, `.ai/planning/SPRINT-CURRENT.md`

## Execution plan
1. Strip matching surrounding quotes in `extract()` for the skill and loop
   paths. Leave the MCP JSON path alone — it is already correct.
2. Regenerate; confirm the only diff is the two quote-stripped rows.
3. Add the three integrity checks to `validate.sh`, keeping it offline.
4. Prove each fails: a fixture description that is quoted, one containing a
   pipe, and a hand-corrupted registry row. Remove every fixture and verify
   by listing.
5. Write ADR-0011; close B-001; update state files.

## Acceptance criteria
- [x] `docs/registry.md` contains no leaked quotes; diff is exactly the two
      affected rows (2 insertions, 2 deletions).
- [x] `validate.sh` fails on a leaked quote, on a `|` inside a cell, and on
      a wrong column count.
- [x] All three checks pass on the corrected registry.
- [x] `validate.sh` stays offline and sub-second (0.375 s, from 0.366 s).
- [x] Both existing skills pass unchanged — no source description edited.
- [x] ADR-0011 records the closure, the mechanism objection, and what
      supersedes it.
- [x] B-001 marked done in `BACKLOG.md`; **backlog is now empty**.
- [x] No fixture remains (verified by `ls skills/ loops/`).

## Mandatory validations
- [x] tests/validate.sh — OK
- [x] scripts/sync-registry.sh — regenerated; only the two quote-fixed rows
      changed; re-running is idempotent
- [x] CI green after push

## Risks and rollback
- Risk: an over-eager quote strip mangles a description that legitimately
  starts and ends with a quote character. Mitigation: strip only a *matching
  pair* of leading/trailing quotes, exactly as the skill linter already does.
- Risk: the column-count check is brittle against future format changes.
  Mitigation: derive the expected count from each section's own header row
  rather than hardcoding it.
- Rollback: revert; the generator change is one line of normalization and
  the checks are additive.

## Dependencies
TASK-0011 (single emit path), TASK-0012 (quote-tolerant linter), TASK-0015
(CI, which satisfied B-001's stated precondition).

## Expected result
The backlog is empty. Registry generation is normalized, and three defect
classes that would not announce themselves now fail a commit.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13

## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode
- Actions:
  - Traced B-001 to `e72b78c` (initial scaffold) and confirmed it was
    template boilerplate, never scoped. Wrote ADR-0011 closing it as
    superseded.
  - Added `unquote()` to `sync-registry.sh` and merged the `skill` and
    `loop` branches of `extract()`, which differed only in filename —
    reducing the duplication that TASK-0011 originally set out to remove.
  - Added three registry-integrity checks to `validate.sh`.
- Observations:
  - **The quote leak was invisible by construction**, which is why four
    sprints and a dedicated linter task missed it. The MCP path escapes it
    because `json.load()` strips quotes; the loop escapes it because its
    description happens to be unquoted. Only the two quoted-frontmatter
    skills showed it. A defect visible in 2 of 4 cases reads as a property
    of those 2, not as a bug.
  - Fixed in the generator, not the schema. ADR-0008 accepts quoted and
    unquoted frontmatter on purpose, and both real skills pass the linter —
    forbidding quotes to work around a generator bug would invalidate a
    valid skill.
  - The pipe hazard is genuinely reachable, not theoretical:
    `skills/project-migration/SKILL.md` already contains `|` at lines 28 and
    37. Body text today, one edit from the description line.
  - **Caught a defect in my own check via the proof.** The column-count
    message hinted "an unescaped '|' in a description?" for *both*
    directions, so a row with a *missing* cell got a hint pointing the wrong
    way. Split the diagnosis by direction. A misleading hint costs the
    reader more than no hint — and I would not have seen it without
    testing the too-few-columns case separately from the too-many case.
  - Deriving the expected column count from each section's own header row
    means adding a column to a section does not require editing the check.
    The MCP section already has 6 where the others have 5, so a hardcoded
    number would have been wrong on arrival.
- Validation:
  - `tests/validate.sh` OK, 0.375 s, offline.
  - Fails-when-reverted, 6 cases: leaked quote → flagged with the section
    and line; unescaped pipe → 6 columns vs 5; missing column → 5 vs 6 with
    the *correct* alternative diagnosis; restored → OK.
  - **End-to-end case, the one that matters:** injected a real `|` into
    `loops/release-check/loop.md`'s description, regenerated the registry,
    and confirmed the malformed row (7 columns) was rejected. This proves
    the check catches the defect through the real generator path, not just
    against a hand-edited file. `loop.md` restored byte-identical
    (`diff -q`).
  - Idempotence: re-running `sync-registry.sh` after the fix produces no
    further diff and zero leaked quotes.
  - No fixtures remain: `ls skills/ loops/` shows only real components and
    templates.
- Result: success. B-001 closed as superseded rather than implemented; the
  backlog is empty for the first time; two defect classes that would not
  have announced themselves now fail a commit.
- Commit: see below
- Push: to `origin master`
