# TASK-0037 — agents/_template/ and the normative agent schema

## Objective
Turn `agents/` from a declared category with nothing behind it into a
defined one: create `agents/_template/` and write the **normative schema**
into `docs/development/authoring-guide.md`.

This task **defines**. TASK-0038, 0039 and 0040 enforce, index and deploy
what it defines. That order is ADR-0008's rule and is not negotiable.

## Minimal context

### Why definition strictly precedes enforcement
ADR-0008 settled this after B-002 bundled a specified requirement
(frontmatter rules, already written in `authoring-guide.md`) with an
unspecified one (a "line budget" defined nowhere). Its consequence:
*"enforcement follows definition"*, and to add a budget you must
*"define it here first, in bytes, with a rationale, then enforce it."*

`authoring-guide.md:17-21` records the same rule from the other side: no
`SKILL.md` size budget exists, and one was **deliberately not invented** —
because *"enforcing an invented number would make the gate the author of a
requirement."*

So this task writes the rule table, and TASK-0038 mirrors it. If they are
written in the other order, the gate becomes the author of the schema and
the guide becomes documentation of the gate.

### Why `agents/` has been empty for six sprints
`agents/README.md` is 141 bytes, three lines, and the only file. Yet
`agents/` is a first-class component category in `AGENTS.md`, `README.md`,
ADR-0001, `GLOSSARY.md` and `PROJECT_MAP.md`. `prompts/` is identical at
127 bytes.

ADR-0016 already recorded this and drew the correct conclusion — *"A
declared category can exist indefinitely with nothing behind it"* — and used
it as an argument against adding a `hooks/` category. It did not fix it,
reasonably, since it was deciding a different question.

The consequence if this task is skipped: agent roles ship as **unenforced
text** while the repo's other three component categories are all gated.
That is the newest category being the only unpoliced one, which is the
inverse of what a repo that polices components should look like.

### What the template must mirror, and what it must not
The three existing `_template*` directories are the shape precedent:

- `skills/_template/` — `SKILL.md` + `assets/` + `references/` +
  `scripts/`. Exercised twice.
- `loops/_template/` — `loop.md`, 17 lines. Exercised once.
- `mcp-servers/_template/` — **never exercised** (ADR-0010), and
  `CURRENT_STATE.md`'s reference case for plausible unexercised scaffolding.

That last one is the warning. A template is not evidence a category works;
only an instance is. This task creates the template, and TASK-0043 and
TASK-0045 are what actually exercise it.

### The schema's hard constraint: an abstract capability profile
ADR-0018 requires a role to declare capability **intent** (`read-only`,
`test-files-only`) which the emitter translates per client. A role file must
therefore **not** contain a raw `permission:` block or the string
`disallowedTools` — either means it has picked a client, which defeats the
one-source mechanism.

The vocabulary of allowed profile terms comes from TASK-0036's
capability-vocabulary table. **A term that maps to only one client cannot be
offered**, and that constraint is what makes this schema harder than the
skill schema: it is not just naming fields, it is fixing an abstraction
whose expressiveness is bounded by the weaker of two clients.

### Why the template is exempt from one rule but not the others
`validate.sh` exempts `_template*` from the `name`↔directory rule only, and
still schema-checks `mcp-servers/_template-external/server.json`. The agent
template must be checkable the same way: everything except the
name-equals-directory rule applies to it, so the template itself proves the
schema is satisfiable.

