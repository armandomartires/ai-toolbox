# ADR-0016 — Hooks as a component category: declined, because the clients disagree on the tool's name

## Status
**Accepted — 2026-09-22.** Ratified by the human in answer to `REVIEW-0010`'s
ratification packet. Opened by `PLAN-0003` (sprint S6); recorded by
`TASK-0054`.

**What was ratified is the ground, not the conclusion.** The conclusion — no
`hooks/` category — was the expected one. Its basis was **refuted and
replaced**: `TASK-0028` found interception **works in both clients**, so the
category is **declined on portability**, never unavailable on capability.
Ratification binds that distinction, and with it Decision 4 (a future
category is not named `hooks/`) and the three-part reopen trigger.

**`ADR-0021` extends this ADR and is still `Proposed`** — its own status is
unaffected by this ratification; see the dated note in its Context.

The trail below is kept as written:

> **Proposed**, 2026-09-14. **Body written 2026-09-16** against `TASK-0028`'s
> evidence, per the human decision of the same date: draft from spike
> evidence, leave `Proposed` for ratification.

Its blocking dependency is met: `TASK-0028` is **done**. The title changed
when the body was written — it previously read *"decide after evidence, expect
no"*. The expectation was met and **the reasoning behind it was refuted**, so
the title now names the actual reason rather than the anticipated one.

## Context

### The premise, and what the spike did to it
This ADR rested on one unverified claim: whether a client hook can intercept
an MCP tool call. The plan expected **no**, and expected that "no" to carry
the decision. **Both halves of that turned out wrong in an instructive
way — interception works in both clients, and the category is still
declined.**

`TASK-0028` established, on 2026-09-16:

- **Claude Code (DOCUMENTED-ONLY**, `code.claude.com/docs/en/hooks`, read
  against installed `claude 2.1.246`): MCP tools *"appear as regular tools in
  tool events"* — `PreToolUse`, `PostToolUse`, `PermissionRequest` and
  others — and `PreToolUse` *"Can block it"* via
  `hookSpecificOutput.permissionDecision: "deny"`. Naming is
  `mcp__<server>__<tool>`.
- **OpenCode (OBSERVED live**, `opencode 1.18.31`): `tool.execute.before`
  fires for MCP tools, **before** the permission prompt, and a `throw`
  blocks the call. A temporary probe plugin intercepted and blocked the
  read-only `zen_of_ansible`, logging the tool ID as
  **`ansible_zen_of_ansible`**. OpenCode's own documentation shows this hook
  blocking only the built-in `read` tool and is **silent** on MCP tools, so
  this was established by reading the installed bundle and then confirming it
  live.

So the capability exists in both. Had the spike stopped at *"can it
intercept?"*, the evidence would have pointed **toward** a category.

### The finding that actually decides it: the identifier differs
Same capability, two irreconcilable schemes — both verified this session:

| | Claude Code | OpenCode |
|---|---|---|
| Tool ID | `mcp__ansible__zen_of_ansible` | `ansible_zen_of_ansible` |
| Construction | `mcp__` + server + `__` + tool | `sanitize(server) + "_" + sanitize(tool)` |
| Mechanism | `PreToolUse` matcher in `settings.json` (JSON + shell) | `tool.execute.before` in a JS/TS plugin |
| Blocks by | `permissionDecision: "deny"` | `throw new Error(...)` |
| Config surface | `~/.claude/settings.json` | `~/.config/opencode/plugins/*.js` |

**A single portable guard artifact cannot express this.** There is no shared
identifier, no shared file format and no shared blocking convention — only a
shared *concept*. `AGENTS.md` requires components be "portable across every
client that supports its capability"; here the incompatibility reaches
**the string the guard must match**, which is deeper than the
two-implementations problem the plan anticipated.

This is `ADR-0006`'s per-capability scoping again, and the same shape as
`ADR-0018`'s finding for agent roles: the mechanism ports, the *safety
expression* does not.

### Two silent-no-op modes, both found while verifying
Each is this repo's most-repeated defect available as a one-line mistake, and
each would make a shipped guard appear installed while doing nothing:

- **Claude Code:** the `.*` is **required**. Per the docs, a matcher like
  `mcp__ansible` *"contains only exact-match characters, so it is compared as
  an exact string and matches no tool"*. `mcp__ansible__.*` is correct;
  `mcp__ansible` silently matches nothing while looking right.
- **OpenCode:** under `experimental.codeMode`, MCP tools are **not
  registered as individual tools at all**, so `tool.execute.before` does not
  fire per MCP tool. Found in the installed bundle; the alternative code path
  was not decompiled and is recorded as **could-not-determine**.

