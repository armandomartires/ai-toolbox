# ADR-0006 — LM Studio is an MCP-only client; loops are authored, not ported

## Status
Accepted (2026-09-13)

## Context
Two roadmap statements written at scaffold time turned out to be
unsatisfiable once tested against reality. Both were found by
REVIEW-0003's end-of-sprint checkpoint rather than by a failing script,
because neither is the kind of claim a script was checking.

**1. Phase 2's exit criterion.** `ROADMAP.md` states: *"one skill and one
MCP server working in all clients."* `AGENTS.md`'s Objective similarly
requires every component to be "portable across Claude Code, OpenCode, and
LM Studio". TASK-0006 established that LM Studio has **no Agent Skills
target at all**: it has a `~/.lmstudio/hub/skills/` directory, but that is
not an Agent Skills consumer of the kind `~/.claude/skills/` and
`~/.config/opencode/skills/` are. The criterion cannot be met by any amount
of work in this repo, because the gap is in the client.

**2. The loops objective.** Sprint S1's objective named migrating
"existing skills, MCP servers, and **loops**". A search of both workspace
roots, all sibling repos, `~/.config/opencode/`, `~/.claude/`,
`~/.codex/`, and `/mnt/c/Users/<user>/.agents/` found **no first-party
artifact in `loop.md` shape anywhere** — nothing to migrate. Three
near-candidates exist, and each fails for a different reason:

- `.agents/skills/loop/SKILL.md` and `.agents/skills/babysit/SKILL.md` —
  genuine loop semantics, but vendor-bundled Codex/Cursor system skills.
  Using them is *vendoring third-party content*, a provenance decision,
  not a migration.
- `agent-tiers/templates/bmad/bmad-workflow.md` — the only first-party
  artifact with real loop semantics (bounded retry, gate verdicts,
  escalation), but its canonical copy lives in `opencode-customization`
  and is installed by `install-tiers.ps1`. Copying it here creates two
  owners of one fact — exactly the drift ADR-0004 was written to end.
- `AGENTS.md`'s own "Mandatory task process" work cycle — arguably a loop
  in substance, but `AGENTS.md` already owns that fact normatively.
  Extracting it into `loops/` would duplicate it.

So "port a loop" was never an available action. The word "port" encoded an
assumption that was never checked.

## Decision

**LM Studio is an MCP-only client.** It is excluded from any skill-related
criterion, in the roadmap and elsewhere. Concretely:

- Phase 2's exit criterion is restated as: *one skill working in Claude
  Code and OpenCode, and one MCP server working in all three clients.*
- `AGENTS.md`'s portability claim is scoped per capability rather than
  implying every component reaches every client.
- LM Studio stays absent from `scripts/install.sh`'s client list, and is
  therefore exempt from the `configs/<client>/README.md` pairing that
  `tests/validate.sh` enforces for deployable clients. It keeps a wiring
  snapshot anyway, documenting MCP config and stating plainly that skills
  are unsupported.
- This is a statement about the client's capabilities as observed on
  2026-09-13, not a permanent judgement. If LM Studio adds Agent Skills
  support, revisit — the evidence bar for reopening is its own
  documentation describing an Agent Skills directory, not an inference
  from a directory name.

**Loops are authored here, not ported.** The first loop component is
written natively for this repo rather than adapted from any of the three
near-candidates above. The vendoring and dual-ownership problems are
avoided by not incurring them.

## Alternatives considered

- **Keep Phase 2's criterion and mark it blocked upstream.** Rejected:
  a phase that can never formally exit is not a plan, it is a permanent
  open ticket. Worse, it attributes to this repo a gap that belongs to a
  third-party client.
- **Narrow the criterion to Claude Code + OpenCode only, dropping LM
  Studio entirely.** Rejected as written — LM Studio's MCP wiring *is*
  verified (config accepted, `initialize` handshake confirmed in
  TASK-0006), so dropping it from the criterion altogether would discard
  real, proven coverage. Splitting per capability keeps what is true.
- **Port `bmad-workflow.md` and retire the `opencode-customization`
  copy.** Rejected for now: it is a defensible option, but it requires
  changing another repo to avoid dual ownership, and its content is
  coupled to OpenCode-specific agent names — meaning the *first* loop this
  repo ships would violate the portability rule it is supposed to
  demonstrate. Left available as a future decision, not foreclosed.
- **Vendor `.agents/skills/loop` or `babysit`.** Rejected: third-party
  content with no clear license grant for redistribution, and
  `AGENTS.md`'s Objective is to collect tools this repo can validate and
  deploy, not to re-publish a vendor's system skills.
- **Drop loops from the Foundation objective and ship nothing.**
  Rejected: `loops/` has a template, the registry has a Loops section, and
  the authoring guide documents the shape — the scaffolding all exists and
  has never once been exercised. An unexercised component shape is an
  untested claim.

## Consequences
- `ROADMAP.md`'s Phase 2 exit criteria and `AGENTS.md`'s portability
  sentence are amended in the task carrying this ADR.
- Backlog B-005 ("re-scope Phase 2 criterion") is resolved by this ADR.
- Backlog B-006 changes verb from "port a loop" to "author a loop", and is
  scoped as TASK-0008.
- The first loop is `loops/release-check/` — this repo's own
  validate → sync-registry → review-diff → commit cycle, which
  `AGENTS.md`'s Git rules and Definition of done already describe
  procedurally and which every task in S1 performed by hand. Writing it
  down exercises the loop shape against something already proven to work,
  rather than inventing a workflow to justify the directory.
- Risk accepted: a loop describing this repo's own process could drift
  from `AGENTS.md`, which owns that process normatively. Mitigated by the
  loop *linking* to `AGENTS.md` for the rules and stating only the
  sequence and exit conditions — the one-owner rule applies to loops too.
