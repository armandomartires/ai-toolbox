# SESSION-20260916-0600 — Author the design roles; extend the capability vocabulary

- Date: 2026-09-15
- Agent: opencode (claude-opus-5)
- Objective: TASK-0043 — author the design-stage roles in `agents/`, the
  first real instances of the category, exercising Phase 2's plumbing.
- Entry state: clean tree at `9a5fea8`. Phase 2 complete but wholly
  unexercised; `agents/` held only `_template/` and a README; both client
  agents directories empty.

## The escalation, and the human's routing

**TASK-0043's step-2 gate fired.** The nine-term capability vocabulary could
not express `designer-manager`'s central boundary — a primary agent
delegating to *exactly* `ideator`, `critic` and `git-ops`. The only
delegation term was `no-delegation`: all-or-nothing.

The important qualifier: this was a **vocabulary gap, not a client
limitation.** Both clients can enforce an allowlist
(`permission.task` deny-first; `tools: Agent(a, b)` for a main-thread
agent), and `agent-tiers`' own `plan`/`build` primaries each carry one.

Escalated rather than worked around, per the brief. The human chose to
extend the vocabulary **as follow-ups to the owning tasks first** — which is
also what TASK-0043's own "Not included" demanded.

## Three follow-ups, in ADR-0008's order

Definition → enforcement → emission, each recorded as an amendment in its
**owning task's** log rather than attributed to TASK-0043:

- **TASK-0037** — `delegation-allowlist` (tenth term; **fourth** that maps to
  both clients), the `delegates_to` key, the `mode: primary` rule, and the
  block-list-only constraint.
- **TASK-0038** — five new checks, **each observed failing** on a single-rule
  fixture, plus two controls. Runtime 683/681/720 ms, still sub-second.
- **TASK-0040** — the vocabulary's first **parameterised** term, emitted per
  client.

**The `mode: primary` pairing is the substantive discovery.** Claude Code
ignores an `Agent(...)` type list in a *subagent* definition, so a subagent
declaring the allowlist would be enforced in OpenCode and **silently
widened** in Claude Code — ADR-0018 clause 8's exact failure. Now a schema
rule the gate rejects, not a convention.

## Two things proved rather than assumed

1. **`"*"` is emitted first by guarantee.** OpenCode's rules are
   last-match-wins, so allowed names before the blanket deny would leave the
   deny winning and block *everything*. Tested with names chosen to sort
   before `*` under a naive sort (`AAA-first`, `!bang`) — `"*"` still first,
   because the sort key is `(g != "*", g)`. Without this the emitter would
   produce a file that reads correctly and enforces the opposite.
2. **`critic` is read-only at runtime in both clients.** Claude Code
   reports **`WRITE=no EDIT=no AGENT=no`** from the subagent's own tool list
   — the tools are absent from the pool, so no prompt-compliance question
   arises, unlike TASK-0036's `cc-permonly` fixture which *had* Write and
   merely declined to use it. OpenCode's resolver applies all six denies,
   checked individually.

## One message corrected after testing

The inline flow form (`delegates_to: [a, b]`) lands in the "missing" branch,
because `seq()` reads block sequences only. Verified it **fails loudly**
rather than emitting an unparsed allowlist — the safe direction — but the
original message read "requires a 'delegates_to' list" while the author is
looking at a present key. Reworded. **A correct verdict with a misleading
message is still a defect**: the fixture proved the verdict, reading the
message proved the rest.

## `design-doc-writer` declined, on evidence

**Zero** references across all shipped content, verified by grep rather than
by reading the loop alone. The manager writes the brief at step 4; `git-ops`
commits at step 7. The role would exist to perform a mechanical write another
role must do anyway, and at `subagent_depth: 1` only the manager could reach
it. **Sprint role count is six, not seven.**

## Phase 2 exercised end to end

| Proof | Result |
|---|---|
| `validate.sh` on real agent content | PASS — first time outside a fixture |
| Registry populates | 3 roles; `_template` excluded |
| Emission | 6 files (3 roles × 2 clients), all inspected |
| `critic` read-only | Proved at runtime, both clients |
| `designer-manager` allowlist | Resolved deny-first in OpenCode |
| `opencode.jsonc` | Unmodified, no `agent` key |

**No Phase 2 defect was found.** What was found was a Phase 2 *omission* — a
missing vocabulary term — fixed in the owning tasks.

## Recorded so it is not read as an oversight

`designer-manager` names **`git-ops` in `delegates_to` before that role
exists**. Deliberate: the allowlist is a declaration of intent, the loop
already names it, and `validate.sh` does *not* check that a delegate exists
— that would couple the gate to authoring order, and a role legitimately
references roles authored later. It is exactly why the loop states step 7
cannot execute until TASK-0045 lands.

## Exit state

**Phases 1, 2 and 3 complete; nine of S7's tasks done.** The design stage is
complete and deployable — gated loop, documented method, three emitted roles
— but **still unrun**.

Remaining: **TASK-0044** (`loops/project-build/`, independent of everything
above), then **TASK-0045** (three production roles, and the one that makes
the design loop executable end to end), then **TASK-0046**'s pilot.

- Result: TASK-0043 done, with three follow-up amendments to
  TASK-0037/0038/0040. Commit `3a588da`, pushed to `origin/master` and confirmed by re-fetch.
