# ADR-0011 — B-001 (subagent-run registry validation) is closed as superseded

## Status
Accepted — 2026-09-13. Closes backlog item B-001, the last open item.

## Context
B-001, "Subagent-run registry validation", sat at `status: idea` for four
sprints with `Ready when: CI exists`. TASK-0015 met that condition, which
forced the question of whether to implement it.

**Provenance.** `git log -S "B-001"` traces it to `e72b78c`, the initial
scaffold commit, where it arrived as part of the `.ai/` template's example
backlog alongside B-002 and B-003. It was never scoped, never justified by
an observed failure, and never discussed after being written down. That does
not make it wrong, but it means there is no original requirement to honour —
only a title.

**Its mechanism has been overtaken.** When the item was written, registry
correctness was a human-judgment problem: the registry was hand-maintained
and nothing checked it. Since then, four things landed:

- `scripts/sync-registry.sh` generates `docs/registry.md` deterministically,
  through a single emit path (TASK-0011).
- `tests/validate.sh` independently rejects any row pointing at a
  `_template*` path — deliberately independent of the generator, so a
  regression fails a check instead of reaching a commit.
- `.githooks/pre-commit` runs that gate on every commit (ADR-0007).
- CI re-runs the gate *and* fails on a stale registry — verified by an
  actual run, not assumed (TASK-0015).

`AGENTS.md` does permit delegating simple checks to a subagent while the
main agent verifies the result, and that remains sensible for *review*
tasks. It is the wrong instrument here. Against the existing checks, a
subagent would be:

- **Nondeterministic** where the current check is exact. "Is this row
  malformed" has one right answer computable by string comparison.
- **Slower** by orders of magnitude — the whole gate runs in ~0.38 s
  offline; an LLM round trip cannot.
- **Unable to gate a commit.** The pre-commit hook must be hermetic and
  offline (ADR-0007, ADR-0009). A subagent needs a network and an API key,
  so it could never be the thing that blocks a bad commit — only something
  that comments after the fact.
- **Redundant.** It would re-derive what a grep already proves.

Implementing it would be adding a weaker check and calling the item done.

## Decision
**B-001 is closed as superseded, not implemented.** Deterministic,
hermetic checks in `tests/validate.sh` — run by the pre-commit hook and
re-run by CI — are the mechanism for registry validation. No subagent is
involved, and none should be added for this purpose.

Scoping it was not wasted, and this is the substantive part: it surfaced two
real defects that the existing checks did not cover, both fixed in
TASK-0018.

**Defect 1 — leaked YAML quotes (active).** `sync-registry.sh` stripped the
`description:` key but not surrounding quotes, so `docs/registry.md` carried
`| project-migration | "Harmonize … |`. It was visible in exactly the two
components that quote their frontmatter and invisible in the others, which
is why it survived four sprints and TASK-0012's linter work. Fixed by
normalizing in the generator — **not** by forbidding quotes in frontmatter:
ADR-0008's linter accepts both forms deliberately, and invalidating a valid
skill to work around a generator bug would be the wrong repair.

**Defect 2 — unescaped pipe (latent).** A `|` in a description injects
columns and breaks the markdown table with no error. Reachable today:
`skills/project-migration/SKILL.md` already contains pipes in body text; one
edit into its description would do it. Now rejected by a column-count check
whose expected width is read from each section's own header row, so adding a
column to a section does not require editing the check.

## Consequences
- **The backlog is empty.** Every item is closed: B-001 (this ADR), B-002
  (TASK-0012), B-003 (TASK-0009), B-004 (TASK-0013), B-005/B-006 (ADR-0006,
  TASK-0008), B-007 (TASK-0011).
- Three defect classes now fail a commit instead of reaching a generated
  file silently. All three were proven to fail for their own specific reason
  before being trusted.
- `validate.sh` gains ~10 ms (0.366 → 0.375 s) and stays offline and
  hermetic. Those properties are load-bearing and were checked, not assumed.
- The precedent is explicit: **an item's age is not an argument for
  implementing it.** B-001 and B-002 were both scaffold boilerplate that sat
  for sprints. One contained a real requirement once split from an
  unspecified one (B-002 → ADR-0008); the other did not. Each had to be read
  on its merits rather than worked off a queue.
- Anyone who later wants agent-assisted review of the registry should treat
  it as **new** work with its own justification, not as reopening B-001. The
  objection here is to the mechanism as a *gate*, not to agents reviewing
  anything ever.

## Alternatives rejected
- **Implement it as written.** Rejected above: slower, nondeterministic,
  cannot gate a commit, duplicates existing checks.
- **Close it with no code change.** Rejected: the scoping had already
  surfaced a visible defect in a generated file. Closing the item while
  leaving the defect would have optimized the backlog's appearance over the
  repo's correctness.
- **Forbid quoted frontmatter so the generator needs no normalization.**
  Rejected: ADR-0008 accepts both forms on purpose, both real skills pass
  the linter today, and the bug was in the generator.
- **Escape pipes so malformed descriptions still render.** Rejected: the
  registry is generated, so the right place to fix a bad description is the
  source. Rejecting the ambiguity surfaces the problem; escaping it hides
  the problem and keeps the bad description.
