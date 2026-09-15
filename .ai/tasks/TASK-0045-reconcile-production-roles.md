# TASK-0045 — Author the three production roles in agents/

## Objective
Author `qa-test`, `review` and `git-ops` as `agents/<role>/agent.md` under
ADR-0018's one-source contract, **using the `agent-tiers` copies as
read-only reference**. Their permission boundaries are the real safety
control in the production loop and they already work; this task must
reproduce those boundaries in the abstract vocabulary without weakening
them.

> **RESCOPED 2026-09-15: author fresh, do not import.** This task was
> written as a *reconciliation* of files TASK-0035 would have imported into
> `skills/agent-tiers/`. **ADR-0017 is Rejected and TASK-0035 is
> cancelled** — `agent-tiers` stays with `opencode-customization` (human
> decision). So there is nothing in this repo to reconcile *with*, and the
> "one owner per role" problem this brief was built around **does not
> arise**.
>
> What changes: the three roles are **authored** here, not moved. The
> installed copy at `~/.config/opencode/skills/agent-tiers/agents/` is
> **reference material read as evidence**, never a source to copy from or
> modify — the same standing rule S6 applies to `SIGMA-infrastructure`.
>
> What does **not** change, and is the bulk of this brief: the boundaries
> that must survive translation, the per-role-per-client emission proof,
> and the `shell-runner` exclusion. Those were always the real work.

## Minimal context

### There is no reconciliation to do — and that is the point

The original premise was that `skills/agent-tiers/agents/*.md` would exist
in this repo after TASK-0035, creating two definitions of each role. **They
will not.** The skill stays where it is, so:

- **`agents/<role>/agent.md` is the sole definition of each role in this
  repo**, from the first commit. No removal step, no pointer step, no
  version bump in a skill this repo does not own.
- **`install-tiers.ps1` is not this task's concern.** The original brief
  warned against breaking it while reconciling; there is nothing to break,
  because this task touches no file in that repo.

**The two-owner question moves outward rather than disappearing.** After
this task, `git-ops` exists twice on this machine by different routes:
`install-tiers.ps1` writes it into a target project when someone runs
`/bmad`, and `scripts/install.sh` emits it into
`~/.config/opencode/agents/`. **Different scopes** — project-local versus
global — so they do not overwrite each other, and OpenCode resolves
project over global.

That is a **coexistence to document, not a defect to fix.** It cannot be
fixed from this repo anyway: the other copy belongs to another repo's
installer. What this task must do is **state it plainly** in the role's own
body or the config snapshot, so a reader who finds two `git-ops` files
knows why. A future divergence between them is `opencode-customization`'s
concern for its copy and this repo's for its own.

### Authoring from reference is not copying

The installed role files are OpenCode-native: `permission` blocks, glob
maps, `{tier:...}` model placeholders. ADR-0018 forbids **any** of that in
an `agent.md`. So even a direct import would have been a rewrite — the
files share a *purpose*, not a format.

Read them for three things and nothing else:
1. **The boundaries**, listed below, which TASK-0034 verified are fully
   expressible in the nine-term vocabulary.
