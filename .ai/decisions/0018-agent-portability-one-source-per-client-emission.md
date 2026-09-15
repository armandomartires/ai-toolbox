# ADR-0018 — Agent portability is scoped per capability; one source, per-client emission

## Status
**Proposed**, 2026-09-15. Opened by `PLAN-0004` (sprint S7).
Extends ADR-0006 to a third capability class.

**Depends on TASK-0036.** The field mapping below was read from two
vendors' live documentation on 2026-09-15, and both ship frequently enough
that their own docs qualify behaviour by patch version in dozens of places.
The spike must **re-verify rather than cite this ADR or `PLAN-0004`** —
writing the mechanism against a recalled or four-day-old API is the
TASK-0019 error (a claim about external state asserted without
verification, then restated with growing confidence).

## Context

To be completed after TASK-0036. What is established, and what is not:

### Established by reading the two vendors' docs, 2026-09-15
Agent definitions are **not portable** between Claude Code and OpenCode.
The divergence is not cosmetic:

| Concern | OpenCode | Claude Code |
|---|---|---|
| Location | `~/.config/opencode/agents/`, `.opencode/agents/` | `~/.claude/agents/`, `.claude/agents/` |
| Identity | the **filename** (`review.md` → agent `review`) | a **required `name` field**; filename need not match |
| Capability gating | `permission: {read, edit, bash, task, skill, webfetch, …}`, each `allow`/`ask`/`deny`, optionally a glob→action object | `tools` allowlist / `disallowedTools` denylist / `permissionMode` |
| Primary vs subagent | explicit `mode: primary\|subagent\|all` | inferred from use; **no equivalent field** |
| Model reference | `provider/model-id`, e.g. `perplexity-agent/anthropic/claude-opus-5` | an alias (`opus`), a full ID, or `inherit` |
| Restricting delegation | `permission.task: {"*": "deny", "x": "allow"}`, last match wins | `tools: Agent(worker, researcher)`, an allowlist |
| Subagent nesting | `subagent_depth` (`1` in `agent-tiers`, also the default) | 3 layers by default; `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` |
| Iteration cap | `steps` | `maxTurns` |

The overlap is `description`, `model` and `color`. **Everything that makes
an agent safe differs in name, in syntax and in semantics.** One markdown
file cannot serve both clients.

Two further constraints, both structural rather than stylistic:

- **Claude Code strips a fixed tool list from every subagent** regardless
  of its `tools` field — `AskUserQuestion`, `EnterPlanMode`, `Workflow`,
  and others. A subagent therefore **cannot ask the user a question**.
- **OpenCode reaches the same place by another route**: at
  `subagent_depth: 1` a subagent cannot spawn subagents at all.

So an interactive design manager must be a **primary** agent in both
clients, forced independently by each. Recorded here because it constrains
TASK-0043's role shapes, not just their file format.

