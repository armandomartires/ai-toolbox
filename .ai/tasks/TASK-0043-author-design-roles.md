# TASK-0043 — Author the four design-stage roles

## Objective
Author the first real components in `agents/`: `designer-manager` (a
**primary** agent) plus `ideator`, `critic` and `design-doc-writer`
(subagents), under ADR-0018's one-source contract.

This is the task that **exercises** Phase 2. Until a real role exists,
the template, the schema, the checks, the registry section and the emitter
are all plausible and unproven.

## Minimal context

### Why `designer-manager` must be primary
Two independent client constraints force it, and neither is a preference:

- **Claude Code strips a fixed tool list from every subagent** regardless of
  its `tools` field, and `AskUserQuestion` is on that list. A subagent
  cannot ask the user a question.
- **OpenCode's `subagent_depth: 1`** — set by `agent-tiers` and also the
  documented default — prevents a subagent from spawning subagents. So a
  designer-manager implemented as a subagent could not delegate to
  `ideator` or `critic` even if it could talk to the user.

The design stage is an interactive back-and-forth that delegates to
workers. Both properties are required, and only a primary agent has both.
TASK-0036 confirms both by observation; this task must not re-derive them
from memory.

### Why a primary agent is structurally different from a subagent
OpenCode has an explicit `mode: primary|subagent|all`. Claude Code has **no
equivalent field** — a primary agent there is one launched with `--agent`
or the `agent` setting, and its restriction mechanism is different too:
`tools: Agent(worker, researcher)` is an allowlist *"only for an agent
running as the main thread"*, while in a subagent definition any type list
inside the parentheses is **ignored**.

So `designer-manager` is the role where the two clients diverge most, and it
is the hardest test of ADR-0018's abstraction. Worth knowing before
authoring: if the capability profile cannot express "primary agent that may
delegate to exactly these three subagents" in both clients, that is a real
limitation of the vocabulary and belongs in the record rather than being
worked around per client.

### `agent-tiers`' warning about built-in names
`agent-tiers`' `SKILL.md` documents, with reasoning, why `plan` and `build`
are inline config overrides rather than markdown files: *"A markdown agent
file's body becomes that agent's system prompt — creating `agents/plan.md`
would silently replace OpenCode's tuned built-in `plan` prompt wholesale,
not extend it."*

OpenCode's built-ins are `build`, `plan`, `general`, `explore`, `scout`
(plus hidden `compaction`, `title`, `summary`). Claude Code's include
`Explore`, `Plan`, `general-purpose`, `claude`.

**None of the four names proposed here collides**, which is deliberate. But
the rule must be honoured for any future role, and the collision list is
worth recording in the skill or guide rather than living only in
`agent-tiers`' `SKILL.md`.

### Descriptions cost context
Claude Code matches subagents by their `description`, and warns at startup
when combined subagent descriptions exceed **15,000 tokens**, advising that
detail move into the system prompt, which loads only when the subagent runs.
OpenCode also requires a `description` and matches on it.

TASK-0037 documents this as a vendor threshold, deliberately **not** a gated
rule. Four short descriptions will not approach it; the discipline matters
because S7 adds seven roles in total and the sprint after may add more.

### Why these four, and the honest uncertainty
The split follows TASK-0041's loop steps: one interactive manager, one
generator, one adversarial reviewer, one writer. TASK-0041's and TASK-0042's
handovers both warn that the landed step list may differ from
clarify/ideate/critique/converge — and **a different step count may mean a
different role set**. Four is a forecast inherited from `PLAN-0004`, not a
requirement.

A genuine open question this task must answer rather than assume: whether
`design-doc-writer` earns its own role at all, or whether writing the
accepted brief is the manager's last step. A role that exists to perform one
mechanical write, in a topology where `subagent_depth: 1` already limits
delegation, may be structure without benefit.

**TASK-0041 has since answered this from the sequence side: it gives
`design-doc-writer` nothing to do.** The manager writes the brief at step 4
because it is the only role that has spoken to the human and holds the
constraint list, and `git-ops` performs the step-7 commit. So the default is
now **decline it**, and authoring it requires an independent reason this
task must state. That makes the sprint's role count **six, not seven**.