### No invented budgets
ADR-0008 again. This task must **not** invent a length limit for an agent
file, a description byte cap, or a role-count limit. If a budget is ever
wanted it is defined here first, in bytes, with a rationale. Note the one
genuine external constraint worth *documenting* rather than enforcing:
Claude Code warns when combined subagent descriptions exceed 15,000 tokens.
That is a vendor threshold, not this repo's rule, and documenting it is not
the same as gating on it.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/decisions/0018-agent-portability-one-source-per-client-emission.md` | TASK-0033, completed by TASK-0036 | **Accepted**; names the source-of-truth path, the abstract-profile requirement, and the emission mechanism |
| `.ai/tasks/TASK-0036-spike-agent-schema-mapping.md` | TASK-0036 | `done`; execution log carries the capability-vocabulary table and the dated field mapping |
| `agents/README.md` | pre-existing | 141 bytes, 3 lines. States "One markdown file per role: name, system prompt or pointer to prompts/, allowed tools and MCP servers" |
| `docs/development/authoring-guide.md` | pre-existing | 98 lines; rule tables for Skills, MCP servers, Loops; `:17-21` records the deliberate absence of a size budget |
| `skills/_template/` | pre-existing | `SKILL.md` (24 lines) + `assets/` + `references/` + `scripts/` — the shape precedent |
| `loops/_template/loop.md` | pre-existing | 17 lines, 288 bytes — the minimal-template precedent |
| `mcp-servers/_template-external/server.json` | pre-existing | 32 lines; the precedent for a template that is schema-checked but exempt from name↔directory |
| `~/.config/opencode/skills/agent-tiers/agents/*.md` | `agent-tiers` | Four real OpenCode-shaped roles — the concrete cases the schema must be able to express |
| `.ai/decisions/0008-skill-linter-frontmatter-only.md` | pre-existing | Accepted; enforcement-follows-definition, and no invented budgets |

**Verify the expected state; don't assume it.** Confirm ADR-0018 is
`Accepted` rather than `Proposed`, and that TASK-0036's log actually contains
a capability vocabulary — without it this task would be inventing the
abstraction rather than recording a verified one.

## Scope

### Included
- `agents/_template/agent.md` — the role template, with the required
  frontmatter and a commented body skeleton.
- An **Agents** section in `docs/development/authoring-guide.md`, matching
  the existing sections' shape: a rule table per frontmatter key with the
  *reason* for each rule, since the guide's existing rules each state why
  (`name` must equal the directory *because it determines the install
  path*; `description` is single-line *because it renders into one registry
  cell*).
- The abstract capability-profile vocabulary, enumerated, with each term's
  meaning and the note that terms mapping to only one client are excluded.
- An explicit statement that a role file must **not** contain client-native
  permission syntax, and why.
- A statement that **no size budget exists** for agent files, matching
  `:17-21`'s treatment for skills, so the next reader does not invent one.
- Documentation of Claude Code's 15,000-token combined-description warning
  as a **vendor threshold to be aware of**, explicitly not a gated rule.
- Replace `agents/README.md`'s three lines with a pointer to the
  authoring guide, so the category has one owner for its rules.

### Not included
- **Any `validate.sh` change.** TASK-0038. Writing both here would collapse
  the definition/enforcement boundary this task exists to respect.
- **Any `sync-registry.sh` or `install.sh` change.** TASK-0039, TASK-0040.
- **Authoring a real role.** TASK-0043, TASK-0045. This task creates the
  template only.
- **Building out `prompts/`.** Deliberately out of scope (B-016). `prompts/`
  stays a 127-byte README; extending this work to a second category on
  symmetry alone is how a sprint acquires unrequested items.
- **Inventing any budget.** ADR-0008.
- Deciding the emitter's implementation. TASK-0040.

## Likely files
- `agents/_template/agent.md`
- `agents/README.md` — rewritten as a pointer
- `docs/development/authoring-guide.md` — new Agents section
- `.ai/tasks/TASK-0037-agents-template-and-schema.md` — this file

Note the forecast tension worth recording at the end: `docs/registry.md`
should **not** change in this task, because `sync-registry.sh` has no agent
kind until TASK-0039. If the registry changes here, something was done out
of order.

## Execution plan
1. Confirm ADR-0018 is `Accepted` and TASK-0036 is `done` with a capability
   vocabulary. **Stop and escalate if not** — the schema's central
   abstraction comes from that spike.
2. Read all three existing `authoring-guide.md` sections to match their
   table shape and their habit of stating a reason per rule.
3. Read the four `agent-tiers` role files as the concrete cases the schema
   must express. Any boundary they use that the schema cannot state is a
   finding.
4. Draft the frontmatter rule table: which keys are required, which
   optional, what each constrains, and **why**.
5. Draft the capability-profile vocabulary from TASK-0036's table. For each
   term, state its meaning and its expression in both clients.
6. Write the Agents section into `authoring-guide.md`, including the
   no-budget statement and the vendor-threshold note.
7. Create `agents/_template/agent.md` conforming to the schema just
   written, exempt only from name↔directory.
8. Rewrite `agents/README.md` as a pointer to the guide.
9. Confirm the template satisfies every rule in the new table except
   name↔directory — by reading it against the table, since no check exists
   yet.
10. `bash tests/validate.sh` — expect green. The new category is not yet
    checked, which is correct at this point and worth noting: **a green gate
    here proves nothing about `agents/`.**
11. `bash scripts/sync-registry.sh` — expect **no diff**, since there is no
    agent kind yet.
12. Review the diff; commit; record the hash; push; confirm; record.

## Acceptance criteria
- [ ] `docs/development/authoring-guide.md` has an Agents section with a
      rule table whose every row states a **reason**, matching the three
      existing sections' style
- [ ] The abstract capability vocabulary is enumerated, each term mapped to
      **both** clients, with the exclusion rule stated
- [ ] The guide states explicitly that a role file must not contain
      client-native permission syntax, and why
- [ ] The guide states that **no size budget exists** for agent files, in
      the same terms as `:17-21` does for skills
- [ ] Claude Code's 15,000-token description warning is documented as a
      vendor threshold, explicitly **not** a gated rule
- [ ] `agents/_template/agent.md` exists and satisfies every schema rule
      except name↔directory
- [ ] The schema can express all four `agent-tiers` role boundaries; any it
      cannot is **recorded as a finding**, not silently dropped
- [ ] `agents/README.md` points at the guide rather than restating rules
- [ ] `tests/validate.sh` green, **with the note that this proves nothing
      about `agents/` yet**
- [ ] `scripts/sync-registry.sh` produces no diff

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — run it; the correct
      result is **no diff**, since no agent kind exists yet. Running it
      proves that rather than asserting it

## Risks and rollback
- **Risk: inventing the abstraction instead of recording it.** If TASK-0036
  did not produce a usable vocabulary, the temptation is to design one here
  from first principles. That would make this task the author of an
  unverified cross-client claim — exactly what ADR-0018 is structured to
  prevent. Step 1 is a hard gate.
- **Risk: a vocabulary term that maps to only one client.** It would produce
  a role that is silently weaker in one client than the author intended —
  a `review` agent that can edit, say. The schema must exclude such terms,
  and TASK-0036's table is the authority for which they are.
- **Risk: inventing a budget.** ADR-0008 forbids it and lesson 6 records
  that a budget nobody measures is not a budget. The vendor's 15,000-token
  threshold is *documented* precisely so that the next reader has somewhere
  to put that concern other than a made-up line limit.
- **Risk: writing the check first.** Collapses the order this task exists to
  protect. If a rule feels hard to enforce, that is information about the
  rule and belongs in the guide's reasoning, not a reason to draft the check
  to find out.
- **Risk: a template that cannot be instantiated.** `mcp-servers/_template/`
  is the precedent — plausible, never exercised, and only discovered to be
  unproven when someone looked. Mitigated by step 3: the four real
  `agent-tiers` roles are the instantiation test, on paper, before any code
  depends on the schema.
- **Rollback:** three files, all additive except `agents/README.md`'s
  rewrite. `git revert` restores the 141-byte README and removes the
  template and the guide section cleanly. No component behaviour depends on
  this task yet, which is precisely why it is safe to land first.

## Outputs / handover

**Intended end state — this task has not run.** The table below is a plan.
`validate.sh` requires this section non-empty for briefs ≥ 0020 and cannot
distinguish an intention from a state (ADR-0012 Decision 3), so this
sentence does it.

| Artifact | Intended end state |
|----------|-------------------|
| `docs/development/authoring-guide.md` | Fourth component section: agent frontmatter rules with reasons, the capability vocabulary mapped to both clients, the no-client-native-syntax rule, the no-budget statement, the vendor threshold as a note |
| `agents/_template/agent.md` | The role template, satisfying the new schema, exempt only from name↔directory |
| `agents/README.md` | A pointer to the guide instead of three lines of restated rules — one owner for the category's rules |
| `agents/` | Still holds **no real role**. Defined, not populated |
| `tests/validate.sh`, `scripts/sync-registry.sh`, `scripts/install.sh` | **Untouched.** Enforcement, indexing and deployment are TASK-0038/0039/0040 |
| `docs/registry.md` | Unchanged; no agent kind exists yet |

**Next task starts here**: the agent schema is normative and written down,
so TASK-0038 can mirror it into the gate, TASK-0039 can extract the two
keys the registry needs, and TASK-0040 can emit against a fixed set of
profile terms. All three are independent of each other once this lands.

Deviation to watch for: if the schema turns out unable to express one of the
four `agent-tiers` boundaries, TASK-0045's reconciliation is affected and
the gap must be recorded here rather than discovered there — the honest
outcome is a documented limitation of the abstraction, not a term quietly
added that only one client honours.

## Status
- Status: planned
- Owner: agent
- Created: 2026-09-15
- Updated: 2026-09-15

## Execution log
### Attempt 1
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
