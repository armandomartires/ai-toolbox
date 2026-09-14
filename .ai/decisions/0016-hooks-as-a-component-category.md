# ADR-0016 — Hooks as a component category: decide after evidence, expect no

## Status
**Proposed**, 2026-09-14. Opened by `PLAN-0003` (sprint S6).

**Blocked on TASK-0028.** This ADR must not be written before that spike
reports. The entire question rests on one unverified claim — whether a
client hook can intercept an MCP tool call — and writing the decision
first would be the TASK-0019 error repeated: a claim about external state
asserted without verification, then restated with increasing confidence.

## Context

To be completed after TASK-0028. What is already established, and what is
not:

### Established by reading this repo
- **No hook or plugin concept exists anywhere.** Zero occurrences of
  "plugin"; zero of `PreToolUse`, `PostToolUse`, `SessionStart`,
  `UserPromptSubmit`; zero of `settings.json`. All 130 matches for "hook"
  refer to the git pre-commit gate.
- **No category plumbing exists.** `sync-registry.sh:114-124` has three
  hardcoded sections; `install.sh:36-39` has one hardcoded skills-target
  path per client with MCP print-only; `validate.sh` has roughly eight
  hardcoded path patterns. A new top-level directory would be **silently
  ignored** by all three *and* by CI's staleness check — invisible rather
  than loud.
- **Precedent is poor.** `prompts/` and `agents/` are declared component
  categories (`AGENTS.md`, `README.md`, ADR-0001, `GLOSSARY.md`) with
  3-line stub READMEs and zero tooling. A declared category can exist
  indefinitely with nothing behind it.
- **Two implementations would be needed for one capability.** Claude Code
  hooks are JSON configuration invoking shell commands; OpenCode's
  equivalent is a TypeScript plugin. `AGENTS.md` requires components be
  "portable across every client that supports its capability" — two
  unrelated implementations is a genuine portability problem, not a
  packaging detail.
- **`loops/` already is the runbook category, and it already has tooling.**
  `validate.sh:193-213` enforces three mandatory sections;
  `sync-registry.sh` emits a Loops section; `loops/release-check/loop.md`
  is already a gated sequence with expected outputs, bounded retries, hard
  stops, and escalate-without-retry for destructive actions. The sequencing
  layer the source analysis attributes to hooks is substantially already
  covered.

### Not established — TASK-0028's job
- Whether a Claude Code `PreToolUse` hook can **match** a tool name of the
  form `mcp__ansible__*`, and whether it can **block** rather than merely
  observe.
- Whether OpenCode has an equivalent pre-execution interception point at
  all.
- What each vendor's **current** documentation says. Not what is
  remembered — versions change, and a recalled API is a stale claim.

### The decisive counter-consideration
The sprint's highest-value enforcement (TASK-0031, the `gather_subset`
guard) is **static**: it reads YAML and decides. It therefore works as an
`ansible-lint` rule, a `pre-commit` hook, or a standalone script in CI,
with no dependence on client hook interception. The human decided on
2026-09-14 that **the working guard beats the portable abstraction**.

So even a positive answer from TASK-0028 does not automatically justify a
category — it would only mean the option exists.

## Decision

To be written after TASK-0028 reports. **Expected: no new category.**

If that is the outcome, the decision should state:
1. The guard ships as a portable script plus documented wiring for
   `pre-commit` and/or `ansible-lint -r … -R`.
2. No `hooks/` directory is created, and no plumbing changes are made to
   `install.sh`, `sync-registry.sh` or `validate.sh`.
3. The reasoning — two client implementations, no plumbing, poor precedent
   from `prompts/`/`agents/`, and `loops/` already covering the sequencing
   layer — so the next reader does not re-raise it. B-009's lesson: an
   item's title encodes an assumption, and roughly a third do not survive
   contact with the files.

If the outcome is **yes**, the decision must also settle:
- The category's **name**. OpenCode calls its mechanism a plugin; naming a
  category after one vendor's term for a capability the other implements
  differently is how confusion starts.
- Which client gets which implementation, and how a single logical guard
  stays consistent across two.
- That plumbing changes are **their own tasks**, with the human's
  agreement, since they were scoped out at plan time.

## Consequences

To be written. Expected:

- **No category means no new surface to maintain**, and the guard still
  ships. The capability is delivered; only the abstraction is declined.
- **A negative result from TASK-0028 is a successful outcome**, not a
  failure. It prevents building a category on a false premise — which is
  precisely what this repo did *not* do with B-001 (closed as superseded
  after scoping) and B-009 (closed on a false premise), and the discipline
  worth preserving.
- If the answer is yes and a category is still declined, that tension must
  be recorded rather than hidden: the capability existed and was not
  taken up, with the reason.
- **Whatever is decided, the guard must not be described as making Ansible
  execution safe.** It prevents one documented mechanism of one hazard, and
  it is validated against syntax rather than against the hazard itself,
  which is not reproducible on demand.