The landed loop also adds a role this brief did not forecast: **`git-ops`**
is a Phase 3 dependency, not only a Phase 4 one. It is reconciled into
`agents/` by TASK-0045, which sits *after* this task — so the design loop
cannot be *executed* end to end until that lands. That is TASK-0046's
ordering problem, not this task's, but it must not be discovered there.

### This is the first real instance of the category
`mcp-servers/_template/` is this repo's reference case for plausible
unexercised scaffolding (ADR-0010). Phase 2 built a template, a schema,
checks, a registry section and an emitter — all of which are in that same
position until now.

So the acceptance criteria here include things that are really Phase 2's
proofs: that the emitter produces correct per-client files for a real role,
that `validate.sh`'s agent checks pass on real content, and that the
registry populates. If any of those fail, the finding belongs to Phase 2's
tasks, not to this one — but it is found here.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `loops/design-brief/loop.md` | TASK-0041 | **`done`, 176 lines, seven steps.** Roles named: manager (**primary**), `ideator`, `critic`, and **`git-ops`** (reused from `agent-tiers`, delegated the step-7 commit). **`design-doc-writer` is not referenced anywhere** — see the open question below |
| `skills/design-flow/` | TASK-0042 | `done`; the method per step, the critique's obligations, the distinctness requirement |
| `.ai/decisions/0018-agent-portability-one-source-per-client-emission.md` | TASK-0033/0036 | Accepted; source path, abstract-profile requirement, the no-client-native-syntax rule |
| `docs/development/authoring-guide.md` | TASK-0037 | Agents section: frontmatter rules with reasons, the enumerated capability vocabulary, the vendor-threshold note |
| `agents/_template/agent.md` | TASK-0037 | The shape to copy from |
| `tests/validate.sh` | TASK-0038 | Agent checks in place, each **observed failing** on a fixture |
| `scripts/install.sh` | TASK-0040 | Emits per-client agent files; `_template*` skipped; no `link` mode for agents |
| `scripts/sync-registry.sh` | TASK-0039 | Handles the `agent` kind; Agents section present but empty below its header |
| `.ai/tasks/TASK-0036-spike-agent-schema-mapping.md` | TASK-0036 | `done`; confirmed directory names, the capability vocabulary with both clients' expressions, and the two structural constraints confirmed |
| `skills/agent-tiers/SKILL.md` | TASK-0035 | In this repo; the built-in-name-collision warning and its reasoning |

**Verify the expected state; don't assume it.** Read the **landed** loop and
skill rather than this brief's description of them — both tasks' handovers
warn their shapes may have changed. Confirm the capability vocabulary can
express a primary agent's delegation allowlist before authoring
`designer-manager`; if it cannot, that is a finding to escalate, not a gap
to paper over per client.

## Scope

### Included
- `agents/designer-manager/agent.md` — **primary**; holds the conversation
  with the human; delegates to the three subagents; owns the brief file.
- `agents/ideator/agent.md` — subagent; generates distinct alternatives per
  the skill's distinctness requirement.
- `agents/critic/agent.md` — subagent; adversarial review per the skill's
  enumerated obligations; **read-only**.
- `agents/design-doc-writer/agent.md` — subagent; writes the accepted brief
  — **if** it earns a role; see the open question.
- Each with abstract capability profiles from the enumerated vocabulary, and
  **no client-native permission syntax**.
- Short `description` fields with detail in the prompt body, per the
  vendor-threshold note.
- Verification that none of the four names collides with a built-in in
  either client.
- Emission verified for all four roles in both clients, with the resulting
  client-native permissions **inspected**, not assumed.

### Not included
- **The production roles.** TASK-0045 reconciles `qa-test`, `review` and
  `git-ops`.
- **Running the design loop.** TASK-0046 is the pilot.
- **Any change to `validate.sh`, `sync-registry.sh` or `install.sh`.** If
  one is needed, that is a Phase 2 defect found here — record it and fix it
  in the owning task rather than patching it from this one.