### Established by reading this repo, and re-verified
- **No hook or plugin concept exists here.** Zero occurrences of
  `PreToolUse`, `PostToolUse`, `SessionStart`, `UserPromptSubmit` or
  `settings.json`; all matches for "hook" refer to the git pre-commit gate.
- **No category plumbing exists.** Re-verified 2026-09-16 (via `PLAN-0005`):
  four hardcoded `emit_section` calls, four hardcoded `validate.sh` iteration
  roots, a four-column `install.sh` `CLIENTS` table. **A new top-level
  directory is silently ignored by all three and by CI** — invisible rather
  than loud.
- **Precedent is poor.** `prompts/` is still a declared category with a
  127-byte README and zero tooling. `agents/` was the same until S7 built it
  out deliberately, which took four tasks. *A declared category can exist
  indefinitely with nothing behind it.*
- **`loops/` already is the runbook category, and it already has tooling.**
  Mandatory exit conditions are enforced in `validate.sh`; the sequencing
  layer the source analysis attributed to hooks is substantially covered.

### The decisive counter-consideration, unchanged
S6's highest-value enforcement (`TASK-0031`) is **static**: it reads YAML and
decides. `TASK-0027` confirmed its home — a custom `ansible-lint` rule, which
runs in `pre-commit`, in CI, in an editor, **and** through the pinned MCP
server's own `ansible_lint` tool. It never needed hook interception. The
human decided on 2026-09-14 that **the working guard beats the portable
abstraction**, and the evidence supports that.

## Decision

1. **No `hooks/` component category.** No such directory is created, and **no
   plumbing changes** are made to `install.sh`, `sync-registry.sh` or
   `validate.sh`.
2. **The guard ships as a static `ansible-lint` custom rule** wired via
   `enable_list:` in `.ansible-lint`, per `TASK-0027`'s recommendation —
   **conditional on shipping a proof that the rule fires**, since a rule
   outside the active profile is loaded, listed and never evaluated at exit 0.
3. **The reason is recorded as the naming incompatibility, not as an absence
   of capability.** Interception **is** available in both clients and is
   **deliberately not taken up**. This ADR must be readable as a declined
   option, never as an unavailable one — otherwise a future reader
   re-discovers hooks and thinks the question is new.
4. **If a category is ever created, it is not called `hooks/`.** OpenCode
   calls the mechanism a *plugin*; Claude Code calls it a *hook* and *also*
   uses "plugin" for a marketplace (`ADR-0021`). Both terms are
   vendor-specific, and naming a category after one vendor's word for a
   capability another implements differently is how confusion starts — the
   trap this ADR predicted in words and `ADR-0021` later hit directly.
5. **Reopen trigger, so this is a deferral rather than an orphan**
   (lesson 9). Revisit only if **all three** hold: (a) a concrete need for
   *runtime* MCP-call enforcement that a static check cannot meet; (b) a
   named owner for two per-client implementations, accepting they share no
   identifier; and (c) the category plumbing in Decision 1 becoming
   parameterised rather than hardcoded. Anything less is per-client wiring
   documented in `configs/`, not a component category.

## Consequences

- **No category means no new surface to maintain, and the guard still
  ships.** The capability is delivered; only the abstraction is declined.
- **The tension is recorded rather than hidden**, as this ADR's own draft
  demanded: the capability existed, was verified, and was not taken up. A
  future task wanting runtime enforcement has a **verified path per client**
  and the naming table above as its starting evidence — and does not have to
  re-run this spike.
- **A negative result was expected and a positive one arrived, which changed
  nothing about the outcome and everything about the reasoning.** Worth
  keeping visible: the spike's value was not in confirming the guess but in
  finding the *real* obstacle one layer down. Had it stopped at the
  interception question it would have produced the wrong recommendation with
  a satisfied feeling.
- **Two silent-no-op modes are now on the record** (`.*`-required;
  `experimental.codeMode`). Any future hook-based work must prove its hook
  **fires** before trusting it — the same condition `TASK-0027` attached to
  the `ansible-lint` route. Three independent mechanisms in this sprint can
  each be installed and inert; that is the sprint's most transferable
  finding.
- **Whatever is decided, the guard must not be described as making Ansible
  execution safe.** It prevents one documented mechanism of one hazard, and
  it is validated against syntax rather than against the hazard itself, which
  is not reproducible on demand.
- **Ratification still owed.** The evidence is in; declining an available
  capability is a scope judgment and remains the human's call.
