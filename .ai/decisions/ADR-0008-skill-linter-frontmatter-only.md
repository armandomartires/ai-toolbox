# ADR-0008 — Skill linting covers frontmatter only; no SKILL.md line budget

## Status
Accepted — 2026-09-13. Supersedes the scope implied by backlog item B-002's
title, "Skill Linter (frontmatter + line budget)".

## Context
B-002 sat at status `ready` across sprints S1, S2 and S3 without ever being
scoped into a task. Scoping it in S4 revealed why it kept stalling: its
title bundled two requirements of very different maturity.

**The frontmatter half was fully specified.**
`docs/development/authoring-guide.md` already states the rules — required
keys `name` and `description`; optional `license`, `metadata.author`,
`metadata.version` (semver); and, for loops in the same guide, "name must
match the directory". Everything needed to write the check existed.

**The line-budget half was specified nowhere.** A search of
`docs/development/authoring-guide.md`, every ADR, and `AGENTS.md` found no
maximum length, cap, or limit for `SKILL.md` — only the qualitative "Keep
SKILL.md lean; push detail into `references/`"
(`docs/development/authoring-guide.md:8`). The three existing skills are 24,
43 and 56 lines. Any threshold a linter enforced would have been chosen by
whoever wrote the linter.

Two ways to resolve that were available, and one is materially worse:

1. Pick a number and enforce it. This makes the validation gate the
   *author* of a requirement rather than its enforcer. `AGENTS.md`'s
   ambiguity policy forbids exactly this: "State assumptions explicitly; do
   not invent requirements."
2. Enforce the defined half, and record that the undefined half was dropped
   on purpose so it is not silently forgotten or later re-litigated.

Note also the size-budget reasoning already established for this
convention's index files: a budget should be measured in bytes rather than
lines, because a dense single-line table cell is invisible to a line-based
cap. A naive `wc -l` ceiling on `SKILL.md` would have inherited that same
blind spot — one long line of frontmatter description would pass a
50-line limit while being exactly the bloat the rule meant to catch.

## Decision
Skill linting, implemented inside `tests/validate.sh` (not as a separate
script), enforces **frontmatter only**:

1. Frontmatter opens with `---` on line 1 and is terminated by a closing
   `---`.
2. `name` is present, non-empty, and equal to the directory name.
   Directories named `_template*` are exempt from the equality rule only.
3. `description` is present, non-empty, and occupies a single line —
   because the generated registry renders it into one table cell.
4. `license`, if present, is non-empty.
5. `metadata.version`, if present, is semver (`MAJOR.MINOR.PATCH` with
   optional pre-release and build metadata).

**No `SKILL.md` length or size limit is enforced.** If one is wanted later,
it must first be *defined* in `docs/development/authoring-guide.md` —
stated in bytes, with a rationale — and only then enforced. Enforcement
follows definition; it does not substitute for it.

The check lives in `tests/validate.sh` rather than a standalone linter
because `validate.sh` is already the mandatory gate and already runs from
`.githooks/pre-commit` (ADR-0007). A second entry point would be a second
thing to remember to run, which is how a check quietly stops being run at
all.

## Consequences
- B-002 closes. The half that was actionable is enforced; the half that was
  not is documented as a deliberate omission with the precondition for
  revisiting it.
- The earlier presence-only check (`grep -q '^name:'`) is replaced. That
  check could not detect a `name` disagreeing with its directory — the same
  defect class that let `_template` rows leak into the registry three times
  before TASK-0011.
- `validate.sh` gains a `python3` dependency for the skills block. This is
  free: `python3` was already a hard prerequisite for the MCP manifest
  checks, and the gate stays offline and sub-second (~320 ms measured).
- Parsing rather than grepping is now the pattern for structured checks in
  this repo. "Is the description one line?" is not a grep-shaped question,
  and writing it as one is how the weak version came to exist.
- A future contributor who wants a length cap has a clear path and will not
  mistake its absence for an oversight.

## Alternatives rejected
- **Invent a line cap (e.g. 100 lines).** Rejected: violates the ambiguity
  policy, and a line-based cap is the wrong unit for the same reason the
  index-file budget is measured in bytes.
- **Drop B-002 entirely.** Rejected: the frontmatter rules were already
  written down and unenforced, which is the gap most likely to produce a
  broken deploy — a `name` that disagrees with its directory installs to a
  path no client will look in.
- **A standalone `tests/lint-skills.sh`.** Rejected: see above; one gate,
  one entry point.