- **Applying any topology to a live `opencode.jsonc`.** Out of S7's scope.
- **Restating the loop's sequence or the skill's method** in a role prompt
  beyond what the role needs to do its own job. Link.
- Any role named `plan`, `build`, `general`, `explore`, `scout`, or any
  Claude Code built-in.

## Likely files
- `agents/designer-manager/agent.md`
- `agents/ideator/agent.md`
- `agents/critic/agent.md`
- `agents/design-doc-writer/agent.md` — conditional on the open question
- `docs/registry.md` — regenerated; Agents section populates for the first
  time
- `.ai/tasks/TASK-0043-author-design-roles.md` — this file

## Execution plan
1. Read the landed loop and skill. Note any divergence from the four-step,
   four-role forecast.
2. Confirm from TASK-0036's log that the vocabulary can express: a primary
   agent with a delegation allowlist; a read-only subagent; and a subagent
   that may write one named file. **Escalate any gap.**
3. Decide the open question: does `design-doc-writer` earn a role, or is
   writing the brief the manager's final step? Record the reasoning either
   way.
4. Check all names against both clients' built-in lists.
5. Author each role from `agents/_template/agent.md`: abstract profile,
   short description, detail in the body.
6. `bash tests/validate.sh` — expect the agent checks to pass on real
   content for the first time. A failure here is a schema-vs-reality finding.
7. `bash scripts/sync-registry.sh` — confirm the Agents section **populates**
   with the real roles and excludes `_template`.
8. `bash scripts/install.sh` — emit, then **read each emitted file** in both
   clients. For each role, confirm the client-native permissions match the
   abstract profile's intent. Record per role per client.
9. Specifically verify `critic` cannot edit in either client, since a
   read-only reviewer that can write is the highest-consequence mapping
   error available here.
10. Confirm no `agent` key was added to any `opencode.jsonc`.
11. Review the diff; commit; record the hash; push; confirm; record.

## Acceptance criteria
- [ ] `designer-manager` is **primary** in both clients' emitted output,
      verified by inspection
- [ ] `ideator`, `critic` and `design-doc-writer` (if authored) are
      subagents
- [ ] **`critic` is provably read-only in both clients** — the emitted
      files inspected, not the profile trusted
- [ ] Every role uses only the enumerated capability vocabulary; **no
      client-native permission syntax** in any source file
- [ ] The `design-doc-writer` question is **decided with reasoning
      recorded**, not defaulted
- [ ] No name collides with a built-in in either client
- [ ] Descriptions are short, with detail in the prompt body
- [ ] `tests/validate.sh` passes on real agent content — the **first
      evidence** TASK-0038's checks work on something other than a fixture
- [ ] `docs/registry.md`'s Agents section **populates** with the real roles
      and excludes `_template`
- [ ] Emission verified per role per client, with the client-native
      permissions inspected and recorded
- [ ] No `agent` key added to any `opencode.jsonc`
- [ ] Any Phase 2 defect found is **recorded and attributed to its owning
      task**, not silently patched here

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — **required**; this
      task adds components and populates a registry section for the first
      time

## Risks and rollback
- **Risk: a plausible role with wrong permissions.** ADR-0018's named
  consequence: the gate validates the source, so a wrong mapping produces a
  correct-looking source and a wrong emitted file. `critic` is the acute
  case — a read-only reviewer that can edit would pass every check this repo
  has. Step 9 exists for exactly that, and it is why the criterion says
  *provably*.
- **Risk: the vocabulary cannot express a primary agent's delegation
  allowlist.** The two clients diverge most on precisely this role: Claude
  Code's `Agent(...)` allowlist applies only to a main-thread agent and is
  **ignored** in a subagent definition. If the abstraction cannot state it,
  authoring per-client workarounds would defeat the one-source mechanism.
  Escalate.
- **Risk: a built-in name collision.** In OpenCode a markdown agent file's
  body *replaces* a built-in's tuned system prompt wholesale rather than
  extending it — a silent, severe regression. None of the four proposed
  names collides, which is why step 4 is a check rather than a redesign.
- **Risk: roles designed around a stale step list.** Both upstream tasks
  warn their shapes may have changed. Step 1 reads the files.
