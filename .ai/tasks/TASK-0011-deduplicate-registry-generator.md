# TASK-0011 — De-duplicate the registry generator; assert no template rows

## Objective
Remove the structural cause of a defect that had to be fixed three times,
and add a check that catches it if it ever returns: no row in
`docs/registry.md` may point at a `_template*` path.

## Minimal context
`scripts/sync-registry.sh` emits three tables (Skills, MCP Servers, Loops).
Each was written as its own `for` loop with its own near-identical body.
Consequence: the rule "templates are not deployable components, keep them
out of the index" had to be added **three separate times** —

- MCP loop — TASK-0005 (found while adding `_template-external`, which the
  old exact-match `mcp-servers/_template` skip would not have caught).
- Skills loop — TASK-0006 (the registry had been publishing
  `template-skill` as a real component since scaffold).
- Loops loop — TASK-0008 (`template-loop` appeared beside the first real
  loop).

Each fix was individually correct. REVIEW-0004's finding is that the
*pattern* is the defect: per-section duplication means a rule added to one
section does not reach the others, so section number four will leak again.
Filed as backlog B-007 rather than fixed opportunistically inside an
unrelated task.

This task runs **before** TASK-0010 (the pre-commit hook) so that the
first thing the new gate guards is already correct.

## Scope

### Included
- `scripts/sync-registry.sh`: one parameterized iteration path instead of
  three near-copies.
- `tests/validate.sh`: fail if any generated registry row references a
  `_template*` path.
- Regenerated `docs/registry.md` — expected **byte-identical** to the
  current committed file. A refactor that changes output is a failed
  refactor, and the generated file is the detector.

### Not included
- **Changing the registry's format or columns.** Not a redesign. The
  Skills and Loops tables have `Name | Description | Path`; MCP Servers has
  an extra `Shape` column (TASK-0005). Preserve both shapes exactly.
- **Adding a fourth component section.** `prompts/` and `agents/` exist as
  directories but have no registry section and no template; giving them one
  is a separate decision, not a side effect of a refactor.
- **The pre-commit hook** — TASK-0010.

## Preconditions
- Branch `master`, clean. S2 closed; ADR-0007 accepted.
- `docs/registry.md` currently committed and correct (no template rows) —
  capture its checksum before starting, to prove the refactor is
  output-neutral.

## Likely files
- `scripts/sync-registry.sh`
- `tests/validate.sh`
- `docs/registry.md` (regenerated; expected unchanged)

## Design note
The three sections differ in exactly three ways: the glob that finds
components (`skills/*/SKILL.md`, `mcp-servers/*/`, `loops/*/loop.md`), how
`name`/`description` are extracted (YAML frontmatter via `awk`, TOML via
`grep`, or JSON via `python3`), and whether a `Shape` column is emitted.
Everything else — the header, the separator row, the template skip, sorted
output, the `?` fallback for a missing name — is common.

Extract the common part; parameterize the three differences. Do not
over-abstract: three call sites with three genuinely different metadata
formats is the right amount of structure, and collapsing the extraction
logic itself into one clever function would trade a duplication problem for
a legibility one.

## Execution plan
1. Record `md5sum docs/registry.md` before any change — the output-neutral
   proof depends on it.
2. Refactor `sync-registry.sh`: a single emit path taking (section title,
   component list, metadata extractor, optional shape). Template skipping
   happens **once**, in the common path.
3. Regenerate; confirm the checksum is unchanged. If it differs, diff and
   fix until the only differences are ones this task intends (there should
   be none).
4. Add the `validate.sh` check: parse `docs/registry.md`'s table rows and
   fail on any path matching `_template`. Match on the row's path column,
   not the whole line, so a description legitimately containing the word
   "template" does not trip it.
5. Prove both directions: a hand-injected template row fails the check; the
   real registry passes.
6. Verify the template skip is now genuinely single-source: temporarily
   break it once and confirm **all three** sections leak together, rather
   than one. That is the evidence the duplication is actually gone —
   without it, the refactor is unproven.
7. Close B-007; validate; follow `release-check` to commit.

## Acceptance criteria
- [ ] `sync-registry.sh` skips templates in exactly **one** place, and
      that place demonstrably governs all three sections.
- [ ] Regenerated `docs/registry.md` is byte-identical to the pre-refactor
      file (same md5).
- [ ] `tests/validate.sh` fails if any registry row's path matches
      `_template`, and does not false-positive on the word "template"
      appearing in a description.
- [ ] Registry format unchanged: Skills/Loops keep 3 columns, MCP Servers
      keeps 4 including `Shape`.
- [ ] `validate.sh` remains offline and well under a second (it is about to
      become a pre-commit gate — TASK-0010).
- [ ] Backlog B-007 closed.