2. **The system prompts**, which are genuinely portable prose and the one
   part that transfers close to verbatim (ADR-0018: the body is "the one
   part of a role that is genuinely portable").
3. **The role-splitting reasoning** — why `qa-test` reports failures rather
   than fixing them, why `review` cannot edit. That reasoning is the
   artifact's real value and is client-agnostic.

Do **not** carry over: `model: "{tier:...}"` (no resolver exists in this
repo — see ADR-0017's recorded gap; omit `model` entirely), `permission`
blocks, or any reference to `install-tiers.ps1`, `opencode.jsonc`, or that
repo's paths.

### The boundaries that must survive translation
From `bmad-workflow.md:48-53` and the role files:

- **`qa-test` edits test files only.** Enforced by an `edit` permission glob
  object, deny-first. It never fixes application code and never commits.
- **`review` is strictly read-only.** `edit`/`write` denied outright; bash
  restricted to `git diff/status/log/show`. It reports pass/blocked and
  **never fixes what it finds**.
- **`git-ops` may not force-push, hard-reset, or rebase.** `git push` is
  always `ask`, never `allow`.
- **No subagent invokes another** (`subagent_depth: 1`).

`qa-test`'s is the narrowest constraint in either sprint — a **glob-scoped
edit permission**, not a blanket allow or deny. TASK-0043's handover flags
this as the likely limit of ADR-0018's abstraction, and if the capability
vocabulary cannot express "edit, but only files matching a pattern", that is
a documented limitation rather than something to work around per client.

### The highest-consequence mapping error available
A `review` role emitted with edit rights. It would pass every check this
repo has — `validate.sh` validates the *source*, and the source would be
correct — while silently removing the property that makes its verdict
trustworthy. ADR-0018's consequences name this class; TASK-0043 proved the
pattern on `critic`. The same proof is required here, per role per client.

### The fourth role is deliberately excluded
`agent-tiers` also defines `shell-runner` (a fixed bash allowlist:
`ls/cat/cp/mv/mkdir/env/which/curl`, cheapest model tier). It is not part of
the production loop's gate sequence — `bmad-workflow.md:30-32` notes `build`
*"never invokes shell-runner directly in the BMAD topology — qa-test owns
test execution."*

So reconciling it is not required by `loops/project-build/`. Whether to
reconcile it anyway for completeness, or leave it as skill-only, is a scope
question this task should answer explicitly rather than leave ambiguous —
and leaving it skill-only is the defensible default, since a role nothing
references is structure without benefit.

### `plan` and `build` can never be reconciled
`agent-tiers`' `SKILL.md` documents why, with reasoning: `plan` and `build`
are OpenCode **built-in** names, and *"a markdown agent file's body becomes
that agent's system prompt — creating `agents/plan.md` would silently
replace OpenCode's tuned built-in `plan` prompt wholesale, not extend it."*
They are therefore inline config overrides (`model` + `permission` only),
never files.

**This is a hard constraint on the reconciliation**: two of the loop's six
steps are performed by agents that cannot exist as `agents/` components at
all. The loop must work with a role set that is partly files and partly
config overrides, and that asymmetry belongs in the record.

### Model tiers have an owner already
`models.jsonc` maps tier→model with every deviation commented — `git-ops`
is deliberately *not* on the cheapest tier because *"a hallucinated
`git reset --hard` or a malformed commit has real blast radius."*

ADR-0018 clause 7 requires the model-reference question settled: whether the
emitter reuses `models.jsonc` or supersedes it. TASK-0040 was told to
escalate if the ADR left it open. If it is still open when this task starts,
**stop** — reconciling roles whose model assignment has two possible owners
is how the second owner appears.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `~/.config/opencode/skills/agent-tiers/agents/{git-ops,shell-runner,qa-test,review}.md` | `opencode-customization` | **READ-ONLY REFERENCE, outside this repo.** OpenCode-native; the four role definitions with their permission boundaries and system prompts. Verified by TASK-0034 to contain **zero** cross-repo citations, so the prose transfers cleanly |
| `~/.config/opencode/skills/agent-tiers/templates/bmad/bmad-workflow.md` | same | **READ-ONLY REFERENCE.** 53 lines, verified readable in place by TASK-0034. `:48-53` the hard rules; `:30-32` the shell-runner note |
| ~~`skills/agent-tiers/models.jsonc`~~ | — | **Not available and not needed.** Stays in `opencode-customization` (ADR-0017 rejected). Roles authored here **omit `model`** — there is no tier resolver in this repo. See ADR-0017's recorded gap |
| ~~`skills/agent-tiers/install-tiers.ps1`~~ | — | **Out of scope entirely.** This task touches no file in that repo, so there is nothing to avoid breaking |
| `.ai/decisions/0017-ai-toolbox-owns-agent-tiers.md` | TASK-0034 | **Rejected** 2026-09-15. Read its "one gap this creates" section before deciding anything about `model` |
| `loops/project-build/loop.md` | TASK-0044 | `done`; names which role performs each step |
| `.ai/decisions/0018-agent-portability-one-source-per-client-emission.md` | TASK-0033/0036 | Accepted; clause 7 on model references is **settled** — the emitter emits `{tier:<name>}` and never resolves it (TASK-0040), and the owning file is in another repo |
| `agents/designer-manager/agent.md` and siblings | TASK-0043 | `done`; the format precedent and the per-role emission proof pattern |
| `.ai/tasks/TASK-0043-author-design-roles.md` | TASK-0043 | `done`; its handover records any vocabulary limitation already hit |
| `docs/development/authoring-guide.md` | TASK-0037 | The capability vocabulary — the authority for whether a glob-scoped edit is expressible |

**Verify the expected state; don't assume it.** Two hard gates: confirm
ADR-0018 clause 7's model-reference question is **settled**, and read
TASK-0043's handover for any vocabulary limitation it already found. If
`qa-test`'s glob-scoped edit is already known unexpressible, this task's
scope changes before it starts.

## Scope

### Included
- `agents/qa-test/agent.md`, `agents/review/agent.md`,
  `agents/git-ops/agent.md` in the client-agnostic format.
- Preservation of all three boundaries, verified in the **emitted** output
  per client, not in the source.
- **A decision on ownership**: whether the skill's copies are removed,
  reduced to pointers, or retained — with reasoning, and without breaking
  `install-tiers.ps1`.
- **A decision on `shell-runner`**: reconcile or leave skill-only, with
  reasoning.
- A recorded statement that `plan` and `build` **cannot** be `agents/`
  components, and how `loops/project-build/` accommodates a mixed role set.
- Per-role per-client emission proof, with `review`'s read-only property and
  `qa-test`'s glob-scoped edit specifically demonstrated.

### Not included
- **Redesigning any boundary.** They work. Translation only.
- **Reconciling `plan` or `build`.** Structurally impossible; recorded, not
  attempted.
- **Changing `models.jsonc`'s content.** If TASK-0034 found a stale ID, it is
  inherited debt with a backlog item, not fixed here.
- **Running the loop.** TASK-0046.
- **Applying any topology to a live `opencode.jsonc`.** Out of S7's scope.
- **Fixing a Phase 2 defect.** Record it and attribute it to its owning task.
- Any client-native permission syntax in a source file.

## Likely files
- `agents/qa-test/agent.md`, `agents/review/agent.md`,
  `agents/git-ops/agent.md`
- `agents/shell-runner/agent.md` — conditional on the scope decision
- `configs/opencode/README.md` — likely: the project-vs-global coexistence
  of `git-ops` (this repo's emitted copy alongside `install-tiers.ps1`'s
  project-local one) belongs in a wiring snapshot, not only in a task log
- `docs/registry.md` — regenerated
- **Nothing under `skills/agent-tiers/`** — it does not exist in this repo
  and must not be created. **Nothing in `opencode-customization`** — that
  repo is read as evidence and never modified (ADR-0017)
- `.ai/tasks/TASK-0045-reconcile-production-roles.md` — this file

## Execution plan
1. Confirm ADR-0018 clause 7 is settled and read TASK-0043's handover for
   known vocabulary limits. **Stop and escalate on either gap.**
2. Read the three role files and `bmad-workflow.md:48-53`; enumerate each
   boundary precisely, including `qa-test`'s glob pattern.
3. Check each boundary against the capability vocabulary. **`qa-test`'s
   glob-scoped edit is the test case** — if it is unexpressible, record it
   as a limitation of ADR-0018's abstraction and escalate before proceeding.
4. Decide the ownership question; record the reasoning. Verify
   `install-tiers.ps1` still works under the chosen option.
5. Decide the `shell-runner` question; record the reasoning.
6. Author the three (or four) roles from `agents/_template/agent.md`.
7. `bash tests/validate.sh`.
8. `bash scripts/sync-registry.sh`; confirm the Agents section carries both
   the design and production roles.
9. `bash scripts/install.sh`; **read every emitted file**. Per role per
   client, confirm the client-native permissions match the boundary's
   intent. Record individually.
10. Specifically demonstrate: `review` cannot edit or write in either
    client; `qa-test` can edit test files and **cannot** edit application
    code; `git-ops` cannot force-push, hard-reset or rebase, and `git push`
    is `ask`.
11. Confirm no `agent` key was added to any `opencode.jsonc`.
12. Record how `loops/project-build/` handles `plan`/`build` being config
    overrides rather than components.
13. Review the diff; commit; record the hash; push; confirm; record.

## Acceptance criteria
- [ ] All three boundaries preserved, **verified in emitted output** per
      client rather than in the source
- [ ] **`review` demonstrably cannot edit or write** in either client
- [ ] **`qa-test`'s test-files-only edit demonstrated in both directions**:
      a test file editable, an application file not
- [ ] **`git-ops` demonstrably cannot force-push, hard-reset or rebase**,
      and `git push` resolves to `ask`
- [ ] The ownership question **decided with reasoning**; exactly one owner
      per role afterwards; `install-tiers.ps1` still functional
- [ ] The `shell-runner` question decided with reasoning
- [ ] It is recorded that `plan`/`build` cannot be `agents/` components, and
      how the loop accommodates a mixed role set
- [ ] No client-native permission syntax in any source file
- [ ] If `qa-test`'s glob-scoped edit is unexpressible, it is **recorded as
      a documented limitation** of ADR-0018 and escalated — not worked
      around per client
- [ ] No `agent` key added to any `opencode.jsonc`
- [ ] `tests/validate.sh` green; registry regenerated and committed

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — **required**

## Risks and rollback
- **Risk: `review` emitted with edit rights.** The highest-consequence error
  available in this sprint. It passes every check, because the gate
  validates the source and the source would be correct, while removing the
  only property that makes a review verdict worth anything. Step 10, and the
  criterion says *demonstrably*.
- **Risk: `qa-test`'s glob-scoped edit is unexpressible.** The narrowest
  boundary in either sprint and the real test of ADR-0018's abstraction. The
  wrong response is a per-client workaround, which defeats one-source. The
  right response is a recorded limitation and an escalation — and possibly a
  vocabulary extension as its own task.
- **Risk: two owners for a role.** The named failure mode. Both the skill
  and `agents/` could plausibly keep their copies, and nothing would break
  immediately — which is exactly how drift starts. `agent-tiers` arrived in
  this sprint *because* it had drifted while unowned; reconciling it into a
  second unowned pair would be the same mistake inside one sprint.
- **Risk: breaking `install-tiers.ps1`.** It copies the role files into a
  target project. Removing them without adjusting it turns a working
  installer into a broken one, and it is the skill's main deliverable.
- **Risk: silently fixing a stale model ID.** If TASK-0034 found one, fixing
  it here bundles an unrelated change and hides inherited debt. Backlog item.
- **Risk: forgetting the `plan`/`build` asymmetry.** Two of six loop steps
  are performed by agents that cannot be components. A reader who assumes a
  uniform role set will look for `agents/plan/` and, worse, may create it —
  silently replacing an OpenCode built-in's system prompt.
- **Rollback:** repo changes revert in one commit. **Emitted files do not** —
  record their paths. If the ownership decision removed the skill's copies,
  a revert restores them, but any target project already installed from the
  new state is outside this repo's reach.

## Outputs / handover

**Intended end state — this task has not run.** The table below is a plan.
`validate.sh` requires this section non-empty for briefs ≥ 0020 and cannot
distinguish an intention from a state (ADR-0012 Decision 3), so this
sentence does it.

| Artifact | Intended end state |
|----------|-------------------|
| `agents/qa-test/`, `agents/review/`, `agents/git-ops/` | Client-agnostic sources; all three boundaries preserved and **proven in emitted output** per client |
| `agents/shell-runner/` | Present or deliberately absent, with reasoning |
| `skills/agent-tiers/` | **Does not exist in this repo and must not.** `agent-tiers` stays with `opencode-customization` (ADR-0017 rejected). `agents/<role>/agent.md` is the sole definition here from the first commit |
| The project-vs-global `git-ops` coexistence | **Documented**, not fixed: `install-tiers.ps1` writes a project-local copy, `install.sh` emits a global one, OpenCode resolves project over global. Unfixable from this repo; a reader finding two files must be able to learn why |
| The `plan`/`build` asymmetry | Recorded: two loop steps are config overrides, not components, and creating `agents/plan/` would clobber an OpenCode built-in |
| ADR-0018's abstraction | Tested against its narrowest case (`qa-test`'s glob-scoped edit); any limitation documented and escalated |
| `docs/registry.md` | Regenerated; Agents section carries both design and production roles |
| Any `opencode.jsonc` | **Unchanged.** No `agent` key; the topology stays unapplied |

**Next task starts here**: both loops exist, all roles are authored under one
contract with one owner each, and Phase 2's plumbing has been exercised by
two independent task sets. TASK-0046 can run the pilot end to end.

Deviation to watch for: **`git-ops` and `shell-runner` are OpenCode-only
roles** (ADR-0018 clause 8.3, measured in TASK-0036 — a command allowlist
has no per-agent Claude Code expression). So `agents/git-ops/agent.md` must
declare `clients: [opencode]`, and the emitter will **refuse loudly** if it
declares `claude-code`. That refusal is correct behaviour, not a bug to work
around — narrow the `clients` list, never soften the emitter.

Second: if `shell-runner` is authored after all, `PLAN-0004`'s role count
grows. Note it is **also** OpenCode-only, for the same reason.

Third: `loops/design-brief/loop.md` delegates its step-7 commit to
`git-ops`, so that role is a **Phase 3 dependency too**, not only Phase 4.
Until this task lands, the design loop cannot be executed end to end — an
ordering fact already recorded in TASK-0041's log.

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