- **Risk: a role that exists for symmetry.** `design-doc-writer` may be
  structure without benefit, especially at `subagent_depth: 1`. Deciding it
  deliberately is cheaper than discovering it in the pilot — and a role that
  does one mechanical write is exactly the kind of thing that survives
  because nobody asked whether it should.
- **Risk: attributing a Phase 2 defect to this task.** If `validate.sh`'s
  checks or the emitter turn out wrong, the fix belongs in TASK-0038 or
  TASK-0040. Patching it here would leave the owning task's proofs still
  claiming success.
- **Rollback:** repo changes revert in one commit. **Emitted files do not** —
  they are outside the repo and untracked, so rollback means `git revert`
  plus removing four emitted files from each of two clients' agents
  directories. Record their paths in the execution log so that is possible.

## Outputs / handover

**Intended end state — this task has not run.** The table below is a plan.
`validate.sh` requires this section non-empty for briefs ≥ 0020 and cannot
distinguish an intention from a state (ADR-0012 Decision 3), so this
sentence does it.

| Artifact | Intended end state |
|----------|-------------------|
| `agents/designer-manager/agent.md` | The first **primary** role in this repo; interactive; delegates to the design subagents |
| `agents/ideator/`, `agents/critic/` | Subagents; `critic` **provably read-only in both clients** by inspection of emitted output |
| `agents/design-doc-writer/` | Authored, or **deliberately not**, with the reasoning recorded either way |
| `docs/registry.md` | Agents section populated for the first time; `_template` excluded |
| Emitted client files | One per role per client, inspected and recorded — including their paths, for rollback |
| Phase 2's artifacts | **Exercised.** The template instantiated, the schema satisfied by real content, the checks run against a real role, the section populated, the emitter proven per role |
| Any `opencode.jsonc` | **Unchanged.** No `agent` key |

**Next task starts here**: the design stage is complete and deployable — a
gated loop, a documented method, and four (or three) emitted roles. The
production half (TASK-0044, TASK-0045) can proceed, and the pilot has one
of its two halves ready.

Deviation to watch for: if the capability vocabulary proved unable to express
any role's boundary, **record which boundary and which client** — that is a
documented limitation of ADR-0018's abstraction and TASK-0045 will hit it
too, since `qa-test`'s test-files-only boundary is the narrowest constraint
in either sprint. If `design-doc-writer` was declined, TASK-0046's pilot has
one fewer role to exercise and `PLAN-0004`'s "seven roles" count becomes six.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-15
- Updated: 2026-09-15

## Execution log
### Attempt 1
- Date: 2026-09-15
- Agent: opencode (claude-opus-5)

#### Step 1 — the landed loop, read rather than assumed

Two divergences from this brief's description, both minor and neither
changing the role set:

- **179 lines, not 176.** The brief's Inputs table was written before the
  final edits.
- The loop's `git-ops` paragraph now points at `agents/git-ops/` (TASK-0045)
  rather than `skills/agent-tiers/` — corrected when ADR-0017 was rejected.

Role mentions in the landed loop, counted: `manager` 12, `git-ops` 7,
`ideator` 3, `critic` 3, **`design-doc-writer` 0**.

#### Step 2 — the escalation the brief predicted, and it fired

**The vocabulary could not express `designer-manager`'s central boundary.**
The role must delegate to *exactly* `ideator`, `critic` and `git-ops`. The
nine terms offered only `no-delegation` — all-or-nothing.

This was a **vocabulary gap, not a client limitation**, which is the more
consequential finding: **both clients can enforce an allowlist.**
- OpenCode: `permission.task {"*": "deny", "<name>": "allow", …}`
- Claude Code: `tools: Agent(a, b)`, valid for a `--agent` main thread

And `agent-tiers`' own `plan`/`build` primaries each carry one, so a
deny-first task allowlist is the *established* pattern for a primary here.