## Mandatory validations
- [ ] `md5sum docs/registry.md` identical before and after the refactor.
- [ ] `bash tests/validate.sh` → OK.
- [ ] **Fails-when-broken proof**, each observed then reverted:
      1. inject a `| template-skill | ... | skills/_template |` row into
         `docs/registry.md` → validate fails naming that row;
      2. a row whose *description* contains "template" but whose path does
         not → validate **passes** (no false positive);
      3. break the single template skip in the generator → **all three**
         sections leak in one regeneration, proving one source of truth;
         restore and confirm the checksum returns.
- [ ] `bash scripts/install.sh link` → unaffected, still clean.
- [ ] `bash tests/smoke-mcp.sh --server ansible` → still PASS (the
      manifest reader is untouched, but confirm rather than assume).
- [ ] Timing check: `validate.sh` still sub-second.
- [ ] `git status` clean at end.

## Risks and rollback
- **Risk: the refactor silently changes registry output.** The whole reason
  for the checksum gate. Generated files make this cheap to detect; not
  checking would be the negligent path.
- **Risk: over-abstraction.** Three metadata formats genuinely differ;
  forcing them through one extractor would hurt legibility. Mitigated by
  the design note's explicit boundary.
- **Risk: the new check false-positives** on a description containing
  "template" — note the Skills table currently contains descriptions
  mentioning templates. Mitigated by matching the path column only, and by
  fixture 2 above testing exactly this.
- **Rollback**: `git revert` this task's commit. The generator returns to
  three loops (all three currently carrying the correct skip, so no
  regression), and the new check disappears.

## Dependencies
Closes backlog B-007. Precedes TASK-0010 so the hook guards a corrected
generator.

## Expected result
The registry generator has one rule per rule, not one rule per section, and
a leak that recurred three times now fails a check instead of reaching a
commit.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13
## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode (anthropic/claude-opus-5)
- Actions: refactored `scripts/sync-registry.sh` from three near-identical
  per-section loops into one `emit_section` path plus an `extract` helper
  parameterized by component kind; added the independent
  no-template-rows-in-the-registry check to `tests/validate.sh`; closed
  B-007 (did both halves the backlog item offered as alternatives, since
  they defend different failure modes).
- Observations:
  1. **The refactor is output-neutral, proven by checksum.** `md5sum
     docs/registry.md` is `cad2d1508c685cd7f1e9a28fc63e9fcc` before and
     after — byte-identical. For a generated file this is the cheap and
     obvious gate, and skipping it would have been negligent.
  2. **Fixture 3 is the real evidence, and it worked.** Disabling the
     *single* template-skip line leaked **four** template rows across
     **all three** sections in one regeneration
     (`skills/_template`, `mcp-servers/_template`,
     `mcp-servers/_template-external`, `loops/_template`). Before this
     task, achieving that would have required breaking three separate
     lines. A checksum match alone would not have proven the duplication
     was gone — only that output was unchanged.
  3. **Both defences were kept, not one.** The generator now skips
     templates in one place *and* `validate.sh` independently rejects a
     template row. They fail differently: the generator prevents the leak,
     the check catches a hand-edit or a future regression. B-007 offered
     them as alternatives ("or"); implementing only one would have left
     the other failure mode open.
  4. **The false-positive risk was real and is tested.** The Skills table
     legitimately contains descriptions mentioning templates, so the check
     matches the *path column* only. Fixture 2 asserts a row whose
     description says "copy from the _template dir" still passes.
  5. Deliberately did **not** over-abstract: three genuinely different
     metadata formats (YAML frontmatter, TOML, JSON) stay as three
     branches in `extract`. Collapsing those would trade a duplication
     problem for a legibility one.
  6. `validate.sh` got slightly *faster* (~275 ms, from ~330 ms) — it now
     does one pass over a generated file instead of nothing extra, and the
     earlier measurement was noisy. Comfortably sub-second, which matters
     because TASK-0010 makes it a commit gate.
- Validation:
  - `md5sum docs/registry.md` identical pre/post refactor
    (`cad2d1508c685cd7f1e9a28fc63e9fcc`).
  - `bash tests/validate.sh` → OK.
  - **Fails-when-broken proof**, all three fixtures, each reverted:
    1. injected `| template-skill | a template | skills/_template |` →
       `TEMPLATE IN REGISTRY: docs/registry.md lists 'skills/_template' …`,
       exit 1;
    2. row with "template" in the description but not the path → **passes**,
       exit 0 (no false positive);
    3. single skip disabled → all four template rows leaked across all
       three sections, validate reported all four, exit 1; restored and
       checksum returned.
  - Registry format unchanged: `Name | Description | Path` for Skills and
    Loops, `Name | Shape | Description | Path` for MCP Servers.
  - `bash scripts/install.sh link` → clean. `bash tests/smoke-mcp.sh
    --server ansible` → still PASS (manifest reader untouched, but
    confirmed rather than assumed).
  - Timing: 266/278/283 ms across three runs.
- Result: success.
- Commit: see below.
- Push: no remote configured — nothing to push (ADR-0007 now makes this
  conditional rather than a rule every task must record as inapplicable).