### The precedent this extends
ADR-0006 faced a criterion assuming cross-client uniformity ("one skill
working in all three clients"), found it unsatisfiable once tested against
reality, and resolved it by scoping portability **per capability**:
`AGENTS.md`'s portability claim means *portable across every client that
supports that capability*. Skills port to two clients; MCP servers port to
three; LM Studio supports MCP only.

Agents are a third capability class. LM Studio supports neither skills nor
agents — it supplies models and performs no agentic work — so the agent
capability spans **two** clients, the same two as skills.

### The shape this borrows
ADR-0005's Clarification established that an MCP server's shape is
**derived** from which marker file is present, never self-declared,
because *"a self-declared `shape` field could contradict the directory's
actual contents; a derived one cannot."* The same logic applies to a
per-client agent file: it should be **generated** from a client-agnostic
source rather than hand-maintained per client, so it cannot contradict the
role it implements.

### Established about this repo's deployment mechanism
- `install.sh:105` deploys skills with `ln -sfn` — one directory, linked
  into each client, so a repo edit is live everywhere with **no sync step**.
  This is why `configs/opencode/README.md` records a drift incident as
  notable rather than expected.
- `install.sh:36-39` is a `CLIENTS` heredoc with **three** columns
  (`name|skills target|parent`), and `validate.sh` parses that block with
  `sed` to require `configs/<client>/README.md` per client. Adding an
  agents target touches the block the gate reads.
- `~/.claude/agents/` **does not exist** on this machine. Claude Code has
  zero custom agents today, so there is no installed base to preserve and
  no drift to inherit.

### Not established — TASK-0036's job
- Whether the table above still holds against **live** docs at the moment
  of implementation, field by field.
- Whether OpenCode's agents directory is `agents/` or `agent/` in the
  installed version — the docs say `~/.config/opencode/agents/`, and
  neither that directory nor `agent/` currently exists on this machine, so
  the correct name is **unverified by observation**.
- What each client does with an unrecognised frontmatter key: ignore it, or
  fail to load the agent. This decides whether one file with a superset of
  keys could work after all, which would make emission unnecessary.
- Whether OpenCode's `permission` semantics can express Claude Code's
  `tools` allowlist faithfully in both directions, or only one way.

## Decision

To be written after TASK-0036 reports. **Expected: one client-agnostic
source per role, emitted per client**, per the human's decision of
2026-09-15.

If that is the outcome, the decision must settle:

1. **The source of truth** is `agents/<role>/agent.md` — one directory per
   role, carrying a client-agnostic role contract: identity, purpose,
   primary-or-subagent, an abstract capability profile, and the system
   prompt. Never a client's native format.
2. **The capability profile is abstract and mapped, not passed through.**
   A role declares intent (`may edit test files only`, `read-only`,
   `may not force-push`) and the emitter translates it into each client's
   mechanism. A role file must not contain the string `disallowedTools` or
   a raw `permission:` block, or it has picked a client.
3. **Emission forbids `link` mode, and that asymmetry with `skills/` is
   correct.** An emitted file's content differs per client by definition,
   so it cannot be a symlink to one source. Agents deploy by generation
   only: no `link`, no `copy`.
4. **No freshness check is possible, and none must be added.** Emission
   creates a fourth copy whose currency nothing verifies. ADR-0009 forbids
   validating runtime presence — *"a gate that cannot pass on a clean
   checkout stops being run, and a gate that is not run is worse than no
   gate, because it is still trusted."* The control is that emission is
   cheap and idempotent and `install.sh` is re-run. **Anyone who later
   "fixes" this by checking the deployed copy breaks every fresh clone and
   CI.** This clause exists to be cited when they try.
5. **What is validated instead**: that each `agents/<role>/agent.md`
   parses, carries its required keys, names a valid mode, and declares a
   capability profile the emitter recognises. Documentation and source
   completeness — never deployment state.
6. **The agent capability spans Claude Code and OpenCode only.** LM Studio
   is excluded by ADR-0006's logic and stays absent from the emission
   target list, as it is absent from the skills list.
7. **Model references belong in one place.** `agent-tiers`' `models.jsonc`
   already solved this for OpenCode with `{tier:<name>}` placeholders
   substituted at install time. Whether the emitter reuses that file or
   supersedes it must be decided, not left for TASK-0040 to improvise — the
   two mechanisms coexisting is how a second owner of the same fact
   appears.

If TASK-0036 finds that unrecognised keys are **ignored** by both clients,
the decision must genuinely reconsider a single superset file, because that
would be simpler than an emitter and this ADR should not pre-commit against
evidence it has not seen. The known blocker is semantic rather than
syntactic — `permission` and `tools` are different models, not different
spellings — but that is a reason to expect the answer, not to skip asking.

## Consequences

To be written. Expected:

- **A role is authored once**, and its safety profile cannot silently
  diverge between clients, because neither client's file is hand-edited.
- **A generated artifact enters the deployment path for the first time.**
  Everything this repo deploys today is either a symlink to a tracked file
  or a printed instruction. An emitted file is neither, and it is the first
  thing `install.sh` produces that has no tracked counterpart. That is a
  new class of artifact and its absence from the gate's reach is a real,
  accepted weakness.
- **The emitter becomes load-bearing and untested-by-the-gate.** A wrong
  mapping produces a *plausible* agent file with wrong permissions — a
  `review` agent that can edit, say. `validate.sh` cannot catch that; only
  fixture-based testing of the emitter can, and lesson 8 applies (knowing
  this has not prevented an unfailable check twice).
- **`CLIENTS` grows a column and the gate's parsing must follow.** The
  client↔config pairing check reads that block; extending it without
  updating the check is how a client gets added with no wiring snapshot.
- **A capability-profile vocabulary is a new thing to maintain.** Every
  abstract term (`read-only`, `test-files-only`) must map to both clients,
  and a term that maps to one is a term that cannot be used. Expect the
  vocabulary to be smaller than either client's native expressiveness —
  that is the price of one source, and it should be paid explicitly rather
  than discovered when a role needs a permission the profile cannot state.
- **This ADR does not make agents portable to future clients.** It makes
  them portable to two, by construction, with a mechanism that can be
  extended. ADR-0006's per-capability scoping means a third client
  supporting agents is a new emitter target, not a crisis.