Per the brief (*"Escalate any gap"*) this was **escalated rather than worked
around**. The human chose to extend the vocabulary, **as follow-ups to the
owning tasks first** — which is also what this brief's "Not included" demands
(*"If one is needed, that is a Phase 2 defect found here — record it and fix
it in the owning task"*).

**Three follow-ups landed in ADR-0008's order — definition, then
enforcement, then emission** — each recorded in its owning task's log:
- **TASK-0037 amendment 1**: `delegation-allowlist` (tenth term, **fourth**
  that maps to both clients) + the `delegates_to` key + the
  `mode: primary` rule + the block-list-only constraint.
- **TASK-0038 amendment 1**: five new checks, **each observed failing** on a
  single-rule fixture, plus two controls. Runtime still sub-second.
- **TASK-0040 amendment 1**: the vocabulary's first **parameterised** term,
  emitted per client, with `"*"`-first ordering proved by adversarial names.

**The `mode: primary` pairing is the substantive discovery.** Claude Code
ignores an `Agent(...)` type list in a *subagent* definition, so a subagent
declaring the allowlist would be enforced in OpenCode and **silently widened**
in Claude Code — ADR-0018 clause 8's exact failure. It is now a schema rule
the gate rejects, not a convention.

#### Step 3 — `design-doc-writer`: DECLINED, on evidence

The brief required this be *decided with reasoning recorded, not defaulted*.

**Declined.** The landed loop references it **zero** times — verified by
grepping all shipped content (`loops/`, `skills/`, `agents/`, `docs/`), not
just the loop file. The work it was forecast to do has two owners already:
the **manager** writes the brief at step 4 (it is the only role that has
spoken to the human and holds the constraint list), and **`git-ops`** commits
at step 7.

So authoring it would create a role whose entire job is a mechanical write
that another role must do anyway — and at `subagent_depth: 1` it could not
be delegated to by anything except the manager. That is structure without
benefit, and *"a role that does one mechanical write is exactly the kind of
thing that survives because nobody asked whether it should."*

**Sprint role count is six, not seven**, as TASK-0041 predicted from the
sequence side.

#### Step 4 — no name collisions
Checked against both clients' built-ins — OpenCode (`build`, `plan`,
`general`, `explore`, `scout`, `compaction`, `title`, `summary`) and Claude
Code (`Explore`, `Plan`, `general-purpose`, `claude`, `statusline-setup`,
`claude-code-guide`), case-insensitively. **All three clear.**

This matters more in OpenCode, where a markdown agent file's body *replaces*
a built-in's tuned system prompt wholesale rather than extending it.

#### Steps 6–7 — Phase 2's artifacts exercised for the first time

| Proof | Result |
|---|---|
| `validate.sh` on **real** agent content | **PASS** — first evidence TASK-0038's checks work on something other than a fixture |
| Registry **populates** | All three roles present; `_template` excluded by the central skip |
| Emission via `install.sh` | **6 files** — 3 roles × 2 clients |

#### Steps 8–9 — emitted output inspected per role per client

Read from the emitted files, not inferred from the sources:

| Role | OpenCode | Claude Code |
|---|---|---|
| `designer-manager` | `mode: primary`; `task: {"*": deny, critic: allow, git-ops: allow, ideator: allow}`; `external_directory: deny` | `tools: Agent(ideator, critic, git-ops)`; `isolation: worktree` |
| `ideator` | `mode: subagent`; `task: deny`; `external_directory: deny` | `disallowedTools: Agent`; `isolation: worktree` |
| `critic` | `mode: subagent`; `edit/write/task/webfetch/websearch/external_directory: deny` | `disallowedTools: Write, Edit, NotebookEdit, Agent, WebFetch, WebSearch`; `isolation: worktree` |

**`critic` is provably read-only in both clients — proved at runtime, not on
paper.** This was the brief's highest-consequence risk (*"a read-only
reviewer that can edit would pass every check this repo has"*).

- **Claude Code:** delegated to it and asked it to report its own tool list.
  Answer: **`WRITE=no EDIT=no AGENT=no`**. The tools are absent from its
  pool, so no prompt-compliance question arises — unlike TASK-0036's
  `cc-permonly` fixture, which *had* Write and merely declined to use it.
- **OpenCode:** `opencode agent list` resolved all three with the correct
  modes, and **all six** of `critic`'s denies are applied
  (`edit`, `write`, `task`, `webfetch`, `websearch`, `external_directory`),
  checked individually against the resolver's output.
- **`designer-manager`'s allowlist resolved deny-first**:
  `task */deny`, then `critic/allow`, `git-ops/allow`, `ideator/allow`.

#### Step 10 — no live config touched
`opencode.jsonc` mtime still **2026-08-24 23:48:09**, **no `agent` key**.

**Emitted file paths, for rollback** (untracked, outside the repo):
`~/.claude/agents/{critic,designer-manager,ideator}.md` and
`~/.config/opencode/agents/{critic,designer-manager,ideator}.md`.

- Actions:
  1. Read the landed loop (179 lines) and the design-flow skill's
     distinctness and critique-obligations references.
  2. Hit the step-2 gate; escalated; landed three follow-ups in
     definition→enforcement→emission order, each attributed to its owner.
  3. Declined `design-doc-writer` on grep evidence.
  4. Verified name collisions against both built-in lists.
  5. Authored three roles from the template — abstract profiles only, short
     descriptions, detail in the body, and **each body links** to the loop
     and skill rather than restating them.
  6. Ran the gate on real content; regenerated the registry; emitted.
  7. Inspected all six emitted files; proved `critic` read-only at runtime in
     both clients; verified `designer-manager`'s allowlist resolution.

- Observations:
  - **No role declares `model`.** Per ADR-0017's recorded gap: the
    `{tier:}` placeholder has no resolver in this repo, so declaring a tier
    would emit something no client understands.
  - **`git-ops` is in `designer-manager`'s `delegates_to` before it
    exists.** Deliberate: the allowlist is a *declaration of intent* and the
    loop already names it. `validate.sh` does not (and should not) check
    that a delegate exists — that would couple the gate to authoring order,
    and a role legitimately references roles authored later. **Recorded so
    it is not read as an oversight**, and it is exactly why the loop says
    step 7 cannot execute until TASK-0045 lands.
  - **`worktree-only` on all three** exercises the mapping TASK-0040 flagged
    as the weakest in the vocabulary — refusal (OpenCode) vs redirection into
    an isolated copy (Claude Code). Emitted as `isolation: worktree` per that
    decision, and worth watching first if these roles ever behave
    differently across clients.
  - **No Phase 2 defect was found** — the schema, gate, registry and emitter
    all handled real content correctly. What was found was a Phase 2
    *omission* (a missing vocabulary term), fixed in the owning tasks rather
    than patched from here.
  - **The bodies are longer than the frontmatter by design.** Claude Code
    warns when combined subagent *descriptions* exceed 15,000 tokens and
    advises moving detail into the prompt, which loads only when the
    subagent runs. Three descriptions of ~30 words are nowhere near it; the
    discipline is the point.

- Validation:
  - `bash tests/validate.sh` → **PASS** (`validate.sh: OK`, exit 0) on three
    real roles. Runtime 683/681/720 ms — still sub-second after the new
    checks.
  - `bash scripts/sync-registry.sh` → Agents section **populated** with
    `critic`, `designer-manager`, `ideator`; `_template` excluded.
  - `bash scripts/install.sh` → 6 agent files emitted, 0 refused, 0 skipped.
  - `critic` read-only **verified at runtime in both clients**.
  - `opencode.jsonc` unmodified; no `agent` key.
  - Five new gate rules each **observed failing**; two controls passing.

- Result: **done.** All twelve acceptance criteria met, including the two
  that were really Phase 2's proofs: the gate works on real content and the
  registry populates. **`agents/` now holds three real roles and the
  category is exercised end to end** — schema → gate → registry → emitter →
  inspected client output.

  Two deviations, both recorded above rather than absorbed: the capability
  vocabulary **needed a tenth term** (escalated, then fixed in the three
  owning tasks in ADR-0008's order), and **`design-doc-writer` was
  declined** on evidence, making the sprint's role count six.

  `PLAN-0004`'s "seven roles" is now **six**: three here, three in TASK-0045.
- Commit: recorded below
- Push: recorded below
